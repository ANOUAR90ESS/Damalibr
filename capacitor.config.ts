import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS/Android shell around the web build in dist/. The app talks to the
// Lámina server through VITE_API_URL (set it before `bun run build` for native).
const config: CapacitorConfig = {
  appId: 'com.lamina.app',
  appName: 'Lámina',
  webDir: 'dist',
  backgroundColor: '#090a0f',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
