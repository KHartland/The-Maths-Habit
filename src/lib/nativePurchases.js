import { Capacitor } from '@capacitor/core';

/**
 * Native in-app purchase integration via RevenueCat.
 *
 * On native platforms (iOS/Android), subscriptions go through
 * Apple/Google billing via RevenueCat. On web, we fall back
 * to the existing Stripe flow.
 *
 * Setup: npm install @revenuecat/purchases-capacitor
 *        then set VITE_REVENUECAT_API_KEY in your .env
 */

let Purchases = null;
let isInitialised = false;

/**
 * Initialise RevenueCat. Call once on app startup (after auth).
 * @param {string} userId - Supabase user ID for cross-platform identity
 */
export async function initPurchases(userId) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const rc = await import('@revenuecat/purchases-capacitor');
    Purchases = rc.Purchases;

    const apiKey = Capacitor.getPlatform() === 'ios'
      ? import.meta.env.VITE_REVENUECAT_IOS_KEY
      : import.meta.env.VITE_REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.error('[IAP] Missing RevenueCat API key');
      return;
    }

    await Purchases.configure({ apiKey, appUserID: userId });
    isInitialised = true;

    if (import.meta.env.DEV) console.log('[IAP] RevenueCat initialised');
  } catch (err) {
    console.error('[IAP] Init error:', err);
  }
}

/**
 * Check if the user has an active "premium" entitlement.
 * @returns {Promise<boolean>}
 */
export async function checkNativeSubscription() {
  if (!isInitialised || !Purchases) return false;

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (err) {
    console.error('[IAP] Check subscription error:', err);
    return false;
  }
}

/**
 * Get available subscription packages.
 * @returns {Promise<Array>} packages from the "default" offering
 */
export async function getPackages() {
  if (!isInitialised || !Purchases) return [];

  try {
    const { offerings } = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (err) {
    console.error('[IAP] Get offerings error:', err);
    return [];
  }
}

/**
 * Purchase a subscription package.
 * @param {object} pkg - A package from getPackages()
 * @returns {Promise<{success: boolean, customerInfo?: object, error?: string}>}
 */
export async function purchasePackage(pkg) {
  if (!isInitialised || !Purchases) {
    return { success: false, error: 'Purchases not initialised' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const isPremium = customerInfo.entitlements.active.premium !== undefined;
    return { success: isPremium, customerInfo };
  } catch (err) {
    // User cancelled — not a real error
    if (err.code === 'PURCHASE_CANCELLED_ERROR') {
      return { success: false, error: 'cancelled' };
    }
    console.error('[IAP] Purchase error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore previous purchases (e.g. after reinstall).
 * @returns {Promise<boolean>} whether premium is now active
 */
export async function restorePurchases() {
  if (!isInitialised || !Purchases) return false;

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (err) {
    console.error('[IAP] Restore error:', err);
    return false;
  }
}

/**
 * Helper: is this running on a native platform?
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}
