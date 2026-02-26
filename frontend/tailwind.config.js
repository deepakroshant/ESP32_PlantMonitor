/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#34C759',
        forest: '#1B4332',
        mint: '#E8F5E9',
        terracotta: '#E07A5F',
        surface: '#F4F7F5',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '32px',
      },
      boxShadow: {
        card: '0 25px 50px -12px rgb(52 199 89 / 0.08)',
      },
    },
  },
  plugins: [],
}
