import { supabase } from './supabase';
import { supabaseUrl, supabaseAnonKey } from './supabase';

// Helper: get auth token from Supabase client session
const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch (e) {
    console.error('Failed to get auth session:', e);
  }
  return supabaseAnonKey;
};

// Helper: raw fetch to PostgREST with timeout
const restFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const token = await getAuthToken();

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
      throw new Error('Request timed out (10s)');
    }
    throw err;
  }
};

// Generate a random 6-character code
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Create a new match
export const createMatch = async (hostId, hostName, settings = {}) => {
  const {
    questionCount = 10,
    tier = 'foundation',
    topics = ['number', 'algebra', 'ratio', 'geometry', 'probability', 'statistics']
  } = settings;

  // Generate unique code
  let code = generateCode();
  let attempts = 0;

  while (attempts < 10) {
    try {
      const { data } = await restFetch('matches', {
        method: 'POST',
        body: JSON.stringify({
          code,
          host_id: hostId,
          host_name: hostName,
          question_count: questionCount,
          tier,
          topics,
          status: 'waiting'
        }),
        headers: { 'Prefer': 'return=representation' },
      });

      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error('Match was not created. This may be a database permissions issue — check RLS policies.');
      }

      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      // Duplicate code (23505) — try again
      if (err.message?.includes('23505')) {
        code = generateCode();
        attempts++;
        continue;
      }
      throw new Error(err.message || 'Unexpected error creating match');
    }
  }

  throw new Error('Failed to generate unique match code');
};

// Join a match by code
export const joinMatch = async (code, guestId, guestName) => {
  const upperCode = code.toUpperCase().trim();

  // First, find the match
  const { data: matches } = await restFetch(
    `matches?code=eq.${upperCode}&status=eq.waiting&select=*`
  );

  if (!matches || matches.length === 0) {
    throw new Error('Match not found or already started');
  }

  const match = matches[0];

  if (match.host_id === guestId) {
    throw new Error("You can't join your own match");
  }

  // Update match with guest
  const { data: updated } = await restFetch(
    `matches?id=eq.${match.id}&status=eq.waiting`, {
      method: 'PATCH',
      body: JSON.stringify({
        guest_id: guestId,
        guest_name: guestName,
        status: 'ready'
      }),
      headers: { 'Prefer': 'return=representation' },
    }
  );

  if (!updated || updated.length === 0) {
    throw new Error('Failed to join match — it may have already started');
  }

  return updated[0];
};

// Start the match (host only)
export const startMatch = async (matchId, questions) => {
  const { data } = await restFetch(
    `matches?id=eq.${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'playing',
        questions: questions,
        started_at: new Date().toISOString()
      }),
      headers: { 'Prefer': 'return=representation' },
    }
  );

  if (!data || data.length === 0) throw new Error('Failed to start match');
  return data[0];
};

// Submit an answer
export const submitAnswer = async (matchId, playerId, playerType, questionIndex, answer, isCorrect, timeSpent) => {
  const isHost = playerType === 'host';
  const answersField = isHost ? 'host_answers' : 'guest_answers';
  const scoreField = isHost ? 'host_score' : 'guest_score';

  // Get current match state
  const { data: matches } = await restFetch(
    `matches?id=eq.${matchId}&select=*`
  );

  if (!matches || matches.length === 0) throw new Error('Match not found');
  const match = matches[0];

  // Add answer to array
  const currentAnswers = match[answersField] || [];
  currentAnswers.push({
    questionIndex,
    answer,
    isCorrect,
    timeSpent,
    submittedAt: new Date().toISOString()
  });

  // Calculate new score
  const newScore = currentAnswers.filter(a => a.isCorrect).length;

  const { data: updated } = await restFetch(
    `matches?id=eq.${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        [answersField]: currentAnswers,
        [scoreField]: newScore
      }),
      headers: { 'Prefer': 'return=representation' },
    }
  );

  if (!updated || updated.length === 0) throw new Error('Failed to submit answer');
  return updated[0];
};

// Player finished all questions
export const finishMatch = async (matchId, playerId, playerType) => {
  const finishedField = playerType === 'host' ? 'host_finished_at' : 'guest_finished_at';

  // Get current match state
  const { data: matches } = await restFetch(
    `matches?id=eq.${matchId}&select=*`
  );

  if (!matches || matches.length === 0) throw new Error('Match not found');
  const match = matches[0];

  const updates = {
    [finishedField]: new Date().toISOString()
  };

  // Check if both players finished
  const otherFinishedField = playerType === 'host' ? 'guest_finished_at' : 'host_finished_at';
  if (match[otherFinishedField]) {
    // Both finished - determine winner
    const hostScore = match.host_score;
    const guestScore = match.guest_score;

    let winnerId = null;
    let winnerReason = null;

    if (hostScore > guestScore) {
      winnerId = match.host_id;
      winnerReason = 'score';
    } else if (guestScore > hostScore) {
      winnerId = match.guest_id;
      winnerReason = 'score';
    } else {
      // Tie - compare times
      const hostTime = new Date(match.host_finished_at || updates.host_finished_at) - new Date(match.started_at);
      const guestTime = new Date(match.guest_finished_at || updates.guest_finished_at) - new Date(match.started_at);

      if (hostTime < guestTime) {
        winnerId = match.host_id;
        winnerReason = 'time';
      } else if (guestTime < hostTime) {
        winnerId = match.guest_id;
        winnerReason = 'time';
      }
      // If still tied, it's a draw (winnerId remains null)
    }

    updates.status = 'finished';
    updates.finished_at = new Date().toISOString();
    updates.winner_id = winnerId;
    updates.winner_reason = winnerReason;
  }

  const { data: updated } = await restFetch(
    `matches?id=eq.${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      headers: { 'Prefer': 'return=representation' },
    }
  );

  if (!updated || updated.length === 0) throw new Error('Failed to finish match');
  return updated[0];
};

// Get match by ID
export const getMatch = async (matchId) => {
  const { data } = await restFetch(
    `matches?id=eq.${matchId}&select=*`
  );

  if (!data || data.length === 0) throw new Error('Match not found');
  return data[0];
};

// Subscribe to match updates (Realtime — uses supabase client, which is fine for channels)
export const subscribeToMatch = (matchId, callback) => {
  const channel = supabase
    .channel(`match-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Leave/cancel match
export const leaveMatch = async (matchId, playerId) => {
  // Get match to check if host or guest
  const { data: matches } = await restFetch(
    `matches?id=eq.${matchId}&select=*`
  );

  if (!matches || matches.length === 0) throw new Error('Match not found');
  const match = matches[0];

  if (match.host_id === playerId) {
    // Host leaving - cancel/delete match
    await restFetch(`matches?id=eq.${matchId}`, {
      method: 'DELETE',
    });
  } else {
    // Guest leaving - reset to waiting
    await restFetch(`matches?id=eq.${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        guest_id: null,
        guest_name: null,
        status: 'waiting'
      }),
    });
  }
};
