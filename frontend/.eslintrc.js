module.exports = {
  extends: [],
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
  }
};
