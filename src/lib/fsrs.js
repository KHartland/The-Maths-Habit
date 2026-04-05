// ==================== FSRS ALGORITHM (Cognitive Science) ====================
// Based on Free Spaced Repetition Scheduler - 20-30% more efficient than SM-2
// Extracted from App.jsx for maintainability

const FSRS_DATA_KEY = 'maths-habit-fsrs';
const MIGRATION_VERSION_KEY = 'maths-habit-migration-version';
const CURRENT_MIGRATION_VERSION = 2;

// FSRS Constants (research-backed defaults)
const FSRS_DEFAULTS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9,   // Target 90% retention rate
  maxInterval: 365,        // Max interval in days
  DECAY: -0.5,
  FACTOR: 19 / 81,
  learningSteps: [10, 60],  // Minutes for learning steps (10min, then 1 hour)
  relearningSteps: [30],    // Minutes for relearning (30 min)
};

// Rating enum for FSRS
const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

// Calculate retrievability (probability of recall) using power function
const fsrsRetrievability = (elapsedDays, stability) => {
  if (!stability || stability <= 0) return 0;
  const { DECAY, FACTOR } = FSRS_DEFAULTS;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
};

// Calculate next interval given stability and target retention
const fsrsInterval = (stability, requestRetention = 0.9) => {
  const { DECAY, FACTOR, maxInterval } = FSRS_DEFAULTS;
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return Math.min(Math.max(1, Math.round(interval)), maxInterval);
};

// Update stability after successful review
const fsrsNextStability = (card, rating, elapsedDays) => {
  const w = FSRS_DEFAULTS.w;
  const { stability: S, difficulty: D } = card;

  if (rating === Rating.Again) {
    // Lapse: stability decreases significantly
    const retrievability = fsrsRetrievability(elapsedDays, S);
    const newS = w[11] * Math.pow(D + 0.1, -w[12]) * (Math.pow(S + 1, w[13]) - 1) *
                 Math.exp(w[14] * (1 - retrievability));
    return Math.max(0.1, newS);
  }

  // Successful recall: stability increases
  const hardPenalty = rating === Rating.Hard ? w[15] : 1;
  const easyBonus = rating === Rating.Easy ? w[16] : 1;
  const retrievability = fsrsRetrievability(elapsedDays, S);

  const newS = S * (1 + Math.exp(w[8]) *
              (11 - D * 10) *
              Math.pow(S, -w[9]) *
              (Math.exp(w[10] * (1 - retrievability)) - 1) *
              hardPenalty * easyBonus);

  return Math.min(Math.max(0.1, newS), FSRS_DEFAULTS.maxInterval);
};

// Update difficulty after review
const fsrsNextDifficulty = (currentD, rating) => {
  const w = FSRS_DEFAULTS.w;
  const delta = (rating - 3) / 3; // -0.67 to +0.33
  const newD = currentD - w[6] * delta;

  // Mean reversion toward default difficulty
  const meanD = w[4] / 10;
  const revertedD = w[7] * meanD + (1 - w[7]) * newD;

  return Math.max(0.1, Math.min(1, revertedD));
};

// Generate stable question ID from objective code and question content
const getQuestionId = (objectiveCode, questionIndex, question) => {
  const hash = simpleHash((question.q || '') + (question.a || ''));
  return `${objectiveCode}_${questionIndex}_${hash}`;
};

const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
};

// Initialize new FSRS card
const fsrsInitCard = (questionId) => ({
  questionId,
  stability: FSRS_DEFAULTS.w[0],
  difficulty: FSRS_DEFAULTS.w[4] / 10,
  lastReview: null,
  nextReview: Date.now(),
  reps: 0,
  lapses: 0,
  state: 'new', // 'new', 'learning', 'review', 'relearning'
  learningStep: 0,
  confidenceHistory: [],
  responseTimeHistory: [],
});

