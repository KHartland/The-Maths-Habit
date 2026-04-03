import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.squareonemaths.app',
  appName: 'The Maths Habit',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: false,
    backgroundColor: '#0E0307',
  },
  plugins: {
    GoogleSignIn: {
      iosClientId: '327555950087-gf20mpijriteeprqstnabv4gn5mppg5i.apps.googleusercontent.com',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#F59E0B',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0E0307',
      showSpinner: false,
    },
  },
};

export default config;
