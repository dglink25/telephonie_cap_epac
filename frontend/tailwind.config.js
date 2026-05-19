/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette principale CAP-EPAC : vert & blanc
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',  // Couleur principale
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        capepac: {
          green:      '#16a34a',
          'green-light': '#22c55e',
          'green-dark':  '#15803d',
          white:      '#ffffff',
          'off-white': '#f0fdf4',
          'gray-soft': '#f8fafb',
          'gray-mid':  '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        'slide-in':   'slide-in 0.3s ease-out',
        'fade-in':    'fade-in 0.2s ease-out',
        'ring':       'ring 1.2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(0.95)', opacity: '0.7' },
          '70%':  { transform: 'scale(1.05)', opacity: '0.3' },
          '100%': { transform: 'scale(0.95)', opacity: '0.7' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'ring': {
          '0%, 100%': { transform: 'rotate(-15deg)' },
          '50%':      { transform: 'rotate(15deg)' },
        },
      },
      boxShadow: {
        'green-glow': '0 0 20px rgba(22, 163, 74, 0.3)',
      },
    },
  },
  plugins: [],
};
