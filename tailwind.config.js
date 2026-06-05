/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        genshin: {
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
    },
  },
  plugins: [],
};
