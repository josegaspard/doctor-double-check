import React, { useEffect, useState } from 'react';
import logo from '@/assets/logo-medical-masters-white.png';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 1800);
    const finishTimer = setTimeout(onFinish, 2300);
    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[hsl(var(--background))] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <img
        src={logo}
        alt="Medical Masters"
        className="w-32 h-32 object-contain animate-pulse mb-6"
      />
      <h1 className="text-2xl font-heading font-bold text-primary">
        Medical Masters
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        Tu salud, nuestra prioridad
      </p>
      <div className="mt-8 w-12 h-1 rounded-full bg-primary/30 overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
