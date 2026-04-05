import React from 'react';

// Nav icon components
const NavIcon = ({ src, className = '' }) => (
  <img src={src} alt="" className={`${className} object-contain rounded-md`} draggable={false} />
);
const HomeIcon = ({ className }) => <NavIcon src="/images/nav/home.png" className={className} />;
const HeatmapIcon = ({ className }) => <NavIcon src="/images/nav/journey.png" className={className} />;
const PracticeIcon = ({ className }) => <NavIcon src="/images/nav/practice.png" className={className} />;
const StatsIcon = ({ className }) => <NavIcon src="/images/nav/stats.png" className={className} />;
const SettingsIcon = ({ className }) => <NavIcon src="/images/nav/settings.png" className={className} />;

function NavBar({ currentPage, setCurrentPage, streak }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'heatmap', label: 'Journey', icon: HeatmapIcon },
    { id: 'practice', label: 'Practice', icon: PracticeIcon },
    { id: 'stats', label: 'Stats', icon: StatsIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 top-nav-bar" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="max-w-4xl mx-auto px-4 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 group">
              <img
                src="/images/the-maths-habit-logo-hires.jpeg"
                alt="The Maths Habit logo"
                className="w-10 h-10 rounded-xl shadow-glow-celebration group-hover:scale-105 transition-transform nav-logo object-cover"
              />
              <span className="font-bold text-xl hidden sm:block gradient-text-celebration">The Maths Habit</span>
            </button>

            {/* Nav links - desktop */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      currentPage === item.id
                        ? "bg-gradient-violet text-white shadow-glow-violet"
                        : "text-secondary-text hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-9 h-9" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Streak display removed — Piro handles streak motivation */}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav - Floating Glass Pill */}
      <nav className="fixed left-4 right-4 z-50 md:hidden bottom-nav" style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <div className="glass-panel-strong rounded-2xl shadow-glass mx-auto max-w-sm">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? "text-mint"
                      : "text-secondary-text hover:text-white"
                  }`}
                >
                  <Icon className={`w-10 h-10 ${isActive ? 'drop-shadow-[0_0_8px_rgba(56,230,162,0.5)]' : 'opacity-60'}`} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

export default NavBar;
export { NavIcon, HomeIcon, HeatmapIcon, PracticeIcon, StatsIcon, SettingsIcon };
