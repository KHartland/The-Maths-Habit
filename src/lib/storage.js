// ==================== STORAGE KEYS ====================
export const STORAGE_KEY = 'maths-habit-progress';
export const SETTINGS_KEY = 'maths-habit-settings';
export const SESSION_COUNT_KEY = 'maths-habit-session-count';
export const SESSION_HISTORY_KEY = 'maths-habit-session-history';
export const DAILY_ACTIVITY_KEY = 'maths-habit-daily-activity';
export const STREAK_DATA_KEY = 'maths-habit-streak-data';
export const TOTAL_QUESTIONS_KEY = 'maths-habit-total-questions';
export const PIRO_KEY = 'maths-habit-piro';
export const ONBOARDING_COMPLETE_KEY = 'maths-habit-onboarding-complete';

// ==================== QUICK FIRE THRESHOLDS ====================
export const QUICKFIRE_MASTERY_THRESHOLD = 5;
export const QUICKFIRE_STREAK_THRESHOLD = 3;

// ==================== ONBOARDING ====================
export const isOnboardingComplete = () => {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch { return false; }
};

export const setOnboardingComplete = () => {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {}
};

// ==================== PRACTICE TIPS SYSTEM ====================
export const TIPS_STORAGE_KEY = 'maths-habit-tips-shown';

export const PRACTICE_TIPS = {
  firstQuestion: {
    id: 'firstQuestion',
    text: 'Answer each question to build your mastery. Get 4 right to master an objective!',
  },
  firstCorrect: {
    id: 'firstCorrect',
    text: 'Nice! Keep practising to unlock Quick Fire mode (5 objectives mastered) and Exam mode (10 mastered).',
  },
  firstIncorrect: {
    id: 'firstIncorrect',
    text: "Don't worry! Mistakes help you learn. You'll get easier building-block questions to strengthen your skills.",
  },
  sessionComplete: {
    id: 'sessionComplete',
    text: 'Come back tomorrow to build your streak! Consistent daily practice is the fastest way to improve.',
  },
  secondSession: {
    id: 'secondSession',
    text: 'Your progress is tracked on the home screen heatmap. Each square represents a GCSE objective.',
  },
};

