import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, authLimiter } from './_lib/rate-limit.js';
import {
  rejectOversizedPayload,
  sanitiseAuthHeader,
} from './_lib/sanitise.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject oversized payloads (max 1 KB — this endpoint needs no body)
  if (!rejectOversizedPayload(req, res, 1024).ok) return;

  // Strict rate limit: 5 requests per 15 minutes per IP (sensitive auth route)
  const { success } = await applyRateLimit(req, res, authLimiter);
  if (!success) return;

  try {
    // Sanitise the Authorization header
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

    // 1. Verify the user's identity using their JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 2. Use service role to delete all user data and auth record
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Delete from all data tables (user_id column)
    const userIdTables = [
      'user_daily_activity',
      'user_streaks',
      'user_fsrs',
      'user_settings',
      'user_progress',
    ];

    for (const table of userIdTables) {
      await adminClient.from(table).delete().eq('user_id', user.id);
    }

    // profiles uses 'id' not 'user_id'
    await adminClient.from('profiles').delete().eq('id', user.id);

    // 3. Delete the auth user record completely
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
