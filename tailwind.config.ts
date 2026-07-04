import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0a0a0f', raised: '#12121a', border: '#1e1e2e' },
        accent: { green: '#22c55e', red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6' },
      },
    },
  },
  plugins: [],
};
export default config;
