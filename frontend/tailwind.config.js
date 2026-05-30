/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette principale CAP-EPAC : vert teal du site officiel
        primary: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',  // Couleur principale du site cap-epac.bj
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        capepac: {
          green:      '#0d9488',
          'green-light': '#14b8a6',
          'green-dark':  '#0f766e',
          white:      '#ffffff',
          'off-white': '#f0fdfa',
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
