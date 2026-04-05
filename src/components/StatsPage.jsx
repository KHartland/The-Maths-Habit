import React, { useState } from 'react';
import { Target, Calendar, Zap, Trophy } from 'lucide-react';
import NavBar from './NavBar';
import SchoolLeaderboard from './SchoolLeaderboard';
import {
  loadSessionHistory,
  loadDailyActivity,
  loadStreakData,
} from '../lib/storage.js';
import {
  TOPIC_HEX,
} from '../data/curriculum.js';
import {
  isMastered,
} from '../lib/sessionQueue.js';

const getBestPracticeTime = () => {
  const history = loadSessionHistory();
  if (history.length < 5) return null;

  const hourCounts = {};
  history.forEach(s => {
    const hour = new Date(s.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const bestHour = Object.entries(hourCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  const hour = parseInt(bestHour);
  return `${hour % 12 === 0 ? 12 : hour % 12}:00${hour >= 12 ? 'PM' : 'AM'}`;
};

function StatsPage({ currentPage, setCurrentPage, dayStreak, progress, allObjectives, userSchool, user }) {
  const [timeRange, setTimeRange] = useState('week'); // 'week', 'month', 'all'
  const sessionHistory = loadSessionHistory();

  // Calculate time-based stats
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const filteredHistory = sessionHistory.filter(s => {
    if (timeRange === 'week') return s.date > weekAgo;
    if (timeRange === 'month') return s.date > monthAgo;
    return true;
  });

  // Overall stats
  const totalSessions = sessionHistory.length;
  const totalQuestions = sessionHistory.reduce((sum, s) => sum + s.total, 0);
  const totalCorrect = sessionHistory.reduce((sum, s) => sum + s.correct, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Period stats
  const periodSessions = filteredHistory.length;
  const periodQuestions = filteredHistory.reduce((sum, s) => sum + s.total, 0);
  const periodCorrect = filteredHistory.reduce((sum, s) => sum + s.correct, 0);
  const periodAccuracy = periodQuestions > 0 ? Math.round((periodCorrect / periodQuestions) * 100) : 0;

  // Topic breakdown
  const topicStats = {};
  Object.entries(TOPIC_HEX).forEach(([topic]) => {
    const topicObjectives = allObjectives?.filter(o => o.topic === topic) ?? [];
    const mastered = topicObjectives.filter(o => isMastered(progress[o.code])).length;
    const examReady = topicObjectives.filter(o => {
      const prog = progress[o.code];
      const qc = prog?.quickCorrect ?? 0;
      return qc >= 4 && qc < 5;
    }).length;
    const learning = topicObjectives.filter(o => {
      const prog = progress[o.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      return quickCorrect > 0 && quickCorrect < 4;
    }).length;
    topicStats[topic] = {
      total: topicObjectives.length,
      mastered,
      examReady,
      learning,
      notStarted: topicObjectives.length - mastered - examReady - learning,
      percentage: topicObjectives.length > 0 ? Math.round((mastered / topicObjectives.length) * 100) : 0,
    };
  });

  // Weekly activity chart data (last 7 days) — uses dailyActivity (cloud-synced)
  const dailyActivity = loadDailyActivity();
  const weeklyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayData = dailyActivity[dateKey];

    weeklyActivity.push({
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      questions: dayData?.questions ?? 0,
      correct: dayData?.correct ?? 0,
      sessions: dayData?.sessions ?? 0,
    });
  }

  // Calculate exam readiness
  const totalObjectiveCount = allObjectives?.length ?? 0;
  const masteredCount = allObjectives?.filter(o => isMastered(progress[o.code])).length ?? 0;
  const examReadyCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    const qc = prog?.quickCorrect ?? 0;
    return qc >= 4 && qc < 5;
  }).length ?? 0;
  const learningCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    const quickCorrect = prog?.quickCorrect ?? 0;
    return quickCorrect > 0 && quickCorrect < 4;
  }).length ?? 0;

  // Weighted readiness: mastered = 100%, exam ready = 80%, learning = 40%, not started = 0%
  const readinessScore = totalObjectiveCount > 0
    ? Math.round(((masteredCount * 100) + (examReadyCount * 80) + (learningCount * 40)) / totalObjectiveCount)
    : 0;

  const getReadinessLabel = (score) => {
    if (score >= 80) return { label: 'Exam Ready', color: 'text-emerald-600' };
    if (score >= 60) return { label: 'Almost There', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Making Progress', color: 'text-amber-600' };
    if (score >= 20) return { label: 'Getting Started', color: 'text-orange-600' };
    return { label: 'Just Beginning', color: 'text-slate-600' };
  };

  const readiness = getReadinessLabel(readinessScore);

  // Max for chart scaling
  const maxQuestions = Math.max(...weeklyActivity.map(d => d.questions), 1);

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      <div className="ambient-glow" />
      <div className="orb-purple w-80 h-80 -top-40 -right-40 opacity-70 fixed pointer-events-none" />
      <div className="orb-mint w-56 h-56 bottom-20 -left-24 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-44 h-44 top-1/2 right-0 opacity-50 fixed pointer-events-none" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text-celebration">Progress Analytics</h1>
            <p className="text-secondary-text mt-1">Track your learning journey</p>
          </div>

          {/* Exam Readiness Card */}
          <div className="glass-panel rounded-3xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-violet rounded-2xl flex items-center justify-center shadow-glow-violet">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Exam Readiness</h2>
                <p className={`text-sm font-medium ${readiness.color}`}>{readiness.label}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-white">{readinessScore}%</div>
              </div>
            </div>

            {/* Readiness bar */}
            <div className="h-4 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${readinessScore}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-mint">{masteredCount}</div>
                <div className="text-xs text-secondary-text">Mastered</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">{examReadyCount}</div>
                <div className="text-xs text-secondary-text">Exam Ready</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                <div className="text-xs text-secondary-text">Learning</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-secondary-text">{totalObjectiveCount - masteredCount - examReadyCount - learningCount}</div>
                <div className="text-xs text-secondary-text">Not Started</div>
              </div>
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-violet-light" />
                </div>
                <h2 className="font-semibold text-white">Weekly Activity</h2>
              </div>
            </div>

            {/* Simple bar chart */}
            <div className="flex items-end justify-between gap-2 h-32 mt-4">
              {weeklyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    {day.questions > 0 ? (
                      <div
                        className="w-full max-w-[40px] bg-gradient-to-t from-violet to-violet-light rounded-t-lg transition-all"
                        style={{ height: `${(day.questions / maxQuestions) * 100}%`, minHeight: '8px' }}
                      />
                    ) : (
                      <div className="w-full max-w-[40px] h-2 bg-white/20 rounded-lg" />
                    )}
                  </div>
                  <span className="text-xs text-secondary-text">{day.day}</span>
                  <span className="text-xs font-medium text-white">{day.questions}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{weeklyActivity.reduce((s, d) => s + d.sessions, 0)}</div>
                <div className="text-xs text-secondary-text">Sessions this week</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{weeklyActivity.reduce((s, d) => s + d.questions, 0)}</div>
                <div className="text-xs text-secondary-text">Questions answered</div>
              </div>
            </div>
          </div>

          {/* Streak Stats */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-500/20 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{loadStreakData().longestStreak}</div>
                <div className="text-xs text-amber-400">🏆 Longest Streak</div>
              </div>
              <div className="bg-blue-500/20 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{loadStreakData().freezesAvailable}</div>
                <div className="text-xs text-blue-400">🛡️ Streak Freezes</div>
              </div>
            </div>

            <p className="text-xs text-secondary-text mt-3 text-center">
              Earn freezes at 7, 14, 30, 60, 90, 180 & 365 day milestones
            </p>

            {/* Best Practice Time */}
            {getBestPracticeTime() && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary-text">🕐 Best time to practice:</span>
                  <span className="font-semibold text-white">{getBestPracticeTime()}</span>
                </div>
                <p className="text-xs text-secondary-text mt-1">Based on when you're most active</p>
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          {sessionHistory.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 shadow-glass">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="font-semibold text-white">Recent Sessions</h2>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessionHistory.slice(-10).reverse().map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Session #{session.sessionNumber}
                      </div>
                      <div className="text-xs text-secondary-text">
                        {new Date(session.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        session.correct === session.total ? 'text-mint' :
                        session.correct >= session.total * 0.8 ? 'text-blue-400' :
                        'text-secondary-text'
                      }`}>
                        {session.correct}/{session.total}
                      </div>
                      <div className="text-xs text-secondary-text">
                        {Math.round((session.correct / session.total) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* School Leaderboard */}
          {userSchool && user ? (
            <div className="glass-panel rounded-2xl p-6 shadow-glass">
              <SchoolLeaderboard
                schoolId={userSchool.id}
                schoolName={userSchool.name}
                currentUserId={user.id}
                isTeacher={true}
                compact={false}
              />
            </div>
          ) : user ? (
            <div className="glass-panel rounded-2xl p-6 shadow-glass text-center">
              <Trophy className="w-8 h-8 text-[#FBBF24] mx-auto mb-2" />
              <h3 className="font-semibold text-white mb-1">School Leaderboard</h3>
              <p className="text-sm text-secondary-text mb-3">Join your school to compete with classmates</p>
              <button
                onClick={() => setCurrentPage('settings')}
                className="px-5 py-2 btn-gradient-violet text-white text-sm font-medium rounded-xl"
              >
                Join a School
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StatsPage;
