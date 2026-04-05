import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, generalLimiter } from './_lib/rate-limit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase with service role key for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing for Stripe webhooks (need raw body)
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_WEBHOOK_BODY_BYTES = 65_536; // 64 KB — Stripe events can be large

// Helper to get raw body with size enforcement
async function getRawBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;
    if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
      throw new Error('Payload too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Rate limit: 100 requests per 15 minutes per IP
  const { success } = await applyRateLimit(req, res, generalLimiter);
  if (!success) return;

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          // Update user profile with subscription info
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating profile:', error);
          } else {
            console.log(`Subscription activated for user ${userId}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        // Find user by Stripe customer ID and update status
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: status === 'active' ? 'active' : 'inactive',
            subscription_updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error updating subscription status:', error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Mark subscription as cancelled
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'cancelled',
            subscription_updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error cancelling subscription:', error);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Mark subscription as past_due
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
            subscription_updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error updating payment failure:', error);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
