# In-App Purchases Setup Guide — The Maths Habit

Your app already has Stripe subscriptions for the web. For native iOS/Android, Apple and Google require you to use their billing systems. **RevenueCat** makes this much simpler by providing a single SDK that works with both.

## Why RevenueCat?

- Single API for both Apple and Google billing
- Handles receipt validation server-side
- Free for up to $2,500/month in tracked revenue
- Dashboard shows subscriber stats
- Webhooks can sync with your Supabase `subscription_status`

---

## Step 1: Create RevenueCat Account

1. Go to https://www.revenuecat.com and sign up (free)
2. Create a new Project called "The Maths Habit"

## Step 2: Configure App Store Products

### Google Play Console
1. Go to **Monetization** → **Subscriptions**
2. Create a subscription:
   - Product ID: `maths_habit_monthly`
   - Name: The Maths Habit Premium (Monthly)
   - Price: £3.99/month (or your chosen price)
   - Free trial: 7 days (optional)
3. Create another subscription:
   - Product ID: `maths_habit_yearly`
   - Name: The Maths Habit Premium (Yearly)
   - Price: £29.99/year

### App Store Connect
1. Go to **Features** → **Subscriptions**
2. Create a Subscription Group: "The Maths Habit Premium"
3. Create subscriptions:
   - Product ID: `maths_habit_monthly` — £3.99/month
   - Product ID: `maths_habit_yearly` — £29.99/year

## Step 3: Connect Stores to RevenueCat

1. In RevenueCat dashboard, add your **Apple App** with shared secret from App Store Connect
2. Add your **Google Play App** with service account JSON credentials
3. Create **Entitlements**: one called `premium`
4. Create **Offerings**: one called `default` with both monthly and yearly packages
5. Attach the store product IDs to the packages

## Step 4: Install SDK

```bash
npm install @revenuecat/purchases-capacitor
npx cap sync
```

## Step 5: Integration Code

Create `src/lib/nativePurchases.js` (code provided in the project — see that file).

## Step 6: Update UpgradePrompt

The UpgradePrompt component needs to detect whether the user is on native (use RevenueCat) or web (use Stripe). The routing logic is already prepared in `src/lib/nativePurchases.js`.

## Step 7: Webhook for Server-Side Sync

Set up a RevenueCat webhook to your Supabase Edge Function to update `subscription_status` in your database when purchases happen natively. This keeps your existing web + native subscriptions in sync.

1. In RevenueCat dashboard → Integrations → Webhooks
2. URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook`
3. Create the Edge Function to handle events like `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`

---

## Architecture Overview

```
Web user → Stripe Checkout → webhook → Supabase subscription_status
Native user → RevenueCat → webhook → Supabase subscription_status
                                        ↓
                              AuthContext checks subscription_status
                              → gates features (handwriting, unlimited, etc.)
```

Both paths write to the same `subscription_status` field, so your existing feature gating in AuthContext works for both web and native users.
