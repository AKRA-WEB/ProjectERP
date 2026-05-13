import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        ink: {
          DEFAULT: '#0c0a09',
          1: '#1c1917',
          2: '#44403c',
          3: '#78716c',
          4: '#a8a29e',
        },
        line: {
          DEFAULT: '#e7e5e4',
          strong: '#d6d3d1',
          soft: '#f1efee',
        },
        accent: {
          DEFAULT: '#10b981',
          ink: '#047857',
          soft: '#ecfdf5',
          line: '#a7f3d0',
        },
        surface: {
          DEFAULT: '#ffffff',
          soft: '#fafaf9',
          sunken: '#f5f5f4',
        },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        '1': '0 1px 0 rgba(15, 23, 42, .03), 0 1px 2px rgba(15, 23, 42, .04)',
        '2': '0 1px 0 rgba(15, 23, 42, .04), 0 4px 12px rgba(15, 23, 42, .06)',
        'pop': '0 12px 32px -8px rgba(15, 23, 42, .18), 0 2px 6px rgba(15, 23, 42, .06)',
      },
    },
  },
  plugins: [],
};

export default config;
