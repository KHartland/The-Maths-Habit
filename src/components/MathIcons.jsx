import React from 'react';

// Custom maths-themed SVG icons for The Maths Habit app
// Each icon accepts className for Tailwind styling (like Lucide icons)

// 3D Cube icon for Home tab
export const CubeIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Front face */}
    <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
    {/* Inner lines for 3D effect */}
    <path d="M12 22V12" />
    <path d="M22 7L12 12L2 7" />
    {/* Top edge highlight */}
    <path d="M2 7l10 5 10-5" />
  </svg>
);

// Square root symbol for Practice tab
export const SquareRootIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Square root symbol */}
    <path d="M3 12L6 20L11 4H21" />
    {/* Horizontal line over the radicand */}
    <path d="M11 4H21" />
  </svg>
);

// Drawing compass for Settings tab
export const CompassIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Compass pivot point */}
    <circle cx="12" cy="5" r="2" />
    {/* Left leg (pencil) */}
    <path d="M12 7L7 21" />
    {/* Right leg (point) */}
    <path d="M12 7L17 21" />
    {/* Hinge connection */}
    <path d="M9 13h6" />
    {/* Small arc being drawn */}
    <path d="M5 18a7 7 0 0 1 4-3" strokeDasharray="2 2" />
  </svg>
);

// Infinity symbol for Streak display
export const InfinityIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Infinity symbol using two connected loops */}
    <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" />
  </svg>
);

// Brain icon (improved version) for Stats/Due
export const BrainIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Left hemisphere */}
    <path d="M9.5 2C7 2 5 4 5 6.5c0 1-.5 2-1.5 2.5C2 10 1 11.5 1 13.5c0 2 1.5 4 4 4.5.5 2.5 2.5 4 5 4" />
    {/* Right hemisphere */}
    <path d="M14.5 2C17 2 19 4 19 6.5c0 1 .5 2 1.5 2.5 1.5 1 2.5 2.5 2.5 4.5 0 2-1.5 4-4 4.5-.5 2.5-2.5 4-5 4" />
    {/* Center line */}
    <path d="M12 2v20" />
    {/* Brain folds - left */}
    <path d="M5 10c1.5 0 3 1 3 2.5" />
    <path d="M5 14c1 0 2.5.5 3 2" />
    {/* Brain folds - right */}
    <path d="M19 10c-1.5 0-3 1-3 2.5" />
    <path d="M19 14c-1 0-2.5.5-3 2" />
  </svg>
);

// Compass star for Trophy/Awards
export const CompassStarIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer circle */}
    <circle cx="12" cy="12" r="10" />
    {/* Four-pointed compass star */}
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    {/* Inner diamond/star shape */}
    <polygon points="12,6 14,10 18,12 14,14 12,18 10,14 6,12 10,10" fill="currentColor" opacity="0.2" />
    <polygon points="12,6 14,10 18,12 14,14 12,18 10,14 6,12 10,10" fill="none" />
  </svg>
);

// Stack of books for Standard mode
export const BooksIcon = ({ className = "w-6 h-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Bottom book */}
    <path d="M4 19h16v-3H4v3z" />
    <path d="M4 16V15" />
    {/* Middle book (slightly offset) */}
    <path d="M5 13h14v-3H5v3z" />
    <path d="M5 10V9" />
    {/* Top book */}
    <path d="M6 7h12v-3H6v3z" />
    {/* Book spine details */}
    <path d="M7 19v-3" />
    <path d="M8 13v-3" />
    <path d="M9 7V4" />
  </svg>
);

// Pi symbol icon
export const PiIcon = ({ className = "w-6 h-6", strokeWidth = 2, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M7 7h10" />
    <path d="M9 7v10" />
    <path d="M15 7v10" />
  </svg>
);

// Export all icons as a named object for convenience
export const MathIcons = {
  CubeIcon,
  SquareRootIcon,
  CompassIcon,
  InfinityIcon,
  BrainIcon,
  CompassStarIcon,
  BooksIcon,
  PiIcon,
};

export default MathIcons;
