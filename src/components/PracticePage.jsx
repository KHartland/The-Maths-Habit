import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronRight, X, Sparkles, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Loader2, Trophy, Camera, Lock, Star, Flag, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DOMPurify from 'dompurify';
import DragDropOrder from './DragDropOrder';
import DragDropMatch from './DragDropMatch';
import Calculator from './Calculator';
import { CubeIcon, SquareRootIcon, CompassIcon, InfinityIcon, CompassStarIcon, BooksIcon, PiIcon } from './MathIcons';
const TrophyIcon = CompassStarIcon;

// Lib imports
import { checkAnswer } from '../lib/answerChecker';
import { generateDiagram } from '../lib/diagrams';
import { buildSessionQueue, getDiamondQuestion, INTERVALS, getNextDueTime, isDue, isMastered } from '../lib/sessionQueue';
import { saveProgress, loadRecentQuestions, saveRecentQuestions, loadAnsweredCorrect, saveAnsweredCorrect, loadTotalQuestions, saveTotalQuestions, recordDailyActivity, loadShownTips, markTipShown, PRACTICE_TIPS, getTodayKey, loadDailyActivity, loadSessionCount, saveSessionCount, loadSessionHistory, saveSessionHistory, calculateStreak, checkStreakMilestone, loadStreakData } from '../lib/storage';
import { getQuestionId, fsrsInitCard, fsrsReview, Rating, loadFsrsData, saveFsrsData } from '../lib/fsrs';
import { questionBank, questionBankLabel, pickVariant, getQuestionBankForTier, workedExamples, examTips, prerequisites, getExamQuestionsForTier } from '../data/questionBank';
import { objectiveDescriptions as descriptions, revisionHints, TOPIC_HEX } from '../data/curriculum';
import { saveFsrsToCloud, saveProgressToCloud, saveStreakToCloud, saveDailyActivityToCloud } from '../lib/syncService';
import { updatePiro, loadPiro, savePiro, getPiroDisplay } from '../lib/piro';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

// Helper components
import CelebrationCarousel from './CelebrationCarousel';
import NavBar, { PracticeIcon } from './NavBar';
import { TILE_IMAGES, levelLabels } from '../data/curriculum';

// ==================== HELPER FUNCTIONS ====================

// Parse a fraction string like "3/4" into a decimal
const parseFraction = (str) => {
  const fractionMatch = str.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    if (den !== 0) return num / den;
  }
  return null;
};

// Parse mixed number like "1 1/2"
const parseMixedNumber = (str) => {
  const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    if (den !== 0) {
      const sign = whole < 0 ? -1 : 1;
      return whole + sign * (num / den);
    }
  }
  return null;
};

// Normalize a string for comparison
const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/°/g, '')
    .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8').replace(/⁹/g, '^9')
    .replace(/£|\$|€|p|cm|m|mm|km|kg|g|ml|l|%$/gi, '')
    .replace(/^[£$€]/gi, '')
    .trim();
};

// Extract numeric value from answer
const extractNumber = (str) => {
  let cleaned = str
    .replace(/^[a-z]\s*=\s*/i, '')
    .replace(/^(answer|ans|solution)[\s:=]*/i, '')
    .replace(/[£$€°%]|cm|mm|m|km|kg|g|ml|l|hours?|mins?|minutes?|seconds?|secs?/gi, '')
    .trim();

  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  const frac = parseFraction(cleaned);
  if (frac !== null) return frac;

  const mixed = parseMixedNumber(cleaned);
  if (mixed !== null) return mixed;

  return null;
};

// Check if two numbers are equivalent
const numbersEquivalent = (a, b, tolerance = 0.0001) => {
  if (a === null || b === null) return false;
  if (a === b) return true;
  if (Math.abs(a - b) < tolerance) return true;
  if (Math.abs(a - b) < 0.05 && Math.round(a * 10) === Math.round(b * 10)) return true;
  return false;
};

// Parse ratio like "2:3"
const parseRatio = (str) => {
  const ratioMatch = str.replace(/\s/g, '').match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (ratioMatch) {
    const parts = [parseFloat(ratioMatch[1]), parseFloat(ratioMatch[2])];
    if (ratioMatch[3]) parts.push(parseFloat(ratioMatch[3]));
    return parts;
  }
  return null;
};

// Check if two ratios are equivalent
const ratiosEquivalent = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  const scale = a[0] / b[0];
  return a.every((val, i) => Math.abs(val - b[i] * scale) < 0.001);
};

// Parse coordinate pair like "(2, 3)"
const parseCoordinate = (str) => {
  const coordMatch = str.replace(/[()]/g, '').match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];
  }
  return null;
};

// Extract multiple values from answer
const extractMultipleValues = (str) => {
  const values = [];

  const commaParts = str.split(/[,;]/);
  if (commaParts.length > 1) {
    commaParts.forEach(part => {
      const num = extractNumber(part.trim());
      if (num !== null) values.push(num);
    });
    if (values.length > 0) return values.sort((a, b) => a - b);
  }

  const andParts = str.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    andParts.forEach(part => {
      const num = extractNumber(part.trim());
      if (num !== null) values.push(num);
    });
    if (values.length > 0) return values.sort((a, b) => a - b);
  }

  return null;
};

// Main forgiving comparison function
const answersEquivalent = (userAnswer, correctAnswer) => {
  if (!userAnswer || !correctAnswer) return false;

  if (correctAnswer.includes('[r]') || userAnswer.includes('[r]')) {
    return userAnswer === correctAnswer;
  }

  const userNorm = normalizeString(userAnswer);
  const correctNorm = normalizeString(correctAnswer);

  if (userNorm === correctNorm) return true;

  const correctHasMultiple = correctAnswer.includes(',') && correctAnswer.split(',').length > 1;
  const userHasMultiple = userAnswer.includes(',') && userAnswer.split(',').length > 1;

  if (correctHasMultiple && !userHasMultiple) {
    return false;
  }

  const userNum = extractNumber(userAnswer);
  const correctNum = extractNumber(correctAnswer);
  if (!correctHasMultiple && numbersEquivalent(userNum, correctNum)) return true;

  const userRatio = parseRatio(userNorm);
  const correctRatio = parseRatio(correctNorm);
  if (userRatio && correctRatio && ratiosEquivalent(userRatio, correctRatio)) return true;

  const userCoord = parseCoordinate(userNorm);
  const correctCoord = parseCoordinate(correctNorm);
  if (userCoord && correctCoord) {
    if (numbersEquivalent(userCoord[0], correctCoord[0]) &&
        numbersEquivalent(userCoord[1], correctCoord[1])) return true;
  }

  const userMulti = extractMultipleValues(userAnswer);
  const correctMulti = extractMultipleValues(correctAnswer);
  if (userMulti && correctMulti && userMulti.length === correctMulti.length) {
    const allMatch = userMulti.every((val, i) => numbersEquivalent(val, correctMulti[i]));
    if (allMatch) return true;
  }

  if (userNum !== null && correctNum === null) {
    const correctFrac = parseFraction(correctNorm);
    if (correctFrac !== null && numbersEquivalent(userNum, correctFrac)) return true;
  }
  if (correctNum !== null && userNum === null) {
    const userFrac = parseFraction(userNorm);
    if (userFrac !== null && numbersEquivalent(correctNum, userFrac)) return true;
  }

  const yesVariants = ['yes', 'y', 'true', 'correct', '1'];
  const noVariants = ['no', 'n', 'false', 'incorrect', '0'];
  if (yesVariants.includes(userNorm) && yesVariants.includes(correctNorm)) return true;
  if (noVariants.includes(userNorm) && noVariants.includes(correctNorm)) return true;

  const toDecimal = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    if (trimmed.endsWith('%')) {
      const pctVal = parseFloat(trimmed.replace('%', ''));
      if (!isNaN(pctVal)) return pctVal / 100;
    }
    const frac = parseFraction(normalizeString(trimmed));
    if (frac !== null) return frac;
    const mixed = parseMixedNumber(normalizeString(trimmed));
    if (mixed !== null) return mixed;
    const num = extractNumber(trimmed);
    if (num !== null) return num;
    return null;
  };

  const userDecimal = toDecimal(userAnswer);
  const correctDecimal = toDecimal(correctAnswer);

  if (userDecimal !== null && correctDecimal !== null) {
    if (numbersEquivalent(userDecimal, correctDecimal)) return true;
  }

  if (correctAnswer.includes('%')) {
    const correctPct = parseFloat(correctAnswer.replace('%', ''));
    if (!isNaN(correctPct)) {
      if (numbersEquivalent(userNum, correctPct)) return true;
      if (numbersEquivalent(userNum, correctPct / 100)) return true;
      const userFracVal = parseFraction(userNorm);
      if (userFracVal !== null && numbersEquivalent(userFracVal, correctPct / 100)) return true;
    }
  }
  if (userAnswer.includes('%') && !correctAnswer.includes('%')) {
    const userPct = parseFloat(userAnswer.replace('%', ''));
    if (!isNaN(userPct)) {
      if (correctNum !== null && numbersEquivalent(userPct / 100, correctNum)) return true;
      const correctFracVal = parseFraction(correctNorm);
      if (correctFracVal !== null && numbersEquivalent(userPct / 100, correctFracVal)) return true;
    }
  }

  const userExpr = userNorm.replace(/\s/g, '').replace(/\+-/g, '-').replace(/-\+/g, '-');
  const correctExpr = correctNorm.replace(/\s/g, '').replace(/\+-/g, '-').replace(/-\+/g, '-');
  if (userExpr === correctExpr) return true;

  const userFormula = userNorm.replace(/^[a-z]=/, '');
  const correctFormula = correctNorm.replace(/^[a-z]=/, '');
  if (userFormula === correctFormula) return true;

  return false;
};

