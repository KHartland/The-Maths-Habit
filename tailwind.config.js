/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Maths Habit - Metallic Blue Design System
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
      },
      boxShadow: {
        'glow-metallic': '0 0 40px rgba(91, 127, 199, 0.4)',
        'glow-violet': '0 0 40px rgba(91, 127, 199, 0.4)',
        'glow-mint': '0 0 20px rgba(56, 230, 162, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.1)',
        'card': '0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
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
