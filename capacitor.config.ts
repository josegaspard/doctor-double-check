import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medicalmasters.app',
  appName: 'Medical Masters',
  webDir: 'dist',
  // Production: load bundled web assets. To dev against a remote server, set CAPACITOR_DEV_SERVER_URL env.
  server: {
    androidScheme: 'https',
    cleartext: false,
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
