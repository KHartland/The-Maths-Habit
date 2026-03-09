import React, { useState, useEffect, useCallback, Component } from 'react';
import { Users, Copy, Check, Play, Trophy, Clock, X, Loader2, Swords } from 'lucide-react';
import { sanitiseName } from '../lib/profanityFilter';
import HandwritingInput from './HandwritingInput';

// Error boundary to prevent white screen crashes
class BattleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Battle crash:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-4">
          <div className="glass-panel rounded-xl p-8 text-center max-w-md">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-white mb-2">Battle Crashed!</h2>
            <p className="text-secondary-text mb-6">Something went wrong during the match. This has been logged so we can fix it.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); this.props.onClose?.(); }}
              className="px-6 py-3 btn-gradient-violet text-white rounded-xl font-semibold"
            >
              Back to Menu
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  createMatch,
  joinMatch,
  startMatch,
  submitAnswer,
  finishMatch,
  getMatch,
  subscribeToMatch,
  leaveMatch
} from '../lib/matchService';

// Format time as MM:SS
const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Game states
const STATES = {
  MENU: 'menu',
  CREATING: 'creating',
  WAITING: 'waiting',
  JOINING: 'joining',
  READY: 'ready',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

// Avatar circle with image fallback to initial
const AvatarCircle = ({ avatarUrl, name, size = 'md', colorClass = 'bg-metallic-base/20', textClass = 'text-metallic-base' }) => {
  const sizeClasses = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'} rounded-full object-cover`}
        onError={(e) => {
          // Replace with initial fallback on error
          const div = document.createElement('div');
          div.className = `${sizeClasses} rounded-full ${colorClass} flex items-center justify-center`;
          const span = document.createElement('span');
          span.className = `font-bold ${textClass}`;
          span.textContent = initial;
          div.appendChild(span);
          e.target.replaceWith(div);
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full ${colorClass} flex items-center justify-center`}>
      <span className={`font-bold ${textClass}`}>{initial}</span>
    </div>
  );
};

const OneVsOne = ({ user, questionBank, onClose, answersEquivalent }) => {
  const [gameState, setGameState] = useState(STATES.MENU);
  const [match, setMatch] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerType, setPlayerType] = useState(null); // 'host' or 'guest'

  // Game state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [myFinished, setMyFinished] = useState(false);

  // Input mode for answer entry
  const [inputMode, setInputMode] = useState('handwriting'); // 'type' or 'handwriting'

  // Settings
  const [questionCount, setQuestionCount] = useState(10);
  const [tier, setTier] = useState('foundation');

  // Get display name
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Player';

  // Subscribe to match updates
  useEffect(() => {
    if (!match?.id) return;

    const unsubscribe = subscribeToMatch(match.id, (updatedMatch) => {
      setMatch(prev => {
        if (!prev) return updatedMatch;
        const merged = { ...prev };
        for (const [key, value] of Object.entries(updatedMatch)) {
          if (value !== undefined && value !== null) {
            merged[key] = value;
          } else if (key === 'winner_id' || key === 'guest_id' || key === 'guest_name') {
            merged[key] = value;
          }
        }
        return merged;
      });

      // Update opponent score
      if (playerType === 'host') {
        setOpponentScore(updatedMatch.guest_score || 0);
      } else {
        setOpponentScore(updatedMatch.host_score || 0);
      }

      // Check for state changes
      if (updatedMatch.status === 'ready' && gameState === STATES.WAITING) {
        setGameState(STATES.READY);
      }

      if (updatedMatch.status === 'playing' && gameState === STATES.READY) {
        setGameState(STATES.PLAYING);
        setStartTime(new Date(updatedMatch.started_at));
        setQuestionStartTime(Date.now());
      }

      if (updatedMatch.status === 'finished') {
        setGameState(STATES.FINISHED);
      }
    });

    return unsubscribe;
  }, [match?.id, playerType, gameState]);

  // Timer
  useEffect(() => {
    if (gameState !== STATES.PLAYING || !startTime) return;

    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime.getTime());
    }, 100);

    return () => clearInterval(timer);
  }, [gameState, startTime]);

  // Generate questions for the match
  const generateQuestions = useCallback(() => {
    const questions = [];
    const topics = Object.keys(questionBank);
    let attempts = 0;
    const maxAttempts = questionCount * 20;

    while (questions.length < questionCount && attempts < maxAttempts) {
      attempts++;
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const levels = questionBank[topic];
      if (!levels || levels.length === 0) continue;

      const level = levels[Math.floor(Math.random() * levels.length)];
      if (!Array.isArray(level) || level.length === 0) continue;

      const q = level[Math.floor(Math.random() * level.length)];
      if (!q || !q.q) continue;

      if (!questions.find(existing => existing.q === q.q)) {
        questions.push({ ...q, topic });
      }
    }

    return questions;
  }, [questionBank, questionCount]);

  // Create a new match
  const handleCreate = async () => {
    setError('');
    setGameState(STATES.CREATING);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please check your internet connection and try again.')), 30000)
      );

      const newMatch = await Promise.race([
        createMatch(user.id, displayName, { questionCount, tier }),
        timeoutPromise
      ]);

      setMatch(newMatch);
      setPlayerType('host');
      setGameState(STATES.WAITING);
    } catch (err) {
      console.error('Create match error:', err);
      setError(err.message || 'Failed to create match');
      setGameState(STATES.MENU);
    }
  };

  // Join existing match
  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a match code');
      return;
    }

    setError('');
    setGameState(STATES.JOINING);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 30000)
      );

      const joinedMatch = await Promise.race([
        joinMatch(joinCode, user.id, displayName),
        timeoutPromise
      ]);

      setMatch(joinedMatch);
      setPlayerType('guest');
      setGameState(STATES.READY);
    } catch (err) {
      console.error('Join match error:', err);
      setError(err.message || 'Failed to join match');
      setGameState(STATES.MENU);
    }
  };

  // Start the game (host only)
  const handleStart = async () => {
    try {
      const questions = generateQuestions();
      await startMatch(match.id, questions);
    } catch (err) {
      setError(err.message);
    }
  };

  // Copy code to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(match.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit answer
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    if (myFinished) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const questions = match?.questions;
      if (!questions || !questions[currentQuestionIndex]) {
        console.error('Questions missing from match state', { hasMatch: !!match, hasQuestions: !!questions, index: currentQuestionIndex });
        setError('Something went wrong. Please try leaving and creating a new match.');
        return;
      }

      const question = questions[currentQuestionIndex];
      let isCorrect = false;
      try {
        isCorrect = answersEquivalent(userAnswer, question.a || '');
      } catch (e) {
        console.error('Answer comparison error:', e);
        isCorrect = userAnswer.trim().toLowerCase() === (question.a || '').trim().toLowerCase();
      }
      const timeSpent = Date.now() - (questionStartTime || Date.now());

      try {
        await submitAnswer(
          match.id,
          user.id,
          playerType,
          currentQuestionIndex,
          userAnswer,
          isCorrect,
          timeSpent
        );
      } catch (submitErr) {
        console.error('Failed to submit answer to server:', submitErr);
      }

      if (isCorrect) {
        setMyScore(prev => prev + 1);
      }

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setUserAnswer('');
        setQuestionStartTime(Date.now());
        setIsSubmitting(false);
      } else {
        setMyFinished(true);
        try {
          await finishMatch(match.id, user.id, playerType);
        } catch (finishErr) {
          console.error('Failed to finish match on server:', finishErr);
        }
      }
    } catch (err) {
      console.error('handleSubmit error:', err);
      setError(err.message || 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  // Submit with a specific answer (used by handwriting auto-submit)
  const handleSubmitWithAnswer = async (answer) => {
    if (!answer || !answer.trim()) return;
    if (myFinished || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const questions = match?.questions;
      if (!questions || !questions[currentQuestionIndex]) {
        setError('Something went wrong. Please try leaving and creating a new match.');
        return;
      }

      const question = questions[currentQuestionIndex];
      let isCorrect = false;
      try {
        isCorrect = answersEquivalent(answer, question.a || '');
      } catch (e) {
        isCorrect = answer.trim().toLowerCase() === (question.a || '').trim().toLowerCase();
      }
      const timeSpent = Date.now() - (questionStartTime || Date.now());

      try {
        await submitAnswer(match.id, user.id, playerType, currentQuestionIndex, answer, isCorrect, timeSpent);
      } catch (submitErr) {
        console.error('Failed to submit answer to server:', submitErr);
      }

      if (isCorrect) {
        setMyScore(prev => prev + 1);
      }

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setUserAnswer('');
        setQuestionStartTime(Date.now());
        setIsSubmitting(false);
      } else {
        setMyFinished(true);
        try {
          await finishMatch(match.id, user.id, playerType);
        } catch (finishErr) {
          console.error('Failed to finish match on server:', finishErr);
        }
      }
    } catch (err) {
      console.error('handleSubmitWithAnswer error:', err);
      setError(err.message || 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  // Leave match
  const handleLeave = async () => {
    if (match) {
      try {
        await leaveMatch(match.id, user.id);
      } catch (err) {
        console.error('Error leaving match:', err);
      }
    }
    setMatch(null);
    setGameState(STATES.MENU);
    setPlayerType(null);
    setCurrentQuestionIndex(0);
    setMyScore(0);
    setOpponentScore(0);
    setMyFinished(false);
  };

  // Render based on game state
  const renderContent = () => {
    switch (gameState) {
      case STATES.MENU:
        return (
          <div className="space-y-6">
            {/* Create Match */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Swords className="w-5 h-5 text-metallic-base" />
                Create Match
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-text mb-1">Questions</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-white/10 bg-white/5 text-white"
                  >
                    <option value={5}>5 questions (Quick)</option>
                    <option value={10}>10 questions (Standard)</option>
                    <option value={15}>15 questions (Long)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-text mb-1">Difficulty</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full p-2 rounded-lg border border-white/10 bg-white/5 text-white"
                  >
                    <option value="foundation">Foundation</option>
                    <option value="higher">Higher</option>
                  </select>
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-3 btn-gradient-violet text-white font-semibold rounded-xl"
                >
                  Create Match
                </button>
              </div>
            </div>

            {/* Join Match */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-metallic-base" />
                Join Match
              </h3>

              <div className="space-y-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full p-3 rounded-lg border border-white/10 bg-white/5 text-white text-center text-2xl font-mono tracking-widest uppercase placeholder-white/30"
                />

                <button
                  onClick={handleJoin}
                  disabled={joinCode.length !== 6}
                  className="w-full py-3 btn-gradient-mint text-gray-900 font-semibold rounded-xl disabled:opacity-50"
                >
                  Join Match
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>
        );

      case STATES.CREATING:
      case STATES.JOINING:
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-metallic-base animate-spin mb-4" />
            <p className="text-secondary-text">{gameState === STATES.CREATING ? 'Creating match...' : 'Joining match...'}</p>
          </div>
        );

      case STATES.WAITING:
        return (
          <div className="text-center space-y-6">
            <div className="glass-panel rounded-xl p-8">
              <h3 className="text-lg font-semibold text-white mb-2">Share this code with your friend:</h3>

              <div className="flex items-center justify-center gap-2 my-6">
                <div className="text-4xl font-mono font-bold tracking-widest text-white bg-white/10 px-6 py-4 rounded-xl">
                  {match.code}
                </div>
                <button
                  onClick={copyCode}
                  className="p-3 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6 text-secondary-text" />}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-secondary-text">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Waiting for opponent to join...</span>
              </div>
            </div>

            <button
              onClick={handleLeave}
              className="px-6 py-2 text-secondary-text hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        );

      case STATES.READY:
        return (
          <div className="text-center space-y-6">
            <div className="glass-panel rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Ready to Battle!</h3>

              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-center">
                  <div className="mb-2 flex justify-center">
                    <AvatarCircle
                      avatarUrl={null}
                      name={sanitiseName(match.host_name)}
                      size="lg"
                      colorClass="bg-metallic-base/20"
                      textClass="text-metallic-base"
                    />
                  </div>
                  <p className="font-semibold text-white">{sanitiseName(match.host_name)}</p>
                  {playerType === 'host' && <span className="text-xs text-metallic-base">(You)</span>}
                </div>

                <div className="text-3xl font-bold text-white/30">VS</div>

                <div className="text-center">
                  <div className="mb-2 flex justify-center">
                    <AvatarCircle
                      avatarUrl={null}
                      name={sanitiseName(match.guest_name)}
                      size="lg"
                      colorClass="bg-mint/20"
                      textClass="text-mint"
                    />
                  </div>
                  <p className="font-semibold text-white">{sanitiseName(match.guest_name)}</p>
                  {playerType === 'guest' && <span className="text-xs text-metallic-base">(You)</span>}
                </div>
              </div>

              <p className="text-secondary-text mb-6">
                {match.question_count} questions • {match.tier === 'foundation' ? 'Foundation' : 'Higher'} tier
              </p>

              {playerType === 'host' ? (
                <button
                  onClick={handleStart}
                  className="px-8 py-3 btn-gradient-mint text-gray-900 font-bold rounded-xl flex items-center gap-2 mx-auto"
                >
                  <Play className="w-5 h-5" />
                  Start Match
                </button>
              ) : (
                <p className="text-secondary-text flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Waiting for host to start...
                </p>
              )}
            </div>

            <button
              onClick={handleLeave}
              className="px-6 py-2 text-secondary-text hover:text-white transition-colors"
            >
              Leave Match
            </button>
          </div>
        );

      case STATES.PLAYING:
        // Show waiting screen if player has finished all questions
        if (myFinished) {
          return (
            <div className="text-center space-y-6">
              <div className="glass-panel rounded-xl p-8">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-white mb-2">You're done!</h3>
                <p className="text-secondary-text mb-4">
                  You scored {myScore} out of {match.questions?.length || 0}
                </p>
                <div className="flex items-center justify-center gap-2 text-secondary-text">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Waiting for opponent to finish...</span>
                </div>
              </div>
            </div>
          );
        }

        const question = match.questions?.[currentQuestionIndex];
        if (!question) return null;

        return (
          <div className="space-y-4">
            {/* Score bar */}
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-sm text-secondary-text">{playerType === 'host' ? 'You' : sanitiseName(match.host_name)}</p>
                  <p className="text-2xl font-bold text-metallic-base">{playerType === 'host' ? myScore : opponentScore}</p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-secondary-text">Time</p>
                  <p className="text-xl font-mono text-white">{formatTime(elapsedTime)}</p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-secondary-text">{playerType === 'guest' ? 'You' : sanitiseName(match.guest_name)}</p>
                  <p className="text-2xl font-bold text-mint">{playerType === 'guest' ? myScore : opponentScore}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-secondary-text mb-1">
                  <span>Question {currentQuestionIndex + 1} of {match.questions.length}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-metallic-shadow via-metallic-base to-metallic-highlight transition-all"
                    style={{ width: `${((currentQuestionIndex + 1) / match.questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="glass-panel rounded-xl p-6">
              <p className="text-lg text-white mb-6">{question.q}</p>

              {question.type === 'mcq' && question.options ? (
                <div className="grid grid-cols-2 gap-2">
                  {question.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setUserAnswer(option)}
                      className={`p-3 rounded-lg border-2 transition-all text-white ${
                        userAnswer === option
                          ? 'border-metallic-base bg-metallic-base/10'
                          : 'border-white/10 hover:border-metallic-base/50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Input mode toggle */}
                  <div className="flex glass-panel rounded-lg p-1">
                    {['handwriting', 'type'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setInputMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          inputMode === mode
                            ? 'bg-gradient-violet text-white shadow-glow-violet'
                            : 'text-secondary-text hover:text-white'
                        }`}
                      >
                        {mode === 'handwriting' ? '✏️ Write' : '⌨️ Type'}
                      </button>
                    ))}
                  </div>

                  {/* Type mode */}
                  {inputMode === 'type' && (
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      placeholder="Your answer..."
                      className="w-full p-3 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-lg"
                      autoFocus
                    />
                  )}

                  {/* Handwriting mode */}
                  {inputMode === 'handwriting' && (
                    <HandwritingInput
                      onSubmit={(recognizedAnswer) => {
                        setUserAnswer(recognizedAnswer);
                        // Auto-submit after recognition
                        setTimeout(() => handleSubmitWithAnswer(recognizedAnswer), 100);
                      }}
                      onCancel={() => setInputMode('type')}
                      placeholder="Write your answer here..."
                      mathpixAppId={import.meta.env.VITE_MATHPIX_APP_ID}
                      mathpixAppKey={import.meta.env.VITE_MATHPIX_APP_KEY}
                    />
                  )}
                </div>
              )}

              {/* Only show Check Answer button in type mode (handwriting auto-submits) */}
              {(question.type === 'mcq' || inputMode === 'type') && (
                <button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim() || isSubmitting}
                  className="w-full mt-4 py-3 btn-gradient-mint text-gray-900 font-semibold rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                </button>
              )}
            </div>
          </div>
        );

      case STATES.FINISHED:
        const hostScore = match.host_score || 0;
        const guestScore = match.guest_score || 0;
        const isWinner = match.winner_id === user.id;
        const isDraw = !match.winner_id && hostScore === guestScore;

        return (
          <div className="text-center space-y-6">
            <div className="glass-panel rounded-xl p-8">
              {isDraw ? (
                <>
                  <div className="text-6xl mb-4">🤝</div>
                  <h2 className="text-3xl font-bold text-white mb-2">It's a Draw!</h2>
                </>
              ) : isWinner ? (
                <>
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-3xl font-bold text-mint mb-2">You Win!</h2>
                  {match.winner_reason === 'time' && (
                    <p className="text-secondary-text">Tiebreaker: Faster time</p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">😔</div>
                  <h2 className="text-3xl font-bold text-secondary-text mb-2">You Lose</h2>
                  {match.winner_reason === 'time' && (
                    <p className="text-secondary-text">Tiebreaker: Opponent was faster</p>
                  )}
                </>
              )}

              {/* Final scores */}
              <div className="flex items-center justify-center gap-12 my-8">
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <AvatarCircle
                      avatarUrl={null}
                      name={sanitiseName(match.host_name)}
                      size="md"
                      colorClass="bg-metallic-base/20"
                      textClass="text-metallic-base"
                    />
                  </div>
                  <p className="text-sm text-secondary-text mb-1">{sanitiseName(match.host_name)}</p>
                  <p className="text-4xl font-bold text-metallic-base">{hostScore}</p>
                  {match.host_finished_at && (
                    <p className="text-sm text-secondary-text/60 mt-1">
                      {formatTime(new Date(match.host_finished_at) - new Date(match.started_at))}
                    </p>
                  )}
                </div>

                <div className="text-2xl text-white/20">-</div>

                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <AvatarCircle
                      avatarUrl={null}
                      name={sanitiseName(match.guest_name)}
                      size="md"
                      colorClass="bg-mint/20"
                      textClass="text-mint"
                    />
                  </div>
                  <p className="text-sm text-secondary-text mb-1">{sanitiseName(match.guest_name)}</p>
                  <p className="text-4xl font-bold text-mint">{guestScore}</p>
                  {match.guest_finished_at && (
                    <p className="text-sm text-secondary-text/60 mt-1">
                      {formatTime(new Date(match.guest_finished_at) - new Date(match.started_at))}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-secondary-text">
                out of {match.questions?.length} questions
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setMatch(null);
                  setGameState(STATES.MENU);
                  setPlayerType(null);
                  setCurrentQuestionIndex(0);
                  setMyScore(0);
                  setOpponentScore(0);
                  setMyFinished(false);
                  setUserAnswer('');
                }}
                className="px-6 py-3 btn-gradient-violet text-white font-semibold rounded-xl"
              >
                Play Again
              </button>

              <button
                onClick={onClose}
                className="px-6 py-3 border border-white/10 text-secondary-text font-semibold rounded-xl hover:bg-white/5 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-void p-4">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Swords className="w-7 h-7 text-metallic-base" />
            1v1 Battle
          </h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-secondary-text" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto">
        {renderContent()}
      </div>
    </div>
  );
};

// Wrap in error boundary so crashes show a friendly message instead of white screen
const OneVsOneWithErrorBoundary = (props) => (
  <BattleErrorBoundary onClose={props.onClose}>
    <OneVsOne {...props} />
  </BattleErrorBoundary>
);

export default OneVsOneWithErrorBoundary;
