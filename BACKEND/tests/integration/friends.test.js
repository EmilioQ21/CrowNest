// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const db = require('./db');
const { crearUsuario } = require('./auth');

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const con = (peticion, usuario) => peticion.set('Authorization', usuario.token);
const hacerPublico = (u) => con(request(app).put(`/users/${u.id}`), u).send({ public: true });
const agregar = (u, objetivoId) => con(request(app).post(`/users/add-friend/${objetivoId}`), u);
const responder = (u, solicitanteId, action) =>
  con(request(app).post(`/users/friend-request/${solicitanteId}`), u).send({ action });
const listado = (tipo, id, query = '') => request(app).get(`/users/${tipo}/${id}${query}`);
const ids = (res) => res.body.data.map((u) => u._id);
const nuevoId = () => new mongoose.Types.ObjectId().toString();

describe('POST /users/add-friend/:id, casos normales', () => {
  test('con perfil público quedan como amigos al instante (200)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await hacerPublico(b);
    const res = await agregar(a, b.id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('friends');
    expect(ids(await listado(2, a.id))).toEqual([b.id]);
  });

  test('con perfil privado queda una solicitud pendiente (200)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const res = await agregar(a, b.id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(ids(await listado(3, b.id))).toEqual([a.id]);
  });
});

describe('POST /users/add-friend/:id, rechazos', () => {
  test('no puede agregarse a sí mismo (400)', async () => {
    const a = await crearUsuario(app);
    const res = await agregar(a, a.id);
    expect(res.status).toBe(400);
  });

  test('no repite una solicitud pendiente (400)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await agregar(a, b.id);
    const res = await agregar(a, b.id);
    expect(res.status).toBe(400);
  });

  test('no repite una amistad (400)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await hacerPublico(b);
    await agregar(a, b.id);
    const res = await agregar(a, b.id);
    expect(res.status).toBe(400);
  });

  test('un usuario que no existe responde 404', async () => {
    const a = await crearUsuario(app);
    const res = await agregar(a, nuevoId());
    expect(res.status).toBe(404);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).post(`/users/add-friend/${nuevoId()}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /users/friend-request/:requestId', () => {
  test('aceptar deja a los dos como amigos (200)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await agregar(a, b.id);
    const res = await responder(b, a.id, 'accept');
    expect(res.status).toBe(200);
    expect(ids(await listado(2, b.id))).toEqual([a.id]);
    expect(ids(await listado(2, a.id))).toEqual([b.id]);
    expect(ids(await listado(3, b.id))).toEqual([]);
  });

  test('rechazar quita la solicitud y no hay amistad (200)', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await agregar(a, b.id);
    const res = await responder(b, a.id, 'reject');
    expect(res.status).toBe(200);
    expect(ids(await listado(3, b.id))).toEqual([]);
    expect(ids(await listado(2, b.id))).toEqual([]);
  });

  test('una acción inválida responde 400', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const res = await responder(b, a.id, 'quizas');
    expect(res.status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const res = await request(app)
      .post(`/users/friend-request/${nuevoId()}`)
      .send({ action: 'accept' });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/:type/:id, listados', () => {
  let a;
  let b;
  let c;

  beforeEach(async () => {
    a = await crearUsuario(app);
    b = await crearUsuario(app);
    c = await crearUsuario(app);
  });

  test('tipo 1 trae a los demás usuarios, sin el propio', async () => {
    const res = await listado(1, a.id);
    expect(res.status).toBe(200);
    expect(ids(res).sort()).toEqual([b.id, c.id].sort());
  });

  test('tipo 2 sin amigos responde lista vacía', async () => {
    const res = await listado(2, a.id);
    expect(res.body.total).toBe(0);
  });

  test('pagina los resultados', async () => {
    const res = await listado(1, a.id, '?limit=1');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(2);
  });

  test('no incluye datos privados', async () => {
    const res = await listado(1, a.id);
    expect(res.body.data[0]).not.toHaveProperty('password');
    expect(res.body.data[0]).not.toHaveProperty('email');
  });
});

describe('GET /users/:type/:id, rechazos', () => {
  test('un tipo inválido responde 400', async () => {
    const a = await crearUsuario(app);
    const res = await listado(9, a.id);
    expect(res.status).toBe(400);
  });

  test('un usuario que no existe responde 404', async () => {
    const res = await listado(1, nuevoId());
    expect(res.status).toBe(404);
  });
});
