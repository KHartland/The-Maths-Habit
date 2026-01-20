import { supabase } from './supabase';

// Storage keys (same as in App.jsx)
const STORAGE_KEY = 'maths-habit-progress';
const SETTINGS_KEY = 'maths-habit-settings';
const FSRS_DATA_KEY = 'maths-habit-fsrs';
const STREAK_DATA_KEY = 'maths-habit-streak-data';
const DAILY_ACTIVITY_KEY = 'maths-habit-daily-activity';
const SESSION_COUNT_KEY = 'maths-habit-session-count';
const TOTAL_QUESTIONS_KEY = 'maths-habit-total-questions';

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
        await supabase.from('user_progress').upsert(progressRows, {
          onConflict: 'user_id,objective_code'
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
          await supabase.from('user_fsrs_cards').upsert(fsrsRows, {
            onConflict: 'user_id,question_id'
          });
        }
      }
    }

    // 3. Migrate streak data
    const streakData = localStorage.getItem(STREAK_DATA_KEY);
    if (streakData) {
      const streak = JSON.parse(streakData);
      await supabase.from('user_streaks').upsert({
        user_id: userId,
        current_streak: streak.currentStreak || 0,
        longest_streak: streak.longestStreak || 0,
        freezes_available: streak.freezesAvailable || 0,
        last_activity_date: streak.lastActivityDate || null,
        streak_data: streak
      }, {
        onConflict: 'user_id'
      });
    }

    // 4. Migrate settings
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    if (settingsData) {
      const settings = JSON.parse(settingsData);
      await supabase.from('user_settings').upsert({
        user_id: userId,
        questions_per_session: settings.questionsPerSession || 7,
        show_hints: settings.showHints !== false,
        include_higher_tier: settings.includeHigherTier || false,
        daily_goal: settings.dailyGoal || 7,
        weekly_mastery_goal: settings.weeklyMasteryGoal || 3,
        font_size: settings.fontSize || 'normal',
        dyslexia_font: settings.dyslexiaFont || false,
        high_contrast: settings.highContrast || false
      }, {
        onConflict: 'user_id'
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
        await supabase.from('daily_activity').upsert(dailyRows, {
          onConflict: 'user_id,date'
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
    const { data: progressRows } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);

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
    const { data: fsrsRows } = await supabase
      .from('user_fsrs_cards')
      .select('*')
      .eq('user_id', userId);

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
    const { data: streakRow } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (streakRow) {
      const streakData = streakRow.streak_data || {};
      streakData.currentStreak = streakRow.current_streak;
      streakData.longestStreak = streakRow.longest_streak;
      streakData.freezesAvailable = streakRow.freezes_available;
      streakData.lastActivityDate = streakRow.last_activity_date;
      localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(streakData));
    }

    // 4. Load settings
    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

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
    const { data: dailyRows } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', userId);

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

    console.log('Loaded data from cloud!');
    return { success: true };
  } catch (error) {
    console.error('Load from cloud error:', error);
    return { success: false, error };
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
        await supabase.from('user_progress').upsert(progressRows, {
          onConflict: 'user_id,objective_code'
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
        await supabase.from('user_fsrs_cards').upsert(fsrsRows, {
          onConflict: 'user_id,question_id'
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
    await supabase.from('user_streaks').upsert({
      user_id: userId,
      current_streak: streakData.currentStreak || 0,
      longest_streak: streakData.longestStreak || 0,
      freezes_available: streakData.freezesAvailable || 0,
      last_activity_date: streakData.lastActivityDate || null,
      streak_data: streakData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
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
    await supabase.from('user_settings').upsert({
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
    }, {
      onConflict: 'user_id'
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
    await supabase.from('daily_activity').upsert({
      user_id: userId,
      date: date,
      questions_answered: activity.questions || 0,
      correct_answers: activity.correct || 0,
      mastery_gained: activity.masteryGained || 0,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date'
    });
  } catch (error) {
    console.error('Error saving daily activity to cloud:', error);
  }
};
