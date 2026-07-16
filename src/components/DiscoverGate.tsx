import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Lock, Timer } from 'lucide-react';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

// Modo "Descubre MedicalMasters" (cliente 15-jul-2026): el visitante navega
// libre 10 minutos; al agotarse se bloquea TODO con un overlay que pide
// registrarse. El reloj arranca en loginAsVisitor (localStorage
// mm_discover_started_at) y NO se reinicia cerrando la pestaña.
const DISCOVER_LIMIT_MS = 10 * 60 * 1000;

export function DiscoverGate() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  // Se lee fresco en cada render: al re-entrar como visitante loginAsVisitor
  // reinicia el reloj y el chip debe reflejar los 10 min nuevos al instante.
  const rawStarted = localStorage.getItem('mm_discover_started_at');
  const startedNum = rawStarted ? Number(rawStarted) : NaN;
  const startedAt = Number.isFinite(startedNum) ? startedNum : null;

  const isVisitor = role === 'visitor';
  const remainingMs = startedAt ? Math.max(0, DISCOVER_LIMIT_MS - (now - startedAt)) : DISCOVER_LIMIT_MS;
  const expired = isVisitor && startedAt !== null && remainingMs <= 0;

  useEffect(() => {
    if (!isVisitor || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isVisitor, expired]);

  // Al cumplirse los 10 minutos (cliente 16-jul-2026): regresar SOLO al login de
  // forma automática. Se limpia la sesión de visitante para dejar el estado
  // anónimo, pero mm_discover_started_at PERMANECE en localStorage → el modo
  // Descubre es de una sola vez por navegador (no se reinician los 10 min).
  // window.location.replace fuerza una rehidratación limpia de la auth.
  useEffect(() => {
    if (!expired) return;
    try { sessionStorage.removeItem('medicalMasters_visitor'); } catch { /* noop */ }
    const id = setTimeout(() => {
      window.location.replace('/login?reason=discover_expired');
    }, 1600);
    return () => clearTimeout(id);
  }, [expired]);

  if (!isVisitor || startedAt === null) return null;

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);

  if (!expired) {
    // Chip flotante con el tiempo restante — que el bloqueo no tome por sorpresa.
    return (
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
        <div className="flex items-center gap-2 rounded-full bg-[#0a1f47]/90 text-white px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm border border-white/15">
          <Timer className="w-3.5 h-3.5 text-white/80" />
          <span>{t('discover.chip')} {mins}:{String(secs).padStart(2, '0')}</span>
        </div>
      </div>
    );
  }

  // Bloqueo total: overlay no descartable sobre TODA la app.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg, #0a1f47 0%, #163a83 60%, #227787 130%)' }}
      data-testid="discover-gate-overlay"
    >
      <div className="max-w-md w-full text-center text-white">
        <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-14 w-auto mx-auto mb-6 drop-shadow-lg" />
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2 drop-shadow">{t('discover.expiredTitle')}</h2>
        <p className="text-white/85 text-sm leading-relaxed mb-8">{t('discover.expiredDescription')}</p>
        <div className="space-y-3">
          {/* El login es lo primario: al expirar te regresamos aquí automáticamente. */}
          <Button
            className="w-full h-12 text-base bg-white text-[#0a1f47] hover:bg-white/90 font-semibold"
            onClick={() => window.location.replace('/login?reason=discover_expired')}
          >
            {t('discover.loginCta')}
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => navigate('/login', { state: { preferredRole: 'patient', mode: 'signup' } })}
          >
            {t('discover.registerCta')}
          </Button>
        </div>
        <p className="mt-6 text-[11px] text-white/70 flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {t('discover.redirecting')}
        </p>
      </div>
    </div>
  );
}

export default DiscoverGate;
