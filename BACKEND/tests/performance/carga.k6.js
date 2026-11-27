/* eslint-disable */
// Script de k6 (usa módulos ESM y globales de k6, por eso ESLint lo ignora).
// Prueba de carga de la API: 50 usuarios virtuales durante 30 segundos.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const enJson = (cuerpo) => JSON.stringify(cuerpo);

export function setup() {
  const datos = {
    name: 'carga',
    email: 'carga@correo.com',
    password: 'Password123',
    confirm_password: 'Password123',
  };
  http.post(`${BASE}/users`, enJson(datos), { headers: JSON_HEADERS });
  const login = http.post(
    `${BASE}/login`,
    enJson({ email: datos.email, password: datos.password }),
    { headers: JSON_HEADERS },
  );
  const token = login.json('token');
  const auth = { headers: { ...JSON_HEADERS, Authorization: token } };
  const resena = { movieId: 550, movieTitle: 'Fight Club', rating: 4, watchedAt: '2026-03-10' };
  for (let i = 0; i < 20; i++) {
    http.post(`${BASE}/reviews/crear`, enJson(resena), auth);
  }
  return { token, email: datos.email, password: datos.password };
}

export default function (datos) {
  const auth = { headers: { Authorization: datos.token } };
  const respuestas = [
    http.get(`${BASE}/reviews/pelicula/550`),
    http.get(`${BASE}/reviews/mis-resenas`, auth),
    http.get(`${BASE}/lists`, auth),
  ];
  if (__ITER % 5 === 0) {
    respuestas.push(
      http.post(`${BASE}/login`, enJson({ email: datos.email, password: datos.password }), {
        headers: JSON_HEADERS,
      }),
    );
  }
  respuestas.forEach((r) => check(r, { 'responde 200': (x) => x.status === 200 }));
  sleep(1);
}
