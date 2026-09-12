// Rutas antiguas del médico que ahora viven dentro de una sección (11-sep-2026).
//
// Ninguna ruta se borra: la regla de lib/doctorSections decide el destino y
// conserva lo que traía la URL (fecha, hora, paciente…). Las reglas «solo médico»
// dejan pasar al resto de roles a la pantalla de siempre (children).
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DOCTOR_LEGACY_REDIRECTS, resolveDoctorLegacyRedirect } from '@/lib/doctorSections';

export function DoctorLegacyRedirect({ children }: { children?: React.ReactNode }) {
  const { pathname, search } = useLocation();
  const { role, isLoading } = useAuth();
  const path = pathname.replace(/\/+$/, '') || '/';
  const rule = DOCTOR_LEGACY_REDIRECTS.find(r => r.from === path);

  // Hasta saber el rol no se pinta nada: si no, el médico vería un instante la pantalla vieja.
  if (rule?.doctorOnly && isLoading) return null;

  const target = resolveDoctorLegacyRedirect(pathname, search, role === 'doctor');
  if (target) return <Navigate to={target} replace />;
  return <>{children}</>;
}

export default DoctorLegacyRedirect;
