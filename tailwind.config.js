/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // `navy` and `emerald` keep their old names so existing pages pick up the new brand colours.
        navy: '#0A3D24',
        forest: '#0A3D24',
        emerald: '#0E7A3C',
        leaf: '#1E9E52',
        accent: '#F28A12',
        surface: '#F4F7F5',
        ink: '#14231B',
        muted: '#66756C',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
}
