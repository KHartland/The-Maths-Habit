import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Initialise push notifications (remote + local).
 * Call this once on app startup.
 */
export async function initPushNotifications() {
  // Only run on native platforms (not web)
  if (!Capacitor.isNativePlatform()) {
    if (import.meta.env.DEV) console.log('[Push] Skipping — not a native platform');
    return;
  }

  // ---- Remote Push Notifications ----
  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      if (import.meta.env.DEV) console.log('[Push] Permission not granted');
      return;
    }

    // Register with APNS / FCM
    await PushNotifications.register();

    // Log the device token (needed for sending pushes later)
    PushNotifications.addListener('registration', (token) => {
      if (import.meta.env.DEV) console.log('[Push] Device token:', token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Handle notification received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      if (import.meta.env.DEV) console.log('[Push] Received in foreground:', notification);
    });

    // Handle notification tap (app was in background)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      if (import.meta.env.DEV) console.log('[Push] Tapped:', notification);
    });
  } catch (err) {
    console.error('[Push] Init error:', err);
  }

  // ---- Local Streak Reminder ----
  try {
    await scheduleStreakReminder();
  } catch (err) {
    console.error('[Push] Local notification error:', err);
  }
}

/**
 * Schedule a daily local notification at 6pm if the user
 * hasn't completed their streak for the day.
 */
export async function scheduleStreakReminder() {
  if (!Capacitor.isNativePlatform()) return;

  const permResult = await LocalNotifications.requestPermissions();
  if (permResult.display !== 'granted') return;

  // Cancel any existing streak reminders first
  const pending = await LocalNotifications.getPending();
  const streakNotifs = pending.notifications.filter(n => n.id === 1001);
  if (streakNotifs.length > 0) {
    await LocalNotifications.cancel({ notifications: streakNotifs });
  }

  // Schedule daily at 6pm
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title: "Don't lose your streak!",
        body: '5 minutes of maths keeps your streak alive',
        schedule: {
          on: { hour: 18, minute: 0 },
          repeats: true,
          allowWhileIdle: true,
        },
        smallIcon: 'ic_stat_icon',
        iconColor: '#F59E0B', // Amber accent
      },
    ],
  });

  if (import.meta.env.DEV) console.log('[Push] Streak reminder scheduled for 6pm daily');
}
