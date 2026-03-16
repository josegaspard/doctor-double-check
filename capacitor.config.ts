import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.cb26d7e6a55d4434aec60d5240b9ce16',
  appName: 'Medical Masters',
  webDir: 'dist',
  server: {
    url: 'https://cb26d7e6-a55d-4434-aec6-0d5240b9ce16.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F172A',
    },
  },
};

export default config;