// Process review and update FSRS card
const fsrsReview = (card, rating, responseTime, confidence = null) => {
  const now = Date.now();
  const elapsedDays = card.lastReview
    ? (now - card.lastReview) / (1000 * 60 * 60 * 24)
    : 0;

  const updated = { ...card };

  // Record confidence calibration for metacognition tracking
  if (confidence !== null) {
    const retrievability = card.lastReview
      ? fsrsRetrievability(elapsedDays, card.stability)
      : 0.5;
    updated.confidenceHistory = [
      ...(updated.confidenceHistory || []).slice(-49),
      { predicted: confidence, actual: rating >= Rating.Good ? 1 : 0, retrievability, timestamp: now }
    ];
  }

  // Record response time
  updated.responseTimeHistory = [
    ...(updated.responseTimeHistory || []).slice(-19),
    responseTime
  ];
  updated.avgResponseTime = updated.responseTimeHistory.reduce((a, b) => a + b, 0) /
                            updated.responseTimeHistory.length;

  // Handle by card state
  if (card.state === 'new' || card.state === 'learning') {
    return fsrsHandleLearning(updated, rating, now);
  } else if (card.state === 'relearning') {
    return fsrsHandleRelearning(updated, rating, now);
  } else {
    return fsrsHandleReview(updated, rating, elapsedDays, now);
  }
};

// Handle learning state (new cards)
const fsrsHandleLearning = (card, rating, now) => {
  const learningSteps = FSRS_DEFAULTS.learningSteps;
  const updated = { ...card };

  if (rating === Rating.Again) {
    updated.learningStep = 0;
    updated.nextReview = now + learningSteps[0] * 60 * 1000;
  } else if (rating === Rating.Easy) {
    // Graduate immediately with bonus stability
    updated.state = 'review';
    updated.stability = FSRS_DEFAULTS.w[3];
    updated.reps = 1;
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  } else {
    // Good or Hard: advance learning step
    updated.learningStep = (updated.learningStep || 0) + 1;
    if (updated.learningStep >= learningSteps.length) {
      // Graduate to review state
      updated.state = 'review';
      updated.stability = rating === Rating.Hard ? FSRS_DEFAULTS.w[1] : FSRS_DEFAULTS.w[2];
      updated.reps = 1;
      updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
    } else {
      updated.nextReview = now + learningSteps[updated.learningStep] * 60 * 1000;
    }
  }

  updated.lastReview = now;
  return updated;
};

// Handle relearning state (lapsed cards)
const fsrsHandleRelearning = (card, rating, now) => {
  const relearningSteps = FSRS_DEFAULTS.relearningSteps;
  const updated = { ...card };

  if (rating === Rating.Again) {
    updated.learningStep = 0;
    updated.nextReview = now + relearningSteps[0] * 60 * 1000;
  } else {
    // Return to review state
    updated.state = 'review';
    updated.learningStep = 0;
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  }

  updated.lastReview = now;
  return updated;
};

// Handle review state (graduated cards)
const fsrsHandleReview = (card, rating, elapsedDays, now) => {
  const updated = { ...card };

  if (rating === Rating.Again) {
    // Lapse: enter relearning
    updated.lapses = (updated.lapses || 0) + 1;
    updated.state = 'relearning';
    updated.learningStep = 0;
    updated.stability = fsrsNextStability(card, rating, elapsedDays);
    updated.nextReview = now + (FSRS_DEFAULTS.relearningSteps[0] || 10) * 60 * 1000;
  } else {
    // Successful review
    updated.reps = (updated.reps || 0) + 1;
    updated.stability = fsrsNextStability(card, rating, elapsedDays);
    updated.difficulty = fsrsNextDifficulty(card.difficulty, rating);
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  }

  updated.lastReview = now;
  return updated;
};

// FSRS Data Storage
const loadFsrsData = () => {
  try {
    const saved = localStorage.getItem(FSRS_DATA_KEY);
    return saved ? JSON.parse(saved) : { questionCards: {}, params: { ...FSRS_DEFAULTS } };
  } catch { return { questionCards: {}, params: { ...FSRS_DEFAULTS } }; }
};

