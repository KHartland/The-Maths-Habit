import Stripe from 'stripe';
import { applyRateLimit, generalLimiter } from './_lib/rate-limit.js';
import { applyCors } from './_lib/cors.js';
import {
  rejectOversizedPayload,
  sanitiseBody,
  sanitiseId,
  sanitiseUrl,
} from './_lib/sanitise.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS — only allows POST from the configured frontend origin
  const { preflight } = applyCors(req, res);
  if (preflight) return;

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
    const customerId = sanitiseId(body.customerId);
    const returnUrl = body.returnUrl ? sanitiseUrl(body.returnUrl) : null;

    if (!customerId) {
      return res.status(400).json({ error: 'Missing or malformed customerId' });
    }

    if (body.returnUrl && !returnUrl) {
      return res.status(400).json({ error: 'Malformed returnUrl — must be a valid https URL' });
    }

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL || 'https://themathshabit.vercel.app'}`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
}
