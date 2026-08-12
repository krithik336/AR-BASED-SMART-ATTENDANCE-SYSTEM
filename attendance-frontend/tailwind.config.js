/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          accent:  '#3B82F6',
          light:   '#EFF6FF',
        },
        navy: {
          DEFAULT: '#0F172A',
          800:     '#1E293B',
          700:     '#334155',
        },
        surface:  '#F8FAFC',
        border:   '#E2E8F0',
        text: {
          primary:   '#0F172A',
          secondary: '#64748B',
        },
        sidebar: {
          bg:      '#0F172A',
          hover:   '#1E293B',
          active:  '#2563EB',
          text:    '#94A3B8',
          active_text: '#FFFFFF',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        danger:  '#DC2626',
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
      },
    },
  },
  plugins: [],
}
