import { useEffect, useState } from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';

/**
 * Candado de registro por país (cliente 2026-08-03).
 *
 * Solo actúa si el súper admin enciende `restrict_signup_to_mexico`. Mientras esté
 * apagado —que es el default— este hook no llama a nada y el registro sigue abierto
 * al mundo, como nació la plataforma (9 idiomas, filtros por país y continente).
 *
 * El país sale de /api/geo (edge de Vercel, por IP). NO se usa navigator.language:
 * eso es el idioma del navegador, no la ubicación, y dejaría fuera a cualquier
 * mexicano que tenga el teléfono en inglés.
 *
 * Regla de seguridad: si no se puede determinar el país, se DEJA PASAR. Un fallo de
 * red nunca debe impedir que alguien se registre; es un candado comercial, no de
 * seguridad. La restricción de CONSULTAS solo-MX (consultationRegions.ts) sigue
 * aparte y usa el mismo criterio.
 */
const ALLOWED_SIGNUP_COUNTRIES = ['MX'];

// En la app nativa el origen es https://localhost, así que una ruta relativa no
// llegaría al edge de Vercel: ahí sí hace falta la URL absoluta.
function geoEndpoint(): string {
  if (typeof window === 'undefined') return '/api/geo';
  const host = window.location.hostname;
  const isNativeShell = host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'capacitor:';
  return isNativeShell ? 'https://medical-masters.com/api/geo' : '/api/geo';
}

export interface SignupCountryGate {
  /** true = hay que bloquear el registro de esta persona */
  blocked: boolean;
  /** ISO-2 detectado, o null si no se pudo determinar */
  country: string | null;
  /** true mientras se consulta el país (para no habilitar el botón antes de tiempo) */
  checking: boolean;
  /** true si el candado está encendido en el admin */
  enabled: boolean;
}

export function useSignupCountryGate(): SignupCountryGate {
  const { toggles } = useSiteToggles();
  const enabled = toggles.restrict_signup_to_mexico === true;

  const [country, setCountry] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCountry(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    // Timeout corto: si el edge no responde rápido, se deja pasar.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    fetch(geoEndpoint(), { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setCountry(data?.country ?? null);
      })
      .catch(() => {
        if (!cancelled) setCountry(null);
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled]);

  const blocked = enabled && country !== null && !ALLOWED_SIGNUP_COUNTRIES.includes(country);

  return { blocked, country, checking, enabled };
}
