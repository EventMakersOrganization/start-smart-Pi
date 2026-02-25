/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts,js}",
    "./src/**/*.component.html",
    "./src/**/*.component.ts"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1152d4',
        'background-light': '#f6f6f8',
        'background-dark': '#0a0a0c',
        'sidebar-dark': '#0f172a',
      },
      fontFamily: {
        display: ['Space Grotesk'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
