import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, generalLimiter } from './_lib/rate-limit.js';
import { applyCors } from './_lib/cors.js';
import { rejectOversizedPayload, sanitiseAuthHeader } from './_lib/sanitise.js';

const FREE_DAILY_LIMIT = 5;

/**
 * POST /api/validate-access
 *
 * Server-side enforcement of the daily question limit.
 * Called before each practice session to confirm the user is allowed.
 *
 * Returns:
 *   { allowed: true, questionsUsed, questionsRemaining, isSubscribed }
 *   { allowed: false, reason: "...", questionsUsed, questionsRemaining }
 */
export default async function handler(req, res) {
  const { preflight } = applyCors(req, res, { allowHeaders: ['Authorization'] });
  if (preflight) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!rejectOversizedPayload(req, res, 1024).ok) return;

  const { success } = await applyRateLimit(req, res, generalLimiter);
  if (!success) return;

  // Authenticate the user
  const authHeader = sanitiseAuthHeader(req.headers.authorization);
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

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

    // Use service role to read profile (bypasses RLS — single source of truth)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch profile subscription status
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const isSubscribed = profile.subscription_status === 'active';

    // Subscribers always have access
    if (isSubscribed) {
      return res.status(200).json({
        allowed: true,
        isSubscribed: true,
        questionsUsed: 0,
        questionsRemaining: Infinity,
      });
    }

    // Free user — check daily count
    const today = new Date().toISOString().split('T')[0];
    const { data: activity } = await adminClient
      .from('daily_activity')
      .select('questions_answered')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    const questionsUsed = activity?.questions_answered || 0;
    const questionsRemaining = Math.max(0, FREE_DAILY_LIMIT - questionsUsed);
    const allowed = questionsUsed < FREE_DAILY_LIMIT;

    return res.status(200).json({
      allowed,
      isSubscribed: false,
      questionsUsed,
      questionsRemaining,
      ...(allowed ? {} : { reason: 'Daily free limit reached' }),
    });
  } catch (err) {
    console.error('validate-access error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
