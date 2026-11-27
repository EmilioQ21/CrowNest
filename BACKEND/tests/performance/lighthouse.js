// Mide la velocidad de carga de dos vistas con Lighthouse (modo escritorio, 3 corridas cada una).
const { execFileSync } = require('child_process');

const BASE = ['http', '://localhost:3100'].join('');
const PAGINAS = ['/login.html', '/home.html'];
const CORRIDAS = 3;

function medir(url) {
  const argumentos = [
    '--yes',
    'lighthouse',
    url,
    '--preset=desktop',
    '--throttling-method=provided',
    '--only-categories=performance',
    '--output=json',
    '--output-path=stdout',
    '--quiet',
    '--chrome-flags=--headless=new',
  ];
  const salida = execFileSync('npx', argumentos, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const informe = JSON.parse(salida);
  if (informe.categories.performance.score === null) {
    throw new Error(['Lighthouse no pudo medir', url].join(' '));
  }
  return {
    puntaje: Math.round(informe.categories.performance.score * 100),
    fcp: informe.audits['first-contentful-paint'].numericValue,
    lcp: informe.audits['largest-contentful-paint'].numericValue,
  };
}

const mediana = (lista) => [...lista].sort((a, b) => a - b)[Math.floor(lista.length / 2)];
const segundos = (ms) => `${(ms / 1000).toFixed(2)} s`;

function resumir(pagina) {
  const corridas = [];
  for (let i = 0; i < CORRIDAS; i++) {
    corridas.push(medir(BASE + pagina));
  }
  const lcp = corridas.map((c) => c.lcp);
  return {
    pagina,
    puntaje: mediana(corridas.map((c) => c.puntaje)),
    fcp: mediana(corridas.map((c) => c.fcp)),
    lcpMediana: mediana(lcp),
    lcpPeor: Math.max(...lcp),
  };
}

const columnas = ['Página', 'Puntaje', 'FCP', 'LCP mediana', 'LCP peor de 3'];
console.log(columnas.map((c) => c.padEnd(16)).join(''));
PAGINAS.map(resumir).forEach((f) => {
  const celdas = [
    f.pagina,
    `${f.puntaje}/100`,
    segundos(f.fcp),
    segundos(f.lcpMediana),
    segundos(f.lcpPeor),
  ];
  console.log(celdas.map((c) => c.padEnd(16)).join(''));
});
