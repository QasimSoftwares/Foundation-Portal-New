/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#004aad',
          green: '#00a86b',
          yellow: '#ffc72c',
        },
        primary: {
          DEFAULT: '#004aad', // Brand blue as primary
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#00a86b', // Brand green as secondary
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#ffc72c', // Brand yellow as accent
          foreground: '#000000',
        },
      },
      backgroundImage: {
        'auth-pattern': "url('/auth-pattern.svg')",
      },
    },
  },
  plugins: [],
}
