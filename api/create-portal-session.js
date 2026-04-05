import Stripe from 'stripe';
import { applyRateLimit, generalLimiter } from './_lib/rate-limit.js';
import {
  rejectOversizedPayload,
  sanitiseBody,
  sanitiseId,
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
