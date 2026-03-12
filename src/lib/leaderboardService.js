import { supabaseUrl, supabaseAnonKey } from './supabase';

// Helper: get auth token directly from localStorage (bypasses Supabase JS client)
const getAuthToken = () => {
  try {
    const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch (e) {
    console.error('Failed to read auth token:', e);
  }
  return supabaseAnonKey;
};

// Helper: raw fetch to PostgREST with timeout
const restFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const token = options.token || supabaseAnonKey;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || '',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      // PGRST116 = no rows found, not a real error for deletes
      if (response.status === 404 || body.includes('PGRST116')) {
        return { data: null, notFound: true };
      }
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const text = await response.text();
    if (!text) return { data: null };
    return { data: JSON.parse(text) };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out (8s)');
    }
    throw err;
  }
};

// Fetch all schools in pages of 1000 (PostgREST default limit)
export const getAllSchools = async () => {
  const allSchools = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await restFetch(
      `schools?select=id,name,town&order=name.asc&limit=${pageSize}&offset=${offset}`
    );

    if (!data || data.length === 0) break;
    allSchools.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allSchools;
};

// Search schools (unused now — client-side filtering instead)
export const searchSchools = async (query) => {
  if (!query || query.trim().length < 2) return [];
  const trimmed = query.trim();
  const { data } = await restFetch(
    `schools?select=id,name,town&or=(name.ilike.%25${encodeURIComponent(trimmed)}%25,town.ilike.%25${encodeURIComponent(trimmed)}%25)&order=name.asc&limit=30`
  );
  return data || [];
};

// Create a new school (with town)
export const createSchool = async (schoolName, town, userId) => {
  if (!schoolName?.trim()) throw new Error('School name is required');
  if (!town?.trim()) throw new Error('Town/region is required');

  const trimmedName = schoolName.trim();
  const trimmedTown = town.trim();
  const token = getAuthToken();

  // Check if it already exists
  const { data: existing } = await restFetch(
    `schools?select=id,name,town&name=ilike.${encodeURIComponent(trimmedName)}&town=ilike.${encodeURIComponent(trimmedTown)}&limit=1`,
    { token }
  );

  if (existing && existing.length > 0) return existing[0];

  const { data } = await restFetch('schools?select=*', {
    method: 'POST',
    body: JSON.stringify({ name: trimmedName, town: trimmedTown, created_by: userId }),
    prefer: 'return=representation',
    token,
  });

  if (!data || data.length === 0) throw new Error('Failed to create school');
  return data[0];
};

// Join a school (leaves current school first)
export const joinSchool = async (userId, schoolId) => {
  if (!userId || !schoolId) throw new Error('User ID and School ID are required');
  const token = getAuthToken();

  // Leave any existing school first
  await leaveSchool(userId);

  const { data } = await restFetch('school_members?select=*', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, school_id: schoolId }),
    prefer: 'return=representation',
    token,
  });

  if (!data || data.length === 0) throw new Error('Failed to join school');
  return data[0];
};

// Leave current school
export const leaveSchool = async (userId) => {
  if (!userId) throw new Error('User ID is required');
  const token = getAuthToken();

  await restFetch(`school_members?user_id=eq.${userId}`, {
    method: 'DELETE',
    token,
  });
};

// Get user's current school (returns { id, name, town } or null)
export const getUserSchool = async (userId) => {
  if (!userId) return null;
  const token = getAuthToken();

  // Get the user's school_members row
  const { data: members } = await restFetch(
    `school_members?select=school_id&user_id=eq.${userId}&limit=1`,
    { token }
  );

  if (!members || members.length === 0) return null;

  // Now fetch the school details
  const { data: schools } = await restFetch(
    `schools?select=id,name,town&id=eq.${members[0].school_id}&limit=1`,
    { token }
  );

  return schools && schools.length > 0 ? schools[0] : null;
};

// Get MONTHLY leaderboard for a school via RPC function
// Sums correct_answers from daily_activity for the given month
export const getSchoolLeaderboardMonthly = async (schoolId, year, month) => {
  if (!schoolId) throw new Error('School ID is required');
  const token = getAuthToken();

  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || (now.getMonth() + 1); // JS months are 0-indexed

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard_monthly`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_school_id: schoolId, p_year: y, p_month: m }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data || []).map((entry, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      displayName: entry.display_name,
      avatarUrl: entry.avatar_url || null,
      totalCorrect: entry.total_correct,
    }));
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Leaderboard request timed out');
    }
    throw err;
  }
};

// Get ALL-TIME leaderboard for a school via RPC function
export const getSchoolLeaderboard = async (schoolId) => {
  if (!schoolId) throw new Error('School ID is required');
  const token = getAuthToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_school_id: schoolId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data || []).map((entry, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      displayName: entry.display_name,
      avatarUrl: entry.avatar_url || null,
      totalCorrect: entry.total_correct,
    }));
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Leaderboard request timed out');
    }
    throw err;
  }
};
