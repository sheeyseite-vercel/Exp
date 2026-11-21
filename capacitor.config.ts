import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salahiyati.app',
  appName: 'Expired',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_launcher', iconColor: '#E2543C' },
  },
};

export default config;
