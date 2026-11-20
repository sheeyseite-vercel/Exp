import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salahiyati.app',
  appName: 'Expired',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_launcher', iconColor: '#5B4FD6' },
  },
};

export default config;
