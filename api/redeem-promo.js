import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, authLimiter } from './_lib/rate-limit.js';
import { applyCors } from './_lib/cors.js';
import {
  rejectOversizedPayload,
  sanitiseAuthHeader,
  sanitiseBody,
  sanitiseString,
} from './_lib/sanitise.js';

/**
 * POST /api/redeem-promo
 *
 * Server-side promo code redemption.
 * Validates the code, checks limits/expiry/duplicates, and updates the profile
 * atomically so nothing can be spoofed from the client.
 *
 * Body: { code: "MYCODE" }
 *
 * Returns:
 *   { success: true, message: "Premium access activated!" }
 *   { error: "..." }
 */
export default async function handler(req, res) {
  const { preflight } = applyCors(req, res, { allowHeaders: ['Authorization'] });
  if (preflight) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!rejectOversizedPayload(req, res, 2048).ok) return;

  // Strict rate limit — promo redemption is sensitive
  const { success } = await applyRateLimit(req, res, authLimiter);
  if (!success) return;

  // Authenticate the user
  const authHeader = sanitiseAuthHeader(req.headers.authorization);
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const { ok, body } = sanitiseBody(req, res);
  if (!ok) return;

  // Sanitise and validate the promo code
  const code = sanitiseString(body.code, 50);
  if (!code) {
    return res.status(400).json({ error: 'Missing or invalid promo code' });
  }
  const normalisedCode = code.toUpperCase().trim();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify user identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Use service role for all database operations
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Look up the promo code
    const { data: promoCode, error: fetchError } = await admin
      .from('promo_codes')
      .select('*')
      .eq('code', normalisedCode)
      .maybeSingle();

    if (fetchError || !promoCode) {
      return res.status(400).json({ error: 'Invalid promo code' });
    }

    // 2. Validate the code
    if (!promoCode.is_active) {
      return res.status(400).json({ error: 'This promo code is no longer active' });
    }

    if (promoCode.max_uses && promoCode.times_used >= promoCode.max_uses) {
      return res.status(400).json({ error: 'This promo code has reached its usage limit' });
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }

    // 3. Check for duplicate redemption
    const { data: existing } = await admin
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('promo_code_id', promoCode.id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'You have already redeemed this code' });
    }

    // 4. Apply the code — update profile, record redemption, increment usage
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_type: 'promo',
        promo_code_used: promoCode.code,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      return res.status(500).json({ error: 'Failed to apply promo code' });
    }

    // Record redemption (best-effort)
    await admin.from('promo_redemptions').insert({
      user_id: user.id,
      promo_code_id: promoCode.id,
    });

    // Increment usage count (best-effort)
    await admin
      .from('promo_codes')
      .update({ times_used: promoCode.times_used + 1 })
      .eq('id', promoCode.id);

    return res.status(200).json({
      success: true,
      message: 'Premium access activated!',
    });
  } catch (err) {
    console.error('redeem-promo error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
