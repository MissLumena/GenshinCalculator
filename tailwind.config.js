/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        genshin: {
          mint: '#98dcaf',
          mintbright: '#b2ebca',
          mintdark: '#1f4a34',
          gold: '#e8c547',
          goldbright: '#f5dc7a',
          golddark: '#b8942e',
          dark: '#1a1a2e',
          panel: '#16213e',
          accent: '#e94560',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
