-- Últimos puntos del QA 2026-10-03.
--
-- 1. process_wallet_purchase (cargo genérico con saldo) aceptaba cualquier importe con
--    metadata.type content, recording, subscription o cualquier otro. Llamadas legítimas
--    (todas con el token del usuario, porque la función exige auth.uid()):
--      · purchase-content-wallet      → {content_id}                 precio = doctor_content.price
--      · purchase-recording-wallet    → {recording_id}               precio = recordings.price
--      · purchase-marketplace-wallet  → {source:'marketplace', product_id, quantity}
--                                       precio = marketplace_products.price × quantity
--      · web, LiveChat                → {type:'live_chat_highlight', live_id} precio = lives.chat_price
--    Ahora el importe se valida contra el precio de la BD en cada uno (se admite también
--    metadata.type 'content' / 'recording' / 'marketplace' junto a su id) y cualquier otro
--    cargo se rechaza ('Unsupported purchase type'). El destacado exige además que el live
--    exista (antes, un live_id inexistente cobraba el importe que mandara el cliente).
--    Se redefine desde la versión VIVA (pg_get_functiondef del 3-oct, migración 20261003c).
--
-- 2. ad_campaigns: el anunciante podía crear la campaña en 'active' y cambiar su status.
--    Flujo real: la web crea en 'draft' → create-ad-checkout (service role) la pasa a
--    'pending_payment' → stripe-webhook (service role) a 'pending_review' → el admin la
--    aprueba ('active'), rechaza o pausa. Trigger: quien no es admin/servicio crea siempre
--    en 'draft' (forzar 'pending_review' permitiría saltarse el pago) y no cambia status.
--    Importes: la web fija budget (y target_impressions/target_clicks estimados) al crear,
--    antes de pagar, así que en INSERT se aceptan; spent empieza siempre en 0. Después el
--    anunciante no cambia budget, spent, target_impressions ni target_clicks.
--
-- 3. doctor_content: lo aprobado vuelve a 'pending' si cambia cualquier campo público:
--    precio y archivo (ya estaba) + title, description, type, thumbnail_url, category,
--    original_price, is_book e is_masterclass, y masterclass_sessions si el contenido es
--    público. No cuentan is_public (publicar/ocultar, el único cambio que hace hoy la web)
--    ni audience_type.
--
-- Idempotente (CREATE OR REPLACE, DROP TRIGGER IF EXISTS).

