/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        genshin: {
          gold: '#d4a853',
          dark: '#1a1a2e',
          panel: '#16213e',
          accent: '#e94560',
        },
      },
    },
  },
  plugins: [],
};
