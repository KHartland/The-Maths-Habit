import React from 'react';
import { TOPIC_HEX } from '../data/curriculum';

function CelebrationCarousel({ show, objectives, currentIndex, onAdvance }) {
  if (!show || !objectives || objectives.length === 0) return null;

  const current = objectives[currentIndex];
  if (!current) return null;

  const topicColor = TOPIC_HEX[current.topic] || '#A78BFA';
  const levelLabels = ['Not started', 'Getting started', 'Building knowledge', 'Good progress', 'Nearly there', '⭐ Mastered!'];
  const levelLabel = levelLabels[current.level] || 'Learning';
  const progressPct = (current.level / 5) * 100;
  const isLast = currentIndex >= objectives.length - 1;
  const isMastered = current.level >= 5;

  // Generate tile confetti pieces for mastery celebration
  const tileConfetti = isMastered ? [...Array(50)].map((_, i) => {
    const allTopicColors = ['#B00053', '#A845A2', '#76235E', '#513A6F', '#31456A', '#2F4858', '#D4AF37', '#8E0039'];
    const color = allTopicColors[Math.floor(Math.random() * allTopicColors.length)];
    const size = 10 + Math.random() * 16;
    const left = Math.random() * 100;
    const delay = Math.random() * 2.5;
    const duration = 2.5 + Math.random() * 2;
    const rotation = Math.random() * 360;
    const opacity = 0.6 + Math.random() * 0.4;
    return { color, size, left, delay, duration, rotation, opacity, key: `${currentIndex}-${i}` };
  }) : [];

  return (
    <div
      onClick={onAdvance}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(10, 10, 20, 0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {/* Tile confetti for mastery */}
      {isMastered && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 61 }}>
          <style>{`
            @keyframes tileFall {
              0% { transform: translateY(-30px) rotate(var(--rot)) scale(0.3); opacity: 0; }
              10% { opacity: var(--op); transform: translateY(0) rotate(var(--rot)) scale(1); }
              90% { opacity: var(--op); }
              100% { transform: translateY(calc(100vh + 30px)) rotate(calc(var(--rot) + 360deg)) scale(0.8); opacity: 0; }
            }
            @keyframes tileSway {
              0%, 100% { margin-left: 0; }
              25% { margin-left: 20px; }
              75% { margin-left: -20px; }
            }
          `}</style>
          {tileConfetti.map(t => (
            <div
              key={t.key}
              style={{
                position: 'absolute',
                left: `${t.left}%`,
                top: '-30px',
                width: `${t.size}px`,
                height: `${t.size}px`,
                borderRadius: Math.random() > 0.3 ? 4 : '50%',
                backgroundColor: t.color,
                border: `1px solid rgba(255,255,255,0.3)`,
                boxShadow: `0 0 6px ${t.color}80`,
                '--rot': `${t.rotation}deg`,
                '--op': t.opacity,
                animation: `tileFall ${t.duration}s ease-out forwards, tileSway ${1.5 + Math.random()}s ease-in-out infinite`,
                animationDelay: `${t.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Animated card */}
      <div
        key={current.code}
        className="celebration-card"
        style={{
          width: 'min(85vw, 340px)',
          aspectRatio: '1',
          borderRadius: 24,
          background: isMastered
            ? `linear-gradient(135deg, #FFD70040, ${topicColor}30, #FFD70020)`
            : `linear-gradient(135deg, ${topicColor}40, ${topicColor}20)`,
          border: isMastered ? '3px solid #FFD700' : `3px solid ${topicColor}`,
          boxShadow: isMastered
            ? `0 0 50px #FFD70060, 0 0 100px ${topicColor}40, 0 0 150px #FFD70020`
            : `0 0 40px ${topicColor}60, 0 0 80px ${topicColor}30, 0 0 120px ${topicColor}15`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', position: 'relative', overflow: 'hidden',
          zIndex: 62,
        }}
      >
        {/* White glow pulse */}
        <div className="celebration-glow" style={{
          position: 'absolute', inset: -8, borderRadius: 32,
          border: isMastered ? '2px solid rgba(255,215,0,0.7)' : '2px solid rgba(255,255,255,0.6)',
          boxShadow: isMastered
            ? '0 0 40px rgba(255,215,0,0.4), inset 0 0 40px rgba(255,215,0,0.15)'
            : '0 0 30px rgba(255,255,255,0.3), inset 0 0 30px rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }} />

        <span style={{ color: topicColor, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          {current.topic}
        </span>

        <span style={{ color: 'white', fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          {current.code}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', fontWeight: 500, textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.3, maxWidth: '90%' }}>
          {current.title}
        </span>

        <span style={{
          color: current.correctInSession === current.totalInSession ? '#38E6A2' : 'rgba(255,255,255,0.7)',
          fontSize: '1rem', fontWeight: 600, marginBottom: '1rem',
        }}>
          {current.correctInSession}/{current.totalInSession} correct this session
        </span>

        {/* Progress bar */}
        <div style={{ width: '80%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginBottom: '0.5rem' }}>
          <div className="celebration-progress-fill" style={{
            height: '100%', width: `${progressPct}%`, borderRadius: 6,
            background: isMastered
              ? `linear-gradient(90deg, #FFD700, ${topicColor})`
              : `linear-gradient(90deg, ${topicColor}, ${topicColor}CC)`,
            boxShadow: isMastered ? `0 0 16px #FFD70080` : `0 0 12px ${topicColor}80`,
          }} />
        </div>

        <span style={{ color: isMastered ? '#FFD700' : 'rgba(255,255,255,0.7)', fontSize: isMastered ? '1.1rem' : '0.9rem', fontWeight: isMastered ? 700 : 500 }}>
          {isMastered ? '⭐ Mastered!' : levelLabel}
        </span>
      </div>

      {/* Dots */}
      <div style={{ position: 'fixed', bottom: '3rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 62 }}>
        {objectives.map((_, i) => (
          <div key={i} style={{
            width: i === currentIndex ? 24 : 8, height: 8, borderRadius: 4,
            background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <p style={{ position: 'fixed', bottom: '1.2rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', zIndex: 62 }}>
        {isLast ? 'Tap to finish' : 'Tap to continue'}
      </p>
    </div>
  );
}

export default CelebrationCarousel;
