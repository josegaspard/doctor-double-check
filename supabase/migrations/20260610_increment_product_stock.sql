-- 2026-06-10 — RPC para restaurar stock (contraparte de decrement_product_stock).
-- Usada cuando una compra falla DESPUÉS de decrementar (se reembolsa y se repone).
-- Sólo repone cuando el producto controla stock (track_stock=true).
create or replace function public.increment_product_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketplace_products
    set stock = coalesce(stock, 0) + p_qty, updated_at = now()
    where id = p_product_id and track_stock = true;
  return found;
end;
$$;
grant execute on function public.increment_product_stock(uuid, integer) to authenticated, service_role;
