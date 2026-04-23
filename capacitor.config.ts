import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ambient.canvas.overlay',
  appName: 'Ambient Canvas',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // Required to fetch data from local Arduino IP (http://10.0.0.60)
    allowNavigation: ['10.0.0.60']
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
