import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salahiyati.app',
  appName: 'Expired',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_launcher', iconColor: '#3b6ff0' },
  },
};

export default config;
