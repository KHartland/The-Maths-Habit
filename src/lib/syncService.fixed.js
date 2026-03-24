import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';

// ─── localStorage keys ───────────────────────────────────────────────
const PROGRESS_KEY      = 'maths-habit-progress';
const SETTINGS_KEY      = 'maths-habit-settings';
const FSRS_KEY          = 'maths-habit-fsrs';
const STREAK_KEY        = 'maths-habit-streak-data';
const DAILY_KEY         = 'maths-habit-daily-activity';

// ─── Auth helper ─────────────────────────────────────────────────────
const getAuthToken = () => {
  try {
    const raw = localStorage.getItem('sb-kxvtiqkmxhqwqckjikje-auth-token');
    const parsed = raw && JSON.parse(raw);
    if (parsed?.access_token) return parsed.access_token;
  } catch (e) {
    console.error('Failed to read auth token:', e);
  }
  return supabaseAnonKey;
};

// ─── Generic Supabase REST helper ────────────────────────────────────
const supabaseRest = async (path, opts = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const token = getAuthToken();

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: opts.prefer || '',
        ...opts.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 || body.includes('PGRST116')) return { data: null, notFound: true };
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const text = await res.text();
    return text ? { data: JSON.parse(text) } : { data: null };
  } catch (e) {
    clearTimeout(timeout);
    throw e.name === 'AbortError' ? new Error('Request timed out (10s)') : e;
  }
};

