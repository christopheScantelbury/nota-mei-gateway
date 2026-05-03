import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          cyan: '#00E8FF',
        },
        navy: {
          600: '#1E3050',
          700: '#142035',
          900: '#0A0F1E',
        },
        nota: {
          autorizada:  '#00C85A',
          processando: '#F0B414',
          rejeitada:   '#FF3232',
          cancelada:   '#6473A0',
          upgrade:     '#7C6FFF',
        },
        'text-1': '#EEF4FF',
        'text-2': '#8AA0B8',
      },
      fontFamily: {
        // References CSS variables injected by next/font in layout.tsx
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
        'glow-cyan': '0 0 20px rgba(0, 232, 255, 0.15)',
        'glow-cyan-lg': '0 0 40px rgba(0, 232, 255, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':  'linear-gradient(135deg, #00E8FF 0%, #7C6FFF 100%)',
      },
    },
  },
  plugins: [],
}

export default config
