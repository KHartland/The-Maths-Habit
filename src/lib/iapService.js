// ============================================================
// In-App Purchase Service for iOS (StoreKit)
// Uses cordova-plugin-purchase for StoreKit integration
//
// INSTALL: npm install cordova-plugin-purchase
//          npx cap sync ios
//
// SETUP IN APP STORE CONNECT:
// Create two auto-renewable subscription products:
//   - com.squareonemaths.premium.monthly  (£3.99/month)
//   - com.squareonemaths.premium.yearly   (£29.99/year)
// ============================================================

import { supabaseUrl, supabaseAnonKey } from './supabase';

const PRODUCT_IDS = {
  MONTHLY: 'com.squareonemaths.premium.monthly',
  YEARLY: 'com.squareonemaths.premium.yearly',
};

let storeReady = false;

// Initialize the store — call once at app startup on iOS
export const initializeIAP = () => {
  if (!window.CdvPurchase) {
    console.warn('CdvPurchase not available — IAP disabled');
    return;
  }

  const store = window.CdvPurchase.store;
  const Platform = window.CdvPurchase.Platform;
  const ProductType = window.CdvPurchase.ProductType;

  // Register products
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

  // When a purchase is approved, verify and update Supabase
  store.when()
    .approved(async (transaction) => {
      // Update user's subscription in Supabase
      try {
        const storageKey = 'sb-kxvtiqkmxhqwqckjikje-auth-token';
        const raw = localStorage.getItem(storageKey);
        const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

        // Get user ID from the token
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.sub;

        if (userId) {
          await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              subscription_status: 'active',
              subscription_type: 'apple_iap',
            }),
          });
        }
      } catch (err) {
        console.error('Failed to update subscription in Supabase:', err);
      }

      // Finish the transaction (required by StoreKit)
      transaction.finish();
    })
    .finished((transaction) => {
      console.log('Purchase finished:', transaction.products[0]?.id);
      // Reload to pick up new subscription status
      window.location.reload();
    });

  // Initialize
  store.initialize([Platform.APPLE_APPSTORE])
    .then(() => {
      storeReady = true;
      console.log('IAP store initialized');
    })
    .catch((err) => {
      console.error('IAP initialization failed:', err);
    });
};

// Purchase a product
export const purchase = async (productId, userId) => {
  if (!window.CdvPurchase) {
    throw new Error('In-app purchases not available');
  }

  const store = window.CdvPurchase.store;
  const offer = store.get(productId)?.getOffer();

  if (!offer) {
    throw new Error('Product not found. Please try again.');
  }

  // This triggers the native StoreKit purchase sheet
  const result = await store.order(offer);

  if (result && result.isError) {
    if (result.code === window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED) {
      // User cancelled — not an error
      return;
    }
    throw new Error(result.message || 'Purchase failed');
  }
};

// Get product prices (for displaying localised prices)
export const getProducts = () => {
  if (!window.CdvPurchase || !storeReady) return null;

  const store = window.CdvPurchase.store;
  const monthly = store.get(PRODUCT_IDS.MONTHLY);
  const yearly = store.get(PRODUCT_IDS.YEARLY);

  return {
    monthly: monthly?.pricing?.price || '£3.99',
    yearly: yearly?.pricing?.price || '£29.99',
  };
};

// Export as a namespace for dynamic import
export const InAppPurchase = {
  initialize: initializeIAP,
  purchase,
  getProducts,
  PRODUCT_IDS,
};

export default InAppPurchase;
