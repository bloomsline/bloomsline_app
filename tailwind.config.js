/** @type {import('tailwindcss').Config} */
// Tokens extracted from the Claude Design "Bloomsline Signup Flow" canvas.
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Class-based (not 'media') so the RN-web runtime doesn't throw when the color
  // scheme is set. The app is light-only; no `dark:` variants are used.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // v1 "bloom" teal — the single warm accent (active/confirm/links/avatars).
        brand: {
          DEFAULT: '#4A9A86',
          dark: '#2F6E5F',
          deep: '#1A4A3F',
          body: '#3E7A6B',
          tint: '#EAF4F1',
          tint2: '#D6E7E1',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          deep: '#000000',
        },
        muted: {
          DEFAULT: '#999999',
          dark: '#8A8A8A',
          warm: '#8A857B',
          faint: '#BBBBBB',
        },
        mint: {
          DEFAULT: '#EAF4F1',
          border: '#D6E7E1',
        },
        line: {
          DEFAULT: '#EBEBEB',
          soft: '#F5F5F5', // chips / icon tiles / neutral surfaces
          hair: '#E5E5E5',
        },
        surface: {
          DEFAULT: '#FFFFFF', // v1 is white
          soft: '#F5F5F5',
        },
      },
    },
  },
  plugins: [],
};
