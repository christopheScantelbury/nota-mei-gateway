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
          autorizada: '#00C85A',
          processando: '#F0B414',
          rejeitada:   '#FF3232',
          cancelada:   '#6473A0',
          upgrade:     '#7C6FFF',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
