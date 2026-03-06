/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Maths Habit — Design Rules
        // Heatmap: #2F4858 → #513A6F → #A845A2 → #B00053 → #D4AF37
        'metallic': {
          highlight: '#B00053',
          DEFAULT: '#8E0039',
          base: '#8E0039',
          shadow: '#76235E',
        },
        'violet': {
          DEFAULT: '#8E0039',
          light: '#B00053',
          dark: '#76235E',
        },
        'mint': '#A845A2',
        'orange': '#F59E0B',
        'gold': '#D4AF37',
        'void': '#0a0810',
        'cele': {
          purple: '#76235E',
          mint: '#A845A2',
          cyan: '#513A6F',
          pink: '#B00053',
          indigo: '#31456A',
          rose: '#8E0039',
        },
        // Heatmap mastery levels
        'heatmap': {
          1: '#2F4858',
          2: '#513A6F',
          3: '#A845A2',
          4: '#B00053',
          5: '#D4AF37',
        },
        // Text — high contrast
        'primary-text': '#f1f5f9',
        'secondary-text': '#94a3b8',
        // Backgrounds — near-black with purple warmth
        'bg-primary': '#0c0a14',
        'bg-white': '#110e1a',
      },
      boxShadow: {
        // Brand-tinted shadows, never generic grey
        'glow-metallic': '0 0 30px rgba(142, 0, 57, 0.3)',
        'glow-violet': '0 0 30px rgba(142, 0, 57, 0.3)',
        'glow-mint': '0 0 16px rgba(168, 69, 162, 0.25)',
        'glow-purple': '0 0 16px rgba(118, 35, 94, 0.25)',
        'glow-cyan': '0 0 16px rgba(81, 58, 111, 0.25)',
        'glow-pink': '0 0 16px rgba(176, 0, 83, 0.25)',
        'glow-celebration': '0 0 20px rgba(176, 0, 83, 0.15)',
        'glass': '0 8px 24px rgba(10, 8, 16, 0.5)',
        'card': '0 4px 12px rgba(10, 8, 16, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 10s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) rotate(1deg)' },
          '66%': { transform: 'translateY(-5px) rotate(-1deg)' },
        },
        glow: {
          '0%': { opacity: '0.5', transform: 'scale(1)' },
          '100%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
}
