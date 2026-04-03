/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#16213e',
          leaf: '#1f7a4d',
          saffron: '#e98a15',
          sand: '#f5efe2'
        }
      }
    }
  },
  plugins: []
};

