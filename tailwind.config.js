/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SphereAI Deep Space Glassmorphism Design System
        'void': '#0E0307',
        'violet': {
          DEFAULT: '#6E33B1',
          light: '#8B4CD4',
          dark: '#5A2A91',
        },
        'mint': '#38E6A2',
        'primary-text': '#EEEBF3',
        'secondary-text': '#C0B4E3',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-violet': 'linear-gradient(135deg, #6E33B1 0%, #8B4CD4 50%, #5A2A91 100%)',
        'gradient-mint': 'linear-gradient(135deg, #38E6A2 0%, #2BC88A 100%)',
        'orb-glow': 'radial-gradient(circle, rgba(110, 51, 177, 0.6) 0%, rgba(110, 51, 177, 0.2) 40%, transparent 70%)',
      },
      boxShadow: {
        'glow-violet': '0 0 40px rgba(110, 51, 177, 0.4)',
        'glow-mint': '0 0 20px rgba(56, 230, 162, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
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
      },
    },
  },
  plugins: [],
}
