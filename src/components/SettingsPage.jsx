import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen, Swords, Search, School, Loader2, Trophy, Camera, Lock, Star, Flag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { redirectToCheckout, STRIPE_PRICES } from '../lib/stripe';
import IOSUpgradePrompt from './IOSUpgradePrompt';
import { checkProfanity, sanitiseName } from '../lib/profanityFilter';
import { uploadAvatar, deleteAvatar } from '../lib/avatarService';
import DOMPurify from 'dompurify';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { safeInitial } from '../lib/safeDisplayName';
import { Capacitor } from '@capacitor/core';
import NavBar from './NavBar';
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
} from '../lib/storage.js';
import { getAllSchools, createSchool, joinSchool, joinSchoolByCode, leaveSchool, getUserSchool } from '../lib/leaderboardService';
import { clearCloudData } from '../lib/syncService';
import { isMastered } from '../lib/sessionQueue.js';

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

// ==================== UTILITY FUNCTIONS ====================

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

// ==================== PROMO CODE INPUT COMPONENT ====================

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

// ==================== SETTINGS PAGE COMPONENT ====================

function SettingsPage({ currentPage, setCurrentPage, dayStreak, settings, setSettings, progress, setProgress, user, profile, isSubscribed, onSignIn, onSignUp, onSignOut, onUpgrade, userSchool, setUserSchool }) {
  const { refreshProfile } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountStatus, setDeleteAccountStatus] = useState(''); // '' | 'deleting' | 'error'
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  const [allSchoolsList, setAllSchoolsList] = useState([]);
  const [schoolsLoaded, setSchoolsLoaded] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [schoolJoining, setSchoolJoining] = useState(false);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolTown, setNewSchoolTown] = useState('');
  // Maths captcha for bot protection
  const [captcha, setCaptcha] = useState(() => {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    return { a, b, answer: a * b };
  });
  const [captchaInput, setCaptchaInput] = useState('');
  const [pendingSchool, setPendingSchool] = useState(null); // school waiting for captcha
  const [summaryStatus, setSummaryStatus] = useState(''); // '', 'copied', 'shared'
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  // Generate plain-English weekly summary for teachers/parents
  const generateWeeklySummary = () => {
    const sessionHistory = loadSessionHistory();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekSessions = sessionHistory.filter(s => s.date > weekAgo);

    // Calculate stats
    const totalQuestions = weekSessions.reduce((sum, s) => sum + (s.total || 0), 0);
    const correctAnswers = weekSessions.reduce((sum, s) => sum + (s.correct || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Find topics practiced
    const topicCounts = {};
    const strugglingTopics = {};
    weekSessions.forEach(session => {
      session.results?.forEach(r => {
        const topic = r.topic || 'Unknown';
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        if (!r.correct) {
          strugglingTopics[topic] = (strugglingTopics[topic] || 0) + 1;
        }
      });
    });

    // Sort by count
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    const needsWork = Object.entries(strugglingTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    // Count mastered objectives from progress object
    const progressEntries = Object.values(progress || {});
    const masteredCount = progressEntries.filter(p => isMastered(p)).length;
    const totalTracked = progressEntries.length;

    // Generate summary text
    const lines = [
      `GCSE MATHS WEEKLY SUMMARY`,
      `========================`,
      `Week ending: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      ``,
      `PRACTICE STATS`,
      `• Practice sessions: ${weekSessions.length}`,
      `• Questions answered: ${totalQuestions}`,
      `• Accuracy: ${accuracy}%`,
      `• Current streak: ${dayStreak} days`,
      ``,
      `OVERALL PROGRESS`,
      `• Objectives mastered: ${masteredCount}${totalTracked > 0 ? ` of ${totalTracked} practised` : ''}`,
      ``,
      `FOCUS AREAS`,
      topTopics.length > 0
        ? `• Focused on: ${topTopics.join(', ')}`
        : `• No practice sessions this week`,
      ``,
      needsWork.length > 0
        ? `NEEDS MORE PRACTICE\n• ${needsWork.join('\n• ')}`
        : `GREAT WORK! No struggling topics identified.`,
      ``,
      `---`,
      `Generated by The Maths Habit`,
    ];

    return lines.join('\n');
  };

  // Export weekly summary — use share sheet on mobile, copy fallback
  const handleExportSummary = async () => {
    try {
      const summary = generateWeeklySummary();
      // Try native share (works on iOS/Android)
      if (navigator.share) {
        try {
          await navigator.share({ title: 'GCSE Maths Weekly Summary', text: summary });
          setSummaryStatus('shared');
          setTimeout(() => setSummaryStatus(''), 2500);
          return;
        } catch (e) { /* user cancelled share */ }
      }
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(summary);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = summary;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    setSummaryStatus('copied');
    setTimeout(() => setSummaryStatus(''), 2500);
    } catch (err) { console.error('Export error:', err); }
  };

  // Handle export
  const handleExport = () => {
    const data = exportProgress();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-maths-habit-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const success = importProgress(event.target.result);
        if (success) {
          setProgress(loadProgress());
          setSettings(loadSettings());
          setImportStatus('success');
        } else {
          setImportStatus('error');
        }
      } catch {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Handle reset
  const handleReset = async () => {
    if (user) await clearCloudData(user.id);
    resetAllProgress();
    window.location.reload();
  };

  // Delete account – calls API route to remove auth record + all data, then clears local
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteAccountStatus('deleting');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      // Call the Vercel API route – it deletes all DB rows + the auth.users record
      const res = await fetch(`/api/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Delete failed');
      }

      // Also tidy up client-side things the edge function can't reach
      if (userSchool) {
        try { await leaveSchool(user.id); } catch (e) { /* ignore */ }
      }
      try { await deleteAvatar(user.id); } catch (e) { /* ignore */ }

      // Clear all local storage and reload
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleteAccountStatus('error');
    }
  };

  // Update setting
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Load all schools once when dropdown opens, then filter client-side
  useEffect(() => {
    if (!schoolDropdownOpen || schoolsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        setSchoolError('');
        const schools = await getAllSchools();
        if (!cancelled) {
          setAllSchoolsList(schools);
          setSchoolsLoaded(true);
          if (schools.length === 0) setSchoolError('No schools in database yet');
        }
      } catch (err) {
        console.error('Failed to load schools:', err);
        if (!cancelled) {
          setSchoolError('Failed to load schools: ' + (err.message || 'Unknown error'));
          setSchoolsLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [schoolDropdownOpen, schoolsLoaded]);

  const schoolResults = useMemo(() => {
    if (!schoolFilter.trim() || schoolFilter.trim().length < 2) return [];
    const q = schoolFilter.trim().toLowerCase();
    return allSchoolsList.filter(s =>
      s.name?.toLowerCase().includes(q) || s.town?.toLowerCase().includes(q)
    );
  }, [schoolFilter, allSchoolsList]);

  // Generate a new captcha
  const newCaptcha = () => {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    setCaptcha({ a, b, answer: a * b });
    setCaptchaInput('');
  };

  // When user clicks Join on a school, show captcha first
  const handleJoinSchool = (school) => {
    setPendingSchool(school);
    newCaptcha();
    setSchoolError('');
  };

  // Verify captcha and actually join
  const handleCaptchaSubmit = async () => {
    if (parseInt(captchaInput.trim(), 10) !== captcha.answer) {
      setSchoolError('Incorrect answer — try again');
      newCaptcha();
      return;
    }
    if (!user || !pendingSchool) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      await joinSchool(user.id, pendingSchool.id);
      setUserSchool(pendingSchool);
      localStorage.setItem('maths-habit-user-school', JSON.stringify(pendingSchool));
      setPendingSchool(null);
      setSchoolDropdownOpen(false);
      setSchoolFilter('');
      setCaptchaInput('');
    } catch (err) {
      setSchoolError(err.message || 'Failed to join school');
    } finally {
      setSchoolJoining(false);
    }
  };

  // Handle creating + joining a new school (with captcha)
  const handleCreateSchool = async () => {
    if (parseInt(captchaInput.trim(), 10) !== captcha.answer) {
      setSchoolError('Incorrect answer — try again');
      newCaptcha();
      return;
    }
    if (!user || !newSchoolName.trim() || !newSchoolTown.trim()) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      const school = await createSchool(newSchoolName.trim(), newSchoolTown.trim(), user.id);
      await joinSchool(user.id, school.id);
      setUserSchool(school);
      localStorage.setItem('maths-habit-user-school', JSON.stringify(school));
      setShowAddSchool(false);
      setNewSchoolName('');
      setNewSchoolTown('');
      setCaptchaInput('');
      setSchoolsLoaded(false);
    } catch (err) {
      setSchoolError(err.message || 'Failed to create school');
    } finally {
      setSchoolJoining(false);
    }
  };

  // Handle leaving school
  const handleLeaveSchool = async () => {
    if (!user) return;
    setSchoolError('');
    try {
      await leaveSchool(user.id);
      setUserSchool(null);
      localStorage.removeItem('maths-habit-user-school');
    } catch (err) {
      setSchoolError(err.message || 'Failed to leave school');
    }
  };

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      <div className="ambient-glow" />
      <div className="orb-pink w-72 h-72 -top-36 -right-36 opacity-70 fixed pointer-events-none" />
      <div className="orb-purple w-48 h-48 bottom-24 -left-20 opacity-60 fixed pointer-events-none" />
      <div className="orb-mint w-36 h-36 top-1/3 right-0 opacity-60 fixed pointer-events-none" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text-celebration">Settings</h1>
            <p className="text-secondary-text mt-1">Customise your learning experience</p>
          </div>

          {/* Account Section */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Account</h2>
                <p className="text-sm text-secondary-text">Manage your account and subscription</p>
              </div>
            </div>

            {user && (
              <div className="space-y-4">
                {/* User info with avatar */}
                <div className="p-4 bg-white/5 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Avatar with optional upload */}
                    <div className="relative group">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="w-12 h-12 rounded-full object-cover border-2 border-violet/30"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className={`w-12 h-12 bg-gradient-violet rounded-full flex items-center justify-center text-white font-semibold text-lg ${profile?.avatar_url ? 'hidden' : ''}`}
                      >
                        {safeInitial(user)}
                      </div>
                      {/* Camera overlay for subscribers */}
                      {isSubscribed && (
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                          <Camera className="w-5 h-5 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const url = await uploadAvatar(user.id, file);
                                // Update profile in context
                                refreshProfile();
                              } catch (err) {
                                console.error('Avatar upload failed:', err);
                                alert('Failed to upload avatar. Please try again.');
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-white">{typeof profile?.display_name === 'object' ? JSON.stringify(profile.display_name) : (profile?.display_name || 'Anonymous')}</div>
                        <button
                          onClick={() => { setEditingName(true); setNewDisplayName(profile?.display_name || ''); setNameError(''); }}
                          className="text-xs text-violet-light hover:text-white transition-colors"
                        >
                          {profile?.display_name ? 'Edit' : 'Add name'}
                        </button>
                      </div>
                      <div className="text-sm text-secondary-text break-all overflow-hidden">{user.email}</div>
                      {isSubscribed && (
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-violet cursor-pointer hover:text-violet-light transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  await uploadAvatar(user.id, file);
                                  refreshProfile();
                                } catch (err) {
                                  console.error('Avatar upload failed:', err);
                                  alert('Failed to upload avatar. Please try again.');
                                }
                                e.target.value = '';
                              }}
                            />
                            {profile?.avatar_url ? 'Change photo' : 'Add photo'}
                          </label>
                          {profile?.avatar_url && (
                            <button
                              onClick={async () => {
                                try {
                                  await deleteAvatar(user.id);
                                  refreshProfile();
                                } catch (err) {
                                  console.error('Avatar delete failed:', err);
                                }
                              }}
                              className="text-xs text-secondary-text hover:text-red-400 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-2 px-3 py-2 mt-3 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                  </div>

                {/* Edit display name */}
                {editingName && (
                  <div className="p-4 bg-white/5 rounded-xl border border-violet/30">
                    <label className="text-sm text-secondary-text block mb-2">Display name (visible on leaderboard)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Enter your name..."
                        maxLength={20}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet/50"
                      />
                      <button
                        disabled={nameSaving || !newDisplayName.trim()}
                        onClick={async () => {
                          const trimmed = newDisplayName.trim();
                          if (!trimmed) return;
                          const profanityCheck = checkProfanity(trimmed);
                          if (profanityCheck.isProfane) {
                            setNameError('That name is not allowed. Please choose another.');
                            return;
                          }
                          setNameSaving(true);
                          setNameError('');
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
                              body: JSON.stringify({ display_name: sanitiseName(trimmed) }),
                            });
                            if (!res.ok) throw new Error('Failed to save');
                            await refreshProfile();
                            setEditingName(false);
                          } catch (err) {
                            console.error('Name update failed:', err);
                            setNameError('Failed to save. Please try again.');
                          } finally {
                            setNameSaving(false);
                          }
                        }}
                        className="px-4 py-2 btn-gradient-mint text-void font-semibold rounded-xl text-sm disabled:opacity-40"
                      >
                        {nameSaving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-3 py-2 text-secondary-text hover:text-white text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {nameError && <p className="text-red-400 text-xs mt-2">{nameError}</p>}
                  </div>
                )}

                {/* Subscription status */}
                <div className="flex items-center justify-between p-4 bg-violet/20 rounded-xl border border-violet/30">
                  <div>
                    <div className="text-sm text-secondary-text">Subscription</div>
                    <div className="font-semibold text-white">
                      {isSubscribed ? (
                        <span className="text-mint">Premium Active</span>
                      ) : (
                        <span className="text-amber-400">Free Plan</span>
                      )}
                    </div>
                  </div>
                  {!isSubscribed && (
                    <button
                      onClick={onUpgrade}
                      className="px-4 py-2 btn-gradient-mint text-void text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                {/* Promo code input for free users - hidden on iOS per App Store guideline 3.1.1 */}
                {!isSubscribed && !isNativeIOS() && (
                  <PromoCodeInput onSuccess={() => window.location.reload()} />
                )}

                {/* Sync status */}
                <div className="flex items-center gap-2 text-sm text-mint">
                  <Check className="w-4 h-4" />
                  Progress syncing to cloud
                </div>
              </div>
            )}
          </div>

          {/* Your School */}
          {user && (
            <div className="glass-panel rounded-2xl p-6 shadow-glass mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5 text-violet-light" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Your School</h2>
                  <p className="text-sm text-secondary-text">{userSchool ? 'Change or leave your school here' : 'Join your school to see the leaderboard'}</p>
                </div>
              </div>

              {userSchool ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-metallic-base/10 rounded-xl border border-metallic-base/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-violet rounded-full flex items-center justify-center text-white font-semibold">
                        {userSchool.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-white">{userSchool.name}</div>
                        {userSchool.town && <div className="text-xs text-secondary-text">{userSchool.town}</div>}
                      </div>
                    </div>
                    <button
                      onClick={handleLeaveSchool}
                      className="px-3 py-1.5 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ) : pendingSchool ? (
                /* Maths captcha before joining */
                <div className="space-y-3">
                  <div className="p-4 bg-violet/20 rounded-xl border border-violet/30 text-center">
                    <p className="text-sm text-secondary-text mb-1">Joining <span className="text-white font-medium">{pendingSchool.name}</span></p>
                    <p className="text-white font-semibold text-lg mb-3">What is {captcha.a} × {captcha.b}?</p>
                    <div className="flex gap-2 justify-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="?"
                        autoFocus
                        className="w-24 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-center text-lg font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCaptchaSubmit(); }}
                      />
                      <button
                        onClick={handleCaptchaSubmit}
                        disabled={schoolJoining || !captchaInput.trim()}
                        className="px-6 py-3 btn-gradient-mint text-void font-semibold rounded-xl disabled:opacity-50"
                      >
                        {schoolJoining ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPendingSchool(null); setCaptchaInput(''); setSchoolError(''); }}
                    className="w-full py-2 text-sm text-secondary-text hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : showAddSchool ? (
                /* Add new school form with captcha */
                <div className="space-y-3">
                  <p className="text-sm text-secondary-text">Add your school to the list:</p>
                  <input
                    type="text"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="School name..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40"
                  />
                  <input
                    type="text"
                    value={newSchoolTown}
                    onChange={(e) => setNewSchoolTown(e.target.value)}
                    placeholder="Town / region..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40"
                  />
                  {newSchoolName.trim() && newSchoolTown.trim() && (
                    <div className="p-3 bg-violet/20 rounded-xl border border-violet/30 text-center">
                      <p className="text-sm text-secondary-text mb-1">Quick check: What is {captcha.a} × {captcha.b}?</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="?"
                        className="w-24 mx-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-center font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSchool(); }}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSchool}
                      disabled={schoolJoining || !newSchoolName.trim() || !newSchoolTown.trim() || !captchaInput.trim()}
                      className="flex-1 py-3 btn-gradient-mint text-void font-semibold rounded-xl disabled:opacity-50"
                    >
                      {schoolJoining ? 'Adding...' : 'Add & Join'}
                    </button>
                    <button
                      onClick={() => { setShowAddSchool(false); setNewSchoolName(''); setNewSchoolTown(''); setCaptchaInput(''); }}
                      className="px-4 py-3 text-secondary-text hover:text-white bg-white/10 rounded-xl transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                /* School dropdown selector */
                <div className="space-y-3">
                  <button
                    onClick={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white"
                  >
                    <span className="text-secondary-text/60">Select your school...</span>
                    <svg className={`w-4 h-4 text-secondary-text transition-transform ${schoolDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {schoolDropdownOpen && (
                    <div className="rounded-xl border border-white/10 bg-white/10 shadow-lg overflow-hidden backdrop-blur-sm">
                      <div className="p-2 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="text"
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            placeholder="Type your school name..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder-white/40"
                          />
                          {!schoolsLoaded && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text animate-spin" />
                          )}
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {!schoolsLoaded ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">Loading schools...</div>
                        ) : schoolError && allSchoolsList.length === 0 ? (
                          <div className="px-4 py-4 text-center text-sm text-red-400">{schoolError}</div>
                        ) : schoolFilter.trim().length < 2 ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">Start typing to search...</div>
                        ) : schoolResults.length > 0 ? schoolResults.map(school => (
                          <button
                            key={school.id}
                            onClick={() => handleJoinSchool(school)}
                            disabled={schoolJoining}
                            className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center justify-between disabled:opacity-50 border-b border-white/5 last:border-b-0"
                          >
                            <div>
                              <div className="text-sm text-white">{school.name}</div>
                              {school.town && <div className="text-xs text-white/60">{school.town}</div>}
                            </div>
                            <span className="text-xs text-metallic-base font-medium shrink-0 ml-3">Join</span>
                          </button>
                        )) : (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">No schools found for "{schoolFilter}"</div>
                        )}
                      </div>
                      <div className="p-2 border-t border-white/10">
                        <button
                          onClick={() => { setSchoolDropdownOpen(false); setShowAddSchool(true); newCaptcha(); }}
                          className="w-full py-2 text-sm text-metallic-base hover:text-mint font-medium transition-colors"
                        >
                          Can't find your school? Add it
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {schoolError && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {schoolError}
                </div>
              )}
            </div>
          )}

          {/* Study Preferences */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Study Preferences</h2>
                <p className="text-sm text-secondary-text">Adjust your practice sessions</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Questions per session */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Questions per session</label>
                  <span className="text-sm font-bold text-violet-light bg-violet/30 px-2 py-1 rounded-lg">
                    {isSubscribed ? settings.questionsPerSession : 5}
                  </span>
                </div>
                {isSubscribed ? (
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={settings.questionsPerSession}
                    onChange={(e) => updateSetting('questionsPerSession', parseInt(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-violet"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={5}
                      disabled
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                    <p className="text-xs text-amber-400 mt-1">Free plan: 5 questions per day. <button onClick={onUpgrade} className="underline hover:text-amber-300">Upgrade for more</button></p>
                  </div>
                )}
                {isSubscribed && (
                  <div className="flex justify-between text-xs text-secondary-text mt-1">
                    <span>5</span>
                    <span>30</span>
                  </div>
                )}
              </div>


              {/* Higher tier toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-secondary-text">Include Higher tier</div>
                  <div className="text-xs text-secondary-text/70">Add Higher-only objectives to practice</div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !settings.includeHigherTier;
                    updateSetting('includeHigherTier', newVal);
                  }}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.includeHigherTier ? 'bg-violet' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.includeHigherTier ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Daily goal */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Daily question goal</label>
                  <span className="text-sm font-bold text-mint bg-mint/20 px-2 py-1 rounded-lg">
                    {isSubscribed ? (settings.dailyGoal ?? 10) : 5}
                  </span>
                </div>
                {isSubscribed ? (
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={settings.dailyGoal ?? 10}
                    onChange={(e) => updateSetting('dailyGoal', parseInt(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-mint"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={5}
                      disabled
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                    <p className="text-xs text-amber-400 mt-1">Free plan: 5 questions per day. <button onClick={onUpgrade} className="underline hover:text-amber-300">Upgrade for more</button></p>
                  </div>
                )}
                {isSubscribed && (
                  <div className="flex justify-between text-xs text-secondary-text mt-1">
                    <span>5</span>
                    <span>50</span>
                  </div>
                )}
              </div>

              {/* Weekly mastery goal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Weekly mastery goal</label>
                  <span className="text-sm font-bold text-amber-400 bg-amber-400/20 px-2 py-1 rounded-lg">
                    {settings.weeklyMasteryGoal ?? 3}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={settings.weeklyMasteryGoal ?? 3}
                  onChange={(e) => updateSetting('weeklyMasteryGoal', parseInt(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-xs text-secondary-text mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
                <p className="text-xs text-secondary-text/70 mt-2">Objectives to master each week</p>
              </div>
            </div>
          </div>

          {/* Accessibility & Focus */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Accessibility</h2>
                <p className="text-sm text-secondary-text">Customize your learning experience</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label className="text-sm font-medium text-secondary-text mb-2 block">Text Size</label>
                <div className="flex gap-2">
                  {[
                    { value: 'normal', label: 'A', size: 'text-sm' },
                    { value: 'large', label: 'A', size: 'text-base' },
                    { value: 'xlarge', label: 'A', size: 'text-lg' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => updateSetting('fontSize', option.value)}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${option.size} ${
                        (settings.fontSize ?? 'normal') === option.value
                          ? 'bg-violet text-white'
                          : 'bg-white/10 text-secondary-text hover:bg-white/20'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dyslexia-friendly font */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-secondary-text">Dyslexia-friendly font</div>
                  <div className="text-xs text-secondary-text/70">Use OpenDyslexic for easier reading</div>
                </div>
                <button
                  onClick={() => updateSetting('dyslexiaFont', !settings.dyslexiaFont)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.dyslexiaFont ? 'bg-violet' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.dyslexiaFont ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

            </div>
          </div>

          {/* Data Management */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-secondary-text" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Data Management</h2>
                <p className="text-sm text-secondary-text">Backup and manage your progress</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Weekly Summary for Parents/Teachers */}
              <div className="p-4 bg-violet/20 border border-violet/30 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📋</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Weekly Summary</h3>
                    <p className="text-xs text-secondary-text mb-3">
                      Plain-English report for parents or teachers
                    </p>
                    {isSubscribed ? (
                      <button
                        onClick={handleExportSummary}
                        className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                          summaryStatus ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        {summaryStatus === 'copied' ? '✓ Copied to clipboard!' : summaryStatus === 'shared' ? '✓ Shared!' : '📤 Share Summary'}
                      </button>
                    ) : (
                      !isNativeIOS() ? (
                        <button
                          onClick={onUpgrade}
                          className="px-4 py-2 text-white text-sm font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          🔒 Upgrade to unlock
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              </div>


              {/* Import status */}
              {importStatus && (
                <div className={`p-3 rounded-xl text-sm ${
                  importStatus === 'success'
                    ? 'bg-mint/20 text-mint'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {importStatus === 'success'
                    ? '✓ Progress imported successfully!'
                    : '✗ Failed to import. Check file format.'}
                </div>
              )}

              {/* Reset button */}
              <div className="pt-4 border-t border-white/10">
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-colors border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Progress
                  </button>
                ) : (
                  <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold">Are you sure?</span>
                    </div>
                    <p className="text-sm text-red-400/80 mb-4">
                      This will permanently delete all your progress. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-2 glass-panel hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Yes, Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Account */}
              {user && (
                <div className="pt-4 border-t border-white/10">
                  {!showDeleteAccountConfirm ? (
                    <button
                      onClick={() => setShowDeleteAccountConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete your account
                    </button>
                  ) : (
                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                      <div className="flex items-center gap-2 text-red-400 mb-3">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold">Delete your account?</span>
                      </div>
                      <p className="text-sm text-red-400/80 mb-4">
                        This will permanently delete your account, all progress, stats, and school membership. This cannot be undone.
                      </p>
                      {deleteAccountStatus === 'error' && (
                        <p className="text-sm text-red-400 mb-3">Something went wrong. Please try again or contact support.</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowDeleteAccountConfirm(false); setDeleteAccountStatus(''); }}
                          className="flex-1 py-2 glass-panel hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
                          disabled={deleteAccountStatus === 'deleting'}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteAccountStatus === 'deleting'}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {deleteAccountStatus === 'deleting' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                          ) : (
                            'Yes, delete my account'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* About */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-white">About</h2>
                <p className="text-sm text-secondary-text">The Maths Habit v1.0</p>
              </div>
            </div>
            <p className="text-sm text-secondary-text leading-relaxed">
              A spaced repetition app designed to help GCSE students master every maths objective.
              Practice a little each day to build lasting understanding and confidence.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary-text">Objectives tracked</span>
                <span className="font-medium text-white">{Object.keys(progress).length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default SettingsPage;
