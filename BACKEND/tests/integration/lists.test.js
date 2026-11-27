// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const app = require('../../app');
const List = require('../../models/list');
const db = require('./db');
const { crearUsuario } = require('./auth');

const pelicula = { tmdbId: 550, titulo: 'Fight Club', poster_path: '/poster.jpg', año: '1999' };

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const con = (peticion, token) => (token ? peticion.set('Authorization', token) : peticion);
const crearLista = (token, extra = {}) =>
  con(request(app).post('/lists'), token).send({
    nombre: 'Favoritas',
    visibilidad: 'publica',
    ...extra,
  });
const unaLista = async (token, extra) => (await crearLista(token, extra)).body.id;
const verLista = (token, id) => con(request(app).get(`/lists/${id}`), token);
const editar = (token, id, cuerpo) => con(request(app).put(`/lists/${id}`), token).send(cuerpo);
const agregar = (token, id, cuerpo = pelicula) =>
  con(request(app).post(`/lists/${id}/movies`), token).send(cuerpo);
const quitar = (token, id) => con(request(app).delete(`/lists/${id}/movies/550`), token);
const borrar = (token, id) => con(request(app).delete(`/lists/${id}`), token);
const listasDe = (userId, token) => con(request(app).get(`/lists/user/${userId}`), token);
const nombres = (res) => res.body.map((l) => l.nombre).sort();

describe('POST /lists', () => {
  test('crea una lista válida (201)', async () => {
    const a = await crearUsuario(app);
    const res = await crearLista(a.token);
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(a.id);
    expect(res.body.peliculas).toEqual([]);
  });

  test('rechaza una lista sin nombre (400)', async () => {
    const a = await crearUsuario(app);
    const res = await crearLista(a.token, { nombre: undefined });
    expect(res.status).toBe(400);
  });

  test('rechaza una lista sin visibilidad (400)', async () => {
    const a = await crearUsuario(app);
    const res = await crearLista(a.token, { visibilidad: undefined });
    expect(res.status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const res = await crearLista();
    expect(res.status).toBe(401);
  });
});

describe('GET /lists', () => {
  test('solo trae las listas del usuario', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await crearLista(a.token, { nombre: 'De A' });
    await crearLista(b.token, { nombre: 'De B' });
    const res = await con(request(app).get('/lists'), a.token);
    expect(res.status).toBe(200);
    expect(res.body.every((l) => l.userId === a.id)).toBe(true);
    expect(nombres(res)).toContain('De A');
  });

  test('sin token responde 401', async () => {
    const res = await con(request(app).get('/lists'));
    expect(res.status).toBe(401);
  });
});

describe('GET /lists/:id', () => {
  test('el dueño ve su lista (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await verLista(a.token, id);
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Favoritas');
  });

  test('otro usuario no la ve (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await verLista(b.token, id);
    expect(res.status).toBe(404);
  });

  test('una lista que no existe responde 404', async () => {
    const a = await crearUsuario(app);
    const res = await verLista(a.token, 99999);
    expect(res.status).toBe(404);
  });

  test('sin token responde 401', async () => {
    const res = await verLista(undefined, 1);
    expect(res.status).toBe(401);
  });
});

describe('GET /lists/user/:userId', () => {
  let a;
  let b;

  beforeEach(async () => {
    a = await crearUsuario(app);
    b = await crearUsuario(app);
    await crearLista(a.token, { nombre: 'Publica', visibilidad: 'publica' });
    await crearLista(a.token, { nombre: 'Privada', visibilidad: 'privada' });
  });

  test('el dueño ve sus listas públicas y privadas', async () => {
    const res = await listasDe(a.id, a.token);
    expect(nombres(res)).toEqual(['Privada', 'Publica']);
  });

  test('otro usuario solo ve las públicas', async () => {
    const res = await listasDe(a.id, b.token);
    expect(nombres(res)).toEqual(['Publica']);
  });

  test('sin token solo ve las públicas', async () => {
    const res = await listasDe(a.id);
    expect(nombres(res)).toEqual(['Publica']);
  });

  test('un userId con formato inválido hoy responde 500', async () => {
    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await listasDe('abc', a.token);
    espia.mockRestore();
    expect(res.status).toBe(500);
  });
});

describe('PUT /lists/:id', () => {
  test('el dueño cambia el nombre (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await editar(a.token, id, { nombre: 'Nueva' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Nueva');
  });

  test('otro usuario no puede editarla (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await editar(b.token, id, { nombre: 'Robada' });
    expect(res.status).toBe(404);
    expect((await verLista(a.token, id)).body.nombre).toBe('Favoritas');
  });

  test('sin token responde 401', async () => {
    const res = await editar(undefined, 1, { nombre: 'Nueva' });
    expect(res.status).toBe(401);
  });
});

describe('POST /lists/:id/movies', () => {
  test('agrega una película (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await agregar(a.token, id);
    expect(res.status).toBe(200);
    expect(res.body.peliculas).toHaveLength(1);
    expect(res.body.peliculas[0].tmdbId).toBe(550);
  });

  test('rechaza una película sin poster (400)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await agregar(a.token, id, { ...pelicula, poster_path: undefined });
    expect(res.status).toBe(400);
  });

  test('otro usuario no puede agregar (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await agregar(b.token, id);
    expect(res.status).toBe(404);
  });

  test('sin token responde 401', async () => {
    const res = await agregar(undefined, 1);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /lists/:id/movies/:tmdbId', () => {
  test('quita una película (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    await agregar(a.token, id);
    const res = await quitar(a.token, id);
    expect(res.status).toBe(200);
    expect(res.body.peliculas).toHaveLength(0);
  });

  test('otro usuario no puede quitarla (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaLista(a.token);
    await agregar(a.token, id);
    const res = await quitar(b.token, id);
    expect(res.status).toBe(404);
    expect((await verLista(a.token, id)).body.peliculas).toHaveLength(1);
  });

  test('sin token responde 401', async () => {
    const res = await quitar(undefined, 1);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /lists/:id', () => {
  test('el dueño borra su lista (200)', async () => {
    const a = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await borrar(a.token, id);
    expect(res.status).toBe(200);
    expect((await verLista(a.token, id)).status).toBe(404);
  });

  test('otro usuario no puede borrarla (404)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const id = await unaLista(a.token);
    const res = await borrar(b.token, id);
    expect(res.status).toBe(404);
    expect((await verLista(a.token, id)).status).toBe(200);
  });

  test('no deja borrar la lista de Favoritos (400)', async () => {
    const a = await crearUsuario(app);
    const datos = { id: 900, userId: a.id, nombre: 'Favoritos', visibilidad: 'privada' };
    await List.create({ ...datos, isDefault: true });
    const res = await borrar(a.token, 900);
    expect(res.status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const res = await borrar(undefined, 1);
    expect(res.status).toBe(401);
  });
});
