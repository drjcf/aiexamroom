import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const brand = {
  teal: '#16A085', tealLight: '#1ABC9C',
  blue: '#0A4D8C', blueLight: '#2E78C7',
  orange: '#E67E22', green: '#27AE60', red: '#C0392B',
};

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './packages/edai-lms/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: { brand },
      typography: {
        DEFAULT: { css: { maxWidth: '72ch' } },
        invert: {
          css: {
            '--tw-prose-invert-body': '#cbd5e1',
            '--tw-prose-invert-headings': '#f1f5f9',
            '--tw-prose-invert-links': brand.tealLight,
            '--tw-prose-invert-bold': '#ffffff',
            '--tw-prose-invert-counters': brand.tealLight,
            '--tw-prose-invert-bullets': brand.teal,
            '--tw-prose-invert-quotes': brand.tealLight,
            '--tw-prose-invert-quote-borders': brand.teal,
            '--tw-prose-invert-hr': 'rgba(255,255,255,0.10)',
            '--tw-prose-invert-code': brand.tealLight,
            '--tw-prose-invert-th-borders': 'rgba(255,255,255,0.20)',
            '--tw-prose-invert-td-borders': 'rgba(255,255,255,0.10)',
          },
        },
      },
    },
  },
  plugins: [typography],
};
export default config;
