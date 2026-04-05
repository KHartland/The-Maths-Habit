// PI-RO EVOLUTION SYSTEM
// Tamagotchi-style dragon that evolves with streak milestones
// Miss 2 days after reaching Epic and Piro ages to Old Dragon

import { PIRO_KEY } from './storage.js';

export const PIRO_STAGES = [
  { name: 'Egg',           minStreak: 0,  image: '/images/Piro/egg.png',            video: '/images/Piro/egg.mp4' },
  { name: 'Hatchling',     minStreak: 7,  image: '/images/Piro/hatchling.png',      video: '/images/Piro/hatchling.mp4' },
  { name: 'Smoke Flame',   minStreak: 14, image: '/images/Piro/smoke-flame.png',    video: '/images/Piro/smoke-flame.mp4' },
  { name: 'Teal Flame',    minStreak: 21, image: '/images/Piro/teal-flame.png',     video: '/images/Piro/teal-flame.mp4' },
  { name: 'Magenta Flame', minStreak: 28, image: '/images/Piro/magenta-flame.png',  video: '/images/Piro/magenta-flame.mp4' },
  { name: 'Epic Piro',     minStreak: 35, image: '/images/Piro/gold-flames.png',    video: '/images/Piro/gold-flames.mp4' },
  { name: 'Legendary Piro', minStreak: 70, image: '/images/Piro/diamond-piro.png',  video: '/images/Piro/diamond-piro.mp4' },
];

export const PIRO_OLD = { name: 'Old Piro', image: '/images/Piro/old-piro.png', video: '/images/Piro/old-piro.mp4' };
export const PIRO_CLOSE_TO_DEATH = { name: 'Close to Death', image: '/images/Piro/close-to-death.png', video: '/images/Piro/close-to-death.mp4' };
export const PIRO_DEAD = { name: 'Dead Piro', image: '/images/Piro/dead-piro.png', video: '/images/Piro/dead-piro.mp4' };
export const PIRO_DECAY_DAYS = 2;    // Miss 2 days after Epic → Old Piro
export const PIRO_DYING_DAYS = 7;    // Miss 7 days → Close to Death
export const PIRO_DEATH_DAYS = 10;   // Miss 10 days → Dead (permanent, restart)

// Get stage index based on highest streak ever reached
export const getPiroStageFromStreak = (highestStreak) => {
  for (let i = PIRO_STAGES.length - 1; i >= 0; i--) {
    if (highestStreak >= PIRO_STAGES[i].minStreak) return i;
  }
  return 0;
};

export const loadPiro = () => {
  try {
    const saved = localStorage.getItem(PIRO_KEY);
    const defaultPiro = {
      stage: 0,
      highestStreak: 0,  // Best streak ever (determines max evolution reached)
      reachedEpic: false, // Has ever reached Epic Piro (50-day streak)
      decayed: false,     // Currently in Old Piro state
      dying: false,       // Close to death state
      dead: false,        // Permanently dead — must restart
      evolvedAt: [],      // Evolution history
    };
    if (!saved) return defaultPiro;
    const parsed = JSON.parse(saved);
    // Migrate old reachedGold → reachedEpic
    if (parsed.reachedGold !== undefined && parsed.reachedEpic === undefined) {
      parsed.reachedEpic = parsed.reachedGold;
      delete parsed.reachedGold;
    }
    return { ...defaultPiro, ...parsed };
  } catch {
    return { stage: 0, highestStreak: 0, reachedEpic: false, decayed: false, dying: false, dead: false, evolvedAt: [] };
  }
};

export const savePiro = (piro) => {
  try { localStorage.setItem(PIRO_KEY, JSON.stringify(piro)); } catch {}
};

