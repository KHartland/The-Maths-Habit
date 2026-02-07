import { supabase } from './supabase';

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
    const { data, error } = await supabase
      .from('matches')
      .insert({
        code,
        host_id: hostId,
        host_name: hostName,
        question_count: questionCount,
        tier,
        topics,
        status: 'waiting'
      })
      .select()
      .single();

    if (error?.code === '23505') {
      // Duplicate code, try again
      code = generateCode();
      attempts++;
      continue;
    }

    if (error) throw error;
    return data;
  }

  throw new Error('Failed to generate unique match code');
};

// Join a match by code
export const joinMatch = async (code, guestId, guestName) => {
  const upperCode = code.toUpperCase().trim();

  // First, find the match
  const { data: match, error: findError } = await supabase
    .from('matches')
    .select('*')
    .eq('code', upperCode)
    .eq('status', 'waiting')
    .single();

  if (findError || !match) {
    throw new Error('Match not found or already started');
  }

  if (match.host_id === guestId) {
    throw new Error("You can't join your own match");
  }

  // Update match with guest
  const { data, error } = await supabase
    .from('matches')
    .update({
      guest_id: guestId,
      guest_name: guestName,
      status: 'ready'
    })
    .eq('id', match.id)
    .eq('status', 'waiting')
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Start the match (host only)
export const startMatch = async (matchId, questions) => {
  const { data, error } = await supabase
    .from('matches')
    .update({
      status: 'playing',
      questions: questions,
      started_at: new Date().toISOString()
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Submit an answer
export const submitAnswer = async (matchId, playerId, playerType, questionIndex, answer, isCorrect, timeSpent) => {
  const isHost = playerType === 'host';
  const answersField = isHost ? 'host_answers' : 'guest_answers';
  const scoreField = isHost ? 'host_score' : 'guest_score';

  // Get current match state
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError) throw fetchError;

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

  const { data, error } = await supabase
    .from('matches')
    .update({
      [answersField]: currentAnswers,
      [scoreField]: newScore
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Player finished all questions
export const finishMatch = async (matchId, playerId, playerType) => {
  const finishedField = playerType === 'host' ? 'host_finished_at' : 'guest_finished_at';

  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError) throw fetchError;

  const updates = {
    [finishedField]: new Date().toISOString()
  };

  // Check if both players finished
  const otherFinishedField = playerType === 'host' ? 'guest_finished_at' : 'host_finished_at';
  if (match[otherFinishedField]) {
    // Both finished - determine winner
    const hostScore = match.host_score;
    const guestScore = match.guest_score + (playerType === 'guest' ? 0 : 0); // Current scores

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

  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get match by ID
export const getMatch = async (matchId) => {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error) throw error;
  return data;
};

// Subscribe to match updates
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
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError) throw fetchError;

  if (match.host_id === playerId) {
    // Host leaving - cancel match
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);

    if (error) throw error;
  } else {
    // Guest leaving - reset to waiting
    const { error } = await supabase
      .from('matches')
      .update({
        guest_id: null,
        guest_name: null,
        status: 'waiting'
      })
      .eq('id', matchId);

    if (error) throw error;
  }
};
