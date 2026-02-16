import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Users } from 'lucide-react';
import { getSchoolLeaderboard } from '../lib/leaderboardService';
import { sanitiseName } from '../lib/profanityFilter';

const MEDALS = ['🥇', '🥈', '🥉'];

const SchoolLeaderboard = ({ schoolId, schoolName, currentUserId, compact = false }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = async () => {
    if (!schoolId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getSchoolLeaderboard(schoolId);
      setLeaderboard(data);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setError('Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [schoolId]);

  const displayData = compact ? leaderboard.slice(0, 5) : leaderboard;
  const userEntry = leaderboard.find(e => e.userId === currentUserId);
  const memberCount = leaderboard.length;

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

  if (leaderboard.length === 0) {
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FBBF24]" />
            <h3 className="font-bold text-primary-text">{schoolName}</h3>
            <span className="text-xs text-secondary-text">({memberCount} {memberCount === 1 ? 'member' : 'members'})</span>
          </div>
          <button
            onClick={fetchLeaderboard}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-secondary-text" />
          </button>
        </div>
      )}

      {/* User's rank callout (full mode) */}
      {!compact && userEntry && (
        <div className="mb-4 p-3 bg-metallic-base/10 border border-metallic-base/30 rounded-xl text-center">
          <span className="text-sm text-primary-text">
            You are <span className="font-bold text-metallic-base">#{userEntry.rank}</span> of {memberCount}
          </span>
        </div>
      )}

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
                  : 'bg-gray-50 hover:bg-gray-100'
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

              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${
                  isCurrentUser ? 'text-metallic-base' : 'text-primary-text'
                }`}>
                  {sanitiseName(entry.displayName)}
                  {isCurrentUser && <span className="text-xs text-secondary-text ml-1">(you)</span>}
                </span>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <span className={`text-sm font-bold ${
                  entry.rank === 1 ? 'text-[#FBBF24]' : 'text-primary-text'
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
    </div>
  );
};

export default SchoolLeaderboard;
