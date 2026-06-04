import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spanishcaptionengine.app',
  appName: 'Spanish Caption Engine',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost'
  }
};

export default config;
