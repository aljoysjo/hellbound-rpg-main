module.exports = {
  extends: [
    'plugin:tailwindcss/recommended'
  ],
  plugins: [
    'tailwindcss'
  ],
  env: {
    browser: true,
    es6: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  globals: {
    // Sin globals problemáticos - configuración limpia
  },
  rules: {
    // Reglas mínimas para no bloquear desarrollo
    'tailwindcss/no-custom-classname': 'off',
    'tailwindcss/migration-from-tailwind-2': 'off'
  },
  settings: {
    tailwindcss: {
      config: './tailwind.config.js',
      calleable: ['classnames', 'cn']
    }
  }
};
