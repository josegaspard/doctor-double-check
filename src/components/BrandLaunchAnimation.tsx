import React, { useEffect, useState } from 'react';
import logo from '@/assets/logo-medical-masters-white.png';

interface BrandLaunchAnimationProps {
  onFinish: () => void;
  title?: string;
  subtitle?: string;
}

// Animación de marca de pantalla completa: logo + progreso, mismo look en
// (1) el arranque en frío de la SPA (SplashScreen.tsx) y (2) la transición al
// pulsar "Entrar"/"Acceder a la Plataforma" en el landing (pages/Landing.tsx),
// para que ambos momentos se sientan como el MISMO lenguaje de marca.
export function BrandLaunchAnimation({ onFinish, title = 'Medical Masters', subtitle }: BrandLaunchAnimationProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 2;
      });
    }, 30);

    const fadeTimer = setTimeout(() => setFadeOut(true), 800);
    const finishTimer = setTimeout(onFinish, 1100);
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(135deg, #227787 0%, #227787 50%, #AED3D9 100%)' }}
    >
      {/* Floating background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/[0.03] blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#227787]/20 blur-3xl" style={{ animation: 'pulse 3s ease-in-out infinite' }} />
        <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-[#163a83]/30 blur-2xl" style={{ animation: 'pulse 4s ease-in-out infinite 1s' }} />

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Logo with scale-in animation */}
      <div className="relative z-10 flex flex-col items-center">
        <div
          className="mb-6"
          style={{
            animation: 'splash-scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <img
            src={logo}
            alt="Medical Masters"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
          />
        </div>

        <h1
          className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight mb-1"
          style={{ animation: 'splash-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-sm text-slate-300/80 mb-8"
            style={{ animation: 'splash-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both' }}
          >
            {subtitle}
          </p>
        )}

        {/* Progress bar */}
        <div
          className={`w-48 h-1 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm ${subtitle ? '' : 'mt-8'}`}
          style={{ animation: 'splash-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both' }}
        >
          <div
            className="h-full rounded-full transition-all duration-100 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #aed3d9, #227787)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