const saveFsrsData = (data) => {
  try {
    localStorage.setItem(FSRS_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save FSRS data:', e);
  }
};

// Discriminative interleaving pairs (commonly confused topics)
const confusablePairs = {
  'N5': ['N6'],        // BIDMAS vs powers
  'N6': ['N5'],
  'N8': ['R4'],        // HCF/LCM vs ratio simplification
  'R4': ['N8'],
  'N10': ['R9'],       // Converting fractions/decimals vs percentages
  'R9': ['N10'],
  'A4': ['A6'],        // Expanding vs rearranging
  'A6': ['A4'],
  'A17': ['A18'],      // Linear vs quadratic equations
  'A18': ['A17', 'A19'],
  'A19': ['A18'],      // Simultaneous vs quadratic
  'G3': ['G4'],        // Angle facts vs parallel lines
  'G4': ['G3', 'G5'],
  'G5': ['G4'],        // Polygon angles
  'G19': ['G20'],      // Pythagoras vs trigonometry
  'G20': ['G19'],
  'R10': ['R12'],      // Percentage change vs reverse percentage
  'R12': ['R10'],
  'R3': ['R4'],        // Fraction of amount vs ratios
  'P4': ['P8'],        // Basic probability vs tree diagrams
  'P8': ['P4', 'P9'],
};

// Data migration function
const migrateToFSRS = (progress, questionBank) => {
  const fsrsData = {
    questionCards: {},
    params: { ...FSRS_DEFAULTS },
  };

  Object.entries(progress).forEach(([objectiveCode, prog]) => {
    if (!prog) return;

    const questions = questionBank[objectiveCode] || [];
    const quickCorrect = prog.quickCorrect || 0;

    // Estimate FSRS parameters from existing mastery data
    let stability, state, reps;
    if (quickCorrect >= 5) {
      stability = 30; // ~1 month for mastered
      state = 'review';
      reps = 5;
    } else if (quickCorrect >= 3) {
      stability = 7;  // ~1 week
      state = 'review';
      reps = quickCorrect;
    } else if (quickCorrect > 0) {
      stability = 1;  // ~1 day
      state = 'learning';
      reps = quickCorrect;
    } else {
      stability = FSRS_DEFAULTS.w[0];
      state = 'new';
      reps = 0;
    }

    questions.forEach((q, idx) => {
      const questionId = getQuestionId(objectiveCode, idx, q);
      fsrsData.questionCards[questionId] = {
        questionId,
        stability,
        difficulty: FSRS_DEFAULTS.w[4] / 10,
        lastReview: prog.lastPracticed || null,
        nextReview: prog.nextDue || Date.now(),
        reps,
        lapses: 0,
        state,
        learningStep: state === 'learning' ? quickCorrect : 0,
        confidenceHistory: [],
        responseTimeHistory: [],
      };
    });
  });

  return fsrsData;
};

// Run migration if needed
const runMigration = (progress, questionBank) => {
  try {
    const currentVersion = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '1');
    if (currentVersion >= CURRENT_MIGRATION_VERSION) return loadFsrsData();

    console.log(`Migrating FSRS data from v${currentVersion} to v${CURRENT_MIGRATION_VERSION}`);
    const fsrsData = migrateToFSRS(progress, questionBank);
    saveFsrsData(fsrsData);
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    console.log(`Migration complete: ${Object.keys(fsrsData.questionCards).length} cards`);
    return fsrsData;
  } catch (e) {
    console.error('Migration failed:', e);
    return loadFsrsData();
  }
};

export {
  FSRS_DEFAULTS,
  FSRS_DATA_KEY,
  MIGRATION_VERSION_KEY,
  CURRENT_MIGRATION_VERSION,
  Rating,
  fsrsRetrievability,
  fsrsInterval,
  fsrsNextStability,
  fsrsNextDifficulty,
  getQuestionId,
  simpleHash,
  fsrsInitCard,
  fsrsReview,
  fsrsHandleLearning,
  fsrsHandleRelearning,
  fsrsHandleReview,
  loadFsrsData,
  saveFsrsData,
  confusablePairs,
  migrateToFSRS,
  runMigration,
};
