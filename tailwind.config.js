/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Square One Maths - Metallic Blue Design System
        'metallic': {
          highlight: '#8BA8D9',
          DEFAULT: '#5B7FC7',
          base: '#5B7FC7',
          shadow: '#3D5A8A',
        },
        // Legacy support - map violet to metallic
        'violet': {
          DEFAULT: '#5B7FC7',
          light: '#8BA8D9',
          dark: '#3D5A8A',
        },
        'mint': '#38E6A2',
        'orange': '#F59E0B',
        'gold': '#D4A84B',
        // Dark background
        'void': '#0E0307',
        // Celebration / Topic colors
        'cele': {
          purple: '#A78BFA',
          mint: '#38E6A2',
          cyan: '#67E8F9',
          pink: '#F0ABFC',
          indigo: '#818CF8',
          rose: '#EC4899',
        },
        // Light theme text colors
        'primary-text': '#374151',
        'secondary-text': '#6B7280',
        // Background colors
        'bg-primary': '#F8F9FA',
        'bg-white': '#FFFFFF',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-metallic': 'linear-gradient(180deg, #8BA8D9 0%, #5B7FC7 50%, #3D5A8A 100%)',
        'gradient-metallic-h': 'linear-gradient(90deg, #3D5A8A 0%, #5B7FC7 50%, #8BA8D9 100%)',
        // Legacy support
        'gradient-violet': 'linear-gradient(180deg, #8BA8D9 0%, #5B7FC7 50%, #3D5A8A 100%)',
        'gradient-mint': 'linear-gradient(135deg, #38E6A2 0%, #2BC88A 100%)',
        'orb-glow': 'radial-gradient(circle, rgba(91, 127, 199, 0.6) 0%, rgba(91, 127, 199, 0.2) 40%, transparent 70%)',
        // Celebration gradients
        'gradient-celebration': 'linear-gradient(135deg, #A78BFA 0%, #38E6A2 25%, #67E8F9 50%, #F0ABFC 75%, #818CF8 100%)',
      },
      boxShadow: {
        'glow-metallic': '0 0 40px rgba(91, 127, 199, 0.4)',
        'glow-violet': '0 0 40px rgba(91, 127, 199, 0.4)',
        'glow-mint': '0 0 20px rgba(56, 230, 162, 0.3)',
        'glow-purple': '0 0 20px rgba(167, 139, 250, 0.3)',
        'glow-cyan': '0 0 20px rgba(103, 232, 249, 0.3)',
        'glow-pink': '0 0 20px rgba(240, 171, 252, 0.3)',
        'glow-celebration': '0 0 30px rgba(167, 139, 250, 0.2), 0 0 60px rgba(56, 230, 162, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.1)',
        'card': '0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 10s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 3s linear infinite',
        'color-pulse': 'colorPulse 8s ease-in-out infinite',
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
        colorPulse: {
          '0%, 100%': { opacity: '0.4', filter: 'hue-rotate(0deg)' },
          '50%': { opacity: '0.7', filter: 'hue-rotate(30deg)' },
        },
      },
    },
  },
  plugins: [],
}
