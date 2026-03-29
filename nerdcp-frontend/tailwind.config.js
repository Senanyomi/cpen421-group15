/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        void:    '#080b0f',
        panel:   '#0d1117',
        surface: '#161b22',
        border:  '#21262d',
        muted:   '#30363d',

        // Text
        dim:     '#8b949e',
        body:    '#c9d1d9',
        bright:  '#f0f6fc',

        // Accent — amber alert
        amber: {
          DEFAULT: '#f59e0b',
          dim:     '#92400e',
          glow:    '#fbbf24',
        },

        // Status colours
        critical: '#ef4444',
        warning:  '#f59e0b',
        success:  '#22c55e',
        info:     '#3b82f6',

        // Severity
        sev: {
          critical: '#ef4444',
          high:     '#f97316',
          medium:   '#f59e0b',
          low:      '#22c55e',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        glow:    '0 0 20px rgba(245,158,11,0.15)',
        'glow-sm':'0 0 8px rgba(245,158,11,0.2)',
        panel:   '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.35s ease forwards',
        'blink':      'blink 1.2s step-end infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        blink:   { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
      },
    },
  },
  plugins: [],
}
