import { getQuestionBankForTier, pickVariant, questionBankPrimary, questionBankGroups } from '../data/questionBank.js';
import { loadRecentQuestions, loadAnsweredCorrect } from './storage.js';
import { getQuestionId } from './fsrs.js';
import { diamondQuestionBank } from '../data/diamondQuestionBank.js';

// Spaced repetition intervals (in milliseconds)
export const INTERVALS = {
  initial: 4 * 60 * 60 * 1000,     // 4 hours (was 10 min — way too short)
  level1: 24 * 60 * 60 * 1000,     // 1 day
  level2: 3 * 24 * 60 * 60 * 1000, // 3 days
  level3: 7 * 24 * 60 * 60 * 1000, // 7 days
  level4: 21 * 24 * 60 * 60 * 1000, // 21 days
  wrong: 10 * 60 * 1000,            // 10 minutes (was 2 min)
};

export const getNextDueTime = (streak, isCorrect) => {
  if (!isCorrect) return Date.now() + INTERVALS.wrong;
  const intervals = [INTERVALS.initial, INTERVALS.level1, INTERVALS.level2, INTERVALS.level3, INTERVALS.level4];
  return Date.now() + (intervals[Math.min(streak, 4)] || INTERVALS.level4);
};

export const isDue = (progress) => {
  if (!progress?.nextDue) return true;
  return Date.now() >= progress.nextDue;
};

export const isMastered = (progress) => (progress?.quickCorrect ?? 0) >= 5;

