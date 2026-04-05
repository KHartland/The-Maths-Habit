import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen, Swords, Search, School, Loader2, Trophy, Camera, Lock, Star, Flag } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import OneVsOne from './components/OneVsOne';
// HandwritingInput removed — Mathpix integration discontinued
import SchoolLeaderboard from './components/SchoolLeaderboard';
import { getAllSchools, createSchool, joinSchool, joinSchoolByCode, leaveSchool, getUserSchool } from './lib/leaderboardService';
import { redirectToCheckout, STRIPE_PRICES } from './lib/stripe';
import IOSUpgradePrompt from './components/IOSUpgradePrompt';
import { initIAP, destroyIAP } from './lib/iapService';
import { checkProfanity, sanitiseName } from './lib/profanityFilter';
import { uploadAvatar, deleteAvatar } from './lib/avatarService';
import { migrateLocalToCloud, loadFromCloud, saveProgressToCloud, saveFsrsToCloud, saveSettingsToCloud, saveStreakToCloud, saveDailyActivityToCloud } from './lib/syncService';
import DOMPurify from 'dompurify';
import { supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { CubeIcon, SquareRootIcon, CompassIcon, InfinityIcon, CompassStarIcon, BooksIcon, PiIcon } from './components/MathIcons';
import DragDropOrder from './components/DragDropOrder';
import DragDropMatch from './components/DragDropMatch';
import ErrorBoundary from "./components/ErrorBoundary";
import { safeInitial, safeDisplayName } from "./lib/safeDisplayName";
import { Capacitor } from "@capacitor/core";
const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
import { diamondQuestionBank } from './data/diamondQuestionBank.js';


// Custom maths-themed nav icons (image-based)
const NavIcon = ({ src, className = '' }) => (
  <img src={src} alt="" className={`${className} object-contain rounded-md`} draggable={false} />
);
const HomeIcon = ({ className }) => <NavIcon src="/images/nav/home.png" className={className} />;
const HeatmapIcon = ({ className }) => <NavIcon src="/images/nav/journey.png" className={className} />;
const PracticeIcon = ({ className }) => <NavIcon src="/images/nav/practice.png" className={className} />;
const StatsIcon = ({ className }) => <NavIcon src="/images/nav/stats.png" className={className} />;
const SettingsIcon = ({ className }) => <NavIcon src="/images/nav/settings.png" className={className} />;

// Legacy icon aliases (used elsewhere in app)
const StreakIcon = InfinityIcon;     // Infinity ∞ for Streak
const TrophyIcon = CompassStarIcon;  // Compass star for Awards
const StandardIcon = BooksIcon;      // Stack of books for Standard mode

// ==================== ANIMATED LOGO COMPONENT ====================
// Landing page logo using the app icon image
const AnimatedLogo = () => {
  return (
    <img
      src="/images/the-maths-habit-logo-hires.jpeg"
      alt="The Maths Habit logo"
      className="w-full h-full object-contain rounded-lg"
    />
  );
};

// ==================== RECURRING DECIMAL COMPONENT ====================
// Renders recurring decimals with clear dots above digits (UK GCSE standard)
// Usage: <Rec>0.3</Rec> for 0.3̇ or <Rec>0.142857</Rec> for 0.1̇42857̇
// For multiple dots: <Rec dots={[1,6]}>0.142857</Rec> puts dots on 1st and 6th decimal digit

const Rec = ({ children, dots = 'ends' }) => {
  const text = String(children);
  const decimalIndex = text.indexOf('.');

  if (decimalIndex === -1) return <span>{text}</span>;

  const beforeDecimal = text.slice(0, decimalIndex + 1);
  const afterDecimal = text.slice(decimalIndex + 1);

  // Determine which positions get dots
  let dotPositions = [];
  if (dots === 'ends') {
    // First and last digit of recurring part
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
    dotPositions = dots.map(d => d - 1); // Convert 1-indexed to 0-indexed
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

// Helper to render recurring text in questions (parses special syntax)
// Use: renderRecurring("Order: 0.7[r], 0.77, 0.707, 0.7[r]0[r]7[r]")
// [r] marks the preceding digit as recurring
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

  // Pattern: [vec:x,y] renders as a column vector
  // Process column vectors first
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

  // Pattern: digit followed by [r] means that digit is recurring
  const parts = [];
  let i = 0;
  let currentText = '';

  while (i < text.length) {
    if (text.slice(i, i + 3) === '[r]') {
      // Previous character should get a dot
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

// ==================== SCIENTIFIC CALCULATOR COMPONENT ====================
// On-screen calculator for questions that allow calculator use


import Calculator from './components/Calculator';



// AQA GCSE curriculum data — extracted to src/data/curriculum.js
import {
  topics, objectiveDescriptions, revisionHints, levelLabels,
  TOPIC_HEX, HEATMAP_COLORS, TILE_IMAGES,
} from './data/curriculum.js';


function mixWithWhite(hex, intensity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * (1 - intensity));
  return `#${[r, g, b].map(mix).map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

// Calculate recency factor (1.0 = practiced today, fades to 0.3 over 14 days)
function getRecencyFactor(lastPracticed) {
  if (!lastPracticed) return 0.5; // Never practiced = medium fade
  const daysSince = Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24));
  if (daysSince <= 1) return 1.0;   // Today/yesterday = full color
  if (daysSince <= 3) return 0.9;   // Last 3 days
  if (daysSince <= 7) return 0.75;  // Last week
  if (daysSince <= 14) return 0.55; // Last 2 weeks
  return 0.35; // Older = faded (needs revisiting)
}

// Level-based heatmap: cool teal to warm gold based on mastery
function getTileColor(hex, progressLevel, recencyFactor) {
  const baseColor = HEATMAP_COLORS[progressLevel] || HEATMAP_COLORS[0];
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  // Apply recency dimming (fade old topics toward darker)
  const dim = (c) => Math.round(c * (0.4 + 0.6 * recencyFactor));

  return `#${[dim(r), dim(g), dim(b)].map(c =>
    Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")
  ).join("")}`;
}

// Mastery system: 4 quick questions + 1 exam question = mastered
function getUnderstandingLevel(progress) {
  const quickCorrect = progress?.quickCorrect ?? 0;

  // 5 questions per objective, sequential progression
  // quickCorrect tracks how many they've got right (0-5)
  if (quickCorrect >= 5) return 5; // Mastered — all 5 questions correct
  if (quickCorrect === 4) return 4; // Nearly there
  if (quickCorrect === 3) return 3;
  if (quickCorrect === 2) return 2;
  if (quickCorrect === 1) return 1;
  return 0; // Not started
}

function isReadyForExam(progress) {
  // With 5-question sequential system, "exam ready" = completed 4 of 5
  return (progress?.quickCorrect ?? 0) === 4;
}

function TileDetailModal({ open, objective, progress, onClose }) {
  if (!open || !objective) return null;

  const quickCorrect = progress?.quickCorrect ?? 0;
  const mastered = quickCorrect >= 5;
  const level = getUnderstandingLevel(progress);
  const lastPracticed = progress?.lastPracticed;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="glass-panel-strong rounded-2xl w-full max-w-sm p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: TOPIC_HEX[objective.topic] }}
            >
              {objective.code}
            </span>
            <span className="text-xs text-secondary-text">{objective.topicName}</span>
            {objective.isHigher && (
              <span className="px-1.5 py-0.5 bg-violet text-white text-xs font-bold rounded">H</span>
            )}
          </div>
          <button onClick={onClose} className="text-secondary-text/60 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-4">
          {objective.title}
        </h3>

        {/* Status badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            level >= 5 ? 'bg-mint/20 text-mint border border-mint/30' :
            level >= 4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            level > 0 ? 'bg-violet/20 text-violet-light border border-violet/30' :
            'bg-white/10 text-secondary-text border border-white/10'
          }`}>
            {level >= 5 ? '⭐ Mastered' :
             level >= 4 ? '🔥 Nearly there' :
             level > 0 ? '📚 Learning' :
             '○ Not started'}
          </span>
        </div>

        {/* Progress bars */}
        <div className="space-y-3 mb-4">
          {/* Quick questions */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-secondary-text">Questions</span>
              <span className="font-medium text-white">{Math.min(quickCorrect, 5)}/5</span>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-2.5 flex-1 rounded-full transition-all"
                  style={{
                    backgroundColor: i < quickCorrect
                      ? TOPIC_HEX[objective.topic]
                      : 'rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Last practiced */}
        {lastPracticed && (
          <p className="text-xs text-secondary-text/60">
            Last practiced: {new Date(lastPracticed).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ==================== PRACTICE PAGE SYSTEM ====================

// Storage helpers

// Storage/persistence utilities — extracted to src/lib/storage.js
import {
  STORAGE_KEY, SETTINGS_KEY, SESSION_COUNT_KEY, SESSION_HISTORY_KEY,
  DAILY_ACTIVITY_KEY, STREAK_DATA_KEY, TOTAL_QUESTIONS_KEY, PIRO_KEY,
  ONBOARDING_COMPLETE_KEY, QUICKFIRE_MASTERY_THRESHOLD, QUICKFIRE_STREAK_THRESHOLD,
  isOnboardingComplete, setOnboardingComplete,
  TIPS_STORAGE_KEY, PRACTICE_TIPS, loadShownTips, markTipShown,
  defaultStreakData, defaultSettings,
  loadProgress, saveProgress, loadSessionCount, saveSessionCount,
  loadSessionHistory, saveSessionHistory,
  RECENT_QUESTIONS_KEY, MAX_RECENT_QUESTIONS, loadRecentQuestions, saveRecentQuestions,
  ANSWERED_CORRECT_KEY, loadAnsweredCorrect, saveAnsweredCorrect,
  loadTotalQuestions, saveTotalQuestions,
  loadDailyActivity, saveDailyActivity, getTodayKey, recordDailyActivity,
  loadStreakData, saveStreakData, calculateStreak, checkStreakMilestone,
} from './lib/storage.js';

// Piro mascot evolution system — extracted to src/lib/piro.js
import {
  PIRO_STAGES, PIRO_OLD, PIRO_CLOSE_TO_DEATH, PIRO_DEAD,
  PIRO_DECAY_DAYS, PIRO_DYING_DAYS, PIRO_DEATH_DAYS,
  getPiroStageFromStreak, loadPiro, savePiro, updatePiro,
  getPiroDisplay, getPiroProgress, getPiroNudge,
} from './lib/piro.js';


const getWeeklyMastery = (progress) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let count = 0;
  
  Object.values(progress).forEach(p => {
    if (p.masteredAt && p.masteredAt > weekAgo) {
      count++;
    }
  });
  
  return count;
};

const getBestPracticeTime = () => {
  const history = loadSessionHistory();
  if (history.length < 5) return null;
  
  const hourCounts = {};
  history.forEach(s => {
    const hour = new Date(s.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  let bestHour = null;
  let maxCount = 0;
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      bestHour = parseInt(hour);
    }
  });
  
  if (bestHour === null) return null;
  
  const formatHour = (h) => {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };
  
  return `${formatHour(bestHour)} - ${formatHour((bestHour + 1) % 24)}`;
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch { return defaultSettings; }
};

const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
};

const resetAllProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_COUNT_KEY);
    localStorage.removeItem(SESSION_HISTORY_KEY);
    localStorage.removeItem(DAILY_ACTIVITY_KEY);
    localStorage.removeItem(STREAK_DATA_KEY);
  } catch {}
};

const exportProgress = () => {
  const data = {
    progress: loadProgress(),
    settings: loadSettings(),
    sessionCount: loadSessionCount(),
    sessionHistory: loadSessionHistory(),
    dailyActivity: loadDailyActivity(),
    streakData: loadStreakData(),
    exportedAt: new Date().toISOString(),
    version: '1.3',
  };
  return JSON.stringify(data, null, 2);
};

const importProgress = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.progress) saveProgress(data.progress);
    if (data.settings) saveSettings(data.settings);
    if (data.sessionCount !== undefined) saveSessionCount(data.sessionCount);
    if (data.sessionHistory) saveSessionHistory(data.sessionHistory);
    if (data.dailyActivity) saveDailyActivity(data.dailyActivity);
    if (data.streakData) saveStreakData(data.streakData);
    return true;
  } catch {
    return false;
  }
};


