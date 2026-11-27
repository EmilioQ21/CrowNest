// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const app = require('../../app');
const db = require('./db');
const { crearUsuario } = require('./auth');

const resenaValida = {
  movieId: 550,
  movieTitle: 'Fight Club',
  rating: 4.5,
  reviewText: 'Muy buena',
  isWatched: true,
  watchedAt: '2026-01-15',
};

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const crearResena = (token, extra = {}) =>
  request(app)
    .post('/reviews/crear')
    .set('Authorization', token)
    .send({ ...resenaValida, ...extra });
const unaResena = async (token, extra) => (await crearResena(token, extra)).body.review._id;
const editar = (token, id, cuerpo) =>
  request(app).put(`/reviews/editar/${id}`).set('Authorization', token).send(cuerpo);
const borrar = (token, id) =>
  request(app).delete(`/reviews/borrar/${id}`).set('Authorization', token);
const misResenas = (token) => request(app).get('/reviews/mis-resenas').set('Authorization', token);

describe('POST /reviews/crear', () => {
  test('guarda una reseña válida (201)', async () => {
    const a = await crearUsuario(app);
    const res = await crearResena(a.token);
    expect(res.status).toBe(201);
    expect(res.body.review.userId).toBe(a.id);
    expect(res.body.review.rating).toBe(4.5);
  });

  test('rechaza una calificación de 6 (400)', async () => {
    const a = await crearUsuario(app);
    const res = await crearResena(a.token, { rating: 6 });
    expect(res.status).toBe(400);
  });

  test('rechaza una reseña sin título de película (400)', async () => {
    const a = await crearUsuario(app);
    const res = await crearResena(a.token, { movieTitle: undefined });
    expect(res.status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).post('/reviews/crear').send(resenaValida);
    expect(res.status).toBe(401);
  });
});

describe('GET /reviews/mis-resenas y /reviews/otras-resenas/:id', () => {
  test('mis-resenas solo trae las del usuario', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await crearResena(a.token);
    await crearResena(b.token, { movieId: 1 });
    const res = await misResenas(a.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].movieId).toBe(550);
  });

  test('mis-resenas sin token responde 401', async () => {
    const res = await request(app).get('/reviews/mis-resenas');
    expect(res.status).toBe(401);
  });

  test('otras-resenas trae las reseñas de otro usuario', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await crearResena(a.token);
    const res = await request(app)
      .get(`/reviews/otras-resenas/${a.id}`)
      .set('Authorization', b.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PUT /reviews/editar/:id', () => {
  test('el dueño edita su reseña (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaResena(a.token);
    const res = await editar(a.token, id, { rating: 3 });
    expect(res.status).toBe(200);
    expect(res.body.review.rating).toBe(3);
  });

  test('otro usuario no puede editarla (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaResena(a.token);
    const res = await editar(b.token, id, { rating: 1 });
    expect(res.status).toBe(404);
    expect((await misResenas(a.token)).body[0].rating).toBe(4.5);
  });

  test('una calificación inválida responde 400', async () => {
    const a = await crearUsuario(app);
    const id = await unaResena(a.token);
    const res = await editar(a.token, id, { rating: 9 });
    expect(res.status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).put('/reviews/editar/123').send({ rating: 3 });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /reviews/borrar/:id', () => {
  test('el dueño borra su reseña (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaResena(a.token);
    const res = await borrar(a.token, id);
    expect(res.status).toBe(200);
    expect((await misResenas(a.token)).body).toHaveLength(0);
  });

  test('otro usuario no puede borrarla (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaResena(a.token);
    const res = await borrar(b.token, id);
    expect(res.status).toBe(404);
    expect((await misResenas(a.token)).body).toHaveLength(1);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).delete('/reviews/borrar/123');
    expect(res.status).toBe(401);
  });
});

describe('GET /reviews/pelicula/:movieId', () => {
  beforeEach(async () => {
    const a = await crearUsuario(app);
    await crearResena(a.token, { rating: 5 });
    await crearResena(a.token, { rating: 2 });
    await crearResena(a.token, { movieId: 1 });
  });

  test('es público y trae solo las reseñas de esa película', async () => {
    const res = await request(app).get('/reviews/pelicula/550');
    expect(res.status).toBe(200);
    expect(res.body.totalReviews).toBe(2);
  });

  test('filtra por calificación', async () => {
    const res = await request(app).get('/reviews/pelicula/550?rating=5');
    expect(res.body.totalReviews).toBe(1);
  });

  test('pagina los resultados', async () => {
    const res = await request(app).get('/reviews/pelicula/550?limit=1');
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.totalPages).toBe(2);
  });

  test('un autor con formato inválido hoy responde 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/reviews/pelicula/550?autor=abc');
    expect(res.status).toBe(500);
  });
});
