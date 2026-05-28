/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tienta: {
          gold: '#caa870',      // Dorado Arena oficial de Tienta
          goldDark: '#b59469',  // Dorado para textos legibles
          teal: '#026163',      // Verde azulado oficial de Tienta
          tealDark: '#01494a',  // Verde azulado oscuro para hovers
          crema: '#FAF8F5',     // Fondo crema refinado
          hueso: '#FDFDFD',     // Blanco hueso
          carbon: '#1C1C1C',    // Texto oscuro elegante
        }
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        lato: ['Lato', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      scale: {
        '101': '1.01',
      }
    },
  },
  plugins: [],
}