// Question bank, exam questions, worked examples, tips and prerequisites
// extracted to src/data/questionBank.js for maintainability
import {
  questionBank,
  questionBankPrimary,
  questionBankGroups,
  questionBankLabel,
  pickVariant,
  getQuestionBankForTier,
  examQuestions,
  higherExamQuestions,
  getExamQuestionsForTier,
  workedExamples,
  examTips,
  prerequisites,
} from './data/questionBank.js';



// Answer checking utilities — extracted to src/lib/answerChecker.js
import { parseFraction, parseMixedNumber, normalizeString, checkAnswer } from './lib/answerChecker.js';

// Diagram generation — extracted to src/lib/diagrams.js
import { generateDiagram } from './lib/diagrams.js';

// Session queue and spaced repetition — extracted to src/lib/sessionQueue.js
import { INTERVALS, getNextDueTime, isDue, isMastered, buildSessionQueue, getDiamondQuestion } from './lib/sessionQueue.js';



// PracticePage component — extracted to src/components/PracticePage.jsx
import PracticePage from './components/PracticePage';


// Page components — extracted to src/components/
import StatsPage from './components/StatsPage';
import SettingsPage from './components/SettingsPage';

function OnboardingAuthForm({ onSuccess, initialMode = 'signup' }) {
  const [mode, setMode] = useState(initialMode); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onSuccess();
      } else {
        // Require a display name
        if (!displayName.trim()) {
          throw new Error('Please enter a display name');
        }
        if (displayName.trim().length < 2) {
          throw new Error('Display name must be at least 2 characters');
        }
        // Check display name for profanity
        const profanityCheck = checkProfanity(displayName);
        if (!profanityCheck.clean) {
          throw new Error(profanityCheck.reason);
        }
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Success will be handled by the useEffect in parent
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error/Success messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3 bg-mint/20 border border-mint/40 text-mint rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Apple Sign In — uses Apple HIG white button style for dark backgrounds */}
      <button
        onClick={async () => { setError(''); setLoading(true); try { const { error } = await signInWithApple(); if (error) throw error; } catch (err) { setError(err.message); } finally { setLoading(false); } }}
        disabled={loading}
        className="w-full bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-3"
        style={{ minHeight: '44px', fontSize: '17px', letterSpacing: '-0.01em' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="black">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Sign in with Apple
      </button>

      {/* Google Sign In */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 border border-gray-300"
        style={{ minHeight: '44px', fontSize: '17px', letterSpacing: '-0.01em' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-void text-secondary-text">or {mode === 'signup' ? 'create account' : 'sign in'} with email</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
              placeholder="Your name"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-secondary-text mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-text mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 btn-gradient-violet text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </span>
          ) : (
            mode === 'signup' ? 'Create Account' : 'Sign In'
          )}
        </button>
      </form>

      {/* Mode switcher */}
      <div className="text-center text-sm">
        {mode === 'signup' ? (
          <button
            onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
            className="text-violet-light hover:text-white transition-colors"
          >
            Already have an account? Sign in
          </button>
        ) : (
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            className="text-violet-light hover:text-white transition-colors"
          >
            Need an account? Create one
          </button>
        )}
      </div>
    </div>
  );
}

// Onboarding Plan Selection Card (Premium)
function OnboardingPlanCard({ onSelectFree, userId, userEmail }) {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const priceId = selectedPlan === 'monthly'
        ? STRIPE_PRICES.MONTHLY
        : STRIPE_PRICES.YEARLY;

      await redirectToCheckout({
        priceId,
        userId,
        userEmail,
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Unable to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel-strong rounded-2xl p-6 border-2 border-mint/50 relative overflow-hidden">
      {/* Popular badge */}
      <div className="absolute top-0 right-0 bg-mint text-void text-xs font-bold px-3 py-1 rounded-bl-lg">
        RECOMMENDED
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Premium</h3>
          <p className="text-secondary-text text-sm">Unlimited practice, maximum results</p>
        </div>
      </div>

      {/* Plan Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedPlan('monthly')}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            selectedPlan === 'monthly'
              ? 'bg-violet text-white'
              : 'bg-white/10 text-secondary-text hover:bg-white/20'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlan('yearly')}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative ${
            selectedPlan === 'yearly'
              ? 'bg-violet text-white'
              : 'bg-white/10 text-secondary-text hover:bg-white/20'
          }`}
        >
          Yearly
          <span className="absolute -top-2 -right-2 bg-mint text-void text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Save 37%
          </span>
        </button>
      </div>

      {/* Price Display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-white">
          {selectedPlan === 'monthly' ? '£3.99' : '£29.99'}
        </div>
        <div className="text-secondary-text text-sm">
          {selectedPlan === 'monthly' ? 'per month' : 'per year (£2.50/mo)'}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 text-sm mb-6">
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Unlimited daily questions
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Sync progress across all devices
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> All 700+ GCSE questions
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Priority support
        </li>
      </ul>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Upgrade Button */}
      <button
        onClick={handleUpgrade}
        disabled={isLoading}
        className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          `Start Premium - ${selectedPlan === 'monthly' ? '£3.99/mo' : '£29.99/yr'}`
        )}
      </button>

      {/* Secure payment */}
      <p className="mt-3 text-xs text-secondary-text/60 flex items-center justify-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure payment via Stripe
      </p>
    </div>
  );
}

