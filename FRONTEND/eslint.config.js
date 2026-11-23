const js = require('@eslint/js');

// Las vistas HTML cargan los .js con <script> y comparten el ámbito global.
// ESLint revisa cada archivo por separado, así que hay que declarar esas variables.
const compartidas = {
  ENV: 'readonly',
  BASE_URL: 'readonly',
  API_KEY: 'readonly',
  IMG_URL: 'readonly',
  selectedMovie: 'writable',
  mostrarLoader: 'readonly',
  mostrarLoaderEl: 'readonly',
  toggleForms: 'readonly',
  getPerfil: 'readonly',
  cargarListas: 'readonly',
  cargarListasPerfil: 'readonly',
  buscarConFallback: 'readonly',
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        bootstrap: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        event: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        ...compartidas,
      },
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
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly' },
    },
  },
];
