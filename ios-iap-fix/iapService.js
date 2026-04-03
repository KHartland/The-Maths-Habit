/**
 * iapService.js — iOS In-App Purchase service using cordova-plugin-purchase
 *
 * Handles subscription purchases via Apple StoreKit on native iOS.
 * Web/Android continue to use Stripe (see stripe.js).
 *
 * IMPORTANT: Product IDs must match exactly what is configured in
 * App Store Connect. Update PRODUCT_IDS below if yours differ.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// ── Product IDs (must match App Store Connect) ──────────────────────────
export const PRODUCT_IDS = {
  MONTHLY: 'com.themathshabit.premium.monthly',
  YEARLY:  'com.themathshabit.premium.yearly',
};

// ── State ───────────────────────────────────────────────────────────────
let storeReady = false;
let storeInstance = null;
let purchaseUpdateCallback = null;

const isNativeIOS = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// ── Initialise the store ────────────────────────────────────────────────
/**
 * Call once at app startup (inside useEffect).
 * Registers products and listens for purchase events.
 *
 * @param {Function} onPurchaseUpdate – called with { productId, status, error? }
 */
export async function initIAP(onPurchaseUpdate) {
  if (!isNativeIOS()) return;
  if (storeReady) return;

  const CdvPurchase = window.CdvPurchase;
  if (!CdvPurchase) {
    console.warn('[IAP] CdvPurchase not available');
    return;
  }

  const { store, ProductType, Platform } = CdvPurchase;
  storeInstance = store;
  purchaseUpdateCallback = onPurchaseUpdate || (() => {});

  store.verbosity = store.DEBUG;

  store.register([
    {
      id: PRODUCT_IDS.MONTHLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.APPLE_APPSTORE,
    },
    {
      id: PRODUCT_IDS.YEARLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.APPLE_APPSTORE,
    },
  ]);

  // ── Purchase lifecycle ───────────────────────────────────────────
  store.when()
    .approved(async (transaction) => {
      console.log('[IAP] Approved:', transaction);
      try {
        await activateSubscription(transaction);
        purchaseUpdateCallback({
          productId: transaction.products?.[0]?.id,
          status: 'active',
        });
      } catch (err) {
        console.error('[IAP] Activation failed:', err);
        purchaseUpdateCallback({
          productId: transaction.products?.[0]?.id,
          status: 'error',
          error: err.message,
        });
      }
      transaction.finish();
    })
    .finished((transaction) => {
      console.log('[IAP] Finished:', transaction);
    });

  store.error((err) => {
    console.error('[IAP] Store error:', err.code, err.message);
    purchaseUpdateCallback({
      productId: null,
      status: 'error',
      error: err.message,
    });
  });

  try {
    await store.initialize([Platform.APPLE_APPSTORE]);
    storeReady = true;
    console.log('[IAP] Store ready. Products:', getProducts().map(p => ({
      id: p.id, title: p.title, pricing: p.pricing,
    })));
  } catch (err) {
    console.error('[IAP] Init failed:', err);
  }
}

// ── Get products ────────────────────────────────────────────────────────
export function getProducts() {
  if (!storeInstance) return [];
  return [
    storeInstance.get(PRODUCT_IDS.MONTHLY),
    storeInstance.get(PRODUCT_IDS.YEARLY),
  ].filter(Boolean);
}

export function getProduct(productId) {
  if (!storeInstance) return null;
  return storeInstance.get(productId) || null;
}

// ── Purchase ────────────────────────────────────────────────────────────
export async function purchaseProduct(productId) {
  if (!storeInstance) {
    throw new Error('Store not initialised. Call initIAP() first.');
  }
  const product = storeInstance.get(productId);
  if (!product) {
    throw new Error(`Product "${productId}" not found in store.`);
  }
  const offer = product.getOffer();
  if (!offer) {
    throw new Error(`No offer for "${productId}".`);
  }
  console.log('[IAP] Ordering:', productId);
  await storeInstance.order(offer);
}

// ── Restore ─────────────────────────────────────────────────────────────
export async function restorePurchases() {
  if (!storeInstance) return;
  console.log('[IAP] Restoring...');
  await storeInstance.restorePurchases();
}

// ── Activate in Supabase ────────────────────────────────────────────────
async function activateSubscription(transaction) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[IAP] No user — skipping profile update');
    return;
  }
  const productId = transaction.products?.[0]?.id;
  const subscriptionType = productId === PRODUCT_IDS.YEARLY ? 'yearly' : 'monthly';
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'active', subscription_type: subscriptionType })
    .eq('id', user.id);
  if (error) {
    console.error('[IAP] Profile update failed:', error);
    throw error;
  }
  console.log('[IAP] Activated:', subscriptionType, user.id);
}

// ── Cleanup ─────────────────────────────────────────────────────────────
export function destroyIAP() {
  storeInstance = null;
  storeReady = false;
  purchaseUpdateCallback = null;
}
