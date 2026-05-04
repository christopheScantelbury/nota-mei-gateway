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
      // modifiers (bg-navy-700/50, text-brand-cyan/80, etc.) in both themes.
      colors: {
        brand: {
          cyan: 'rgb(var(--brand-cyan) / <alpha-value>)',
        },
        navy: {
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
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        body:    ['var(--font-inter)',   'Inter',  'sans-serif'],
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
        'glow-cyan': '0 0 20px rgb(var(--brand-cyan) / 0.15)',
        'glow-cyan-lg': '0 0 40px rgb(var(--brand-cyan) / 0.2)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':  'linear-gradient(135deg, rgb(var(--brand-cyan)) 0%, rgb(var(--nota-upgrade)) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
