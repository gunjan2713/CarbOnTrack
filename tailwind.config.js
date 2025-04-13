/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary blue palette
        primary: {
          50: '#e6f1ff',
          100: '#ccdfff',
          200: '#99beff',
          300: '#669eff',
          400: '#337eff',
          500: '#005eff', // main blue
          600: '#004bcc',
          700: '#003899',
          800: '#002566',
          900: '#001333',
        },
        // Red accent colors
        accent: {
          50: '#ffe6e6',
          100: '#ffcccc',
          200: '#ff9999',
          300: '#ff6666',
          400: '#ff3333',
          500: '#ff0000', // main red
          600: '#cc0000',
          700: '#990000',
          800: '#660000',
          900: '#330000',
        },
        // Dark mode background colors
        dark: {
          surface: '#121212', // main background
          card: '#1e1e1e',    // card/component background
          border: '#2c2c2c',  // borders
          muted: '#2d2d2d',   // muted elements
          elevated: '#242424', // elevated components
        },
        // Light elements for dark mode
        light: {
          text: '#ffffff',     // primary text
          textMuted: '#a0a0a0', // secondary text
          border: '#4d4d4d',    // light borders
        }
      }
    },
  },
  plugins: [],
}