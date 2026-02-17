import { supabaseUrl, supabaseAnonKey } from './supabase';

// Storage keys (same as in App.jsx)
const STORAGE_KEY = 'maths-habit-progress';
const SETTINGS_KEY = 'maths-habit-settings';
const FSRS_DATA_KEY = 'maths-habit-fsrs';
const STREAK_DATA_KEY = 'maths-habit-streak-data';
const DAILY_ACTIVITY_KEY = 'maths-habit-daily-activity';
const SESSION_COUNT_KEY = 'maths-habit-session-count';
const TOTAL_QUESTIONS_KEY = 'maths-habit-total-questions';

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

// Helper: raw fetch to PostgREST with timeout (same pattern as leaderboardService)
const restFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const token = getAuthToken();

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

/**
 * Migrate all localStorage data to Supabase for a new user
 */
export const migrateLocalToCloud = async (userId) => {
  try {
    // 1. Migrate progress
    const progressData = localStorage.getItem(STORAGE_KEY);
    if (progressData) {
      const progress = JSON.parse(progressData);
      const progressRows = Object.entries(progress).map(([code, data]) => ({
        user_id: userId,
        objective_code: code,
        quick_correct: data.quickCorrect || 0,
        exam_passed: data.examPassed || false,
        last_practiced: data.lastPracticed ? new Date(data.lastPracticed).toISOString() : null
      }));

      if (progressRows.length > 0) {
        await restFetch('user_progress?on_conflict=user_id,objective_code', {
          method: 'POST',
          body: JSON.stringify(progressRows),
          prefer: 'resolution=merge-duplicates',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
        });
      }
    }

    // 2. Migrate FSRS data
    const fsrsData = localStorage.getItem(FSRS_DATA_KEY);
    if (fsrsData) {
      const fsrs = JSON.parse(fsrsData);
      if (fsrs.questionCards) {
        const fsrsRows = Object.entries(fsrs.questionCards).map(([questionId, card]) => ({
          user_id: userId,
          question_id: questionId,
          stability: card.stability || 1.0,
          difficulty: card.difficulty || 0.5,
          last_review: card.lastReview ? new Date(card.lastReview).toISOString() : null,
          next_review: card.nextReview ? new Date(card.nextReview).toISOString() : null,
          reps: card.reps || 0,
          lapses: card.lapses || 0,
          state: card.state || 'new'
        }));

        if (fsrsRows.length > 0) {
          await restFetch('user_fsrs_cards?on_conflict=user_id,question_id', {
            method: 'POST',
            body: JSON.stringify(fsrsRows),
            prefer: 'resolution=merge-duplicates',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
          });
        }
      }
    }

    // 3. Migrate streak data
    const streakData = localStorage.getItem(STREAK_DATA_KEY);
    if (streakData) {
      const streak = JSON.parse(streakData);
      await restFetch('user_streaks?on_conflict=user_id', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          current_streak: streak.currentStreak || 0,
          longest_streak: streak.longestStreak || 0,
          freezes_available: streak.freezesAvailable || 0,
          last_activity_date: streak.lastActivityDate || null,
          streak_data: streak
        }),
        prefer: 'resolution=merge-duplicates',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
      });
    }

    // 4. Migrate settings
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    if (settingsData) {
      const settings = JSON.parse(settingsData);
      await restFetch('user_settings?on_conflict=user_id', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          questions_per_session: settings.questionsPerSession || 7,
          show_hints: settings.showHints !== false,
          include_higher_tier: settings.includeHigherTier || false,
          daily_goal: settings.dailyGoal || 7,
          weekly_mastery_goal: settings.weeklyMasteryGoal || 3,
          font_size: settings.fontSize || 'normal',
          dyslexia_font: settings.dyslexiaFont || false,
          high_contrast: settings.highContrast || false
        }),
        prefer: 'resolution=merge-duplicates',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
      });
    }

    // 5. Migrate daily activity
    const dailyData = localStorage.getItem(DAILY_ACTIVITY_KEY);
    if (dailyData) {
      const daily = JSON.parse(dailyData);
      const dailyRows = Object.entries(daily).map(([date, data]) => ({
        user_id: userId,
        date: date,
        questions_answered: data.questions || 0,
        correct_answers: data.correct || 0,
        mastery_gained: data.masteryGained || 0
      }));

      if (dailyRows.length > 0) {
        await restFetch('daily_activity?on_conflict=user_id,date', {
          method: 'POST',
          body: JSON.stringify(dailyRows),
          prefer: 'resolution=merge-duplicates',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
        });
      }
    }

    console.log('Migration to cloud complete!');
    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
};