// Update Piro based on current streak. Called after each session.
// Returns { piro, evolved, decayed, dying, dead, newStage, oldStage }
export const updatePiro = (currentStreak, daysMissed) => {
  const piro = loadPiro();
  const oldStage = piro.stage;

  // Dead Piro cannot be revived — user must reset
  if (piro.dead) {
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: false, dead: true, newStage: piro.stage, oldStage };
  }

  // Practising reverses decay/dying states
  if (currentStreak >= 1 && (piro.decayed || piro.dying)) {
    piro.decayed = false;
    piro.dying = false;
  }

  // Track highest streak ever
  if (currentStreak > piro.highestStreak) {
    piro.highestStreak = currentStreak;
  }

  // Check if reached Epic Piro (35-day streak)
  if (piro.highestStreak >= 35) {
    piro.reachedEpic = true;
  }

  // Calculate current stage from highest streak
  const earnedStage = getPiroStageFromStreak(piro.highestStreak);

  // Decay ladder (only after reaching Epic):
  // 2 days missed → Old Piro
  // 7 days missed → Close to Death
  // 10 days missed → Dead (permanent)
  if (piro.reachedEpic && daysMissed >= PIRO_DEATH_DAYS) {
    piro.dead = true;
    piro.decayed = false;
    piro.dying = false;
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: false, dead: true, newStage: piro.stage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DYING_DAYS) {
    piro.dying = true;
    piro.decayed = false;
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: true, dead: false, newStage: piro.stage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DECAY_DAYS) {
    piro.decayed = true;
    piro.dying = false;
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: true, dying: false, dead: false, newStage: piro.stage, oldStage };
  }

  // Evolution check — stage can only go UP, never down
  const newStage = Math.max(oldStage, earnedStage);
  piro.stage = newStage;

  if (newStage > oldStage) {
    piro.evolvedAt.push({ stage: newStage, name: PIRO_STAGES[newStage].name, date: Date.now() });
  }

  savePiro(piro);
  return { piro, evolved: newStage > oldStage, decayed: false, dying: false, dead: false, newStage, oldStage };
};

// Get current display info for Piro
// Once evolved, Piro always shows its current evolution stage — never reverts visually.
// Decay/dying flags only affect styling (borders, nudge text), not the dragon image.
export const getPiroDisplay = (piro) => {
  if (piro.dead) {
    return { name: PIRO_DEAD.name, image: PIRO_DEAD.image, video: PIRO_DEAD.video, isDead: true, isDying: false, isDecayed: false };
  }
  const stage = PIRO_STAGES[piro.stage] || PIRO_STAGES[0];
  return { name: stage.name, image: stage.image, video: stage.video, isDead: false, isDying: !!piro.dying, isDecayed: !!piro.decayed };
};

// Get progress toward next evolution
export const getPiroProgress = (piro, currentStreak) => {
  const currentStageIdx = piro.stage;
  if (currentStageIdx >= PIRO_STAGES.length - 1) {
    return { needed: 0, total: 0, progress: 1, nextName: null }; // Max stage (Legendary)
  }
  const streak = currentStreak ?? piro.highestStreak; // Use current streak if provided
  const nextStage = PIRO_STAGES[currentStageIdx + 1];
  const currentThreshold = PIRO_STAGES[currentStageIdx].minStreak;
  const nextThreshold = nextStage.minStreak;
  const range = nextThreshold - currentThreshold;
  const progressInRange = streak - currentThreshold;
  return {
    needed: nextThreshold - streak,
    total: range,
    progress: Math.min(1, Math.max(0, progressInRange / range)),
    nextName: nextStage.name,
  };
};

// Near-miss nudge messages
export const getPiroNudge = (piro, dayStreak, todayQuestions, dailyGoal) => {
  const display = getPiroDisplay(piro);
  const progressInfo = getPiroProgress(piro, dayStreak);

  // Dead - game over
  if (display.isDead) {
    return "Piro has died. Reset to hatch a new egg and start again.";
  }

  // Close to death - critical warning
  if (display.isDying) {
    return "Piro is fading! Practice NOW to save your dragon!";
  }

  // Decayed state - urgent
  if (display.isDecayed) {
    return "Piro misses you! Practice today to keep your streak alive.";
  }

  // Egg stage - encourage first streak
  if (piro.stage === 0 && piro.highestStreak === 0) {
    return "Build a 7-day streak to hatch Piro!";
  }

  // Evolution is close (within 3 days)
  if (progressInfo.needed > 0 && progressInfo.needed <= 3) {
    return `${progressInfo.needed} more day${progressInfo.needed !== 1 ? 's' : ''} to evolve into ${progressInfo.nextName}!`;
  }

  // At Legendary - maintain message
  if (piro.stage >= PIRO_STAGES.length - 1) {
    return "Piro is LEGENDARY! Keep your streak alive.";
  }

  // Haven't practised today
  if (todayQuestions === 0) {
    return `Piro is waiting! ${dailyGoal} questions to keep your streak.`;
  }

  // Goal complete
  if (todayQuestions >= dailyGoal) {
    return `Piro is thriving! ${dayStreak} day streak.`;
  }

  // Mid-session
  const remaining = dailyGoal - todayQuestions;
  return `${remaining} more question${remaining !== 1 ? 's' : ''} to complete today's goal!`;
};
