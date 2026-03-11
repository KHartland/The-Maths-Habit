import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Trigger haptic feedback for correct answer.
 */
export async function hapticCorrect() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Silently fail on unsupported devices
  }
}

/**
 * Trigger haptic feedback for wrong answer.
 */
export async function hapticWrong() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    // Silently fail on unsupported devices
  }
}

/**
 * Trigger haptic feedback for streak milestone.
 */
export async function hapticStreakMilestone() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    // Silently fail on unsupported devices
  }
}
