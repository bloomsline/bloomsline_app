/** @type {import('tailwindcss').Config} */
// Tokens extracted from the Claude Design "Bloomsline Signup Flow" canvas.
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#009B8E', // primary teal
          dark: '#2F6E5F',
          deep: '#1A4A3F',
          tint: '#EAF4F1', // light teal surfaces
          tint2: '#D6E7E1',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          deep: '#141414',
        },
        muted: {
          DEFAULT: '#9A9A9A',
          dark: '#8A8A8A',
          warm: '#8A857B',
        },
        line: {
          DEFAULT: '#EBEBEB',
          soft: '#F5F5F5',
          warm: '#E0DED9',
        },
        surface: {
          DEFAULT: '#FAFAF8', // screen background
          canvas: '#EAE8E2',
        },
        // warm terracotta accent family (moments / warmth)
        warm: {
          DEFAULT: '#C87941',
          100: '#FDEAD4',
          200: '#F7DBBF',
          300: '#FCCB90',
          400: '#F3AF73',
        },
      },
    },
  },
  plugins: [],
};
