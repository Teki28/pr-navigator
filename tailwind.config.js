/** @type {import('tailwindcss').Config} */
// Liquid Glass design tokens. Components must pull from these — no magic values.
// Colors reference CSS variables (see src/styles/tokens.css) so themes swap cleanly.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // semantic, variable-backed
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        danger: "var(--danger)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "bg-base": "var(--bg-base)",
        // glass material
        glass: {
          fill: "var(--glass-fill)",
          strong: "var(--glass-fill-strong)",
          border: "var(--glass-border)",
          "border-soft": "var(--glass-border-soft)",
        },
      },
      fontFamily: {
        display: ['-apple-system', '"SF Pro Display"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing, fontWeight }]
        display: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['2rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.5' }],
        body: ['1rem', { lineHeight: '1.5' }],
        caption: ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
      },
      spacing: {
        // 4px base scale (Tailwind defaults already align; explicit for clarity)
        '0.5': '2px', '1': '4px', '2': '8px', '3': '12px',
        '4': '16px', '6': '24px', '8': '32px', '12': '48px', '16': '64px',
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        full: '9999px',
      },
      backdropBlur: {
        thin: '12px',
        glass: '24px',
        strong: '40px',
      },
      backdropSaturate: {
        glass: '1.8',
      },
      boxShadow: {
        glass:
          '0 1px 1px rgba(255,255,255,0.4) inset, 0 8px 32px rgba(16,19,26,0.12), 0 2px 8px rgba(16,19,26,0.08)',
        'glass-hover':
          '0 1px 1px rgba(255,255,255,0.5) inset, 0 16px 48px rgba(16,19,26,0.18), 0 4px 12px rgba(16,19,26,0.10)',
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '180ms',
        base: '260ms',
        slow: '420ms',
      },
      maxWidth: {
        container: '1120px',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(2%, -2%, 0) scale(1.05)' },
          '66%': { transform: 'translate3d(-2%, 1%, 0) scale(1.02)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        drift: 'drift 26s ease-in-out infinite',
        'fade-up': 'fade-up var(--dur-slow, 420ms) cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};