export const loadShownTips = () => {
  try {
    return JSON.parse(localStorage.getItem(TIPS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const markTipShown = (tipId) => {
  try {
    const shown = loadShownTips();
    if (!shown.includes(tipId)) {
      shown.push(tipId);
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(shown));
    }
  } catch {}
};

// ==================== DEFAULT OBJECTS ====================
export const defaultStreakData = {
  freezesAvailable: 1, // Start with 1 free freeze
  freezesUsed: [], // Dates when freezes were used
  lastStreakMilestone: 0, // Last streak length that earned a freeze
  repairNeeded: false, // Whether streak needs repair
  repairDate: null, // Date when repair became needed
  longestStreak: 0, // Personal best
};

export const defaultSettings = {
  questionsPerSession: 5,
  showHints: true,
  includeHigherTier: false,
  dailyGoal: 10, // questions per day
  weeklyMasteryGoal: 3, // objectives to master per week
  // Accessibility
  fontSize: 'normal', // 'normal', 'large', 'xlarge'
  dyslexiaFont: false,
};

// ==================== LOAD/SAVE PROGRESS ====================
export const loadProgress = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

export const saveProgress = (progress) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
};

// ==================== SESSION COUNT ====================
export const loadSessionCount = () => {
  try {
    const saved = localStorage.getItem(SESSION_COUNT_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch { return 0; }
};

export const saveSessionCount = (count) => {
  try {
    localStorage.setItem(SESSION_COUNT_KEY, count.toString());
  } catch {}
};

// ==================== SESSION HISTORY ====================
export const loadSessionHistory = () => {
  try {
    const saved = localStorage.getItem(SESSION_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

export const saveSessionHistory = (history) => {
  try {
    // Keep last 100 sessions
    const trimmed = history.slice(-100);
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
};

// ==================== RECENT QUESTIONS ====================
// Recently answered question IDs — prevents repeats across sessions
export const RECENT_QUESTIONS_KEY = 'maths-habit-recent-questions';
export const MAX_RECENT_QUESTIONS = 120; // Track last 120 answered questions

export const loadRecentQuestions = () => {
  try {
    const saved = localStorage.getItem(RECENT_QUESTIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

export const saveRecentQuestions = (list) => {
  try {
    const trimmed = list.slice(-MAX_RECENT_QUESTIONS);
    localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(trimmed));
  } catch {}
};

// ==================== ANSWERED CORRECT ====================
// Permanently answered questions — once correct, never show again
export const ANSWERED_CORRECT_KEY = 'maths-habit-answered-correct';

export const loadAnsweredCorrect = () => {
  try {
    const saved = localStorage.getItem(ANSWERED_CORRECT_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
};

export const saveAnsweredCorrect = (set) => {
  try {
    localStorage.setItem(ANSWERED_CORRECT_KEY, JSON.stringify([...set]));
  } catch {}
};

// ==================== TOTAL QUESTIONS ====================
// Total questions answered (lifetime) - for AI unlock
export const loadTotalQuestions = () => {
  try {
    const saved = localStorage.getItem(TOTAL_QUESTIONS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch { return 0; }
};

export const saveTotalQuestions = (count) => {
  try {
    localStorage.setItem(TOTAL_QUESTIONS_KEY, count.toString());
  } catch {}
};

// ==================== DAILY ACTIVITY ====================
export const loadDailyActivity = () => {
  try {
    const saved = localStorage.getItem(DAILY_ACTIVITY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

export const saveDailyActivity = (activity) => {
  try {
    localStorage.setItem(DAILY_ACTIVITY_KEY, JSON.stringify(activity));
  } catch {}
};

export const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const recordDailyActivity = (questionsAnswered, correctCount, masteryGained) => {
  const activity = loadDailyActivity();
  const todayKey = getTodayKey();

  if (!activity[todayKey]) {
    activity[todayKey] = { questions: 0, correct: 0, mastery: 0, sessions: 0, firstPractice: Date.now() };
  }

  activity[todayKey].questions += questionsAnswered;
  activity[todayKey].correct += correctCount;
  activity[todayKey].mastery += masteryGained;
  activity[todayKey].sessions += 1;
  activity[todayKey].lastPractice = Date.now();

  saveDailyActivity(activity);
  return activity;
};

// ==================== STREAK DATA ====================
export const loadStreakData = () => {
  try {
    const saved = localStorage.getItem(STREAK_DATA_KEY);
    return saved ? { ...defaultStreakData, ...JSON.parse(saved) } : defaultStreakData;
  } catch { return defaultStreakData; }
};

export const saveStreakData = (data) => {
  try {
    localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
  } catch {}
};

export const calculateStreak = () => {
  const activity = loadDailyActivity();
  const streakData = loadStreakData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getTodayKey();

  const practicedToday = activity[todayKey]?.questions > 0;
  const todayGoalMet = (activity[todayKey]?.questions ?? 0) >= 5; // Min 5 questions for streak

  // Get yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const practicedYesterday = activity[yesterdayKey]?.questions >= 5;

  // Check if we need to use a freeze or initiate repair
  let needsRepair = streakData.repairNeeded;
  let freezeUsedToday = streakData.freezesUsed.includes(yesterdayKey);

  // If didn't practice yesterday and haven't used a freeze
  if (!practicedYesterday && !freezeUsedToday && !needsRepair) {
    // Check if there was a streak to protect
    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    const twoDaysAgoKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;
    const hadStreak = activity[twoDaysAgoKey]?.questions >= 5;

    if (hadStreak) {
      // Try to auto-use a freeze
      if (streakData.freezesAvailable > 0) {
        streakData.freezesAvailable--;
        streakData.freezesUsed.push(yesterdayKey);
        freezeUsedToday = true;
        saveStreakData(streakData);
      } else {
        // No freeze available - streak needs repair
        streakData.repairNeeded = true;
        streakData.repairDate = yesterdayKey;
        needsRepair = true;
        saveStreakData(streakData);
      }
    }
  }

  // Calculate actual streak
  let streak = 0;
  let checkDate = new Date(today);

  // If not practiced today, start checking from yesterday
  if (!todayGoalMet) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days (including freeze days)
  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const practiced = activity[key]?.questions >= 5;
    const froze = streakData.freezesUsed.includes(key);

    if (practiced || froze) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 365) break;
  }

  // Update longest streak
  if (streak > streakData.longestStreak) {
    streakData.longestStreak = streak;
    saveStreakData(streakData);
  }

  // Check for repair completion (double session = 10+ questions)
  const repairCompleted = needsRepair && (activity[todayKey]?.questions ?? 0) >= 10;
  if (repairCompleted) {
    streakData.repairNeeded = false;
    streakData.repairDate = null;
    saveStreakData(streakData);
    needsRepair = false;
  }

  // Calculate repair progress
  const repairProgress = needsRepair ? Math.min((activity[todayKey]?.questions ?? 0) / 10 * 100, 100) : 0;

  return {
    streak: needsRepair ? 0 : streak, // Show 0 if repair needed
    potentialStreak: streak, // What streak would be after repair
    practicedToday: todayGoalMet,
    needsRepair,
    repairProgress,
    repairCompleted,
    freezesAvailable: streakData.freezesAvailable,
    freezeUsedToday,
    longestStreak: streakData.longestStreak,
  };
};

// ==================== STREAK MILESTONES ====================
// Award streak freeze for milestones
export const checkStreakMilestone = (streak) => {
  const streakData = loadStreakData();
  const milestones = [7, 14, 30, 60, 90, 180, 365]; // Days that earn freezes

  for (const milestone of milestones) {
    if (streak >= milestone && streakData.lastStreakMilestone < milestone) {
      streakData.freezesAvailable++;
      streakData.lastStreakMilestone = milestone;
      saveStreakData(streakData);
      return { earned: true, milestone, total: streakData.freezesAvailable };
    }
  }
  return { earned: false };
};
