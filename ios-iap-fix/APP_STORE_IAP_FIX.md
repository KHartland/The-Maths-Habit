# Fixing Apple Rejection: Guideline 2.1(b) — In-App Purchase Error

## The Problem

The app hides ALL purchase/upgrade UI on iOS with `!isNativeIOS()` guards,
and the only payment method is Stripe (which doesn't work on native iOS).
Apple's reviewer tried to purchase a subscription and got an error.

## Files to Add/Replace

### 1. Replace `src/lib/iapService.js`
Copy the new `iapService.js` over the existing file. This wires up
`cordova-plugin-purchase` to handle StoreKit subscriptions on iOS.

### 2. Add `src/components/IOSUpgradePrompt.jsx`
This is a NEW component — the iOS-native version of UpgradePrompt.
It shows Apple pricing and triggers StoreKit payment sheets.

---

## Changes Needed in `src/App.jsx`

### A. Add imports (near the top, around line 10)

Add these two lines after the existing imports:

```js
import IOSUpgradePrompt from './components/IOSUpgradePrompt';
import { initIAP, destroyIAP } from './lib/iapService';
```

### B. Initialise IAP in the main App component

Inside the main App function component, add a useEffect to initialise IAP.
Find the area where other useEffects are (after state declarations) and add:

```js
// Initialise iOS In-App Purchases
useEffect(() => {
  if (isNativeIOS()) {
    initIAP((update) => {
      console.log('[App] IAP update:', update);
      if (update.status === 'active') {
        // Refresh the user profile to pick up new subscription status
        refreshProfile?.();
      }
    });
    return () => destroyIAP();
  }
}, []);
```

(You'll need `refreshProfile` from useAuth — it's already in the context.)

### C. Show upgrade UI on iOS (remove `!isNativeIOS()` guards)

There are ~6 places where upgrade-related UI is hidden on iOS.
The approach: on iOS, show the IOSUpgradePrompt instead of UpgradePrompt.

#### C1. The UpgradePrompt rendering (~lines 10493 and 10969)

BEFORE:
```jsx
{/* Upgrade Prompt - hidden on iOS per App Store guideline 3.1.1 */}
{!isNativeIOS() && (
  <UpgradePrompt
    isOpen={showUpgradePrompt}
    onClose={() => setShowUpgradePrompt(false)}
    ...
  />
)}
```

AFTER:
```jsx
{/* Upgrade Prompt — Stripe on web, StoreKit on iOS */}
{isNativeIOS() ? (
  <IOSUpgradePrompt
    isOpen={showUpgradePrompt}
    onClose={() => setShowUpgradePrompt(false)}
    onSuccess={() => {
      setShowUpgradePrompt(false);
      refreshProfile?.();
    }}
  />
) : (
  <UpgradePrompt
    isOpen={showUpgradePrompt}
    onClose={() => setShowUpgradePrompt(false)}
    onSignUp={() => {
      setShowUpgradePrompt(false);
    }}
  />
)}
```

Do this for BOTH occurrences (around lines 10493 and 10969).

#### C2. The "Unlock Unlimited Practice" button (~line 6610)

BEFORE:
```jsx
{!isNativeIOS() && (
  <button onClick={() => setShowUpgradePrompt(true)} ...>
    Unlock Unlimited Practice
  </button>
)}
```

AFTER (remove the `!isNativeIOS()` guard):
```jsx
<button onClick={() => setShowUpgradePrompt(true)} ...>
  Unlock Unlimited Practice
</button>
```

#### C3. Settings page upgrade button (~line 8232)

BEFORE:
```jsx
{!isSubscribed && !isNativeIOS() && (
  <button onClick={onUpgrade} ...>Upgrade</button>
)}
```

AFTER:
```jsx
{!isSubscribed && (
  <button onClick={onUpgrade} ...>Upgrade</button>
)}
```

#### C4. "Upgrade for more" links in sliders (~lines 8486, 8549)

BEFORE:
```jsx
{!isNativeIOS() && <> <button onClick={onUpgrade} ...>Upgrade for more</button></>}
```

AFTER:
```jsx
<> <button onClick={onUpgrade} ...>Upgrade for more</button></>
```

#### C5. "Upgrade to unlock" button (~line 8678)

BEFORE:
```jsx
!isNativeIOS() ? (
  <button onClick={onUpgrade} ...>🔒 Upgrade to unlock</button>
) : null
```

AFTER:
```jsx
<button onClick={onUpgrade} ...>🔒 Upgrade to unlock</button>
```

#### C6. Daily limit message (~line 6604)

BEFORE:
```jsx
{isNativeIOS()
  ? `You've completed your ${FREE_DAILY_LIMIT} free questions for today. Come back tomorrow for more practice!`
  : `You've completed your ${FREE_DAILY_LIMIT} free questions for today. Come back tomorrow or upgrade for unlimited practice.`
}
```

AFTER (use the same message for both):
```jsx
{`You've completed your ${FREE_DAILY_LIMIT} free questions for today. Come back tomorrow or upgrade for unlimited practice.`}
```

### D. Onboarding plan card on iOS (~line 9840)

Show the OnboardingPlanCard on iOS too, but it needs to use IAP instead
of Stripe. The simplest fix for now: show the IOSUpgradePrompt during
onboarding instead.

BEFORE:
```jsx
{/* Premium Plan Card - hidden on iOS per App Store guideline 3.1.1 */}
{!isNativeIOS() && (
  <OnboardingPlanCard ... />
)}
```

AFTER:
```jsx
{/* Premium Plan Card — Stripe on web, StoreKit on iOS */}
{isNativeIOS() ? (
  <button
    onClick={() => setShowUpgradePrompt(true)}
    className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all"
  >
    ✨ View Premium Plans
  </button>
) : (
  <OnboardingPlanCard
    onSelectFree={completeOnboarding}
    userId={user?.id}
    userEmail={user?.email}
  />
)}
```

### E. Keep promo code hidden on iOS (correct — guideline 3.1.1)

The promo code input should STAY hidden on iOS. Apple requires all digital
purchases go through IAP — external promo codes violate this. So these
lines are correct as-is:

```jsx
{!isSubscribed && !isNativeIOS() && (
  <PromoCodeInput ... />
)}
{!isNativeIOS() && <PromoCodeInput ... />}
```

---

## App Store Connect Setup

Before resubmitting, verify these in App Store Connect:

### 1. Paid Apps Agreement
Go to **App Store Connect → Business** and confirm the Paid Apps Agreement
is signed and in effect. Without this, IAP won't work at all.

### 2. Subscription Products
Go to **App Store Connect → My Apps → The Maths Habit → Subscriptions**:

- Create a subscription group (e.g. "The Maths Habit Premium")
- Add two subscriptions with IDs matching the code:
  - `com.themathshabit.premium.monthly` — Auto-Renewable, 1 Month
  - `com.themathshabit.premium.yearly` — Auto-Renewable, 1 Year
- Set pricing for each (e.g. £2.99/month, £24.99/year)
- Fill in the display name, description, and review screenshot
- Status should be "Ready to Submit" or "Waiting for Review"

### 3. Sandbox Testing
- Go to **Users and Access → Sandbox → Testers**
- Create a sandbox tester account
- On your iPad, sign out of your real Apple ID in Settings → App Store
- Sign in with the sandbox tester
- Open the app and test the purchase flow — it should show the StoreKit
  payment sheet with "[Environment: Sandbox]" and process without charging

---

## Testing Checklist

Before resubmitting to Apple:

- [ ] Products appear in App Store Connect with status "Ready to Submit"
- [ ] Paid Apps Agreement is signed in Business section
- [ ] App launches on iOS and iapService initialises without errors
- [ ] Tapping "Unlock Unlimited Practice" or "Upgrade" opens IOSUpgradePrompt
- [ ] IOSUpgradePrompt shows correct Apple pricing (not hardcoded)
- [ ] Tapping "Subscribe" triggers the StoreKit payment sheet
- [ ] After purchase, subscription_status updates to 'active' in Supabase
- [ ] "Restore previous purchase" works
- [ ] Promo code input remains hidden on iOS
- [ ] Web version still uses Stripe (no regression)
