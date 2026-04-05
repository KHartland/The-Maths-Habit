import Stripe from 'stripe';
import { applyRateLimit, generalLimiter } from './_lib/rate-limit.js';
import {
  rejectOversizedPayload,
  sanitiseBody,
  sanitiseId,
  sanitiseEmail,
  sanitiseUrl,
} from './_lib/sanitise.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://www.themathshabit.co.uk');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject oversized payloads (max 10 KB)
  if (!rejectOversizedPayload(req, res).ok) return;

  // Rate limit: 100 requests per 15 minutes per IP
  const { success } = await applyRateLimit(req, res, generalLimiter);
  if (!success) return;

  // Validate body is a JSON object
  const { ok, body } = sanitiseBody(req, res);
  if (!ok) return;

  try {
    // Sanitise and validate each field
    const priceId = sanitiseId(body.priceId);
    const userId = sanitiseId(body.userId);
    const userEmail = body.userEmail ? sanitiseEmail(body.userEmail) : null;
    const successUrl = body.successUrl ? sanitiseUrl(body.successUrl) : null;
    const cancelUrl = body.cancelUrl ? sanitiseUrl(body.cancelUrl) : null;

    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Missing or malformed required fields: priceId and userId' });
    }

    // If email was provided but failed validation, reject
    if (body.userEmail && !userEmail) {
      return res.status(400).json({ error: 'Malformed email address' });
    }

    // If URLs were provided but failed validation, reject
    if (body.successUrl && !successUrl) {
      return res.status(400).json({ error: 'Malformed successUrl — must be a valid https URL' });
    }
    if (body.cancelUrl && !cancelUrl) {
      return res.status(400).json({ error: 'Malformed cancelUrl — must be a valid https URL' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL || 'https://themathshabit.vercel.app'}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'https://themathshabit.vercel.app'}?canceled=true`,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId: userId,
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
