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
      // Brand Blue Lagoon teal — antes #0F172A (slate genérico de scaffold, no es
      // parte del brandbook) causaba un flash de color navy→teal al entregarle el
      // control al splash JS (components/SplashScreen.tsx, mismo gradient).
      backgroundColor: '#227787',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#227787',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      iconColor: '#163a83',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
