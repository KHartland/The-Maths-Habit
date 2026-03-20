import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Users, Calendar, Clock, Trash2 } from 'lucide-react';
import { getSchoolLeaderboard, getSchoolLeaderboardMonthly, removeInactiveMembers, getProfileExtras } from '../lib/leaderboardService';
import { sanitiseName } from '../lib/profanityFilter';

const MEDALS = ['🥇', '🥈', '🥉'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SchoolLeaderboard = ({ schoolId, schoolName, currentUserId, isTeacher = false, compact = false }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [badges, setBadges] = useState({}); // { userId: 'gold' | 'diamond' }
  const [piroStages, setPiroStages] = useState({}); // { userId: 'Epic Piro' | 'Hatchling' | ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('monthly'); // 'monthly' (default) or 'alltime'
  const [monthlyAvailable, setMonthlyAvailable] = useState(true); // false if RPC not deployed yet
  const [cleanupStatus, setCleanupStatus] = useState(''); // '', 'cleaning', 'done'

  const fetchLeaderboard = async () => {
    if (!schoolId) return;
    setLoading(true);
    setError('');
    try {
      let data;
      if (view === 'monthly') {
        try {
          data = await getSchoolLeaderboardMonthly(schoolId);
        } catch (monthlyErr) {
          // Monthly RPC may not be deployed yet — fall back to all-time
          console.warn('Monthly leaderboard not available, falling back to all-time:', monthlyErr.message);
          data = await getSchoolLeaderboard(schoolId);
          setMonthlyAvailable(false);
        }
      } else {
        data = await getSchoolLeaderboard(schoolId);
      }
      setLeaderboard(data);
      // Fetch mastery badges and piro stages for displayed users
      if (data && data.length > 0) {
        const userIds = data.map(e => e.userId);
        getProfileExtras(userIds).then(({ badges: b, piroStages: p }) => {
          setBadges(b);
          setPiroStages(p);
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setError('Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [schoolId, view]);

  const displayData = compact ? leaderboard.slice(0, 5) : leaderboard;
  const userEntry = leaderboard.find(e => e.userId === currentUserId);
  const memberCount = leaderboard.length;

  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 text-metallic-base animate-spin" />
        <span className="ml-2 text-secondary-text text-sm">Loading leaderboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-secondary-text text-sm">
        <p>{error}</p>
        <button onClick={fetchLeaderboard} className="mt-2 text-metallic-base underline text-xs">Try again</button>
      </div>
    );
  }

  if (leaderboard.length === 0 && view === 'alltime') {
    return (
      <div className="text-center py-6">
        <Users className="w-8 h-8 text-secondary-text mx-auto mb-2" />
        <p className="text-secondary-text text-sm">No members yet. Be the first to practise!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header (full mode only) */}
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FBBF24]" />
            <h3 className="font-bold text-white">{schoolName}</h3>
            <span className="text-xs text-secondary-text">({memberCount} {memberCount === 1 ? 'member' : 'members'})</span>
          </div>
          <div className="flex items-center gap-1">
            {isTeacher && (
              <button
                onClick={async () => {
                  setCleanupStatus('cleaning');
                  try {
                    const removed = await removeInactiveMembers(schoolId);
                    setCleanupStatus(`Removed ${removed}`);
                    setTimeout(() => setCleanupStatus(''), 3000);
                    fetchLeaderboard();
                  } catch (err) {
                    console.error('Cleanup error:', err);
                    setCleanupStatus('');
                  }
                }}
                disabled={cleanupStatus === 'cleaning'}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                title="Remove inactive members (0 correct)"
              >
                {cleanupStatus === 'cleaning' ? (
                  <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
                ) : cleanupStatus ? (
                  <span className="text-xs text-green-400 font-medium">{cleanupStatus}</span>
                ) : (
                  <Trash2 className="w-4 h-4 text-secondary-text group-hover:text-red-400" />
                )}
              </button>
            )}
            <button
              onClick={fetchLeaderboard}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-secondary-text" />
            </button>
          </div>
        </div>
      )}

      {/* Monthly / All Time toggle */}
      {!compact && monthlyAvailable && (
        <div className="flex items-center gap-1 mb-4 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setView('monthly')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              view === 'monthly'
                ? 'bg-violet/30 text-white border border-violet/40 shadow-sm'
                : 'text-secondary-text hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {currentMonthName}
          </button>
          <button
            onClick={() => setView('alltime')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              view === 'alltime'
                ? 'bg-violet/30 text-white border border-violet/40 shadow-sm'
                : 'text-secondary-text hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            All Time
          </button>
        </div>
      )}

      {/* Monthly info banner */}
      {!compact && monthlyAvailable && view === 'monthly' && (
        <div className="mb-3 px-3 py-2 bg-violet/10 border border-violet/20 rounded-lg">
          <p className="text-xs text-secondary-text text-center">
            Resets on the 1st of each month — everyone starts fresh!
          </p>
        </div>
      )}

      {/* User's rank callout (full mode) */}
      {!compact && userEntry && (
        <div className="mb-4 p-3 bg-metallic-base/10 border border-metallic-base/30 rounded-xl text-center">
          <span className="text-sm text-primary-text">
            You are <span className="font-bold text-metallic-base">#{userEntry.rank}</span> of {memberCount}
            {monthlyAvailable && view === 'monthly' && <span className="text-secondary-text text-xs ml-1">this month</span>}
          </span>
        </div>
      )}

      {/* Empty state for monthly when no one has scored yet */}
      {leaderboard.length === 0 && view === 'monthly' ? (
        <div className="text-center py-6">
          <Calendar className="w-8 h-8 text-secondary-text mx-auto mb-2" />
          <p className="text-secondary-text text-sm">No scores yet for {currentMonthName}.</p>
          <p className="text-secondary-text text-xs mt-1">Be the first to practise this month!</p>
        </div>
      ) : (
        <>
          {/* Leaderboard rows */}
          <div className="space-y-1.5">
            {displayData.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : null;

              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isCurrentUser
                      ? 'bg-metallic-base/15 border border-metallic-base/30'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-lg">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold text-secondary-text">{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar + Name */}
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ${
                        entry.rank === 1 ? 'ring-[#FBBF24]' :
                        entry.rank === 2 ? 'ring-gray-400' :
                        entry.rank === 3 ? 'ring-amber-600' :
                        'ring-transparent'
                      }`}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
                      entry.rank === 1 ? 'bg-gradient-to-br from-[#FBBF24] to-amber-600' :
                      entry.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      entry.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                      'bg-metallic-base/40'
                    }`}
                    style={entry.avatarUrl ? { display: 'none' } : {}}
                  >
                    {sanitiseName(entry.displayName)?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className={`text-sm font-medium truncate ${
                      isCurrentUser ? 'text-metallic-base' : 'text-white/90'
                    }`}>
                      {sanitiseName(entry.displayName)}
                      {isCurrentUser && <span className="text-xs text-secondary-text ml-1">(you)</span>}
                    </span>
                    {badges[entry.userId] === 'diamond' && (
                      <img src="/images/tiles/diamond-tile.jpeg" alt="Diamond" className="w-5 h-5 rounded-sm flex-shrink-0" title="Completed Diamond Level" />
                    )}
                    {badges[entry.userId] === 'gold' && (
                      <img src="/images/tiles/gold-tile.jpeg" alt="Gold" className="w-5 h-5 rounded-sm flex-shrink-0" title="Completed Gold Level" />
                    )}
                    {piroStages[entry.userId] && (
                      <span className="text-[10px] text-secondary-text flex-shrink-0 bg-white/5 px-1.5 py-0.5 rounded-full" title={`Piro: ${piroStages[entry.userId]}`}>
                        {piroStages[entry.userId] === 'Egg' && '🥚'}
                        {piroStages[entry.userId] === 'Hatchling' && '🐣'}
                        {piroStages[entry.userId] === 'Smoke Flame' && '💨'}
                        {piroStages[entry.userId] === 'Teal Flame' && '🩵'}
                        {piroStages[entry.userId] === 'Magenta Flame' && '🩷'}
                        {piroStages[entry.userId] === 'Epic Piro' && '🔥'}
                        {piroStages[entry.userId] === 'Legendary Piro' && '💎'}
                        {' '}{piroStages[entry.userId]}
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-bold ${
                      entry.rank === 1 ? 'text-[#FBBF24]' : 'text-white/90'
                    }`}>
                      {entry.totalCorrect}
                    </span>
                    {!compact && (
                      <span className="text-xs text-secondary-text ml-1">correct</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* "View more" hint in compact mode */}
          {compact && leaderboard.length > 5 && (
            <p className="text-center text-xs text-secondary-text mt-3">
              +{leaderboard.length - 5} more · View full leaderboard in Stats
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SchoolLeaderboard;
