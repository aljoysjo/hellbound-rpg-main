/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './public/index.html'
  ],
  theme: {
    extend: {
      colors: {
        'creamy-old': 'var(--creamy-old)',
        'light-caramel': 'var(--light-caramel)', 
        'imperial-gold': 'var(--imperial-gold)',
        'cedar-brown': 'var(--cedar-brown)',
        'emerald-highlight': 'var(--emerald-highlight)',
        'text-primary-custom': 'var(--text-primary-custom)',
        'text-accent-custom': 'var(--text-accent-custom)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      fontFamily: {
        'lexend': ['Lexend', 'Noto Sans', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
    require('@tailwindcss/forms'),
  ],
  safelist: [
    'bg-[var(--imperial-gold)]',
    'text-[var(--cedar-brown)]',
    'border-[var(--imperial-gold)]',
    'from-[var(--creamy-old)]',
    'to-[var(--light-caramel)]',
    'text-[var(--text-accent-custom)]',
    'text-[var(--text-primary-custom)]',
    'bg-[var(--light-caramel)]/50',
    'border-[var(--imperial-gold)]/50',
    'bg-[var(--creamy-old)]/80',
  ]
}
