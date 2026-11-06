const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      'no-unused-vars': 'warn',
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      complexity: ['warn', 8],
      'max-lines-per-function': ['warn', 40],
      'no-duplicate-imports': 'error',
      'no-shadow': 'error',
      'consistent-return': 'warn',
    },
  },
];