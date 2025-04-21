/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      rotate: {
        '180': '-180',
      },

      margin: {
        '20vh': '20vh',
      },

      textShadow: {
        'custom': '1px 1px 2px rgba(0, 0, 0, 0.5)',
      },

      fontFamily: {
        Roca: ['Roca', 'sans-serif'],
        galpike: ['galpike', 'sans-serif'],
        mioge: ['mioge', 'sans-serif'],
        betofin: ['betofin', 'sans-serif'],
        rocaLt: ['rocaLt', 'sans-serif'],
        rocaThI: ['rocaThI', 'sans-serif'],
        rocaIt: ['rocait', 'sans-serif'],
        tan: ['tan', 'sans-serif'],
        hanoble: ['hanoble', 'sans-serif'],
        halimun: ['halimun', 'sans-serif'],
        rocaThin: ['rocaThin', 'sans-serif'],
        Rspring: ['Rspring', 'sans-serif'],
        Bspring: ['Bspring', 'sans-serif'],
        RocaHeavyItalic: ['Roca-Heavy-Italic', 'sans-serif'],
      },

      boxShadow: {
        // shd: '-95px 95px 96.5px #8B91F3',
        shd: '-34px -3px 45px -16px #8B91F3',
      },

      animation: {
        scroll: 'scroll 10s linear infinite',
      },

      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }

    },
  },

  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.text-shadow-custom': {
          textShadow: ' 2px 2px 3px rgba(0, 0, 0, 0.8);',
        },
      })
    },
    require('daisyui'),
  ],
}