// Quick diagnosis for wrong answers
const quickDiagnosis = (question, userAnswer, correctAnswer) => {
  const userNum = parseFloat(userAnswer);
  const correctNum = parseFloat(correctAnswer);

  if (!isNaN(userNum) && !isNaN(correctNum)) {
    if (userNum === -correctNum) {
      return {
        hasDiagnosis: true,
        diagnosis: "You have the right number but the wrong sign.",
        tip: "Check: negative × negative = positive, negative × positive = negative",
        encouragement: "The calculation was right - just a sign slip!",
      };
    }

    if (userNum === correctNum * 10 || userNum === correctNum / 10) {
      return {
        hasDiagnosis: true,
        diagnosis: "Your answer is off by a factor of 10.",
        tip: "Check your decimal point placement or percentage conversion (15% = 0.15)",
        encouragement: "You're on the right track!",
      };
    }

    if (Math.abs(userNum - correctNum) < Math.abs(correctNum * 0.1) && userNum !== correctNum) {
      return {
        hasDiagnosis: true,
        diagnosis: "You're very close! Check your final calculation or rounding.",
        tip: "Re-read how many decimal places or significant figures are needed.",
        encouragement: "Nearly there!",
      };
    }

    if (question.q.includes('×') && question.q.includes('+')) {
      return {
        hasDiagnosis: true,
        diagnosis: "This question tests order of operations (BIDMAS).",
        tip: "Do Brackets, then Indices, then Division/Multiplication, finally Addition/Subtraction.",
        encouragement: "BIDMAS trips up lots of students - practice makes perfect!",
      };
    }
  }

  return {
    hasDiagnosis: false,
    diagnosis: null,
    tip: null,
  };
};

// Rendering helpers
const Rec = ({ children, dots = 'ends' }) => {
  const text = String(children);
  const decimalIndex = text.indexOf('.');

  if (decimalIndex === -1) return <span>{text}</span>;

  const beforeDecimal = text.slice(0, decimalIndex + 1);
  const afterDecimal = text.slice(decimalIndex + 1);

  let dotPositions = [];
  if (dots === 'ends') {
    if (afterDecimal.length === 1) {
      dotPositions = [0];
    } else {
      dotPositions = [0, afterDecimal.length - 1];
    }
  } else if (dots === 'first') {
    dotPositions = [0];
  } else if (dots === 'all') {
    dotPositions = afterDecimal.split('').map((_, i) => i);
  } else if (Array.isArray(dots)) {
    dotPositions = dots.map(d => d - 1);
  }

  return (
    <span style={{ whiteSpace: 'nowrap', lineHeight: '1.8' }}>
      {beforeDecimal}
      {afterDecimal.split('').map((digit, i) => (
        dotPositions.includes(i) ? (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
            }}
          >
            {digit}
            <span style={{
              position: 'absolute',
              top: '-0.6em',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5em',
              fontWeight: 'bold',
            }}>●</span>
          </span>
        ) : (
          <span key={i}>{digit}</span>
        )
      ))}
    </span>
  );
};

