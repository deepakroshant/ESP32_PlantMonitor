/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    { DEFAULT: '#22C55E', 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 400: '#4ADE80', 600: '#16A34A', 700: '#15803D', 800: '#166534' },
        forest:     { DEFAULT: '#14332A', 50: '#E8F0ED', 100: '#D1E1DC' },
        mint:       { DEFAULT: '#ECFDF5', dark: '#D1FAE5' },
        terracotta: { DEFAULT: '#EF4444', light: '#FEF2F2' },
        surface:    '#F7FAF8',
        glass:      'rgba(255,255,255,0.55)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(20,51,42,0.04), 0 8px 24px rgba(20,51,42,0.06)',
        glow:  '0 0 40px rgba(34,197,94,0.12)',
        inner: 'inset 0 2px 4px rgba(20,51,42,0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-mesh': 'linear-gradient(135deg, rgba(34,197,94,0.05) 0%, rgba(20,51,42,0.02) 50%, rgba(34,197,94,0.04) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
