// Invitación pendiente de un paciente (13-sep-2026).
//
// Flujo: el médico comparte `/app?invitacion=<token>`. La página de aterrizaje
// (RoleSelector) guarda el token en localStorage y enseña «Te invitó …». Tras
// iniciar sesión o registrarse, este hook —montado UNA vez en el layout— pide
// la confirmación del paciente y llama a `accept_patient_invite`, que crea la
// relación real con el médico (seguimiento gratuito).
//
// Vincularse comparte nombre y foto con el médico: por eso hay revisión
// (useConfirmAction) antes de aceptar. «Ahora no» descarta el token; el enlace
// se puede volver a abrir.
//
// Sin la migración 20260913d el RPC no existe: el token se ignora y se borra,
// sin avisos ni errores en pantalla.
import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';
import { fill } from '@/lib/proFormat';

const sb = supabase as any;
const STORAGE_KEY = 'mm_patient_invite';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const INVITE_QUERY_PARAM = 'invitacion';
export const INVITE_TOKEN_RE = /^[A-Za-z0-9]{32,128}$/;

export function storeInviteToken(token: string) {
  if (!INVITE_TOKEN_RE.test(token)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, savedAt: Date.now() }));
  } catch {
    /* almacenamiento bloqueado: el flujo sigue sin recordar el enlace */
  }
}

export function readStoredInviteToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const expired = typeof v?.savedAt === 'number' && Date.now() - v.savedAt > MAX_AGE_MS;
    if (!v || typeof v.token !== 'string' || !INVITE_TOKEN_RE.test(v.token) || expired) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return v.token;
  } catch {
    return null;
  }
}

export function clearStoredInviteToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada que borrar */
  }
}

export function readInviteTokenFromSearch(search: string): string | null {
  try {
    const token = (new URLSearchParams(search).get(INVITE_QUERY_PARAM) || '').trim();
    return INVITE_TOKEN_RE.test(token) ? token : null;
  } catch {
    return null;
  }
}

export type InvitePreviewStatus = 'pending' | 'sent' | 'accepted' | 'revoked' | 'not_found' | 'unavailable';

export interface InvitePreview {
  status: InvitePreviewStatus;
  doctorId: string | null;
  doctorName: string | null;
  doctorSpecialty: string | null;
  doctorAvatarUrl: string | null;
}

export const isInviteUsable = (p: InvitePreview | null) => !!p && (p.status === 'pending' || p.status === 'sent');

/** Vista previa pública del enlace: solo datos del médico. `missing` = migración sin aplicar. */
export async function fetchInvitePreview(
  token: string,
): Promise<{ preview: InvitePreview | null; missing: boolean; failed: boolean }> {
  const { data, error } = await sb.rpc('get_patient_invite', { p_token: token });
  if (error) {
    if (isMissingDbObject(error)) return { preview: null, missing: true, failed: false };
    console.warn('[invitación] get_patient_invite', error);
    return { preview: null, missing: false, failed: true };
  }
  return {
    preview: {
      status: (data?.status || 'not_found') as InvitePreviewStatus,
      doctorId: data?.doctor_id ?? null,
      doctorName: data?.doctor_name ?? null,
      doctorSpecialty: data?.doctor_specialty ?? null,
      doctorAvatarUrl: data?.doctor_avatar_url ?? null,
    },
    missing: false,
    failed: false,
  };
}

// Un solo flujo a la vez aunque el layout se desmonte y vuelva a montar al navegar.
let inFlight = false;

export function usePendingPatientInvite(): { dialog: React.ReactNode } {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const mounted = useRef(true);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user?.id || !role || role === 'visitor') return;
    const fromUrl = readInviteTokenFromSearch(window.location.search);
    if (fromUrl) storeInviteToken(fromUrl);
    const token = fromUrl || readStoredInviteToken();
    if (!token || inFlight) return;
    inFlight = true;
    const tr = (k: string) => tRef.current(k);

    (async () => {
      try {
        const { preview, missing, failed } = await fetchInvitePreview(token);
        if (missing) {
          clearStoredInviteToken();
          return;
        }
        if (failed || !preview) return; // red: se reintenta en la próxima página
        if (preview.status === 'not_found' || preview.status === 'revoked' || preview.status === 'unavailable') {
          clearStoredInviteToken();
          toast.info(tr('mm2.importar.accept.gone'));
          return;
        }
        if (preview.doctorId && preview.doctorId === user.id) {
          clearStoredInviteToken();
          toast.info(tr('mm2.importar.accept.own'));
          return;
        }
        if (role !== 'patient') {
          clearStoredInviteToken();
          toast.info(tr('mm2.importar.accept.notPatient'));
          return;
        }

        const doctorName = preview.doctorName || tr('mm2.importar.accept.doctorFallback');
        if (preview.status !== 'accepted') {
          if (!mounted.current) return;
          const ok = await confirm({
            title: fill(tr('mm2.importar.accept.title'), { doctor: doctorName }),
            description: tr('mm2.importar.accept.desc'),
            details: [
              { label: tr('mm2.importar.accept.doctor'), value: doctorName },
              ...(preview.doctorSpecialty
                ? [{ label: tr('mm2.importar.accept.specialty'), value: preview.doctorSpecialty }]
                : []),
              { label: tr('mm2.importar.accept.plan'), value: tr('mm2.importar.accept.planValue') },
              { label: tr('mm2.importar.accept.notices'), value: tr('mm2.importar.accept.noticesValue') },
            ],
            confirmLabel: tr('mm2.importar.accept.confirm'),
            cancelLabel: tr('mm2.importar.accept.cancel'),
          });
          // Desmontado con el modal abierto (navegación): no se decidió nada.
          if (!mounted.current) return;
          if (!ok) {
            clearStoredInviteToken();
            toast.info(tr('mm2.importar.accept.later'));
            return;
          }
        }

        const { data, error } = await sb.rpc('accept_patient_invite', { p_token: token });
        if (error) {
          if (isMissingDbObject(error)) {
            clearStoredInviteToken();
            return;
          }
          console.error('[invitación] accept_patient_invite', error);
          toast.error(tr('mm2.importar.accept.error'));
          return; // se conserva el token para reintentar
        }
        clearStoredInviteToken();
        const reason = String(data?.reason || '');
        const doctor = data?.doctor_name || doctorName;
        if (data?.ok && reason === 'accepted') toast.success(fill(tr('mm2.importar.accept.done'), { doctor }));
        else if (data?.ok) toast.success(fill(tr('mm2.importar.accept.already'), { doctor }));
        else if (reason === 'own_invite') toast.info(tr('mm2.importar.accept.own'));
        else if (reason === 'not_patient') toast.info(tr('mm2.importar.accept.notPatient'));
        else toast.info(tr('mm2.importar.accept.gone'));
      } finally {
        inFlight = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, role, user?.id]);

  return { dialog };
}

/** Atajo para montarlo con una línea: `<PendingPatientInvite />`. */
export function PendingPatientInvite() {
  const { dialog } = usePendingPatientInvite();
  return React.createElement(React.Fragment, null, dialog);
}

export default usePendingPatientInvite;