const renderColumnVector = (x, y) => (
  <span key={`vec-${x}-${y}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', margin: '0 2px' }}>
    <span style={{ fontSize: '1.8em', fontWeight: 200, lineHeight: 1 }}>(</span>
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '0 3px', lineHeight: 1.3, fontSize: '0.9em' }}>
      <span>{x}</span>
      <span>{y}</span>
    </span>
    <span style={{ fontSize: '1.8em', fontWeight: 200, lineHeight: 1 }}>)</span>
  </span>
);

const renderRecurring = (text) => {
  if (!text || typeof text !== 'string') return text;

  const vecPattern = /\[vec:([\-\d]+),([\-\d]+)\]/g;
  if (vecPattern.test(text)) {
    const segments = [];
    let lastIdx = 0;
    vecPattern.lastIndex = 0;
    let match;
    while ((match = vecPattern.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segments.push(text.slice(lastIdx, match.index));
      }
      segments.push(renderColumnVector(match[1], match[2]));
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) segments.push(text.slice(lastIdx));
    return <span style={{ lineHeight: '1.8' }}>{segments}</span>;
  }

  const parts = [];
  let i = 0;
  let currentText = '';

  while (i < text.length) {
    if (text.slice(i, i + 3) === '[r]') {
      if (currentText.length > 0) {
        const lastChar = currentText.slice(-1);
        const beforeLast = currentText.slice(0, -1);
        if (beforeLast) parts.push(beforeLast);
        parts.push(
          <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
            {lastChar}
            <span style={{
              position: 'absolute',
              top: '-0.6em',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5em',
              fontWeight: 'bold',
            }}>●</span>
          </span>
        );
        currentText = '';
      }
      i += 3;
    } else {
      currentText += text[i];
      i++;
    }
  }

  if (currentText) parts.push(currentText);

  return parts.length > 0 ? <span style={{ lineHeight: '1.8' }}>{parts}</span> : text;
};

// ==================== PRACTICE PAGE COMPONENT ====================

function PracticePage({ dailyObjectives, progress, setProgress, saveProgressFn = saveProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings, isSubscribed, FREE_DAILY_LIMIT, tier = 'foundation', setRecentSessionCodes, setSessionToastData, setShowOneVsOne, setShowCelebration, setCelebrationIndex, setShowUpgradePrompt, gameLevel = 1, diamondProgress, setDiamondProgress, saveDiamondProgress, diamondObjectives = [] }) {
  const { user: practiceUser } = useAuth();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [questionCount, setQuestionCount] = useState(() => {
    const requested = settings?.questionsPerSession ?? 5;
    if (!isSubscribed) {
      const activity = loadDailyActivity();
      const todayKey = getTodayKey();
      const todayQuestions = activity[todayKey]?.questions ?? 0;
      const remaining = Math.max(0, (FREE_DAILY_LIMIT ?? 5) - todayQuestions);
      return Math.min(requested, remaining || 1);
    }
    return requested;
  });
  const [sessionCount, setSessionCount] = useState(() => loadSessionCount());
  const [masteryGained, setMasteryGained] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [localCelebration, setLocalCelebration] = useState(null);
  const [practiceMode, setPracticeMode] = useState('standard');
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  const [currentTip, setCurrentTip] = useState(null);
  const shownTipsRef = useRef(loadShownTips());

  const showTip = (tipId) => {
    if (shownTipsRef.current.includes(tipId)) return;
    setCurrentTip(PRACTICE_TIPS[tipId]);
    markTipShown(tipId);
    shownTipsRef.current.push(tipId);
  };

  const dismissTip = () => setCurrentTip(null);

  const [failureCounts, setFailureCounts] = useState({});
  const [currentDiagnosis, setCurrentDiagnosis] = useState(null);

  const [showCalculator, setShowCalculator] = useState(false);

  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(() => loadTotalQuestions());

  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathKeyboardTab, setMathKeyboardTab] = useState('123');
  const inputRef = useRef(null);

  const [inputMode, setInputMode] = useState('type');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [userConfidence, setUserConfidence] = useState(null);
  const [showConfidenceRating, setShowConfidenceRating] = useState(false);
  const [showDelayedFeedback, setShowDelayedFeedback] = useState(false);
  const [fsrsData, setFsrsData] = useState(() => loadFsrsData());

  // State for Piro and other features
  const [piro, setPiro] = useState(() => loadPiro());
  const [piroEvolution, setPiroEvolution] = useState(null);
  const [piroDecayed, setPiroDecayed] = useState(false);
  const [showPiroNaming, setShowPiroNaming] = useState(false);
  const [piroCustomName, setPiroCustomName] = useState('');
  const [piroNamingError, setPiroNamingError] = useState('');
  const [profile, setProfile] = useState(null);
  const [userSchool, setUserSchool] = useState(null);

  const processHandwrittenAnswer = async (imageData) => {
    setIsProcessingImage(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageData.split(',')[1]
                  }
                },
                {
                  type: "text",
                  text: `This is a photo of a student's handwritten maths answer. Extract ONLY the final answer they wrote.

Rules:
- Return just the answer value (e.g., "12", "3/4", "2x + 5", "yes")
- If there's working out shown, only extract the final answer
- If you see a fraction, write it as "a/b" format
- If you see a mixed number, write it as "1 3/4" format
- If it's unclear or unreadable, respond with "UNCLEAR"
- Do not include any explanation, just the answer

What is the student's answer?`
                }
              ]
            }
          ],
        })
      });

      const data = await response.json();
      const extractedAnswer = data.content?.[0]?.text?.trim() || '';

      if (extractedAnswer && extractedAnswer !== 'UNCLEAR') {
        setUserAnswer(extractedAnswer);
        return extractedAnswer;
      } else {
        alert('Could not read the handwriting clearly. Please try again or type your answer.');
        return null;
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try typing your answer instead.');
      return null;
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handlePhotoCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;
      setCapturedImage(imageData);
      await processHandwrittenAnswer(imageData);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setCapturedImage(null);
    setUserAnswer('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const detectSkillGap = (question, userAnswer, correctAnswer, objective) => {
    const userNum = parseFloat(userAnswer);
    const correctNum = parseFloat(correctAnswer);

    if (!isNaN(userNum) && !isNaN(correctNum) && userNum === -correctNum) {
      return 'N2';
    }

    if (!isNaN(userNum) && !isNaN(correctNum)) {
      if (userNum === correctNum * 10 || userNum === correctNum / 10) {
        return 'N12';
      }
    }

    if (question.q && question.q.includes('×') && question.q.includes('+')) {
      return 'N5';
    }

    if (objective.code === 'G19' || question.q?.toLowerCase().includes('pythag')) {
      if (!isNaN(userNum) && !isNaN(correctNum)) {
        if (Math.abs(userNum - Math.sqrt(correctNum * correctNum)) < 1) {
          return 'N6';
        }
      }
    }

    return prerequisites[objective.code] || null;
  };

  const insertSymbol = (symbol) => {
    const input = inputRef.current;
    if (!input) {
      setUserAnswer(prev => prev + symbol);
      return;
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = userAnswer.slice(0, start) + symbol + userAnswer.slice(end);
    setUserAnswer(newValue);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 0);
  };

  const totalObjectives = allObjectives?.length ?? 0;
  const masteredCount = allObjectives?.filter(o => isMastered(progress[o.code])).length ?? 0;
  const dueCount = allObjectives?.filter(o => isDue(progress[o.code]) && !isMastered(progress[o.code])).length ?? 0;
  const cooldownCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    return prog?.skipUntilSession && prog.skipUntilSession >= sessionCount;
  }).length ?? 0;

  const qBank = getQuestionBankForTier(tier);

  const mcqObjectiveCount = allObjectives?.filter(o => {
    const questions = qBank[o.code];
    return questions && questions.some(q => q.type === 'mcq');
  }).length ?? 0;

  const startQuestionTimer = () => {
    if (practiceMode === 'quickfire' && !showFeedback) {
      setTimeLeft(15);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            checkAnswer(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const startSession = (mode = practiceMode) => {
    if (!isSubscribed) {
      const activity = loadDailyActivity();
      const todayKey = getTodayKey();
      const todayQuestions = activity[todayKey]?.questions ?? 0;
      if (todayQuestions >= FREE_DAILY_LIMIT) {
        setShowUpgradePrompt(true);
        return;
      }
      const remaining = FREE_DAILY_LIMIT - todayQuestions;
      if (questionCount > remaining) {
        setQuestionCount(remaining);
      }
    }

    let questionsWithData;

    if (gameLevel === 2) {
      const unmastered = diamondObjectives.filter(o => (diamondProgress[o.code]?.quickCorrect ?? 0) < 3);
      const pool = unmastered.length > 0 ? unmastered : diamondObjectives;
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));
      questionsWithData = selected.map(obj => {
        const q = getDiamondQuestion(obj, diamondProgress);
        return q || { q: `Diamond question for ${obj.code}`, a: "—", objective: obj, questionType: 'diamond' };
      });
      setSessionQueue(questionsWithData);
      setCurrentIndex(0);
      setSessionStarted(true);
      setSessionResults([]);
      setPracticeMode('standard');
      return;
    }

    if (mode === 'quickfire') {
      const objectivesWithMCQ = allObjectives.filter(obj => {
        const levels = qBank[obj.code];
        return levels && levels.some(level =>
          Array.isArray(level) && level.some(v => v.type === 'mcq')
        );
      });

      if (objectivesWithMCQ.length === 0) {
        alert('No quick-fire questions available yet. Starting standard mode instead.');
        mode = 'standard';
        const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount, tier);
        questionsWithData = queue.map(item => ({
          ...(item.question || {}),
          objective: item.objective,
          questionType: 'quick',
          _fsrsQuestionId: item.questionId
        }));
      } else {
        const queue = buildSessionQueue(objectivesWithMCQ, progress, questionCount, sessionCount, tier);

        questionsWithData = queue.map(item => {
          if (item.question?.type === 'mcq') {
            return { ...item.question, objective: item.objective, questionType: 'quick', difficultyLevel: (item.questionIndex ?? 0) + 1, _fsrsQuestionId: item.questionId };
          }
          const levels = qBank[item.objective?.code] || [];
          const allMcqVariants = levels.flatMap(level =>
            Array.isArray(level) ? level.filter(v => v.type === 'mcq') : []
          );
          const mcq = allMcqVariants.length > 0
            ? allMcqVariants[Math.floor(Math.random() * allMcqVariants.length)]
            : null;
          return { ...(mcq || item.question || {}), objective: item.objective, questionType: 'quick', difficultyLevel: (item.questionIndex ?? 0) + 1, _fsrsQuestionId: item.questionId };
        });
      }
    } else {
      const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount, tier);
      questionsWithData = queue.map(item => {
        const objProg = progress[item.objective?.code];
        const quickCorrect = objProg?.quickCorrect ?? 0;
        const questionType = quickCorrect >= 5 ? 'review' : 'quick';

        return {
          ...(item.question || {}),
          objective: item.objective,
          questionType,
          difficultyLevel: (item.questionIndex ?? 0) + 1,
          _fsrsQuestionId: item.questionId
        };
      });
    }

    setSessionQueue(questionsWithData);
    setCurrentIndex(0);
    setSessionResults([]);
    setSessionStarted(true);
    setShowFeedback(false);
    setUserAnswer('');
    setMasteryGained(0);
    setAchievements([]);
    setPracticeMode(mode);
    setShowMathKeyboard(false);
    setCapturedImage(null);
    setInputMode('type');

    setFailureCounts({});
    setCurrentDiagnosis(null);

    setQuestionStartTime(Date.now());
    setUserConfidence(null);
    setShowConfidenceRating(false);
    setShowDelayedFeedback(false);

    if (mode === 'quickfire') {
      setTimeout(() => startQuestionTimer(), 100);
    }

    if (sessionCount <= 1) {
      setTimeout(() => showTip('firstQuestion'), 800);
    } else if (sessionCount === 2) {
      setTimeout(() => showTip('secondSession'), 800);
    }
  };

  const getfsrsRating = (correct, responseTimeMs, avgResponseTime) => {
    if (!correct) return Rating.Again;

    const avg = avgResponseTime || 15000;
    const ratio = responseTimeMs / avg;

    if (ratio < 0.5) return Rating.Easy;
    if (ratio < 1.0) return Rating.Good;
    if (ratio < 2.0) return Rating.Hard;
    return Rating.Hard;
  };

  const checkAnswer = (selfAssessedCorrect = null, answerOverride = null) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const current = sessionQueue[currentIndex];
    if (!current) return;
    const answerToCheck = answerOverride || userAnswer;
    let correct = selfAssessedCorrect;

    if (current.type !== 'self' && selfAssessedCorrect === null) {
      if (current.type === 'order') {
        const userOrder = JSON.parse(answerToCheck || '[]');
        correct = JSON.stringify(userOrder) === JSON.stringify(current.correctOrder);
      } else if (current.type === 'match') {
        const userMatches = JSON.parse(answerToCheck || '{}');
        correct = Object.entries(current.correctMatches).every(
          ([left, right]) => userMatches[left] === right
        );
      } else {
        correct = answersEquivalent(answerToCheck, current.a);
      }
    }

    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : 15000;

    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      setTimeout(() => showTip('firstCorrect'), 600);
    } else {
      setTimeout(() => showTip('firstIncorrect'), 600);
    }

    const newTotal = totalQuestionsAnswered + 1;
    setTotalQuestionsAnswered(newTotal);
    saveTotalQuestions(newTotal);

    const code = current.objective.code;

    const scaffoldingEnabled = practiceMode !== 'quickfire' && practiceMode !== 'exam';

    if (!correct && scaffoldingEnabled) {
      const quickDiag = quickDiagnosis(current, userAnswer, current.a);
      setCurrentDiagnosis(quickDiag);

      const newFailureCount = (failureCounts[code] || 0) + 1;
      setFailureCounts(prev => ({ ...prev, [code]: newFailureCount }));
    } else if (correct) {
      setCurrentDiagnosis(null);
      setFailureCounts(prev => ({ ...prev, [code]: 0 }));
    }

    if (gameLevel === 2 && current.questionType === 'diamond') {
      const dp = diamondProgress[code] || {};
      const oldDQ = dp.quickCorrect ?? 0;
      const newDQ = correct ? Math.min(oldDQ + 1, 3) : oldDQ;
      const updatedDP = {
        ...diamondProgress,
        [code]: { ...dp, quickCorrect: newDQ, lastPracticed: Date.now() }
      };
      setDiamondProgress(updatedDP);
      saveDiamondProgress(updatedDP);

      setSessionResults(prev => [...prev, {
        code, correct, question: current.q, topic: current.objective.topic,
        questionType: 'diamond', oldQuickCorrect: oldDQ, newQuickCorrect: newDQ,
        newMastery: correct && newDQ >= 3 && oldDQ < 3
      }]);
      return;
    }

    const prog = progress[code] || {};
    const oldQuickCorrect = prog.quickCorrect ?? 0;
    const wasMastered = oldQuickCorrect >= 5;

    let newQuickCorrect = oldQuickCorrect;

    if (correct) {
      newQuickCorrect = Math.min(oldQuickCorrect + 1, 5);
    } else {
      newQuickCorrect = oldQuickCorrect;
    }

    const nowMastered = newQuickCorrect >= 5;

    if (correct && nowMastered && !wasMastered) {
      setMasteryGained(prev => prev + 1);
    }

    setProgress(prev => {
      const updated = { ...prev };
      const now = Date.now();
      const skipUntil = correct
        ? sessionCount + (
            newQuickCorrect >= 5 ? 999 :
            newQuickCorrect >= 4 ? 6 :
            newQuickCorrect >= 3 ? 5 :
            newQuickCorrect >= 2 ? 4 :
            3
          )
        : 0;

      const oldProg = prev[code] || {};
      updated[code] = {
        ...oldProg,
        quickCorrect: newQuickCorrect,
        lastPracticed: now,
        nextDue: getNextDueTime(newQuickCorrect, correct),
        skipUntilSession: skipUntil,
        masteredAt: (newQuickCorrect >= 5 && (oldProg.quickCorrect ?? 0) < 5) ? now : oldProg.masteredAt,
      };

      saveProgressFn(updated);
      return updated;
    });

      setSessionResults(prev => [...prev, {
        code,
        correct,
        question: current.q,
        topic: current.objective.topic,
        questionType: 'quick',
        oldQuickCorrect,
        newQuickCorrect,
        newMastery: correct && nowMastered && !wasMastered
      }]);

      const questionId = current._fsrsQuestionId || getQuestionId(
        code,
        current._fsrsQuestionIndex || 0,
        current
      );

      setFsrsData(prevFsrs => {
        const currentCard = prevFsrs.questionCards[questionId] || fsrsInitCard(questionId);
        const rating = getfsrsRating(correct, responseTimeMs, currentCard.avgResponseTime);
        const updatedCard = fsrsReview(currentCard, rating, responseTimeMs, userConfidence);

        const updatedFsrsData = {
          ...prevFsrs,
          questionCards: {
            ...prevFsrs.questionCards,
            [questionId]: updatedCard
          }
        };

        saveFsrsData(updatedFsrsData);
        if (practiceUser) {
          saveFsrsToCloud(practiceUser.id, updatedFsrsData);
        }
        return updatedFsrsData;
      });

      const recentList = loadRecentQuestions();
      recentList.push(questionId);
      saveRecentQuestions(recentList);

      if (correct) {
        const answeredSet = loadAnsweredCorrect();
        answeredSet.add(questionId);
        saveAnsweredCorrect(answeredSet);
      }
  };

  const nextQuestion = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (currentIndex < sessionQueue.length - 1) {
      setShowFeedback(false);
      setUserAnswer('');
      setIsCorrect(null);
      setCurrentDiagnosis(null);
      setShowMathKeyboard(false);
      setCapturedImage(null);
      setShowCalculator(false);
      setInputMode('type');
      setQuestionStartTime(Date.now());
      setUserConfidence(null);
      setShowConfidenceRating(false);
      setShowDelayedFeedback(false);
      setShowReportModal(false);
      setReportSent(false);

      setCurrentIndex(prev => prev + 1);
      if (practiceMode === 'quickfire') {
        setTimeout(() => startQuestionTimer(), 100);
      }
    } else {
      setTimeLeft(null);

      const lastAnswer = { correct: !!isCorrect, code: current?.objective?.code || '??', topic: current?.objective?.topic || 'Unknown', newQuickCorrect: undefined };
      const allAnswers = [...sessionResults, lastAnswer];
      const codes = [...new Set(allAnswers.filter(r => r.code).map(r => r.code))];
      const current = sessionQueue[currentIndex];
      const celebObjs = codes.map(code => {
        const rForCode = allAnswers.filter(r => r.code === code);
        const correctN = rForCode.filter(r => r.correct).length;
        const totalN = rForCode.length;
        const last = [...rForCode].reverse().find(r => r.newQuickCorrect !== undefined);
        const qc = last?.newQuickCorrect ?? (progress[code]?.quickCorrect ?? 0);
        return {
          code,
          title: descriptions[code] || code,
          topic: rForCode[0]?.topic || 'Unknown',
          level: Math.min(qc, 5),
          quickCorrect: qc,
          mastered: qc >= 5,
          correctInSession: correctN,
          totalInSession: totalN,
        };
      });

      console.log('[CELEB DEBUG] celebObjs:', celebObjs.length, 'codes:', codes, 'sessionResults:', sessionResults.length);
      if (celebObjs.length > 0) {
        console.log('[CELEB DEBUG] Setting localCelebration with', celebObjs.length, 'objectives');
        setLocalCelebration({ objectives: celebObjs, index: 0 });
      } else {
        console.log('[CELEB DEBUG] No celebObjs - skipping celebration');
      }
      setSessionResults(allAnswers);
      setRecentSessionCodes(codes);
      setShowFeedback(false);
      setSessionStarted(false);

      try {
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      saveSessionCount(newCount);

      const correctCount = sessionResults.filter(r => r.correct).length + (isCorrect ? 1 : 0);
      const totalQuestions = sessionResults.length + 1;
      const topicsCovered = [...new Set(sessionResults.map(r => r.topic))];

      const updatedActivity = recordDailyActivity(totalQuestions, correctCount, masteryGained);
      if (practiceUser) {
        const todayKey = getTodayKey();
        saveDailyActivityToCloud(practiceUser.id, todayKey, updatedActivity[todayKey]);

        if (correctCount > 0) {
          try {
            const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
            const raw = localStorage.getItem(storageKey);
            const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
            fetch(`${supabaseUrl}/rest/v1/rpc/increment_total_correct`, {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ p_user_id: practiceUser.id, p_amount: correctCount }),
            }).then(async (res) => {
              if (!res.ok) { res.text().then(t => console.error('Leaderboard update failed:', t)); return; }
              if (userSchool && !profile?.piro_name) {
                try {
                  const lbRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard`, {
                    method: 'POST',
                    headers: {
                      'apikey': supabaseAnonKey,
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ p_school_id: userSchool.id }),
                  });
                  if (lbRes.ok) {
                    const leaderboard = await lbRes.json();
                    if (leaderboard.length > 0 && leaderboard[0].user_id === practiceUser.id) {
                      setShowPiroNaming(true);
                    }
                  }
                } catch (lbErr) {
                  console.error('Leaderboard rank check error:', lbErr);
                }
              }
            }).catch(err => console.error('Leaderboard update error:', err));
          } catch (e) {
            console.error('Leaderboard token error:', e);
          }
        }
      }

      const updatedStreak = calculateStreak();
      const freezeEarned = checkStreakMilestone(updatedStreak.streak);

      if (practiceUser) {
        const savedStreak = loadStreakData();
        savedStreak.currentStreak = updatedStreak.streak;
        savedStreak.lastActivityDate = new Date().toISOString().split('T')[0];
        saveStreakToCloud(practiceUser.id, savedStreak);
      }

      const streakRepaired = updatedStreak.repairCompleted;

      const sessionData = {
        date: Date.now(),
        correct: correctCount,
        total: totalQuestions,
        masteryGained: masteryGained + (sessionResults[sessionResults.length]?.newMastery ? 1 : 0),
        topics: topicsCovered,
        sessionNumber: newCount,
        mode: practiceMode,
      };
      const history = loadSessionHistory();
      history.push(sessionData);
      saveSessionHistory(history);

      const newAchievements = [];

      if (streakRepaired) {
        newAchievements.push({ icon: '🔧', title: 'Streak Repaired!', desc: `Your ${updatedStreak.potentialStreak} day streak is back!` });
      }

      if (freezeEarned.earned) {
        newAchievements.push({ icon: '🛡️', title: 'Streak Freeze Earned!', desc: `${freezeEarned.milestone} day milestone! (${freezeEarned.total} freezes)` });
      }

      if (correctCount === totalQuestions) {
        newAchievements.push({ icon: '🎯', title: 'Perfect Score!', desc: 'All questions correct' });
      }
      if (masteryGained > 0) {
        newAchievements.push({ icon: '⭐', title: 'New Mastery!', desc: `Mastered ${masteryGained} objective${masteryGained > 1 ? 's' : ''}` });
      }
      if (newCount === 1) {
        newAchievements.push({ icon: '🚀', title: 'First Session!', desc: 'You started your journey' });
      }
      if (newCount === 10) {
        newAchievements.push({ icon: '🔥', title: '10 Sessions!', desc: 'Dedicated learner' });
      }
      if (newCount === 50) {
        newAchievements.push({ icon: '💎', title: '50 Sessions!', desc: 'Maths champion' });
      }
      if (correctCount >= 5 && totalQuestions >= 5) {
        newAchievements.push({ icon: '💪', title: 'Strong Session!', desc: '5+ correct answers' });
      }
      if (practiceMode === 'quickfire' && correctCount >= totalQuestions * 0.8) {
        newAchievements.push({ icon: '⚡', title: 'Lightning Fast!', desc: '80%+ in Quick Fire mode' });
      }

      setAchievements(newAchievements);

      const daysMissed = updatedStreak.streak > 0 ? 0 :
        updatedStreak.needsRepair ? 2 : 1;
      const piroResult = updatePiro(updatedStreak.streak, daysMissed);
      const updatedPiro = loadPiro();
      setPiro(updatedPiro);

      if (practiceUser) {
        const piroDisplay = getPiroDisplay(updatedPiro);
        const stageName = piroDisplay.name || 'Egg';
        const goldComplete = allObjectives.length > 0 && allObjectives.every(o => (progress[o.code]?.quickCorrect ?? 0) >= 5);
        const diamondComplete = diamondObjectives.length > 0 && diamondObjectives.every(o => (diamondProgress[o.code]?.quickCorrect ?? 0) >= 3);
        const masteryBadge = diamondComplete ? 'diamond' : goldComplete ? 'gold' : null;
        try {
          const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
          const raw = localStorage.getItem(storageKey);
          const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
          fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${practiceUser.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ piro_stage: stageName, mastery_badge: masteryBadge }),
          }).catch(err => console.error('Piro/badge sync error:', err));
        } catch (e) {
          console.error('Piro/badge token error:', e);
        }
      }
      if (piroResult.evolved) {
        setPiroEvolution({ oldStage: piroResult.oldStage, newStage: piroResult.newStage });
      }
      if (piroResult.decayed) {
        setPiroDecayed(true);
      }

      } catch (err) {
        console.error('Session complete error:', err);
      }
    }
  };

  if (!allObjectives || allObjectives.length === 0) {
    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
        <div className="ambient-glow" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 text-center relative z-10 page-content">
          <PracticeIcon className="w-16 h-16 text-secondary-text/40 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">No questions available</h2>
          <p className="text-secondary-text mt-2">Go to Home to set up your objectives first.</p>
        </div>
      </div>
    );
  }

  console.log('[CELEB RENDER] localCelebration:', localCelebration ? `${localCelebration.objectives?.length} objs` : 'null', 'sessionStarted:', sessionStarted);
  if (localCelebration) {
    return (
      <CelebrationCarousel
        show={true}
        objectives={localCelebration.objectives}
        currentIndex={localCelebration.index}
        onAdvance={() => {
          const objs = localCelebration.objectives;
          if (localCelebration.index >= objs.length - 1) {
            setLocalCelebration(null);
            setCurrentPage('heatmap');
          } else {
            setLocalCelebration(prev => ({ ...prev, index: prev.index + 1 }));
          }
        }}
      />
    );
  }

  if (!sessionStarted && sessionResults.length > 0) {
    const correctCount = sessionResults.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / sessionResults.length) * 100);
    const topicsSet = new Set(sessionResults.map(r => r.topic));
    const streakGained = sessionResults.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0);

    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-64 h-64 -top-32 -right-32 opacity-70 fixed pointer-events-none" />
        <div className="orb-cyan w-48 h-48 bottom-20 -left-20 opacity-60 fixed pointer-events-none" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-28 px-4 relative z-10 page-content">
          <div className="max-w-md mx-auto content-container">
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              <div className="text-center mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  accuracy === 100 ? 'bg-gradient-to-br from-[#FBBF24] to-orange-500 shadow-[0_0_30px_rgba(251,191,36,0.4)]' :
                  accuracy >= 80 ? 'bg-gradient-to-br from-mint to-red-700 shadow-glow-mint' :
                  accuracy >= 60 ? 'bg-gradient-violet shadow-glow-violet' :
                  'bg-gradient-to-br from-secondary-text/40 to-secondary-text/60'
                }`}>
                  {accuracy === 100 ? <TrophyIcon className="w-10 h-10 text-white" /> :
                   accuracy >= 80 ? <Sparkles className="w-10 h-10 text-white" /> :
                   <Target className="w-10 h-10 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {accuracy === 100 ? 'Perfect! 🎉' :
                   accuracy >= 80 ? 'Great Work!' :
                   accuracy >= 60 ? 'Good Effort!' : 'Keep Practicing!'}
                </h2>
              </div>

              <div className="text-center mb-6">
                <div className="text-5xl font-bold gradient-text">
                  {correctCount}/{sessionResults.length}
                </div>
                <p className="text-secondary-text mt-1">{accuracy}% accuracy</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="glass-panel rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-white">{topicsSet.size}</div>
                  <div className="text-xs text-secondary-text">Topics</div>
                </div>
                <div className="glass-panel rounded-xl p-3 text-center border-mint/30">
                  <div className="text-xl font-bold text-mint">+{streakGained}</div>
                  <div className="text-xs text-mint/80">Streak pts</div>
                </div>
                <div className="glass-panel rounded-xl p-3 text-center border-violet/30">
                  <div className="text-xl font-bold text-violet-light">{masteryGained}</div>
                  <div className="text-xs text-violet-light/80">Mastered</div>
                </div>
              </div>

              <div className="space-y-2 text-left mb-6 max-h-60 overflow-y-auto hide-scrollbar">
                {sessionResults.map((r, i) => {
                  const prog = progress[r.code];
                  return (
                    <div key={i} className={`p-3 rounded-lg ${r.correct ? 'glass-panel' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          r.correct ? 'bg-mint/20 text-mint' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <span className="font-medium text-white flex-1 min-w-0 truncate">{r.code}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.newMastery ? (
                            <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-full font-semibold border border-[#D4AF37]/30">
                              ⭐ Mastered!
                            </span>
                          ) : r.correct ? (
                            <span className="text-xs text-secondary-text">{levelLabels[Math.min(progress[r.code]?.quickCorrect ?? 0, 5)] || 'Not started'}</span>
                          ) : null}
                          <img src={TILE_IMAGES[Math.min(progress[r.code]?.quickCorrect ?? 0, 5)] || TILE_IMAGES[0]} alt="" className="w-6 h-6 rounded" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {achievements.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 justify-center">
                  {achievements.map((ach, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-secondary-text rounded-full text-xs">
                      <span>{ach.icon}</span>
                      <span>{ach.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {sessionResults.some(r => !r.correct) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-amber-300">
                    <strong>Time to revise!</strong> The objectives you got wrong won't appear for the next 2 sessions.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={startSession}
                  className="w-full py-3 btn-gradient-mint text-white font-semibold rounded-xl transition-all"
                >
                  Practice Again
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('heatmap'); }}
                  className="w-full py-3 glass-panel hover:bg-white/10 text-white font-semibold rounded-xl transition-colors"
                >
                  View Journey
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('stats'); }}
                  className="w-full py-2 text-secondary-text hover:text-white text-sm font-medium transition-colors"
                >
                  View Stats
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const preSessionActivity = loadDailyActivity();
  const preSessionTodayQuestions = preSessionActivity[getTodayKey()]?.questions ?? 0;
  const dailyLimitReached = !isSubscribed && preSessionTodayQuestions >= FREE_DAILY_LIMIT;
  const questionsRemainingToday = isSubscribed ? Infinity : Math.max(0, FREE_DAILY_LIMIT - preSessionTodayQuestions);

  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-mint w-56 h-56 -top-28 -right-28 opacity-70 fixed pointer-events-none" />
        <div className="orb-pink w-40 h-40 bottom-32 -left-16 opacity-60 fixed pointer-events-none" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 relative z-10 page-content">
          <div className="max-w-md mx-auto content-container">
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-violet rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-violet">
                  <PracticeIcon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Practice Session</h2>
                <p className="text-secondary-text mt-1">Build lasting maths skills</p>
              </div>

              {dailyLimitReached ? (
                <div className="text-center space-y-4">
                  <div className="glass-panel rounded-xl p-4 border border-violet/30">
                    <p className="text-white font-semibold mb-1">Daily limit reached</p>
                    <p className="text-secondary-text text-sm">
                      {`You've completed your ${FREE_DAILY_LIMIT} free questions for today. Come back tomorrow or upgrade for unlimited practice.`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUpgradePrompt(true)}
                    className="w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg btn-gradient-mint text-void shadow-glow-mint"
                  >
                    Unlock Unlimited Practice
                  </button>
                  <button
                    onClick={() => setCurrentPage('home')}
                    className="w-full py-2 text-secondary-text hover:text-white text-sm font-medium transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              ) : (
                <>
                  {!isSubscribed && (
                    <div className="text-center mb-4">
                      <span className="text-xs px-3 py-1 glass-panel text-violet-light rounded-full">
                        {questionsRemainingToday} free question{questionsRemainingToday !== 1 ? 's' : ''} remaining today
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={() => { setPracticeMode('standard'); startSession('standard'); }}
                      className="w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg btn-gradient-mint text-void shadow-glow-mint"
                    >
                      Start Practice
                    </button>

                    <button
                      onClick={() => { setCurrentPage('home'); setShowOneVsOne(true); }}
                      className="w-full py-4 font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 text-white btn-gradient-violet"
                    >
                      <Sparkles className="w-5 h-5" />
                      1v1 Challenge
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const current = sessionQueue[currentIndex];
  const progressPct = ((currentIndex + (showFeedback ? 1 : 0)) / sessionQueue.length) * 100;

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      <div className="ambient-glow" style={{ animationPlayState: 'paused' }} />
      <div className="orb-purple w-72 h-72 -top-36 -right-36 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-cyan w-56 h-56 bottom-10 -left-28 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-pink w-40 h-40 top-1/3 right-0 opacity-50 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />

      <div className="pb-0 px-4 relative z-10 page-content" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <div className="max-w-lg mx-auto content-container">
          {current && (
            <div className="glass-panel-dark rounded-3xl shadow-glass overflow-hidden relative">

              <div
                className="px-3 py-2 flex items-center gap-2 question-card-header"
                style={{ backgroundColor: TOPIC_HEX[current.objective.topic] + '20' }}
              >
                <button
                  onClick={() => setCurrentPage('home')}
                  className="flex items-center gap-0.5 text-secondary-text hover:text-white text-xs transition-colors shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>

                <span
                  className="px-2 py-0.5 rounded-md text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: TOPIC_HEX[current.objective.topic] }}
                >
                  {current.objective.code}
                </span>

                <span className="text-xs font-medium text-white/80 truncate">
                  {current.objective.topicName}
                </span>

                {current.objective.isHigher && (
                  <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-md shrink-0">H</span>
                )}

                <div className="flex-1" />

                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      background: practiceMode === 'quickfire'
                        ? 'linear-gradient(to right, #f97316, #ef4444)'
                        : practiceMode === 'exam'
                          ? 'linear-gradient(to right, #ef4444, #f43f5e)'
                          : 'linear-gradient(180deg, #8BA8D9, #5B7FC7, #3D5A8A)',
                      width: `${progressPct}%`
                    }}
                  />
                </div>

                {current.difficultyLevel && (
                  <span className="text-xs font-semibold text-white/60 shrink-0">
                    Lv {current.difficultyLevel}/5
                  </span>
                )}

                <span className="text-xs text-secondary-text shrink-0">
                  {currentIndex + 1}/{sessionQueue.length}
                </span>

                <span className="text-xs font-bold text-mint shrink-0">
                  {sessionResults.filter(r => r.correct).length}✓
                </span>

                <button
                  onClick={() => { setShowReportModal(true); setReportSent(false); }}
                  className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                  title="Report an issue with this question"
                >
                  <Flag className="w-4 h-4 text-red-400" />
                </button>
              </div>

              <div className="p-6 question-card">
                <div className="question-card-layout">
                <div className="question-side">
                {current.diagram && (
                  <div className="mb-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generateDiagram(current.diagram)) }} />
                )}

                <h3 className="text-lg font-semibold text-white/90 mb-4 question-text">
                  {renderRecurring(current.q)}
                </h3>
                </div>
                <div className="answer-side">

                {current.calculator && !showFeedback && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mint/20 border border-mint/40 rounded-full text-sm text-mint">
                      <span>🧮</span> Calculator allowed
                    </span>
                    <button
                      onClick={() => setShowCalculator(!showCalculator)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        showCalculator
                          ? 'bg-violet text-white'
                          : 'bg-white/10 hover:bg-white/20 text-secondary-text'
                      }`}
                    >
                      {showCalculator ? 'Hide Calculator' : 'Show Calculator'}
                    </button>
                  </div>
                )}

                {current.calculator && showCalculator && !showFeedback && (
                  <div className="mb-4 flex justify-center calc-overlay-container">
                    <Calculator
                      onInsert={(value) => { setUserAnswer(value); setShowCalculator(false); }}
                      onClose={() => setShowCalculator(false)}
                    />
                  </div>
                )}


                {!showFeedback && (
                  <>
                    {current.type === 'self' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-white/50 mb-4">Try this on paper, then mark yourself:</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => checkAnswer(true)}
                            className="flex-1 py-3 bg-mint hover:bg-mint/80 text-void font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Got it right
                          </button>
                          <button
                            onClick={() => checkAnswer(false)}
                            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <X className="w-5 h-5" />
                            Got it wrong
                          </button>
                        </div>
                      </div>
                    ) : (current.type === 'mcq' && current.options) ? (
                      <div className="space-y-2">
                        {current.options.map((option, i) => (
                          <button
                            key={i}
                            onClick={() => { setUserAnswer(option); }}
                            className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${
                              userAnswer === option
                                ? 'border-violet bg-violet/20 text-white'
                                : 'border-white/20 hover:border-white/40 bg-white/5 text-white'
                            }`}
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white/70 text-sm font-bold mr-3">
                              {['A', 'B', 'C', 'D'][i]}
                            </span>
                            {renderRecurring(option)}
                          </button>
                        ))}

                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer}
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : (current.type === 'order' && current.items) ? (
                      <div className="space-y-4">
                        <p className="text-sm text-white/50">Drag to put in the correct order:</p>
                        <DragDropOrder
                          items={current.items}
                          onOrderChange={(newOrder) => setUserAnswer(JSON.stringify(newOrder))}
                        />
                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer}
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : (current.type === 'match' && current.leftItems) ? (
                      <div className="space-y-4">
                        <DragDropMatch
                          leftItems={current.leftItems}
                          rightItems={current.rightItems}
                          onMatchChange={(pairs, matchObj) => setUserAnswer(JSON.stringify(matchObj))}
                        />
                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer || Object.keys(JSON.parse(userAnswer || '{}')).length < current.leftItems.length}
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 answer-section">
                            <div className="relative">
                              <input
                                ref={inputRef}
                                type="text"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && userAnswer && checkAnswer()}
                                placeholder="Type your answer..."
                                className="w-full px-4 py-3 pr-12 border-2 border-white/20 rounded-xl focus:border-violet focus:outline-none text-lg bg-white/10 text-white placeholder-secondary-text"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setShowMathKeyboard(!showMathKeyboard)}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                  showMathKeyboard
                                    ? 'bg-violet/30 text-violet-light ring-2 ring-violet/50'
                                    : 'bg-white/10 text-secondary-text hover:bg-white/20'
                                }`}
                                title="Math symbols"
                              >
                                <span className="text-sm font-bold">π</span>
                              </button>
                            </div>

                            {!showFeedback && current && !current.type && /[²³⁴⁵⁶⁷⁸⁹]|\^/.test(current.a) && (
                              <p className="text-xs text-violet-light/70 mt-1 flex items-center gap-1">
                                <span>💡</span> Type <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-violet-light font-mono text-[11px]">^</kbd> for powers, e.g. <span className="font-mono text-violet-light">x^2</span> for x². Tap <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-violet-light font-mono text-[11px]">π</kbd> for ² ³ buttons.
                              </p>
                            )}

                            {showMathKeyboard && (
                              <div className="bg-white/5 border border-white/10 rounded-xl p-2 shadow-lg backdrop-blur-sm">
                                <div className="flex gap-1 mb-2 pb-2 border-b border-white/10">
                                  {[
                                    { id: '123', label: '123' },
                                    { id: 'f(x)', label: 'f(x)' },
                                    { id: 'ABC', label: 'ABC' },
                                    { id: 'symbols', label: '#&¬' },
                                  ].map(tab => (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => setMathKeyboardTab(tab.id)}
                                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                        mathKeyboardTab === tab.id
                                          ? 'bg-violet/20 text-violet-light'
                                          : 'text-white/50 hover:bg-white/10'
                                      }`}
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-10 gap-1">
                                  {mathKeyboardTab === '123' && (
                                    <>
                                      {['x', 'y', 'π', 'e', '7', '8', '9', '×', '÷'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => key && insertSymbol(key)}
                                          disabled={!key}
                                          className={`p-2 rounded-lg text-center font-medium transition-all ${
                                            key ? 'key-dark' : ''
                                          } ${['×', '÷', '+', '−', '='].includes(key) ? 'key-dark-op' : ''}`}
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => insertSymbol('/')}
                                        className="p-2 rounded-lg text-center font-medium transition-all key-dark-special"
                                        title="Insert fraction (type like 3/4)"
                                      >
                                        <span className="text-xs leading-none flex flex-col items-center">
                                          <span className="border-b border-current px-1">a</span>
                                          <span className="px-1">b</span>
                                        </span>
                                      </button>

                                      {['²', '³', '√', '∛', '4', '5', '6', '+', '−'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => key && insertSymbol(key)}
                                          disabled={!key}
                                          className={`p-2 rounded-lg text-center font-medium transition-all ${
                                            key ? 'key-dark' : ''
                                          } ${['×', '÷', '+', '−', '='].includes(key) ? 'key-dark-op' : ''}`}
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => insertSymbol(' /')}
                                        className="p-2 rounded-lg text-center font-medium transition-all key-dark-special"
                                        title="Insert mixed number (type like 1 3/4)"
                                      >
                                        <span className="text-xs leading-none flex items-center gap-0.5">
                                          <span>1</span>
                                          <span className="flex flex-col items-center">
                                            <span className="border-b border-current px-0.5 text-[10px]">a</span>
                                            <span className="px-0.5 text-[10px]">b</span>
                                          </span>
                                        </span>
                                      </button>

                                      {['<', '>', '≤', '≥', '1', '2', '3', '=', '≠', '⌫'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => key === '⌫' ? setUserAnswer(prev => prev.slice(0, -1)) : insertSymbol(key)}
                                          className={`p-2 rounded-lg text-center font-medium transition-all ${
                                            key === '⌫' ? 'key-dark-special' :
                                            'key-dark'
                                          } ${['×', '÷', '+', '−', '=', '≠'].includes(key) ? 'key-dark-op' : ''}`}
                                        >
                                          {key}
                                        </button>
                                      ))}

                                      {['±', '°', '(', ')', '0', '.', '/', ':', '%', '↵'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => key === '↵' ? (userAnswer && checkAnswer()) : insertSymbol(key)}
                                          className={`p-2 rounded-lg text-center font-medium transition-all ${
                                            key === '↵' ? 'bg-violet text-white hover:bg-violet/80 shadow-glow-violet' :
                                            'key-dark'
                                          }`}
                                        >
                                          {key}
                                        </button>
                                      ))}
                                    </>
                                  )}

                                  {mathKeyboardTab === 'f(x)' && (
                                    <>
                                      {['sin', 'cos', 'tan', 'log', '⁻¹', 'ⁿ', '√', '∛', '(', ')'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center text-sm font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['θ', 'α', 'β', 'Δ', '∞', 'Σ', '∫', 'λ', 'μ', 'σ'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₀'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                    </>
                                  )}

                                  {mathKeyboardTab === 'ABC' && (
                                    <>
                                      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['u', 'v', 'w', 'x', 'y', 'z', ' ', ' ', ' ', '⌫'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => key === '⌫' ? setUserAnswer(prev => prev.slice(0, -1)) : key.trim() && insertSymbol(key)}
                                          disabled={!key.trim() && key !== '⌫'}
                                          className={`p-2 rounded-lg text-center font-medium transition-all ${
                                            key === '⌫' ? 'key-dark-special' :
                                            key.trim() ? 'key-dark' : ''
                                          }`}
                                        >
                                          {key}
                                        </button>
                                      ))}
                                    </>
                                  )}

                                  {mathKeyboardTab === 'symbols' && (
                                    <>
                                      {['∈', '∉', '⊂', '⊃', '∪', '∩', '∅', '∀', '∃', '¬'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['→', '←', '↔', '⇒', '⇔', '∧', '∨', '⊕', '≡', '≈'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                      {['£', '$', '€', '¢', '‰', '′', '″', '…', '·', '×'].map((key, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => insertSymbol(key)}
                                          className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                        >
                                          {key}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer || isProcessingImage}
                          className="w-full py-3 btn-gradient-mint text-void font-semibold rounded-xl transition-all disabled:opacity-30 check-btn"
                        >
                          {isProcessingImage ? 'Processing...' : 'Check Answer'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {showFeedback && (
                  <div className="space-y-4">
                    {practiceMode === 'exam' ? (
                      <div className={`p-4 rounded-xl ${
                        isCorrect
                          ? 'feedback-correct-dark'
                          : 'feedback-incorrect-dark'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <>
                              <Check className="w-5 h-5 text-emerald-400" />
                              <span className="font-semibold text-emerald-400">Correct</span>
                            </>
                          ) : (
                            <>
                              <X className="w-5 h-5 text-red-400" />
                              <span className="font-semibold text-red-400">Incorrect</span>
                              {current.a && (
                                <span className="text-sm text-white/60 ml-2">
                                  Answer: <strong>{renderRecurring(current.a)}</strong>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`p-4 rounded-xl ${
                          isCorrect
                            ? 'feedback-correct-dark'
                            : 'feedback-incorrect-dark'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {isCorrect ? (
                              <>
                                <Check className="w-5 h-5 text-emerald-400" />
                                <span className="font-semibold text-emerald-400">
                                  Correct!
                                </span>
                              </>
                            ) : (
                              <>
                                <X className="w-5 h-5 text-red-400" />
                                <span className="font-semibold text-red-400">Not quite</span>
                              </>
                            )}
                          </div>
                          {current.a && !isCorrect && (
                            <p className="text-sm text-white/60 mb-2">
                              The answer was: <strong className="text-white/80">{renderRecurring(current.a)}</strong>
                            </p>
                          )}
                        </div>

                        {!isCorrect && currentDiagnosis?.hasDiagnosis && (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/20">
                                <span className="text-xl">💡</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-amber-300 mb-1">
                                  What went wrong?
                                </h4>
                                <p className="text-sm mb-2 text-amber-200/80">
                                  {currentDiagnosis.diagnosis}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {!isCorrect && (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="w-5 h-5 text-blue-300" />
                              <span className="font-semibold text-blue-300">Worked Example</span>
                            </div>
                            {current.worked && current.worked.length > 0 ? (
                              <div className="text-sm text-blue-200/80 space-y-2">
                                {current.worked.map((step, i) => (
                                  <p key={i} className={i === current.worked.length - 1 ? 'font-semibold text-blue-300' : ''}>
                                    {renderRecurring(step)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-blue-200/80">
                                The correct answer is <strong className="text-blue-300">{renderRecurring(current.a)}</strong>
                                {current.hint && <span className="block mt-2 text-blue-200/60">Hint: {current.hint}</span>}
                              </p>
                            )}
                          </div>
                        )}

                      </>
                    )}

                    <button
                      onClick={nextQuestion}
                      className="w-full py-3 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 btn-gradient-mint text-void"
                    >
                      {currentIndex < sessionQueue.length - 1 ? (
                        <>Continue <ChevronRight className="w-5 h-5" /></>
                      ) : (
                        <>See Results <ChevronRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </div>
                )}
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-bold text-white">Report Question</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {reportSent ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white/80 text-sm">Thanks for reporting! We'll review this question.</p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-white/60 text-sm mb-4">What's wrong with this question?</p>
                {[
                  { label: '❌ Wrong answer shown', value: 'Wrong answer' },
                  { label: '😕 Question is unclear', value: 'Question unclear' },
                  { label: '📐 Wrong topic or tier', value: 'Wrong topic/tier' },
                  { label: '🐛 Other issue', value: 'Other issue' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={async () => {
                      const current = sessionQueue[currentIndex];
                      try {
                        const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
                        const raw = localStorage.getItem(storageKey);
                        const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
                        await fetch(`${supabaseUrl}/rest/v1/question_reports`, {
                          method: 'POST',
                          headers: {
                            'apikey': supabaseAnonKey,
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                          },
                          body: JSON.stringify({
                            question_code: current?.code || null,
                            question_text: current?.q || null,
                            expected_answer: String(current?.a ?? ''),
                            difficulty_level: current?.difficultyLevel || null,
                            tier: current?.tier || null,
                            issue_type: option.value,
                            user_id: practiceUser?.id || null,
                          }),
                        });
                        setReportSent(true);
                      } catch (err) {
                        console.error('Report failed:', err);
                        setReportSent(true);
                      }
                    }}
                    className="w-full text-left px-4 py-3 mb-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-400/30 text-white/80 text-sm transition-all"
                  >
                    {option.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default PracticePage;