// ─── MIGRATION: one-time upload of all local data ────────────────────
export const migrateToCloud = async (userId) => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const progress = JSON.parse(raw);
      const rows = Object.entries(progress).map(([code, obj]) => ({
        user_id: userId,
        objective_code: code,
        quick_correct: obj.quickCorrect || 0,
        exam_passed: obj.examPassed || false,
        last_practiced: obj.lastPracticed ? new Date(obj.lastPracticed).toISOString() : null,
      }));
      if (rows.length > 0) {
        await supabaseRest('user_progress?on_conflict=user_id,objective_code', {
          method: 'POST',
          body: JSON.stringify(rows),
          prefer: 'resolution=merge-duplicates',
          headers: { Prefer: 'resolution=merge-duplicates' },
        });
      }
    }

    const fsrsRaw = localStorage.getItem(FSRS_KEY);
    if (fsrsRaw) {
      const fsrs = JSON.parse(fsrsRaw);
      if (fsrs.questionCards) {
        const rows = Object.entries(fsrs.questionCards).map(([id, card]) => ({
          user_id: userId,
          question_id: id,
          stability: card.stability || 1,
          difficulty: card.difficulty || 0.5,
          last_review: card.lastReview ? new Date(card.lastReview).toISOString() : null,
          next_review: card.nextReview ? new Date(card.nextReview).toISOString() : null,
          reps: card.reps || 0,
          lapses: card.lapses || 0,
          state: card.state || 'new',
        }));
        if (rows.length > 0) {
          await supabaseRest('user_fsrs_cards?on_conflict=user_id,question_id', {
            method: 'POST',
            body: JSON.stringify(rows),
            prefer: 'resolution=merge-duplicates',
            headers: { Prefer: 'resolution=merge-duplicates' },
          });
        }
      }
    }

    const streakRaw = localStorage.getItem(STREAK_KEY);
    if (streakRaw) {
      const streak = JSON.parse(streakRaw);
      await supabaseRest('user_streaks?on_conflict=user_id', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          current_streak: streak.currentStreak || 0,
          longest_streak: streak.longestStreak || 0,
          freezes_available: streak.freezesAvailable || 0,
          last_activity_date: streak.lastActivityDate || null,
          streak_data: streak,
        }),
        prefer: 'resolution=merge-duplicates',
        headers: { Prefer: 'resolution=merge-duplicates' },
      });
    }

    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      const s = JSON.parse(settingsRaw);
      await supabaseRest('user_settings?on_conflict=user_id', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          questions_per_session: s.questionsPerSession || 7,
          show_hints: s.showHints !== false,
          include_higher_tier: s.includeHigherTier || false,
          daily_goal: s.dailyGoal || 7,
          weekly_mastery_goal: s.weeklyMasteryGoal || 3,
          font_size: s.fontSize || 'normal',
          dyslexia_font: s.dyslexiaFont || false,
          high_contrast: s.highContrast || false,
        }),
        prefer: 'resolution=merge-duplicates',
        headers: { Prefer: 'resolution=merge-duplicates' },
      });
    }

    const dailyRaw = localStorage.getItem(DAILY_KEY);
    if (dailyRaw) {
      const daily = JSON.parse(dailyRaw);
      const rows = Object.entries(daily).map(([date, d]) => ({
        user_id: userId,
        date,
        questions_answered: d.questions || 0,
        correct_answers: d.correct || 0,
        mastery_gained: d.masteryGained || 0,
      }));
      if (rows.length > 0) {
        await supabaseRest('daily_activity?on_conflict=user_id,date', {
          method: 'POST',
          body: JSON.stringify(rows),
          prefer: 'resolution=merge-duplicates',
          headers: { Prefer: 'resolution=merge-duplicates' },
        });
      }
    }

    return { success: true };
  } catch (e) {
    console.error('Migration error:', e);
    return { success: false, error: e };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PULL — load from cloud into localStorage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX: the old version blindly overwrote local progress with server data.
// Now we use a "highest-wins" merge for quickCorrect so mastery is never lost.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const loadFromCloud = async (userId) => {
  try {
    // ── Progress (FIXED: highest-wins merge) ──────────────────────────
    const { data: progressRows } = await supabaseRest(
      `user_progress?user_id=eq.${userId}&select=*`
    );

    if (progressRows && progressRows.length > 0) {
      // Read current local progress FIRST
      const localProgress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');

      // Merge: for each objective keep whichever quickCorrect is HIGHER
      progressRows.forEach((row) => {
        const code = row.objective_code;
        const serverQC = row.quick_correct ?? 0;
        const localQC = localProgress[code]?.quickCorrect ?? 0;

        const serverLastPracticed = row.last_practiced
          ? new Date(row.last_practiced).getTime()
          : null;
        const localLastPracticed = localProgress[code]?.lastPracticed ?? null;

        // Keep the HIGHER quickCorrect value
        const mergedQC = Math.max(serverQC, localQC);

        // Keep the MORE RECENT lastPracticed
        const mergedLastPracticed =
          serverLastPracticed && localLastPracticed
            ? Math.max(serverLastPracticed, localLastPracticed)
            : serverLastPracticed || localLastPracticed;

        // examPassed: true wins (once passed, always passed)
        const mergedExamPassed =
          (row.exam_passed || false) || (localProgress[code]?.examPassed || false);

        localProgress[code] = {
          ...localProgress[code],               // preserve any extra local fields (skipUntilSession, nextDue, masteredAt, etc.)
          quickCorrect: mergedQC,
          examPassed: mergedExamPassed,
          lastPracticed: mergedLastPracticed,
        };
      });

      localStorage.setItem(PROGRESS_KEY, JSON.stringify(localProgress));
    }

    // ── FSRS cards ────────────────────────────────────────────────────
    const { data: fsrsRows } = await supabaseRest(
      `user_fsrs_cards?user_id=eq.${userId}&select=*`
    );

    if (fsrsRows && fsrsRows.length > 0) {
      const localFsrs = JSON.parse(localStorage.getItem(FSRS_KEY) || '{}');
      const cards = {};
      fsrsRows.forEach((row) => {
        cards[row.question_id] = {
          stability: row.stability,
          difficulty: row.difficulty,
          lastReview: row.last_review ? new Date(row.last_review).getTime() : null,
          nextReview: row.next_review ? new Date(row.next_review).getTime() : null,
          reps: row.reps,
          lapses: row.lapses,
          state: row.state,
        };
      });
      localStorage.setItem(FSRS_KEY, JSON.stringify({ ...localFsrs, questionCards: cards }));
    }

    // ── Streaks ───────────────────────────────────────────────────────
    const { data: streakRows } = await supabaseRest(
      `user_streaks?user_id=eq.${userId}&select=*`
    );
    const streakRow = streakRows && streakRows.length > 0 ? streakRows[0] : null;

    if (streakRow) {
      const cloud = streakRow.streak_data || {};
      cloud.currentStreak = streakRow.current_streak;
      cloud.longestStreak = streakRow.longest_streak;
      cloud.freezesAvailable = streakRow.freezes_available;
      cloud.lastActivityDate = streakRow.last_activity_date;

      const local = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
      // Don't overwrite a local "repairNeeded: false" with cloud "repairNeeded: true"
      if (local.repairNeeded === false && cloud.repairNeeded === true) {
        // skip
      } else {
        localStorage.setItem(STREAK_KEY, JSON.stringify(cloud));
      }
    }

    // ── Settings ──────────────────────────────────────────────────────
    const { data: settingsRows } = await supabaseRest(
      `user_settings?user_id=eq.${userId}&select=*`
    );
    const settingsRow = settingsRows && settingsRows.length > 0 ? settingsRows[0] : null;

    if (settingsRow) {
      const s = {
        questionsPerSession: settingsRow.questions_per_session,
        showHints: settingsRow.show_hints,
        includeHigherTier: settingsRow.include_higher_tier,
        dailyGoal: settingsRow.daily_goal,
        weeklyMasteryGoal: settingsRow.weekly_mastery_goal,
        fontSize: settingsRow.font_size,
        dyslexiaFont: settingsRow.dyslexia_font,
        highContrast: settingsRow.high_contrast,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    // ── Daily activity (already used highest-wins in original) ────────
    const { data: dailyRows } = await supabaseRest(
      `daily_activity?user_id=eq.${userId}&select=*`
    );

    if (dailyRows && dailyRows.length > 0) {
      const local = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      const merged = { ...local };

      dailyRows.forEach((row) => {
        const cloud = {
          questions: row.questions_answered,
          correct: row.correct_answers,
          mastery: row.mastery_gained,
          sessions: local[row.date]?.sessions || 0,
          firstPractice: local[row.date]?.firstPractice || null,
          lastPractice: local[row.date]?.lastPractice || null,
        };
        if (!merged[row.date] || cloud.questions > (merged[row.date].questions || 0)) {
          merged[row.date] = { ...merged[row.date], ...cloud };
        }
      });

      localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
    }

    return {
      success: true,
      hasData:
        (progressRows && progressRows.length > 0) ||
        (fsrsRows && fsrsRows.length > 0) ||
        !!streakRow ||
        !!settingsRow ||
        (dailyRows && dailyRows.length > 0),
    };
  } catch (e) {
    console.error('Load from cloud error:', e);
    return { success: false, hasData: false, error: e };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUSH — save local data to cloud
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Save progress (called directly and via debounce)
const saveProgressToCloud = async (userId, progress) => {
  try {
    const rows = Object.entries(progress).map(([code, obj]) => ({
      user_id: userId,
      objective_code: code,
      quick_correct: obj.quickCorrect || 0,
      exam_passed: obj.examPassed || false,
      last_practiced: obj.lastPracticed ? new Date(obj.lastPracticed).toISOString() : null,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await supabaseRest('user_progress?on_conflict=user_id,objective_code', {
        method: 'POST',
        body: JSON.stringify(rows),
        prefer: 'resolution=merge-duplicates',
        headers: { Prefer: 'resolution=merge-duplicates' },
      });
    }
  } catch (e) {
    console.error('Error saving progress to cloud:', e);
  }
};

// Debounced wrapper (2 s)
let progressTimer = null;
export const debouncedSaveProgress = async (userId, progress, immediate = false) => {
  if (!userId) return;
  if (immediate) {
    progressTimer && clearTimeout(progressTimer);
    progressTimer = null;
    return saveProgressToCloud(userId, progress);
  }
  progressTimer && clearTimeout(progressTimer);
  progressTimer = setTimeout(() => saveProgressToCloud(userId, progress), 2000);
};

// Save FSRS cards (2 s debounce)
let fsrsTimer = null;
export const saveFsrsToCloud = async (userId, fsrsState) => {
  if (!userId || !fsrsState?.questionCards) return;
  fsrsTimer && clearTimeout(fsrsTimer);
  fsrsTimer = setTimeout(async () => {
    try {
      const rows = Object.entries(fsrsState.questionCards).map(([id, card]) => ({
        user_id: userId,
        question_id: id,
        stability: card.stability || 1,
        difficulty: card.difficulty || 0.5,
        last_review: card.lastReview ? new Date(card.lastReview).toISOString() : null,
        next_review: card.nextReview ? new Date(card.nextReview).toISOString() : null,
        reps: card.reps || 0,
        lapses: card.lapses || 0,
        state: card.state || 'new',
        updated_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        await supabaseRest('user_fsrs_cards?on_conflict=user_id,question_id', {
          method: 'POST',
          body: JSON.stringify(rows),
          prefer: 'resolution=merge-duplicates',
          headers: { Prefer: 'resolution=merge-duplicates' },
        });
      }
    } catch (e) {
      console.error('Error saving FSRS to cloud:', e);
    }
  }, 2000);
};

// Save streaks
export const saveStreakToCloud = async (userId, streakData) => {
  if (!userId) return;
  try {
    await supabaseRest('user_streaks?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        current_streak: streakData.currentStreak || 0,
        longest_streak: streakData.longestStreak || 0,
        freezes_available: streakData.freezesAvailable || 0,
        last_activity_date: streakData.lastActivityDate || null,
        streak_data: streakData,
        updated_at: new Date().toISOString(),
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { Prefer: 'resolution=merge-duplicates' },
    });
  } catch (e) {
    console.error('Error saving streak to cloud:', e);
  }
};

// Save settings
export const saveSettingsToCloud = async (userId, settings) => {
  if (!userId) return;
  try {
    await supabaseRest('user_settings?on_conflict=user_id', {
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
        updated_at: new Date().toISOString(),
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { Prefer: 'resolution=merge-duplicates' },
    });
  } catch (e) {
    console.error('Error saving settings to cloud:', e);
  }
};

// Save daily activity
export const saveDailyActivityToCloud = async (userId, date, activity) => {
  if (!userId) return;
  try {
    await supabaseRest('daily_activity?on_conflict=user_id,date', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        date,
        questions_answered: activity.questions || 0,
        correct_answers: activity.correct || 0,
        mastery_gained: activity.mastery || activity.masteryGained || 0,
        updated_at: new Date().toISOString(),
      }),
      prefer: 'resolution=merge-duplicates',
      headers: { Prefer: 'resolution=merge-duplicates' },
    });
  } catch (e) {
    console.error('Error saving daily activity to cloud:', e);
  }
};