// Build session queue with FSRS-based spaced repetition + discriminative interleaving
export const buildSessionQueue = (allObjectives, progress, count = 5, sessionCount = 0, tier = 'foundation') => {
  const qBank = getQuestionBankForTier(tier);
  const recentQuestions = new Set(loadRecentQuestions());
  const answeredCorrect = loadAnsweredCorrect();

  // Shuffle helper (Fisher-Yates)
  const shuffle = (arr) => {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  };

  // Pick a variant that hasn't been correctly answered (permanently excluded) or recently answered
  const pickFreshVariant = (variants, objCode, questionIdx) => {
    if (!Array.isArray(variants) || variants.length <= 1) {
      // Even single variants: skip if already answered correctly
      if (variants && variants.length === 1) {
        const id = getQuestionId(objCode, questionIdx, variants[0]);
        if (answeredCorrect.has(id)) return null;
      }
      return pickVariant(variants);
    }

    // Filter out frozen questions (need images before being served)
    const unfrozen = variants.filter(v => !v.frozen);
    if (unfrozen.length === 0) return pickVariant(variants); // all frozen — fallback

    // First: exclude any variant already answered correctly (permanent filter)
    const notAnswered = unfrozen.filter(v => {
      const id = getQuestionId(objCode, questionIdx, v);
      return !answeredCorrect.has(id);
    });

    // If all variants at this level have been answered correctly, return null
    if (notAnswered.length === 0) return null;

    // Then: prefer variants not in recent questions too
    const fresh = notAnswered.filter(v => {
      const id = getQuestionId(objCode, questionIdx, v);
      return !recentQuestions.has(id);
    });

    if (fresh.length > 0) {
      return fresh[Math.floor(Math.random() * fresh.length)];
    }
    // All remaining are recent but not yet correctly answered — pick randomly
    return notAnswered[Math.floor(Math.random() * notAnswered.length)];
  };

  // ── Step 1: Collect all eligible objectives ──
  const candidates = [];

  allObjectives.forEach(obj => {
    const objProg = progress[obj.code];
    const questions = qBank[obj.code] || [];
    if (questions.length === 0) return;

    // Use this objective's own progress only
    const qc = objProg?.quickCorrect ?? 0;
    if (qc >= 5) return; // Mastered — skip

    // Skip if this objective is still in cooldown
    if ((objProg?.skipUntilSession ?? 0) > sessionCount) return;

    const questionIdx = Math.min(qc, questions.length - 1);
    const q = pickFreshVariant(questions[questionIdx], obj.code, questionIdx);

    // All variants at this level already answered correctly — skip this objective
    if (!q) return;

    // Priority: never-practiced objectives first, then least-recently-practiced
    const neverPracticed = objProg?.quickCorrect === undefined;
    const lastPracticed = objProg?.lastPracticed ?? 0;

    candidates.push({
      objective: obj,
      question: q,
      questionIndex: questionIdx,
      questionId: getQuestionId(obj.code, questionIdx, q),
      level: qc,
      topic: obj.topic,
      neverPracticed,
      lastPracticed,
    });
  });

  // ── Step 2: Sort within each topic — unseen objectives first, then oldest-practiced ──
  const byTopic = {};
  candidates.forEach(c => {
    if (!byTopic[c.topic]) byTopic[c.topic] = [];
    byTopic[c.topic].push(c);
  });

  Object.keys(byTopic).forEach(t => {
    // Separate into never-practiced and already-practiced
    const unseen = shuffle(byTopic[t].filter(c => c.neverPracticed));
    const seen = byTopic[t]
      .filter(c => !c.neverPracticed)
      .sort((a, b) => a.lastPracticed - b.lastPracticed); // oldest first
    // Unseen objectives get priority, then oldest-practiced
    byTopic[t] = [...unseen, ...seen];
  });

  // ── Step 3: Round-robin across topics, picking from the front (prioritised) ──
  const queue = [];
  const usedObjectives = new Set();
  const topicCount = {};

  while (queue.length < count) {
    let bestTopic = null;
    let bestCount = Infinity;
    for (const [topic, arr] of Object.entries(byTopic)) {
      const available = arr.filter(c => !usedObjectives.has(c.objective.code));
      if (available.length === 0) continue;
      const tc = topicCount[topic] || 0;
      if (tc < bestCount) {
        bestCount = tc;
        bestTopic = topic;
      }
    }

    if (!bestTopic) break;

    // Pick FIRST available (unseen/oldest gets priority thanks to sorting)
    const topicCandidates = byTopic[bestTopic];
    const nextIdx = topicCandidates.findIndex(c => !usedObjectives.has(c.objective.code));
    if (nextIdx === -1) break;

    const next = topicCandidates.splice(nextIdx, 1)[0];
    // Block all codes sharing the same question bank to avoid duplicate question types
    const primary = questionBankPrimary[next.objective.code] || next.objective.code;
    const bankGroup = questionBankGroups[primary] || [next.objective.code];
    bankGroup.forEach(c => usedObjectives.add(c));
    topicCount[next.topic] = (topicCount[next.topic] || 0) + 1;
    queue.push(next);
  }

  // Shuffle the final queue so topics are interleaved
  return shuffle(queue).map(q => ({
    objective: q.objective,
    question: q.question,
    questionId: q.questionId,
    questionIndex: q.questionIndex,
  }));
};

// Diamond question getter — picks from diamondQuestionBank based on diamond progress
export const getDiamondQuestion = (objective, diamondProg) => {
  const dp = diamondProg?.[objective.code];
  const quickCorrect = dp?.quickCorrect ?? 0;
  const levels = diamondQuestionBank[objective.code];
  if (!levels || levels.length === 0) return null;
  // quickCorrect 0 → Grade 3 (index 0), 1 → Grade 4 (index 1), 2 → Grade 5 (index 2)
  const levelIdx = Math.min(quickCorrect, levels.length - 1);
  const variants = levels[levelIdx];
  if (!variants || variants.length === 0) return null;
  const idx = Math.floor(Math.random() * variants.length);
  const q = variants[idx];
  return { ...q, objective, questionType: 'diamond', difficultyLevel: levelIdx + 3, _diamondLevelIndex: levelIdx, _diamondVariantIndex: idx };
};
