/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B7A57',
          50:  '#F2F8F5',
          100: '#DFF0E7',
          200: '#BFE0CF',
          300: '#93C9AD',
          400: '#62AC85',
          500: '#3B7A57',
          600: '#2F6347',
          700: '#244E38',
          800: '#1C3D2C',
          900: '#142C20',
        },
        forest: {
          DEFAULT: '#1B2F27',
          50:  '#F4F6F5',
          100: '#E2E8E5',
          200: '#C5D0CA',
          300: '#9BADA3',
          400: '#728B7E',
          500: '#516B5F',
          600: '#3E544A',
          700: '#2E403A',
          800: '#1B2F27',
          900: '#111E19',
        },
        sage: {
          50:  '#F6F9F7',
          100: '#EDF3EF',
          200: '#DAE6DF',
          300: '#BDD1C4',
          400: '#95B5A2',
        },
        mint:       { DEFAULT: '#EDF3EF', dark: '#DAE6DF' },
        terracotta: { DEFAULT: '#DC4A4A', light: '#FEF2F2' },
        surface:    '#FAFBFA',
        glass:      'rgba(255,255,255,0.55)',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card:   '0 1px 2px rgba(27,47,39,0.03), 0 4px 12px rgba(27,47,39,0.05), 0 16px 32px rgba(27,47,39,0.04)',
        lift:   '0 2px 8px rgba(27,47,39,0.06), 0 16px 40px rgba(27,47,39,0.10)',
        glow:   '0 0 40px rgba(59,122,87,0.14)',
        soft:   '0 1px 2px rgba(27,47,39,0.03)',
        inner:  'inset 0 2px 4px rgba(27,47,39,0.04)',
        modal:  '0 32px 64px -16px rgba(27,47,39,0.22), 0 8px 24px rgba(27,47,39,0.08)',
        gauge:  '0 0 20px rgba(59,122,87,0.18)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-mesh':  'linear-gradient(135deg, rgba(59,122,87,0.04) 0%, rgba(27,47,39,0.02) 50%, rgba(59,122,87,0.03) 100%)',
        'page-bg':    'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,122,87,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,122,87,0.04) 0%, transparent 50%)',
        'logo-mark':  'linear-gradient(135deg, #4a9b6d 0%, #2f6347 60%, #1c3d2c 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