// Promo Code Input Component
function PromoCodeInput({ onSuccess }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { redeemPromoCode } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    const result = await redeemPromoCode(code);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
    } else {
      setSuccess(result.message);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  };

  if (!showInput) {
    return (
      <div className="text-center">
        <button
          onClick={() => setShowInput(true)}
          className="text-violet-light hover:text-white text-sm transition-colors"
        >
          Have a class code? Enter it here
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <h4 className="text-white font-medium mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Enter Class Code
      </h4>

      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-mint/20 border border-mint/40 rounded-lg text-mint text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC-1234"
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent uppercase tracking-wider"
          disabled={isLoading || success}
        />
        <button
          type="submit"
          disabled={isLoading || !code.trim() || success}
          className="px-5 py-2.5 bg-violet hover:bg-violet-light text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      <button
        onClick={() => { setShowInput(false); setCode(''); setError(''); }}
        className="mt-3 text-secondary-text/60 hover:text-secondary-text text-xs transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// Inner App component that uses auth context
function AppContent() {
  const [tier, setTier] = useState(() => loadSettings().includeHigherTier ? 'higher' : 'foundation');
  const [tooltip, setTooltip] = useState({ open: false, x: 0, y: 0, objective: null });
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());

  // Apply accessibility settings to document.body
  useEffect(() => {
    const b = document.body;
    b.classList.toggle('dyslexia-font', !!settings.dyslexiaFont);
    b.classList.add('high-contrast'); // Always use high contrast for readability
    b.classList.remove('font-large', 'font-xlarge');
    if (settings.fontSize === 'large') b.classList.add('font-large');
    if (settings.fontSize === 'xlarge') b.classList.add('font-xlarge');
  }, [settings.dyslexiaFont, settings.fontSize]);

  const [currentPage, setCurrentPage] = useState('home');
  const [gameLevel, setGameLevel] = useState(1); // 1 = Stone→Gold grid, 2 = Diamond grid
  const [diamondProgress, setDiamondProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maths-habit-diamond-progress') || '{}'); } catch { return {}; }
  });
  const saveDiamondProgress = (dp) => { localStorage.setItem('maths-habit-diamond-progress', JSON.stringify(dp)); };
  const [higherProgress, setHigherProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maths-habit-higher-progress') || '{}'); } catch { return {}; }
  });
  const saveHigherProgress = (hp) => { localStorage.setItem('maths-habit-higher-progress', JSON.stringify(hp)); };

  // Tier-aware progress: Foundation and Higher have completely separate progress tracking
  const activeProgress = tier === 'higher' ? higherProgress : progress;
  const setActiveProgress = tier === 'higher' ? setHigherProgress : setProgress;
  const saveActiveProgress = tier === 'higher' ? saveHigherProgress : saveProgress;

  const [recentSessionCodes, setRecentSessionCodes] = useState([]);
  // Auto-clear recently-progressed tile highlights after 5 seconds
  useEffect(() => {
    if (recentSessionCodes.length === 0) return;
    const timer = setTimeout(() => setRecentSessionCodes([]), 5000);
    return () => clearTimeout(timer);
  }, [recentSessionCodes]);
  const [sessionToastData, setSessionToastData] = useState(null);
  const [celebrationIndex, setCelebrationIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Welcome, 2: Auth, 3: Profile Picture, 4: Plan Selection
  const [onboardingAuthMode, setOnboardingAuthMode] = useState('signup');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');
  const [showOneVsOne, setShowOneVsOne] = useState(false);
  const [userSchool, setUserSchool] = useState(null); // { id, name } or null
  const [piro, setPiro] = useState(() => loadPiro());
  const [piroEvolution, setPiroEvolution] = useState(null); // { oldStage, newStage } when evolution happens
  const [piroDecayed, setPiroDecayed] = useState(false); // Show decay warning
  const [showPiroNaming, setShowPiroNaming] = useState(false); // First place reward: name your dragon
  const [piroCustomName, setPiroCustomName] = useState('');
  const [piroNamingSaving, setPiroNamingSaving] = useState(false);
  const [piroNamingError, setPiroNamingError] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [promptDisplayName, setPromptDisplayName] = useState('');
  const [promptNameSaving, setPromptNameSaving] = useState(false);
  const [promptNameError, setPromptNameError] = useState('');

  // 1v1 daily limit for free users (1 per day)
  const FREE_1V1_LIMIT = 1;
  const get1v1TodayCount = () => {
    try {
      const data = JSON.parse(localStorage.getItem('maths-habit-1v1-daily') || '{}');
      const todayKey = getTodayKey();
      return data[todayKey] || 0;
    } catch { return 0; }
  };
  const increment1v1Count = () => {
    try {
      const data = JSON.parse(localStorage.getItem('maths-habit-1v1-daily') || '{}');
      const todayKey = getTodayKey();
      data[todayKey] = (data[todayKey] || 0) + 1;
      localStorage.setItem('maths-habit-1v1-daily', JSON.stringify(data));
    } catch {}
  };

  // Auth context
  const {
    user,
    profile,
    loading: authLoading,
    signOut,
    canPractice,
    questionsRemaining,
    incrementDailyQuestions,
    isSubscribed,
    dailyQuestionsUsed,
    FREE_DAILY_LIMIT,
    refreshProfile
  } = useAuth();

  // Initialise iOS In-App Purchases
  useEffect(() => {
    if (isNativeIOS()) {
      initIAP((update) => {
        console.log('[App] IAP update:', update);
        if (update.status === 'active') {
          refreshProfile?.();
        }
      });
      return () => destroyIAP();
    }
  }, []);

  // Auto-logout after 30 minutes of inactivity — uses localStorage timestamps
  // so it works across page visibility changes and doesn't interfere with React state
  useEffect(() => {
    const INACTIVITY_KEY = 'maths-habit-last-activity';
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    // Stamp activity on every interaction
    const stampActivity = () => {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
    };

    // Check on visibility change (when user returns to the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const last = Number(localStorage.getItem(INACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= INACTIVITY_TIMEOUT) {
        // Clear auth and reload — supabase will see no session on reload
        localStorage.removeItem('maths-habit-onboarding-complete');
        localStorage.removeItem(INACTIVITY_KEY);
        // Use supabase signOut directly via the global client to avoid React state issues
        import('./lib/supabase').then(({ supabase }) => {
          supabase.auth.signOut().finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      }
    };

    // Stamp on load
    stampActivity();

    window.addEventListener('touchstart', stampActivity, { passive: true });
    window.addEventListener('mousedown', stampActivity);
    window.addEventListener('keydown', stampActivity);
    window.addEventListener('scroll', stampActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check periodically while app is open
    const checkInterval = setInterval(() => {
      const last = Number(localStorage.getItem(INACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= INACTIVITY_TIMEOUT) {
        localStorage.removeItem('maths-habit-onboarding-complete');
        localStorage.removeItem(INACTIVITY_KEY);
        import('./lib/supabase').then(({ supabase }) => {
          supabase.auth.signOut().finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      }
    }, 60 * 1000);

    return () => {
      window.removeEventListener('touchstart', stampActivity);
      window.removeEventListener('mousedown', stampActivity);
      window.removeEventListener('keydown', stampActivity);
      window.removeEventListener('scroll', stampActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(checkInterval);
    };
  }, []); // Empty deps — runs once on mount, never re-runs

  // Prompt users without a display name to add one
  useEffect(() => {
    if (user && !authLoading && profile && !profile.display_name && !showOnboarding) {
      setShowNamePrompt(true);
    }
  }, [user, authLoading, profile, showOnboarding]);

  // Sync data when user logs in
  useEffect(() => {
    const syncOnLogin = async () => {
      if (user && !authLoading) {
        // Always pull from cloud first (cloud is source of truth)
        const cloudResult = await loadFromCloud(user.id);

        if (cloudResult.success && cloudResult.hasData) {
          // Cloud had data — refresh React state from localStorage (which loadFromCloud populated)
          setProgress(loadProgress());
          setSettings(loadSettings());
        } else {
          // Cloud is empty — push local data up (first-time user)
          const hasLocalData = localStorage.getItem('maths-habit-progress');
          if (hasLocalData) {
            await migrateLocalToCloud(user.id);
          }
        }
      }
    };
    syncOnLogin();
  }, [user, authLoading]);

  // Fetch user's school on login — also check localStorage cache
  useEffect(() => {
    if (user && !authLoading) {
      // Load cached school immediately for instant display
      try {
        const cached = localStorage.getItem('maths-habit-user-school');
        if (cached) setUserSchool(JSON.parse(cached));
      } catch {}
      // Then fetch fresh from server — but never clear cache on null
      // (only explicit "Leave" in Settings should clear the school)
      getUserSchool(user.id).then(school => {
        if (school) {
          setUserSchool(school);
          localStorage.setItem('maths-habit-user-school', JSON.stringify(school));

          // Check if user is #1 on startup → show dragon naming reward if eligible
          if (!profile?.piro_name) {
            const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
            try {
              const raw = localStorage.getItem(storageKey);
              const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
              fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ p_school_id: school.id }),
              }).then(async (lbRes) => {
                if (lbRes.ok) {
                  const leaderboard = await lbRes.json();
                  if (leaderboard.length > 0 && leaderboard[0].user_id === user.id) {
                    setShowPiroNaming(true);
                  }
                }
              }).catch(err => console.error('Startup leaderboard rank check error:', err));
            } catch (e) {
              console.error('Startup leaderboard token error:', e);
            }
          }
        }
        // If server returns null but we have a cached school, keep the cache —
        // the server call may have failed silently or have a replication delay
      }).catch(err => {
        console.error('Failed to fetch user school:', err);
        // Keep cached school on error — don't clear
      });
    } else if (!user) {
      setUserSchool(null);
    }
  }, [user, authLoading]);

  // Sync progress to cloud when it changes
  useEffect(() => {
    if (user) {
      saveProgressToCloud(user.id, progress);
    }
  }, [progress, user]);

  // Sync settings to cloud when they change
  useEffect(() => {
    if (user) {
      saveSettingsToCloud(user.id, settings);
    }
  }, [settings, user]);

  // Handle onboarding completion
  const completeOnboarding = () => {
    setOnboardingComplete();
    setShowOnboarding(false);
    setCurrentPage('practice'); // Go straight to practice
  };

  // After auth during onboarding, skip plan for returning users or show profile pic step for new ones
  useEffect(() => {
    if (!showOnboarding || !user) return;
    if (onboardingStep !== 2 && onboardingStep !== 3 && onboardingStep !== 4) return;

    // Wait for profile to load before deciding
    if (authLoading) return;

    // Returning user — has profile or local progress
    if (profile || Object.keys(progress).length > 0) {
      setOnboardingComplete();
      setShowOnboarding(false);
      setCurrentPage('home');
    } else if (onboardingStep === 2) {
      // New user — show profile picture step
      setOnboardingStep(3);
    }
  }, [user, showOnboarding, onboardingStep, profile, authLoading]);

  // Multi-step Onboarding Flow - Deep Space Glassmorphism
  if (showOnboarding) {
    // Step 1: Welcome Screen
    if (onboardingStep === 1) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

          <div className="max-w-md w-full text-center relative z-10">
            {/* App Logo */}
            <div className="w-24 h-24 rounded-2xl mx-auto mb-8 shadow-glow-violet animate-float overflow-hidden">
              <AnimatedLogo />
            </div>

            <h1 className="text-4xl font-bold mb-3 tracking-tight gradient-text-celebration">The Maths Habit</h1>
            <p className="text-xl text-secondary-text mb-10">
              GCSE Maths<br />
              <span className="text-violet-light">Every square counts.</span>
            </p>

            <button
              onClick={() => { setOnboardingAuthMode('signup'); setOnboardingStep(2); }}
              className="w-full py-5 btn-gradient-mint font-bold text-xl rounded-2xl transition-all active:scale-[0.98]"
            >
              Get Started →
            </button>

            <button
              onClick={() => { setOnboardingAuthMode('signin'); setOnboardingStep(2); }}
              className="w-full py-4 mt-3 glass-panel hover:bg-gray-100 font-semibold text-lg text-gray-700 rounded-2xl transition-all active:scale-[0.98]"
            >
              Sign In
            </button>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Account Creation/Sign-in
    if (onboardingStep === 2) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

          <div className="max-w-md w-full relative z-10">
            {/* Back button */}
            <button
              onClick={() => setOnboardingStep(1)}
              className="flex items-center gap-2 text-secondary-text hover:text-white mb-6 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="glass-panel rounded-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {onboardingAuthMode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-secondary-text">
                  {onboardingAuthMode === 'signin' ? 'Sign in to continue' : 'Save your progress and sync across devices'}
                </p>
              </div>

              {/* Embedded Auth Form */}
              <OnboardingAuthForm
                key={onboardingAuthMode}
                onSuccess={() => setOnboardingStep(3)}
                initialMode={onboardingAuthMode}
              />
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Profile Picture (teaser with lock for free users)
    if (onboardingStep === 3) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

          <div className="max-w-md w-full relative z-10">
            <div className="glass-panel rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Personalise your profile</h2>
              <p className="text-secondary-text mb-8">Stand out on the leaderboard with a profile picture</p>

              {/* Avatar preview with lock overlay */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="w-28 h-28 rounded-full bg-gradient-violet flex items-center justify-center text-white text-4xl font-bold">
                  {safeInitial(user)}
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center">
                  <Lock className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] text-white/80 font-medium">PRO</span>
                </div>
              </div>

              <p className="text-secondary-text text-sm mb-8">
                Upload a custom profile picture with a <span className="text-mint font-semibold">Pro subscription</span>
              </p>

              <button
                onClick={() => setOnboardingStep(4)}
                className="w-full py-3 btn-gradient-mint text-gray-800 font-semibold rounded-xl"
              >
                Continue
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 4: Plan Selection
    if (onboardingStep === 4) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

          <div className="max-w-lg w-full relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Choose your plan</h2>
              <p className="text-secondary-text">
                Start with free or unlock unlimited practice
              </p>
            </div>

            <div className="space-y-4">
              {/* Free Plan Card */}
              <div className="glass-panel rounded-2xl p-6 card-hover cursor-pointer border border-transparent hover:border-violet/50"
                onClick={completeOnboarding}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Free Plan</h3>
                    <p className="text-secondary-text text-sm mb-4">Perfect for getting started</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> {FREE_DAILY_LIMIT} questions per day
                      </li>
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> Track your progress
                      </li>
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> AI-powered explanations
                      </li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">£0</div>
                    <div className="text-secondary-text text-sm">Forever free</div>
                  </div>
                </div>
                <button className="w-full mt-6 py-3 border border-violet rounded-xl text-white font-medium hover:bg-violet/20 transition-colors">
                  Start Free →
                </button>
              </div>

              {/* Premium Plan Card — Stripe on web, StoreKit on iOS */}
              {isNativeIOS() ? (
                <button
                  onClick={() => setShowUpgradePrompt(true)}
                  className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all"
                >
                  View Premium Plans
                </button>
              ) : (
                <OnboardingPlanCard
                  onSelectFree={completeOnboarding}
                  userId={user?.id}
                  userEmail={user?.email}
                />
              )}

              {/* Promo Code Section - hidden on iOS per App Store guideline 3.1.1 */}
              {!isNativeIOS() && <PromoCodeInput onSuccess={completeOnboarding} />}
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
            </div>
          </div>
        </div>
      );
    }
  }

  // Calculate real streak from activity with protection
  const streakInfo = calculateStreak();
  const dayStreak = streakInfo.streak;
  const practicedToday = streakInfo.practicedToday;
  const needsRepair = streakInfo.needsRepair;
  const repairProgress = streakInfo.repairProgress;
  const potentialStreak = streakInfo.potentialStreak;
  const freezesAvailable = streakInfo.freezesAvailable;
  const longestStreak = streakInfo.longestStreak;

  // Update Piro decay/death state when streak changes
  useEffect(() => {
    const currentPiro = loadPiro();
    if (currentPiro.dead) return; // Dead is permanent

    // Calculate actual days since last practice
    const activity = loadDailyActivity();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysMissed = 0;
    if (dayStreak === 0 && !practicedToday) {
      // Find last day they practiced
      for (let d = 1; d <= 30; d++) {
        const check = new Date(today);
        check.setDate(check.getDate() - d);
        const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
        if (activity[key]?.questions >= 5) break;
        daysMissed = d;
      }
    }

    let changed = false;

    // Sync highestStreak & stage with actual streak on every load
    // (catches milestone changes and any streak/piro drift)
    if (dayStreak > currentPiro.highestStreak) {
      currentPiro.highestStreak = dayStreak;
      changed = true;
    }
    const earnedStage = getPiroStageFromStreak(currentPiro.highestStreak);
    if (earnedStage > currentPiro.stage) {
      const oldStage = currentPiro.stage;
      currentPiro.stage = earnedStage;
      currentPiro.evolvedAt = currentPiro.evolvedAt || [];
      currentPiro.evolvedAt.push({ stage: earnedStage, name: PIRO_STAGES[earnedStage].name, date: Date.now() });
      changed = true;
      // Show evolution celebration
      setPiroEvolution({ oldStage, newStage: earnedStage });
    }
    if (currentPiro.highestStreak >= 35) {
      currentPiro.reachedEpic = true;
    }

    // Recovery: practising reverses decay/dying
    if (practicedToday && (currentPiro.decayed || currentPiro.dying)) {
      currentPiro.decayed = false;
      currentPiro.dying = false;
      changed = true;
    }

    // Death ladder (only after reaching Epic)
    if (currentPiro.reachedEpic && daysMissed >= PIRO_DEATH_DAYS && !currentPiro.dead) {
      currentPiro.dead = true;
      currentPiro.decayed = false;
      currentPiro.dying = false;
      changed = true;
    } else if (currentPiro.reachedEpic && daysMissed >= PIRO_DYING_DAYS && !currentPiro.dying) {
      currentPiro.dying = true;
      currentPiro.decayed = false;
      changed = true;
    } else if (currentPiro.reachedEpic && daysMissed >= PIRO_DECAY_DAYS && !currentPiro.decayed && !currentPiro.dying) {
      currentPiro.decayed = true;
      changed = true;
    }

    if (changed) {
      savePiro(currentPiro);
      setPiro({ ...currentPiro });
    }
  }, [dayStreak, needsRepair, practicedToday]);
  
  // Today's progress towards daily goal
  const dailyActivity = loadDailyActivity();
  const todayKey = getTodayKey();
  const todayQuestions = dailyActivity[todayKey]?.questions ?? 0;
  const dailyGoal = isSubscribed ? (settings.dailyGoal ?? 10) : FREE_DAILY_LIMIT;
  const dailyProgress = Math.min((todayQuestions / dailyGoal) * 100, 100);
  
  // Weekly mastery progress
  const weeklyMastery = getWeeklyMastery(progress);
  const weeklyGoal = settings.weeklyMasteryGoal ?? 3;

  const getObjectives = (topic) => tier === 'higher' ? [...topic.foundation, ...topic.higher] : topic.foundation;
  
  const allObjectives = topics.flatMap(t => 
    getObjectives(t).map(code => ({ 
      code, 
      topic: t.strand, 
      topicName: t.name,
      title: descriptions[code],
      isHigher: t.higher.includes(code) 
    }))
  );

  const getLevel = (code) => getUnderstandingLevel(activeProgress[code]);
  const totalMastered = allObjectives.filter(o => getLevel(o.code) >= 5).length;

  // Level 2 (Diamond) helpers
  const level1Complete = allObjectives.every(o => getLevel(o.code) >= 5);
  const diamondObjectives = allObjectives.filter(o => diamondQuestionBank[o.code]);
  const getDiamondLevel = (code) => {
    const dp = diamondProgress[code];
    return dp?.quickCorrect ?? 0; // 0-3 (3 = diamond mastered)
  };
  const totalDiamondMastered = diamondObjectives.filter(o => getDiamondLevel(o.code) >= 3).length;

  // Diamond Level 2 heatmap: stone → gold → diamond
  const DIAMOND_HEATMAP = {
    0: '#1a1525',   // Stone (not started)
    1: '#D4AF37',   // Gold (in progress)
    2: '#D4AF37',   // Gold (nearly there)
    3: '#E8E8E8',   // Diamond (mastered)
  };
  const DIAMOND_TILE_IMAGES = {
    0: '/images/tiles/stone-tile.jpeg',     // Stone — not started
    1: '/images/tiles/gold-tile.jpeg',      // Gold — in progress
    2: '/images/tiles/gold-tile.jpeg',      // Gold — nearly there
    3: '/images/tiles/diamond-tile.jpeg',   // Diamond — mastered
  };

  // FSRS: Calculate questions due for review today
  const fsrsData = loadFsrsData();
  const now = Date.now();
  const dueForReview = Object.values(fsrsData.questionCards || {}).filter(
    card => card.nextReview && card.nextReview <= now
  ).length;
  const totalCards = Object.keys(fsrsData.questionCards || {}).length;

  const handleTileTap = (obj) => {
    setTooltip({
      open: true,
      x: 0,
      y: 0,
      objective: obj
    });
  };

  const closeTileDetail = () => {
    setTooltip(t => ({ ...t, open: false }));
  };

  const cols = Math.ceil(Math.sqrt(allObjectives.length * 1.3));

  // Spaced retrieval: weight objectives by how much they need practice
  const getWeightedObjectives = () => {
    // Load recent daily selections to avoid repeating same objectives
    let recentCodes = [];
    try {
      const stored = localStorage.getItem('maths_habit_recent_daily');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Keep last 3 days of selections
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        recentCodes = parsed.filter(e => e.ts > threeDaysAgo).flatMap(e => e.codes);
      }
    } catch (e) { /* ignore */ }

    // Check if any stone (never-practised) objectives remain
    const hasStoneGems = allObjectives.some(obj => {
      const prog = activeProgress[obj.code];
      return !prog || (!(prog.quickCorrect) && !(prog.lastPracticed));
    });

    return allObjectives.map(obj => {
      const prog = activeProgress[obj.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      const lastPracticed = prog?.lastPracticed ?? 0;
      const neverPractised = !prog || (!quickCorrect && !lastPracticed);
      const daysSince = lastPracticed ? Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24)) : 999;

      // Never-practised objectives get a massive boost
      if (neverPractised) {
        return { ...obj, weight: 50 };
      }

      // If there are still stone gems, don't show mastered (gold) objectives
      if (hasStoneGems && quickCorrect >= 5) {
        return { ...obj, weight: 0 };
      }

      // Weight: lower progress = higher weight, longer time since practice = higher weight
      let progressWeight;
      if (quickCorrect >= 5) {
        progressWeight = 1; // Mastered - low priority (only shown when no stone gems left)
      } else if (quickCorrect >= 4) {
        progressWeight = 3; // Nearly there - medium priority
      } else {
        progressWeight = Math.max(5 - quickCorrect, 2); // Learning - higher priority
      }

      const timeWeight = Math.min(daysSince + 1, 7); // 1-7 based on days
      let weight = progressWeight * timeWeight;

      // Penalise objectives that appeared in recent days to force rotation
      if (recentCodes.includes(obj.code)) {
        weight = Math.max(weight * 0.3, 1);
      }

      return { ...obj, weight };
    });
  };

  // Select 5 objectives for today's practice using weighted random selection
  const selectDailyObjectives = (seed) => {
    const weighted = getWeightedObjectives();
    const selected = [];
    const available = [...weighted];

    // Seeded random for consistent daily selection
    const seededRandom = (i) => {
      const x = Math.sin(seed + i * 9999) * 10000;
      return x - Math.floor(x);
    };

    // GUARANTEE: Pick at least 2 never-practised objectives first (if available)
    const neverPractised = available.filter(o => o.weight === 50);
    const shuffledNever = [...neverPractised].sort((a, b) => {
      return seededRandom(a.code.charCodeAt(0)) - seededRandom(b.code.charCodeAt(0));
    });
    for (let i = 0; i < Math.min(2, shuffledNever.length) && selected.length < 5; i++) {
      const idx = available.findIndex(a => a.code === shuffledNever[i].code);
      if (idx !== -1) {
        selected.push(available[idx]);
        available.splice(idx, 1);
      }
    }

    // Filter out zero-weight objectives (e.g. mastered when stone gems exist)
    const pickable = available.filter(o => o.weight > 0);

    // Fill remaining slots with weighted random
    for (let i = selected.length; i < 5 && pickable.length > 0; i++) {
      const totalWeight = pickable.reduce((sum, obj) => sum + obj.weight, 0);
      if (totalWeight <= 0) break;
      let rand = seededRandom(i + 100) * totalWeight;

      for (let j = 0; j < pickable.length; j++) {
        rand -= pickable[j].weight;
        if (rand <= 0) {
          selected.push(pickable[j]);
          pickable.splice(j, 1);
          break;
        }
      }
    }

    // Fallback: if selection failed, take from non-zero-weight objectives first
    if (selected.length < 5) {
      const remaining = weighted.filter(w => w.weight > 0 && !selected.find(s => s.code === w.code));
      while (selected.length < 5 && remaining.length > 0) {
        selected.push(remaining.shift());
      }
    }

    // Save today's selection for rotation tracking
    try {
      let stored = [];
      try {
        stored = JSON.parse(localStorage.getItem('maths_habit_recent_daily') || '[]');
      } catch (e) { /* ignore */ }
      const todayStr = new Date().toDateString();
      // Only add if not already saved today
      if (!stored.find(e => new Date(e.ts).toDateString() === todayStr)) {
        stored.push({ ts: Date.now(), codes: selected.map(s => s.code) });
        // Keep only last 5 days
        const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
        stored = stored.filter(e => e.ts > fiveDaysAgo);
        localStorage.setItem('maths_habit_recent_daily', JSON.stringify(stored));
      }
    } catch (e) { /* ignore */ }

    return selected;
  };

  // Get today's seed (changes daily)
  const todaySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  let dailyObjectives = selectDailyObjectives(todaySeed);
  
  // Fallback if selection returned empty
  if (!dailyObjectives || dailyObjectives.length === 0) {
    dailyObjectives = allObjectives.slice(0, 5);
  }

  // Gated 1v1 launcher — checks free daily limit
  const tryOpenOneVsOne = () => {
    if (!isSubscribed && get1v1TodayCount() >= FREE_1V1_LIMIT) {
      setShowUpgradePrompt(true);
      return;
    }
    if (!isSubscribed) increment1v1Count();
    setShowOneVsOne(true);
  };

  // 1v1 Battle Mode
  if (showOneVsOne) {
    if (!user) {
      // Need to be logged in for 1v1
      setShowAuthModal(true);
      setAuthModalMode('signin');
      setShowOneVsOne(false);
      return null;
    }
    return (
      <OneVsOne
        user={user}
        questionBank={questionBank}
        onClose={() => setShowOneVsOne(false)}
        answersEquivalent={answersEquivalent}
      />
    );
  }

  // ==================== PIRO NAMING MODAL (First Place Reward) ====================
  const handlePiroNamingSave = async () => {
    const trimmed = piroCustomName.trim();
    if (!trimmed) { setPiroNamingError('Give your dragon a name!'); return; }
    if (trimmed.length < 2) { setPiroNamingError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setPiroNamingError('Name must be 20 characters or less'); return; }
    const profanityResult = checkProfanity(trimmed);
    if (!profanityResult.clean) { setPiroNamingError(profanityResult.reason || 'That name is not allowed'); return; }

    setPiroNamingSaving(true);
    setPiroNamingError('');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ piro_name: trimmed }),
      });

      if (!res.ok) throw new Error('Failed to save dragon name');
      await refreshProfile();
      setShowPiroNaming(false);
      setPiroCustomName('');
    } catch (err) {
      console.error('Piro naming save error:', err);
      setPiroNamingError('Could not save name. Try again.');
    } finally {
      setPiroNamingSaving(false);
    }
  };

  if (showPiroNaming) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
        <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
        <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />

        {/* Celebration confetti */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(30)].map((_, i) => {
            const colors = ['#D4AF37', '#ec4899', '#8B5CF6', '#38E6A2', '#F59E0B'];
            const color = colors[i % colors.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 3;
            const duration = 3 + Math.random() * 2;
            return (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: color,
                  left: `${left}%`,
                  top: '-10px',
                  animation: `tileFall ${duration}s ${delay}s ease-in-out infinite`,
                  opacity: 0.7,
                }}
              />
            );
          })}
        </div>

        <div className="max-w-sm w-full glass-panel rounded-3xl p-8 text-center relative z-10">
          {/* Dragon trophy image */}
          <div className="w-32 h-32 mx-auto mb-4">
            <img
              src="/images/dragontrophy.png"
              alt="Dragon Trophy"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              onError={(e) => {
                // Fallback to icon if image not found
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"><svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>';
              }}
            />
          </div>

          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-2">
            You're #1!
          </h2>
          <p className="text-secondary-text text-sm mb-1">
            You've conquered your school leaderboard!
          </p>
          <p className="text-white font-medium mb-2">
            You've earned the right to name your dragon.
          </p>
          <p className="text-yellow-400/70 text-xs mb-6">
            Choose wisely — this name is permanent!
          </p>

          {/* Dragon preview */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden piro-idle">
            <PiroMedia display={getPiroDisplay(piro)} className="w-full h-full object-cover rounded-2xl" />
          </div>

          <input
            type="text"
            value={piroCustomName}
            onChange={(e) => { setPiroCustomName(e.target.value); setPiroNamingError(''); }}
            placeholder="Name your dragon..."
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-yellow-500/30 text-white placeholder-white/40 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter' && !piroNamingSaving) handlePiroNamingSave(); }}
          />

          {piroNamingError && (
            <p className="text-red-400 text-xs mt-2">{piroNamingError}</p>
          )}

          <button
            onClick={handlePiroNamingSave}
            disabled={piroNamingSaving || !piroCustomName.trim()}
            className="mt-5 w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 font-bold rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {piroNamingSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Star className="w-4 h-4" /> Name My Dragon Forever</>
            )}
          </button>

          <button
            onClick={() => { setShowPiroNaming(false); setPiroCustomName(''); }}
            className="mt-3 text-secondary-text/60 hover:text-secondary-text text-xs transition-colors"
          >
            Maybe later
          </button>

          <p className="text-white/30 text-xs mt-3">{piroCustomName.trim().length}/20 characters</p>
        </div>
      </div>
    );
  }

  // ==================== NAME PROMPT MODAL ====================
  // Blocks users without a display name until they add one
  const handleNamePromptSave = async () => {
    const trimmed = promptDisplayName.trim();
    if (!trimmed) { setPromptNameError('Please enter a display name'); return; }
    if (trimmed.length < 2) { setPromptNameError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setPromptNameError('Name must be 20 characters or less'); return; }
    if (!checkProfanity(trimmed).clean) { setPromptNameError('That name is not allowed'); return; }

    setPromptNameSaving(true);
    setPromptNameError('');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) throw new Error('Failed to save name');
      await refreshProfile();
      setShowNamePrompt(false);
      setPromptDisplayName('');
    } catch (err) {
      console.error('Name prompt save error:', err);
      setPromptNameError('Could not save name. Try again.');
    } finally {
      setPromptNameSaving(false);
    }
  };

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
        <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />

        <div className="max-w-sm w-full glass-panel rounded-3xl p-8 text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-glow-violet">
            <User className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Choose a display name</h2>
          <p className="text-secondary-text text-sm mb-6">
            This will show on the school leaderboard and in battles. You can change it later in Settings.
          </p>

          <input
            type="text"
            value={promptDisplayName}
            onChange={(e) => { setPromptDisplayName(e.target.value); setPromptNameError(''); }}
            placeholder="Enter your name..."
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter' && !promptNameSaving) handleNamePromptSave(); }}
          />

          {promptNameError && (
            <p className="text-red-400 text-xs mt-2">{promptNameError}</p>
          )}

          <button
            onClick={handleNamePromptSave}
            disabled={promptNameSaving || !promptDisplayName.trim()}
            className="mt-5 w-full py-3 btn-gradient-mint text-gray-900 font-bold rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {promptNameSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Check className="w-4 h-4" /> Continue</>
            )}
          </button>

          <p className="text-white/30 text-xs mt-3">{promptDisplayName.trim().length}/20 characters</p>
        </div>
      </div>
    );
  }

  // Placeholder pages
  if (currentPage === 'practice') {
    return (
      <>
      <PracticePage
        dailyObjectives={dailyObjectives}
        progress={activeProgress}
        setProgress={setActiveProgress}
        saveProgressFn={tier === 'higher' ? saveHigherProgress : saveProgress}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        allObjectives={allObjectives}
        settings={settings}
        isSubscribed={isSubscribed}
        FREE_DAILY_LIMIT={FREE_DAILY_LIMIT}
        tier={tier}
        setRecentSessionCodes={setRecentSessionCodes}
        setSessionToastData={setSessionToastData}
        setShowOneVsOne={tryOpenOneVsOne}
        setShowCelebration={setShowCelebration}
        setCelebrationIndex={setCelebrationIndex}
        setShowUpgradePrompt={setShowUpgradePrompt}
        gameLevel={gameLevel}
        diamondProgress={diamondProgress}
        setDiamondProgress={setDiamondProgress}
        saveDiamondProgress={saveDiamondProgress}
        diamondObjectives={diamondObjectives}
      />
      {/* Upgrade Prompt for Practice page — Stripe on web, StoreKit on iOS */}
      {isNativeIOS() ? (
        <IOSUpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSuccess={() => {
            setShowUpgradePrompt(false);
            refreshProfile?.();
          }}
        />
      ) : (
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSignUp={() => {
            setShowUpgradePrompt(false);
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
        />
      )}
      </>
    );
  }

  if (currentPage === 'stats') {
    return (
      <StatsPage
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        progress={activeProgress}
        allObjectives={allObjectives}
        userSchool={userSchool}
        user={user}
      />
    );
  }

  if (currentPage === 'settings') {
    return (
      <>
        <SettingsPage
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          dayStreak={dayStreak}
          settings={settings}
          setSettings={setSettings}
          progress={progress}
          setProgress={setProgress}
          user={user}
          profile={profile}
          isSubscribed={isSubscribed}
          onSignIn={() => { setAuthModalMode('signin'); setShowAuthModal(true); }}
          onSignUp={() => { setAuthModalMode('signup'); setShowAuthModal(true); }}
          onSignOut={async () => { await signOut(); localStorage.removeItem('maths-habit-onboarding-complete'); window.location.reload(); }}
          onUpgrade={() => setShowUpgradePrompt(true)}
          userSchool={userSchool}
          setUserSchool={setUserSchool}
        />
        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authModalMode}
        />
        {/* Upgrade Prompt — Stripe on web, StoreKit on iOS */}
        {isNativeIOS() ? (
          <IOSUpgradePrompt
            isOpen={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            onSuccess={() => {
              setShowUpgradePrompt(false);
              refreshProfile?.();
            }}
          />
        ) : (
          <UpgradePrompt
            isOpen={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            onSignUp={() => {
              setShowUpgradePrompt(false);
              setAuthModalMode('signup');
              setShowAuthModal(true);
            }}
          />
        )}
      </>
    );
  }

  if (currentPage === 'heatmap') {
    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-96 h-96 -top-48 -right-48 opacity-70 fixed pointer-events-none" />
        <div className="orb-mint w-64 h-64 top-1/2 -left-32 opacity-60 fixed pointer-events-none" />

        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

        {/* Tile glow animations (Gold + Diamond) */}
        <style>{`
          .gold-tile-glow {
            animation: goldPulse 3s ease-in-out infinite;
          }
          @keyframes goldPulse {
            0%, 100% { filter: drop-shadow(0 0 3px rgba(212,175,55,0.3)); }
            50% { filter: drop-shadow(0 0 8px rgba(212,175,55,0.6)); }
          }
          .gold-tile-shimmer {
            animation: goldShimmer 4s ease-in-out infinite;
          }
          @keyframes goldShimmer {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
          .diamond-tile-glow {
            animation: diamondPulse 3s ease-in-out infinite;
          }
          @keyframes diamondPulse {
            0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.3)); }
            50% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.7)); }
          }
        `}</style>

        <div className="pt-20 pb-28 md:pb-10 relative z-10">
          {/* Hero Heatmap Card */}
          <div className="max-w-4xl mx-auto px-2 sm:px-4">
            <div className="glass-panel rounded-3xl p-3 sm:p-6 md:p-10 shadow-glass card-hover">

              {/* Header with stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight gradient-text-celebration">
                    {gameLevel === 1 ? 'Your Maths Journey' : '💎 Diamond Level'}
                  </h1>
                  <p className="text-secondary-text mt-1">
                    {gameLevel === 1
                      ? `${allObjectives.length} GCSE objectives · Click to track progress`
                      : `${diamondObjectives.length} diamond challenges · Master them all`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Game Level toggle: Level 1 (Gold) / Level 2 (Diamond) */}
                  <div className="flex glass-panel rounded-lg p-1">
                    <button onClick={() => setGameLevel(1)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        gameLevel === 1 ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-gray-800'
                      }`}>⭐ Gold</button>
                    <button onClick={() => { if (level1Complete) setGameLevel(2); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        gameLevel === 2 ? 'bg-white/90 text-slate-900 shadow-[0_0_12px_rgba(255,255,255,0.4)]' :
                        level1Complete ? 'text-secondary-text hover:text-gray-800' : 'text-secondary-text/30 cursor-not-allowed'
                      }`}>{level1Complete ? '💎' : '🔒'} Diamond</button>
                  </div>

                  {/* Tier toggle */}
                  {gameLevel === 1 && (
                    <div className="flex glass-panel rounded-lg p-1">
                      {['foundation', 'higher'].map(t => (
                        <button key={t} onClick={() => setTier(t)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                            tier === t ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-gray-800'
                          }`}>{t}</button>
                      ))}
                    </div>
                  )}

                  {/* Mastery badge */}
                  <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl">
                    <TrophyIcon className="w-5 h-5 text-[#FBBF24]" />
                    <span className="font-bold text-[#FBBF24]">{gameLevel === 1 ? totalMastered : totalDiamondMastered}</span>
                    <span className="text-secondary-text text-sm">/ {gameLevel === 1 ? allObjectives.length : diamondObjectives.length}</span>
                  </div>
                </div>
              </div>

              {/* Mastery Level Legend - Top */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 mb-6 pb-6 border-b-2" style={{borderImage: gameLevel === 2
                ? 'linear-gradient(90deg, transparent, #888, #FFF, #888, transparent) 1'
                : 'linear-gradient(90deg, transparent, #B00053, #76235E, transparent) 1'}}>
                <span className="text-sm text-secondary-text mr-1">Progress:</span>
                {gameLevel === 1 ? [
                  { level: 0, label: 'New' },
                  { level: 1, label: 'Started' },
                  { level: 2, label: 'Learning' },
                  { level: 3, label: 'Confident' },
                  { level: 4, label: 'Exam ready' },
                  { level: 5, label: 'Mastered' },
                ].map(({ level, label }) => (
                  <div key={level} className="flex items-center gap-2">
                    <img src={TILE_IMAGES[level]} alt={label} className="w-7 h-7 rounded object-cover" />
                    <span className="text-sm text-secondary-text">{label}</span>
                  </div>
                )) : [
                  { level: 0, label: 'Stone' },
                  { level: 1, label: 'Gold' },
                  { level: 3, label: 'Diamond' },
                ].map(({ level, label }) => (
                  <div key={level} className="flex items-center gap-2">
                    <img src={DIAMOND_TILE_IMAGES[level]} alt={label} className="w-7 h-7 rounded object-cover" />
                    <span className="text-sm text-secondary-text">{label}</span>
                  </div>
                ))}
              </div>

              {/* Heatmap Explainer - shows for new users */}
              {!loadShownTips().includes('heatmapExplainer') && (
                <div className="mb-4 p-4 glass-panel rounded-xl border border-violet/30 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white mb-2">How the heatmap works</p>
                      <div className="space-y-1.5 text-xs text-secondary-text">
                        <div className="flex items-center gap-2">
                          <img src={TILE_IMAGES[0]} alt="Stone" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                          <span>Stone = not started yet</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <img src={TILE_IMAGES[2]} alt="Gem" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                          <span>Coloured gems = making progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <img src={TILE_IMAGES[4]} alt="Crimson" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                          <span>Bright gem = nearly there</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <img src={TILE_IMAGES[5]} alt="Gold" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                          <span>Gold = mastered!</span>
                        </div>
                      </div>
                      <p className="text-xs text-secondary-text/60 mt-2">Tap any tile to see its objective details</p>
                    </div>
                    <button
                      onClick={(e) => { e.currentTarget.closest('.animate-fade-in').remove(); markTipShown('heatmapExplainer'); }}
                      className="text-secondary-text/60 hover:text-gray-800 shrink-0 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* THE HEATMAP - Hero Element */}
              <div className="flex justify-center py-4" style={{ overflow: 'hidden', width: '100%' }}>
                {gameLevel === 1 ? (
                  /* LEVEL 1 GRID (Stone → Gold) */
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: window.innerWidth < 480 ? 3 : 6,
                    width: '100%',
                    maxWidth: `${cols * 36 + (cols - 1) * 6}px`
                  }}>
                    {allObjectives.map((obj) => {
                      const level = getLevel(obj.code);
                      const objProg = activeProgress[obj.code];
                      const isMasteredTile = level >= 5;
                      const isExamReady = level === 4;
                      const recency = getRecencyFactor(objProg?.lastPracticed);
                      const needsRevisit = recency < 0.6 && level > 0 && level < 5;
                      const tileOpacity = level === 0 ? 1 : (0.5 + 0.5 * recency);
                      return (
                        <div
                          key={obj.code}
                          onClick={() => handleTileTap(obj)}
                          style={{
                            aspectRatio: '1',
                            borderRadius: 4,
                            position: 'relative',
                            overflow: 'visible',
                            opacity: tileOpacity,
                          }}
                          className={`w-full transition-all duration-200 hover:scale-110 hover:z-20 hover:brightness-110 cursor-pointer active:scale-95 ${isMasteredTile ? 'gold-tile-glow' : ''} ${recentSessionCodes.includes(obj.code) ? 'heatmap-glow-afterpulse' : ''}`}
                        >
                          {/* Gold outer glow for mastered tiles */}
                          {isMasteredTile && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 6,
                              boxShadow: '0 0 8px rgba(212,175,55,0.5), 0 0 16px rgba(212,175,55,0.25)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Tile image */}
                          <img
                            src={TILE_IMAGES[level] || TILE_IMAGES[0]}
                            alt=""
                            className="w-full h-full object-cover relative z-[1]"
                            style={{ borderRadius: 4, filter: isMasteredTile ? 'brightness(1.15) saturate(1.2)' : 'none' }}
                            loading="lazy"
                            draggable={false}
                          />
                          {/* Gold shimmer overlay for mastered tiles */}
                          {isMasteredTile && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 4, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,235,140,0.15) 50%, transparent 70%)',
                            }} />
                          )}
                          {/* Revisit indicator overlay */}
                          {needsRevisit && !isExamReady && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30 z-[3]" style={{ borderRadius: 4 }}>
                              <span className="text-[8px] text-white/70">↻</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* LEVEL 2 GRID (Diamond) */
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols)}, 1fr)`,
                    gap: window.innerWidth < 480 ? 4 : 8,
                    width: '100%',
                    maxWidth: `${Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols) * 50 + (Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols) - 1) * 8}px`
                  }}>
                    {diamondObjectives.map((obj) => {
                      const dLevel = getDiamondLevel(obj.code);
                      const isDiamondMastered = dLevel >= 3;
                      const isGoldTile = dLevel === 1 || dLevel === 2;
                      return (
                        <div
                          key={obj.code}
                          onClick={() => handleTileTap(obj)}
                          style={{
                            aspectRatio: '1',
                            borderRadius: 6,
                            position: 'relative',
                            overflow: 'visible',
                          }}
                          className={`w-full transition-all duration-200 hover:scale-110 hover:z-20 hover:brightness-110 cursor-pointer active:scale-95 ${isDiamondMastered ? 'diamond-tile-glow' : isGoldTile ? 'gold-tile-glow' : ''} ${recentSessionCodes.includes(obj.code) ? 'heatmap-glow-afterpulse' : ''}`}
                        >
                          {/* Diamond outer glow for mastered diamond tiles — clear white sparkle */}
                          {isDiamondMastered && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 8,
                              boxShadow: '0 0 10px rgba(255,255,255,0.6), 0 0 20px rgba(255,255,255,0.3)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Gold outer glow for gold tiles in diamond grid */}
                          {isGoldTile && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 8,
                              boxShadow: '0 0 8px rgba(212,175,55,0.5), 0 0 16px rgba(212,175,55,0.25)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Tile image */}
                          <img
                            src={DIAMOND_TILE_IMAGES[dLevel] || DIAMOND_TILE_IMAGES[0]}
                            alt=""
                            className="w-full h-full object-cover relative z-[1]"
                            style={{ borderRadius: 6, filter: (isDiamondMastered || isGoldTile) ? 'brightness(1.15) saturate(1.2)' : 'none' }}
                            loading="lazy"
                            draggable={false}
                          />
                          {/* Diamond shimmer overlay — clear white sparkle */}
                          {isDiamondMastered && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
                            }} />
                          )}
                          {/* Gold shimmer overlay for gold tiles in diamond grid */}
                          {isGoldTile && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,235,140,0.15) 50%, transparent 70%)',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Tile Detail Modal */}
        <TileDetailModal
          open={tooltip.open}
          objective={tooltip.objective}
          progress={tooltip.objective ? activeProgress[tooltip.objective.code] : null}
          onClose={closeTileDetail}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="ambient-glow" />

      {/* Celebration-colored decorative orbs */}
      <div className="orb-purple w-96 h-96 -top-48 -right-48 opacity-70 fixed pointer-events-none" />
      <div className="orb-mint w-64 h-64 top-1/2 -left-32 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-72 h-72 bottom-20 right-10 opacity-60 fixed pointer-events-none hidden md:block" />
      <div className="orb-pink w-48 h-48 top-1/4 left-1/3 opacity-50 fixed pointer-events-none" />

      {/* No orientation prompts — portrait is default */}

      {/* Navigation */}
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      {/* Piro Evolution Celebration Modal */}
      {piroEvolution && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPiroEvolution(null)}>
          <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-primary-text mb-2">{profile?.piro_name || 'Piro'} Evolved!</h2>
            <p className="text-secondary-text mb-4">
              {PIRO_STAGES[piroEvolution.oldStage].name} → <span className="text-[#D4AF37] font-bold">{PIRO_STAGES[piroEvolution.newStage].name}</span>
            </p>
            <div className="w-40 h-40 mx-auto mb-4 rounded-2xl overflow-hidden flex items-center justify-center">
              <PiroMedia display={PIRO_STAGES[piroEvolution.newStage]} className="w-full h-full object-cover rounded-2xl" />
            </div>
            <button
              onClick={() => setPiroEvolution(null)}
              className="btn-gradient-mint px-8 py-3 text-white font-bold rounded-full"
            >
              Amazing!
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-20 pb-28 md:pb-10 relative z-10">

      {/* Piro Dragon Card - Home Screen Hero */}
      <div className="max-w-4xl mx-auto px-2 sm:px-4 mb-4">
        <div className={`glass-panel rounded-3xl p-4 sm:p-6 shadow-glass ${piro.dead ? 'border-red-900/60' : piro.dying ? 'border-red-700/50' : piro.decayed ? 'border-[#8F0000]/40' : ''}`}>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Dragon Video/Image */}
            <div className={`w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center ${piro.dead ? 'piro-decay grayscale' : piro.dying ? 'piro-decay' : piro.decayed ? 'piro-decay' : 'piro-idle'}`}>
              <PiroMedia display={getPiroDisplay(piro)} className="w-full h-full object-cover rounded-2xl" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-bold text-primary-text">{profile?.piro_name || 'Piro'}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${piro.dead ? 'bg-red-900/30 text-red-500' : piro.dying ? 'bg-red-800/20 text-red-400' : piro.decayed ? 'bg-[#8F0000]/20 text-[#8F0000]' : 'bg-white/10 text-secondary-text'}`}>
                  {getPiroDisplay(piro).name}
                </span>
              </div>

              {/* Streak Progress Bar */}
              {(() => {
                const progressInfo = getPiroProgress(piro, dayStreak);
                const isMaxStage = piro.stage >= PIRO_STAGES.length - 1;
                return (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-secondary-text mb-1">
                      <span>{dayStreak} day streak</span>
                      {!isMaxStage && progressInfo.nextName && (
                        <span>{progressInfo.needed} day{progressInfo.needed !== 1 ? 's' : ''} to {progressInfo.nextName}</span>
                      )}
                      {isMaxStage && !piro.decayed && !piro.dying && !piro.dead && <span className="text-[#D4AF37]">Max Evolution</span>}
                      {piro.dead && <span className="text-red-500 font-bold">DEAD</span>}
                      {!piro.dead && piro.dying && <span className="text-red-400 font-bold animate-pulse">DYING</span>}
                      {!piro.dead && !piro.dying && piro.decayed && <span className="text-[#8F0000]">Needs care!</span>}
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${piro.dead ? 100 : isMaxStage ? 100 : Math.max(2, progressInfo.progress * 100)}%`,
                          background: piro.dead
                            ? '#991b1b'
                            : piro.dying
                              ? '#dc2626'
                              : piro.decayed
                                ? '#8F0000'
                                : isMaxStage
                                  ? 'linear-gradient(90deg, #D4AF37, #B00053)'
                                  : piro.stage >= 3
                                    ? 'linear-gradient(90deg, #B00053, #A845A2)'
                                    : 'linear-gradient(90deg, #A845A2, #513A6F)',
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Nudge Message */}
              <p className={`text-xs sm:text-sm ${piro.dead ? 'text-red-500' : piro.dying ? 'text-red-400 font-bold' : piro.decayed ? 'text-[#8F0000]' : 'text-secondary-text'}`}>
                {getPiroNudge(piro, dayStreak, todayQuestions, dailyGoal)}
              </p>

              {/* Reset button when dead */}
              {piro.dead && (
                <button
                  onClick={() => {
                    if (window.confirm('Piro is gone forever. Hatch a new egg and start again?')) {
                      const freshPiro = { stage: 0, highestStreak: 0, reachedEpic: false, decayed: false, dying: false, dead: false, evolvedAt: [] };
                      savePiro(freshPiro);
                      setPiro(freshPiro);
                    }
                  }}
                  className="mt-2 px-4 py-1.5 text-xs font-bold rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                >
                  Hatch New Egg
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* School Leaderboard Card */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {user && userSchool ? (
          <div className="glass-panel rounded-2xl p-5 shadow-glass">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-[#FBBF24]" />
              <h2 className="font-bold text-white">{userSchool.name}{userSchool.town ? `, ${userSchool.town}` : ''}</h2>
            </div>
            <SchoolLeaderboard
              schoolId={userSchool.id}
              schoolName={userSchool.name}
              currentUserId={user.id}
              isTeacher={true}
              compact={true}
            />
            <button
              onClick={() => setCurrentPage('stats')}
              className="w-full mt-3 py-2 text-sm text-metallic-base font-medium hover:bg-metallic-base/10 rounded-xl transition-colors"
            >
              View Full Leaderboard →
            </button>
          </div>
        ) : null}
      </div>

      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Upgrade Prompt — Stripe on web, StoreKit on iOS */}
      {isNativeIOS() ? (
        <IOSUpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSuccess={() => {
            setShowUpgradePrompt(false);
            refreshProfile?.();
          }}
        />
      ) : (
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSignUp={() => {
            setShowUpgradePrompt(false);
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
        />
      )}
    </div>
  );
}

// LandscapePrompt removed — portrait is now the default orientation


// CelebrationCarousel extracted to src/components/CelebrationCarousel.jsx
import CelebrationCarousel from './components/CelebrationCarousel';

// PortraitPrompt removed — portrait is now the default orientation

// Main App wrapper with AuthProvider and ErrorBoundary
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
