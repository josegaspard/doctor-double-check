import React from 'react';
import { BrandLaunchAnimation } from '@/components/BrandLaunchAnimation';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <BrandLaunchAnimation
      onFinish={onFinish}
      subtitle="Tu salud, nuestra prioridad"
    />
  );
}
