const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', fetch: 'readonly', console: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', bootstrap: 'readonly',
        alert: 'readonly', confirm: 'readonly',
        },
    },
    rules: {
      'no-unused-vars': 'warn',
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      complexity: ['warn', 8],
      'max-lines-per-function': ['warn', 40],
      'no-shadow': 'error',
      'consistent-return': 'warn',
    },
    
  },
];