CREATE OR REPLACE FUNCTION public.process_wallet_purchase(p_amount numeric, p_description text, p_metadata jsonb DEFAULT NULL::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_prev numeric;
  v_live_doctor uuid;
  v_live_price numeric;
  v_live_status text;
  v_live_txt text;
  v_purchase_id uuid;
  v_type text := coalesce(p_metadata->>'type', '');
  v_ref text;
  v_price numeric;
  v_ok boolean;
  v_owner uuid;
  v_qty int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  -- Segunda opinión y consultas tienen RPC propia que toma el precio del servidor
  -- (process_double_check_purchase / process_consultation_purchase). Por aquí se
  -- podían cobrar con cualquier importe: se rechazan (2026-10-03, cierre QA).
  if v_type in ('double_check', 'consultation', 'live_consultation') then
    return jsonb_build_object('success', false, 'error', 'Use the dedicated purchase flow');
  end if;

  -- Lock primero (serializa por usuario).
  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

  -- Replay idempotente: misma key ya cobrada → devolver sin volver a cobrar.
  if p_idempotency_key is not null then
    select abs(amount) into v_prev from wallet_transactions
      where user_id = v_user_id and type = 'purchase'
        and metadata->>'idempotency_key' = p_idempotency_key
      limit 1;
    if found then
      return jsonb_build_object('success', true, 'amount_charged', v_prev,
                                'new_balance', v_current_balance, 'idempotent_replay', true);
    end if;
  end if;

  -- Mensaje destacado de un live: el médico y el precio se toman del live (no del cliente).
  if v_type = 'live_chat_highlight' then
    v_live_txt := p_metadata->>'live_id';
    if v_live_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select doctor_id, chat_price, status::text into v_live_doctor, v_live_price, v_live_status from lives where id = v_live_txt::uuid;
    end if;
    if v_live_status is null then
      return jsonb_build_object('success', false, 'error', 'Live not found');
    end if;
    if v_live_status is distinct from 'live' then
      return jsonb_build_object('success', false, 'error', 'Live is not active');
    end if;
    if coalesce(v_live_price, 0) <= 0 or round(p_amount, 2) <> round(v_live_price, 2) then
      return jsonb_build_object('success', false, 'error', 'Price changed', 'price', coalesce(v_live_price, 0));
    end if;
    if v_live_doctor = v_user_id then v_live_doctor := null; end if;

  -- Libro/curso (purchase-content-wallet): precio de doctor_content, aprobado y ajeno.
  elsif v_type in ('', 'content') and p_metadata ? 'content_id' then
    v_ref := p_metadata->>'content_id';
    if v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select price, moderation_status::text = 'approved', creator_id into v_price, v_ok, v_owner
        from doctor_content where id = v_ref::uuid;
    end if;
    if not coalesce(v_ok, false) or coalesce(v_price, 0) <= 0 then
      return jsonb_build_object('success', false, 'error', 'Content not available');
    end if;
    if v_owner = v_user_id then
      return jsonb_build_object('success', false, 'error', 'You cannot purchase your own content');
    end if;
    if round(p_amount, 2) <> round(v_price, 2) then
      return jsonb_build_object('success', false, 'error', 'Price changed', 'price', v_price);
    end if;

  -- Grabación (purchase-recording-wallet): precio de recordings.
  elsif v_type in ('', 'recording') and p_metadata ? 'recording_id' then
    v_ref := p_metadata->>'recording_id';
    if v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select price into v_price from recordings where id = v_ref::uuid;
    end if;
    if coalesce(v_price, 0) <= 0 then
      return jsonb_build_object('success', false, 'error', 'Recording not available');
    end if;
    if round(p_amount, 2) <> round(v_price, 2) then
      return jsonb_build_object('success', false, 'error', 'Price changed', 'price', v_price);
    end if;

  -- Marketplace (purchase-marketplace-wallet): precio del producto activo × cantidad.
  elsif v_type in ('', 'marketplace') and coalesce(p_metadata->>'source', '') = 'marketplace' then
    v_ref := p_metadata->>'product_id';
    if coalesce(p_metadata->>'quantity', '1') ~ '^[0-9]{1,6}$' then
      v_qty := coalesce(p_metadata->>'quantity', '1')::int;
    end if;
    if v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select price, is_active into v_price, v_ok from marketplace_products where id = v_ref::uuid;
    end if;
    if not coalesce(v_ok, false) or coalesce(v_price, 0) <= 0 or coalesce(v_qty, 0) < 1 then
      return jsonb_build_object('success', false, 'error', 'Product not available');
    end if;
    if round(p_amount, 2) <> round(v_price * v_qty, 2) then
      return jsonb_build_object('success', false, 'error', 'Price changed', 'price', v_price);
    end if;

  -- Cualquier otro cargo (subscription, storage_upgrade, sin metadata…) no tiene un precio
  -- del servidor contra el que validar: se rechaza (2026-10-03, últimos QA).
  else
    return jsonb_build_object('success', false, 'error', 'Unsupported purchase type');
  end if;

  -- El marketplace (vendor externo) se cobra al precio REAL: sin descuento de residente,
  -- así lo cobrado == lo acreditado al vendor. El resto de compras conserva el descuento.
  if coalesce(p_metadata->>'source', '') = 'marketplace' then
    v_final_amount := p_amount;
  else
    v_final_amount := get_price_for_user(p_amount, v_user_id);
  end if;

  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
          case when p_idempotency_key is null then p_metadata
               else coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idempotency_key', p_idempotency_key) end
          || case when v_live_doctor is not null then jsonb_build_object('doctor_id', v_live_doctor) else '{}'::jsonb end)
  returning id into v_purchase_id;

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;

  -- Ganancia del médico por el mensaje destacado: neto con la comisión 'live_chat_highlight',
  -- igual que con tarjeta; el earning (bruto, con comprador y concepto) alimenta doctor_sales.
  if v_live_doctor is not null then
    perform public.credit_doctor_earnings(v_live_doctor, v_final_amount, 'live_chat_highlight');
    insert into wallet_transactions (user_id, type, amount, description, status, metadata)
    values (v_live_doctor, 'earning', v_final_amount, 'Ganancia por mensaje destacado en live', 'paid',
            jsonb_build_object('source', 'live_chat_highlight', 'reference_id', v_live_txt,
                               'buyer_id', v_user_id, 'purchase_txn_id', v_purchase_id,
                               'concept', 'Mensaje destacado en transmisión en vivo'));
  end if;
  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$function$;

-- 2. Campañas de anuncios: estado inicial, status e importes solo para admin/servicio.
CREATE OR REPLACE FUNCTION public.fn_guard_ad_campaign_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Admin, service_role (create-ad-checkout, stripe-webhook) y procesos internos: libres.
  if public.is_privileged_writer() then return new; end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.spent  := 0;
    return new;
  end if;

  new.status             := old.status;
  new.budget             := old.budget;
  new.spent              := old.spent;
  new.target_impressions := old.target_impressions;
  new.target_clicks      := old.target_clicks;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_guard_ad_campaign_status ON public.ad_campaigns;
CREATE TRIGGER trg_guard_ad_campaign_status
  BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_ad_campaign_status();

-- 3. Re-moderación de doctor_content con todos los campos públicos.
CREATE OR REPLACE FUNCTION public.fn_guard_content_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Admin, service_role y procesos internos moderan libremente.
  if public.is_privileged_writer() then return new; end if;

  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_note   := null;
    new.moderated_by      := null;
    new.moderated_at      := null;
    return new;
  end if;

  new.moderation_status := old.moderation_status;
  new.moderation_note   := old.moderation_note;
  new.moderated_by      := old.moderated_by;
  new.moderated_at      := old.moderated_at;

  -- Lo aprobado que cambia algo que ve el público (precio, archivo, título, texto,
  -- tipo, portada, categoría, precio tachado, formato libro, masterclass o, si es
  -- público, sus sesiones) vuelve a revisión.
  if old.moderation_status = 'approved'
     and (new.price is distinct from old.price or new.file_url is distinct from old.file_url
          or new.title is distinct from old.title or new.description is distinct from old.description
          or new.type is distinct from old.type or new.thumbnail_url is distinct from old.thumbnail_url
          or new.category is distinct from old.category or new.original_price is distinct from old.original_price
          or new.is_book is distinct from old.is_book
          or new.is_masterclass is distinct from old.is_masterclass
          or (coalesce(new.is_public, true)
              and new.masterclass_sessions is distinct from old.masterclass_sessions)) then
    new.moderation_status := 'pending';
    new.moderated_by      := null;
    new.moderated_at      := null;
  end if;
  return new;
end;
$function$;
