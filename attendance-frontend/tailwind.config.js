/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2E5A88",
          dark: "#1F3E5F",
          light: "#DCE6F1",
        },
        matchGreen: "#22C55E",
        matchRed: "#EF4444",
      },
    },
  },
  plugins: [],
}