/**
 * Load all user data from Supabase to localStorage
 */
export const loadFromCloud = async (userId) => {
  try {
    // 1. Load progress
    const { data: progressRows } = await restFetch(
      `user_progress?user_id=eq.${userId}&select=*`
    );

    if (progressRows && progressRows.length > 0) {
      const progress = {};
      progressRows.forEach(row => {
        progress[row.objective_code] = {
          quickCorrect: row.quick_correct,
          examPassed: row.exam_passed,
          lastPracticed: row.last_practiced ? new Date(row.last_practiced).getTime() : null
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }

    // 2. Load FSRS data
    const { data: fsrsRows } = await restFetch(
      `user_fsrs_cards?user_id=eq.${userId}&select=*`
    );

    if (fsrsRows && fsrsRows.length > 0) {
      const existingFsrs = JSON.parse(localStorage.getItem(FSRS_DATA_KEY) || '{}');
      const questionCards = {};
      fsrsRows.forEach(row => {
        questionCards[row.question_id] = {
          stability: row.stability,
          difficulty: row.difficulty,
          lastReview: row.last_review ? new Date(row.last_review).getTime() : null,
          nextReview: row.next_review ? new Date(row.next_review).getTime() : null,
          reps: row.reps,
          lapses: row.lapses,
          state: row.state
        };
      });
      localStorage.setItem(FSRS_DATA_KEY, JSON.stringify({
        ...existingFsrs,
        questionCards
      }));
    }

    // 3. Load streak data
    const { data: streakRows } = await restFetch(
      `user_streaks?user_id=eq.${userId}&select=*`
    );
    const streakRow = streakRows && streakRows.length > 0 ? streakRows[0] : null;

    if (streakRow) {
      const streakData = streakRow.streak_data || {};
      streakData.currentStreak = streakRow.current_streak;
      streakData.longestStreak = streakRow.longest_streak;
      streakData.freezesAvailable = streakRow.freezes_available;
      streakData.lastActivityDate = streakRow.last_activity_date;
      localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(streakData));
    }

    // 4. Load settings
    const { data: settingsRows } = await restFetch(
      `user_settings?user_id=eq.${userId}&select=*`
    );
    const settingsRow = settingsRows && settingsRows.length > 0 ? settingsRows[0] : null;

    if (settingsRow) {
      const settings = {
        questionsPerSession: settingsRow.questions_per_session,
        showHints: settingsRow.show_hints,
        includeHigherTier: settingsRow.include_higher_tier,
        dailyGoal: settingsRow.daily_goal,
        weeklyMasteryGoal: settingsRow.weekly_mastery_goal,
        fontSize: settingsRow.font_size,
        dyslexiaFont: settingsRow.dyslexia_font,
        highContrast: settingsRow.high_contrast
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    // 5. Load daily activity
    const { data: dailyRows } = await restFetch(
      `daily_activity?user_id=eq.${userId}&select=*`
    );

    if (dailyRows && dailyRows.length > 0) {
      const daily = {};
      dailyRows.forEach(row => {
        daily[row.date] = {
          questions: row.questions_answered,
          correct: row.correct_answers,
          masteryGained: row.mastery_gained
        };
      });
      localStorage.setItem(DAILY_ACTIVITY_KEY, JSON.stringify(daily));
    }

    const hasData = (progressRows && progressRows.length > 0) ||
                     (fsrsRows && fsrsRows.length > 0) ||
                     !!streakRow ||
                     !!settingsRow ||
                     (dailyRows && dailyRows.length > 0);

    console.log('Loaded data from cloud!', hasData ? '(found data)' : '(empty)');
    return { success: true, hasData };
  } catch (error) {
    console.error('Load from cloud error:', error);
    return { success: false, hasData: false, error };
  }
};

/**
 * Save progress to cloud (debounced - call this after updates)
 */
let saveTimeout = null;
export const saveProgressToCloud = async (userId, progress) => {
  if (!userId) return;

  // Debounce saves to batch updates
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    try {
      const progressRows = Object.entries(progress).map(([code, data]) => ({
        user_id: userId,
        objective_code: code,
        quick_correct: data.quickCorrect || 0,
        exam_passed: data.examPassed || false,
        last_practiced: data.lastPracticed ? new Date(data.lastPracticed).toISOString() : null,
        updated_at: new Date().toISOString()
      }));

      if (progressRows.length > 0) {
        await restFetch('user_progress?on_conflict=user_id,objective_code', {
          method: 'POST',
          body: JSON.stringify(progressRows),
          prefer: 'resolution=merge-duplicates',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
        });
      }
    } catch (error) {
      console.error('Error saving progress to cloud:', error);
    }
  }, 2000); // Wait 2 seconds before saving
};

/**
 * Save FSRS data to cloud
 */
let fsrsSaveTimeout = null;
export const saveFsrsToCloud = async (userId, fsrsData) => {
  if (!userId || !fsrsData?.questionCards) return;

  if (fsrsSaveTimeout) clearTimeout(fsrsSaveTimeout);

  fsrsSaveTimeout = setTimeout(async () => {
    try {
      const fsrsRows = Object.entries(fsrsData.questionCards).map(([questionId, card]) => ({
        user_id: userId,
        question_id: questionId,
        stability: card.stability || 1.0,
        difficulty: card.difficulty || 0.5,
        last_review: card.lastReview ? new Date(card.lastReview).toISOString() : null,
        next_review: card.nextReview ? new Date(card.nextReview).toISOString() : null,
        reps: card.reps || 0,
        lapses: card.lapses || 0,
        state: card.state || 'new',
        updated_at: new Date().toISOString()
      }));

      if (fsrsRows.length > 0) {
        await restFetch('user_fsrs_cards?on_conflict=user_id,question_id', {
          method: 'POST',
          body: JSON.stringify(fsrsRows),
          prefer: 'resolution=merge-duplicates',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
        });
      }
    } catch (error) {
      console.error('Error saving FSRS to cloud:', error);
    }
  }, 2000);
};

/**
 * Save streak data to cloud
 */
export const saveStreakToCloud = async (userId, streakData) => {
  if (!userId) return;

  try {
    await restFetch('user_streaks?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        current_streak: streakData.currentStreak || 0,
        longest_streak: streakData.longestStreak || 0,
        freezes_available: streakData.freezesAvailable || 0,
        last_activity_date: streakData.lastActivityDate || null,
        streak_data: streakData,
        updated_at: new Date().toISOString()
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
    });
  } catch (error) {
    console.error('Error saving streak to cloud:', error);
  }
};

/**
 * Save settings to cloud
 */
export const saveSettingsToCloud = async (userId, settings) => {
  if (!userId) return;

  try {
    await restFetch('user_settings?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        questions_per_session: settings.questionsPerSession || 7,
        show_hints: settings.showHints !== false,
        include_higher_tier: settings.includeHigherTier || false,
        daily_goal: settings.dailyGoal || 7,
        weekly_mastery_goal: settings.weeklyMasteryGoal || 3,
        font_size: settings.fontSize || 'normal',
        dyslexia_font: settings.dyslexiaFont || false,
        high_contrast: settings.highContrast || false,
        updated_at: new Date().toISOString()
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
    });
  } catch (error) {
    console.error('Error saving settings to cloud:', error);
  }
};

/**
 * Save daily activity to cloud
 */
export const saveDailyActivityToCloud = async (userId, date, activity) => {
  if (!userId) return;

  try {
    await restFetch('daily_activity?on_conflict=user_id,date', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        date: date,
        questions_answered: activity.questions || 0,
        correct_answers: activity.correct || 0,
        mastery_gained: activity.masteryGained || 0,
        updated_at: new Date().toISOString()
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
    });
  } catch (error) {
    console.error('Error saving daily activity to cloud:', error);
  }
};
