import type { Config } from 'tailwindcss'
import path from 'path'

const config: Config = {
  content: [
    path.join(__dirname, './app/**/*.{ts,tsx}'),
    path.join(__dirname, './components/**/*.{ts,tsx}'),
    path.join(__dirname, './lib/**/*.{ts,tsx}'),
  ],
  // CSS-class strategy: ThemeProvider adds class="dark" on <html>
  darkMode: 'class',
  theme: {
    extend: {
      // All themed colors route through CSS custom properties (globals.css).
      // The `rgb(var(...) / <alpha-value>)` syntax enables Tailwind opacity
      // modifiers (bg-navy-700/50, text-brand-blue/80, etc.) in both themes.
      colors: {
        brand: {
          // Legacy alias — many components reference brand-cyan; keeps backwards compat.
          cyan: 'rgb(var(--brand-cyan) / <alpha-value>)',
          blue: 'rgb(var(--brand-blue) / <alpha-value>)',
          'blue-dark': 'rgb(var(--brand-blue-dark) / <alpha-value>)',
          'blue-50':   'rgb(var(--brand-blue-50)  / <alpha-value>)',
          'blue-100':  'rgb(var(--brand-blue-100) / <alpha-value>)',
          'blue-200':  'rgb(var(--brand-blue-200) / <alpha-value>)',
        },
        // Persona colors — used on /mei (teal), /me (coral), /gateway (purple).
        persona: {
          mei:        'rgb(var(--persona-mei)      / <alpha-value>)',
          'mei-dark': 'rgb(var(--persona-mei-dark) / <alpha-value>)',
          'mei-50':   'rgb(var(--persona-mei-50)   / <alpha-value>)',
          'mei-100':  'rgb(var(--persona-mei-100)  / <alpha-value>)',
          'mei-200':  'rgb(var(--persona-mei-200)  / <alpha-value>)',
          emp:        'rgb(var(--persona-emp)      / <alpha-value>)',
          'emp-dark': 'rgb(var(--persona-emp-dark) / <alpha-value>)',
          'emp-50':   'rgb(var(--persona-emp-50)   / <alpha-value>)',
          'emp-100':  'rgb(var(--persona-emp-100)  / <alpha-value>)',
          'emp-200':  'rgb(var(--persona-emp-200)  / <alpha-value>)',
          api:        'rgb(var(--persona-api)      / <alpha-value>)',
          'api-dark': 'rgb(var(--persona-api-dark) / <alpha-value>)',
          'api-50':   'rgb(var(--persona-api-50)   / <alpha-value>)',
          'api-100':  'rgb(var(--persona-api-100)  / <alpha-value>)',
          'api-200':  'rgb(var(--persona-api-200)  / <alpha-value>)',
        },
        navy: {
          50:  'rgb(var(--navy-50)  / <alpha-value>)',
          500: 'rgb(var(--navy-500) / <alpha-value>)',
          600: 'rgb(var(--navy-600) / <alpha-value>)',
          700: 'rgb(var(--navy-700) / <alpha-value>)',
          900: 'rgb(var(--navy-900) / <alpha-value>)',
        },
        nota: {
          autorizada:  'rgb(var(--nota-autorizada) / <alpha-value>)',
          processando: 'rgb(var(--nota-processando) / <alpha-value>)',
          rejeitada:   'rgb(var(--nota-rejeitada) / <alpha-value>)',
          cancelada:   'rgb(var(--nota-cancelada) / <alpha-value>)',
          upgrade:     'rgb(var(--nota-upgrade) / <alpha-value>)',
        },
        'text-1': 'rgb(var(--text-1) / <alpha-value>)',
        'text-2': 'rgb(var(--text-2) / <alpha-value>)',
        'text-3': 'rgb(var(--text-3) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'DM Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'glow-cyan':    '0 0 20px rgb(var(--brand-blue) / 0.15)',
        'glow-cyan-lg': '0 0 40px rgb(var(--brand-blue) / 0.20)',
        'glow-blue':    '0 0 20px rgb(var(--brand-blue) / 0.15)',
        'glow-blue-lg': '0 0 40px rgb(var(--brand-blue) / 0.20)',
        'card':         '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        'card-md':      '0 4px 12px rgb(15 23 42 / 0.08)',
        'card-hover':   '0 8px 24px rgb(15 23 42 / 0.10)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':  'linear-gradient(135deg, rgb(var(--brand-blue)) 0%, rgb(var(--persona-api)) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
