// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const List = require('../../models/list');
const Review = require('../../models/review');
const db = require('./db');
const { crearUsuario } = require('./auth');

const resena = { movieId: 550, movieTitle: 'Fight Club', rating: 4, watchedAt: '2026-01-15' };

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const con = (peticion, usuario) => peticion.set('Authorization', usuario.token);
const entrar = (email, password) => request(app).post('/login').send({ email, password });
const ver = (u, id) => con(request(app).get(`/users/${id}`), u);
const actualizar = (u, cuerpo) => con(request(app).put(`/users/${u.id}`), u).send(cuerpo);
const borrar = (u, id) => con(request(app).delete(`/users/${id}`), u);

describe('GET /users/:id', () => {
  test('H7: hoy responde 500 porque usa parseInt sobre un id de Mongo', async () => {
    const a = await crearUsuario(app);
    const res = await ver(a, a.id);
    expect(res.status).toBe(500);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).get('/users/123');
    expect(res.status).toBe(401);
  });
});

describe('PUT /users/:id', () => {
  test('actualiza el perfil sin devolver la contraseña (200)', async () => {
    const a = await crearUsuario(app);
    const res = await actualizar(a, { nick_name: 'Nico' });
    expect(res.status).toBe(200);
    expect(res.body.user.nick_name).toBe('Nico');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('cambia la contraseña y se puede entrar con la nueva', async () => {
    const a = await crearUsuario(app);
    await actualizar(a, { password: 'NuevaClave1' });
    expect((await entrar(a.email, 'NuevaClave1')).status).toBe(200);
    expect((await entrar(a.email, a.password)).status).toBe(401);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).put('/users/123').send({ nick_name: 'Nico' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /users/:id', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('borra la cuenta junto con sus listas y reseñas (200)', async () => {
    const a = await crearUsuario(app);
    await con(request(app).post('/reviews/crear'), a).send(resena);
    const res = await borrar(a, a.id);
    expect(res.status).toBe(200);
    expect(await List.countDocuments({ userId: a.id })).toBe(0);
    expect(await Review.countDocuments({ userId: a.id })).toBe(0);
    expect((await entrar(a.email, a.password)).status).toBe(401);
  });

  test('H2: hoy cualquier usuario con sesión borra la cuenta de otro', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const res = await borrar(b, a.id);
    expect(res.status).toBe(200);
    expect((await entrar(a.email, a.password)).status).toBe(401);
  });

  test('un usuario que no existe responde 404', async () => {
    const a = await crearUsuario(app);
    const res = await borrar(a, new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(404);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).delete('/users/123');
    expect(res.status).toBe(401);
  });
});
