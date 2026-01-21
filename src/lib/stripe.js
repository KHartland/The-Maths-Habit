import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
// This should be set in your environment variables
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise = null;

export const getStripe = () => {
  if (!stripePromise && stripePublishableKey) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
};

// Stripe Price IDs - these should match your Stripe dashboard prices
// You'll need to create these products/prices in Stripe and update these IDs
export const STRIPE_PRICES = {
  MONTHLY: import.meta.env.VITE_STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
  YEARLY: import.meta.env.VITE_STRIPE_PRICE_YEARLY || 'price_yearly_placeholder',
};

// Create a checkout session and redirect to Stripe
export const redirectToCheckout = async ({ priceId, userId, userEmail }) => {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        userEmail,
        successUrl: `${window.location.origin}?success=true`,
        cancelUrl: `${window.location.origin}?canceled=true`,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Redirect to Stripe Checkout
    if (data.url) {
      window.location.href = data.url;
    } else {
      // Fallback to client-side redirect
      const stripe = await getStripe();
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });
        if (error) {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Checkout error:', error);
    throw error;
  }
};

// Open the Stripe Customer Portal for subscription management
export const openCustomerPortal = async (customerId) => {
  try {
    const response = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: window.location.origin,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Portal error:', error);
    throw error;
  }
};
