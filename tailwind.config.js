/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3F51B5', // Android AppTheme colorPrimary
          dark: '#303F9F',    // Android AppTheme colorPrimaryDark
        },
        accent: '#FF4081',    // Android AppTheme colorAccent
      }
    },
  },
  plugins: [],
}
