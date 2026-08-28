import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppBackgroundMode = 'image' | 'white';

export interface SiteToggles {
  show_news_section: boolean;
  show_content_medical: boolean;
  app_background: AppBackgroundMode;
  // Funciones activables/desactivables desde el admin (estilo "publicidad").
  // Por defecto DESACTIVADAS (2026-06-02, petición del cliente).
  enable_patient_chat: boolean;
  enable_prescriptions: boolean;
  enable_video_calls: boolean;
  // Kill-switches de secciones completas (2026-06-11). Por defecto ACTIVADAS
  // (la sección está visible hoy); el admin puede ocultar cada una con 1 switch.
  enable_marketplace: boolean;
  enable_lives: boolean;
  enable_events: boolean;
  enable_vault: boolean;
  enable_recordings: boolean;
  enable_ads: boolean;
  // Cierra el REGISTRO a residentes en México (2026-08-03, petición del cliente).
  // APAGADO por defecto: la plataforma nació mundial (9 idiomas, filtros por país
  // y continente), así que el candado solo se activa si el cliente lo confirma.
  // Ojo: es distinto de la restricción de CONSULTAS solo-MX, que ya existe desde
  // 2026-06-29 en src/lib/consultationRegions.ts y sigue independiente de esto.
  restrict_signup_to_mexico: boolean;
  // Abre el acceso de PACIENTES (2026-08-17, petición del cliente). APAGADO por
  // defecto: hoy la plataforma es sólo para médicos y residentes y los pacientes
  // ven "próximamente". Encenderlo aquí abre registro y login de pacientes sin
  // desplegar nada. El candado de verdad está en la base (handle_new_user +
  // política de user_roles), así que apagarlo bloquea también la API directa.
  enable_patient_access: boolean;
  // QUIÉN PUEDE HACER LIVE (2026-08-28, petición del cliente). El cliente cambió
  // de idea sobre los lives de residentes, así que el permiso es un interruptor
  // por rol y no código: se enciende y se apaga desde Ajustes del sitio.
  // El candado de verdad está en la base (políticas de INSERT sobre `lives`),
  // así que apagarlo cierra también la API directa.
  enable_lives_doctors: boolean;
  enable_lives_residents: boolean;
  enable_lives_patients: boolean;
  // Reseñas con estrellas de contenido y lives (2026-08-28).
  enable_content_ratings: boolean;
  // Bloquea el registro desde VPN/proxy/datacenter (2026-08-28). APAGADO por
  // defecto: primero se mira el registro de veredictos, luego se cierra.
  block_vpn_signup: boolean;
}

const DEFAULT_TOGGLES: SiteToggles = {
  show_news_section: false,
  show_content_medical: false,
  app_background: 'image',
  enable_patient_chat: false,
  enable_prescriptions: false,
  enable_video_calls: false,
  enable_marketplace: true,
  enable_lives: true,
  enable_events: true,
  enable_vault: true,
  enable_recordings: true,
  enable_ads: true,
  restrict_signup_to_mexico: false,
  enable_patient_access: false,
  enable_lives_doctors: true,
  enable_lives_residents: false,
  enable_lives_patients: false,
  enable_content_ratings: true,
  block_vpn_signup: false,
};

let cachedToggles: SiteToggles | null = null;
const listeners = new Set<(t: SiteToggles) => void>();
let realtimeStarted = false;

function notify(t: SiteToggles) {
  cachedToggles = t;
  listeners.forEach((cb) => cb(t));
}

async function fetchToggles(): Promise<SiteToggles> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', 'feature_toggles')
      .maybeSingle();

    if (data?.value && !error) {
      cachedToggles = { ...DEFAULT_TOGGLES, ...(data.value as unknown as Partial<SiteToggles>) };
    } else {
      cachedToggles = DEFAULT_TOGGLES;
    }
  } catch {
    cachedToggles = DEFAULT_TOGGLES;
  }
  return cachedToggles;
}

// Subscribe once to live changes so a toggle saved by an admin propagates to
// every open session without a full page reload.
function startRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  try {
    supabase
      .channel('site_settings_feature_toggles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'id=eq.feature_toggles' },
        async () => { notify(await fetchToggles()); }
      )
      .subscribe();
  } catch {
    realtimeStarted = false;
  }
}

export function useSiteToggles() {
  const [toggles, setToggles] = useState<SiteToggles>(cachedToggles || DEFAULT_TOGGLES);
  const [isLoading, setIsLoading] = useState(!cachedToggles);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const cb = (t: SiteToggles) => { if (mounted.current) { setToggles(t); setIsLoading(false); } };
    listeners.add(cb);
    startRealtime();
    // Always revalidate on mount (cache shown immediately, then refreshed).
    fetchToggles().then((t) => cb(t));
    return () => { mounted.current = false; listeners.delete(cb); };
  }, []);

  return { toggles, isLoading };
}

// For admin: save toggles
export async function saveSiteToggles(toggles: SiteToggles, updatedBy?: string) {
  const { error } = await supabase
    .from('site_settings')
    .upsert({
      id: 'feature_toggles',
      value: toggles as any,
      updated_by: updatedBy,
    });

  if (!error) {
    notify(toggles); // propagate immediately to all live subscribers
  }
  return { error };
}
