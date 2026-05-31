/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        gold: '#C8A96E',
        'gold-bright': '#E8C97E',
        'gold-dim': '#8B6B3D',
      },
    },
  },
  plugins: [],
}
