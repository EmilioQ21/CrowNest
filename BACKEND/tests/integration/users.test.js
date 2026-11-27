// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const List = require('../../models/list');
const User = require('../../models/user');
const db = require('./db');
const { crearUsuario } = require('./auth');

const datos = {
  name: 'ana',
  email: 'ana@correo.com',
  password: 'Password123',
  confirm_password: 'Password123',
};

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const registrar = (extra = {}) =>
  request(app)
    .post('/users')
    .send({ ...datos, ...extra });
const entrar = (cuerpo) => request(app).post('/login').send(cuerpo);
const buscar = (q) => request(app).get('/users/search').query({ q });
const perfil = (id, token) => {
  const peticion = request(app).get(`/users/other/${id}`);
  return token ? peticion.set('Authorization', token) : peticion;
};
const nombres = (res) => res.body.map((u) => u.name).sort();

describe('POST /users', () => {
  test('registra un usuario y devuelve su token (200)', async () => {
    const res = await registrar();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('ana@correo.com');
  });

  test('crea la lista Favoritos del usuario', async () => {
    const res = await registrar();
    const listas = await List.find({ userId: res.body.user._id });
    expect(listas).toHaveLength(1);
    expect(listas[0].isDefault).toBe(true);
  });

  test('rechaza contraseñas distintas (401)', async () => {
    const res = await registrar({ confirm_password: 'Otra12345' });
    expect(res.status).toBe(401);
  });

  test('rechaza un registro sin nombre (400)', async () => {
    const res = await registrar({ name: undefined });
    expect(res.status).toBe(400);
  });

  test('rechaza un correo repetido (400)', async () => {
    await User.init();
    await registrar();
    const res = await registrar({ name: 'otra' });
    expect(res.status).toBe(400);
  });
});

describe('POST /users, hallazgos conocidos', () => {
  test('H3: la respuesta incluye el hash de la contraseña', async () => {
    const res = await registrar();
    expect(res.body.user.password).toMatch(/^\$2[aby]\$/);
  });

  test('H14: hoy acepta una contraseña de 3 caracteres', async () => {
    const res = await registrar({ password: 'abc', confirm_password: 'abc' });
    expect(res.status).toBe(200);
  });
});

describe('POST /login', () => {
  beforeEach(async () => {
    await registrar();
  });

  test('entra con datos correctos (200)', async () => {
    const res = await entrar({ email: datos.email, password: datos.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('ana');
  });

  test('una contraseña incorrecta responde 401', async () => {
    const res = await entrar({ email: datos.email, password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.msg).toBe('Contraseña incorrecta');
  });

  test('un correo que no existe responde 401', async () => {
    const res = await entrar({ email: 'no@correo.com', password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.msg).toBe('Usuario no encontrado');
  });

  test('H4: los dos errores dan mensajes distintos', async () => {
    const malaClave = await entrar({ email: datos.email, password: 'incorrecta' });
    const malCorreo = await entrar({ email: 'no@correo.com', password: 'incorrecta' });
    expect(malaClave.body.msg).not.toBe(malCorreo.body.msg);
  });
});

describe('GET /users/search', () => {
  beforeEach(async () => {
    for (const n of ['Carlos', 'carla', 'Pedro']) {
      await registrar({ name: n, email: `${n.toLowerCase()}@correo.com` });
    }
  });

  test('encuentra por parte del nombre sin importar mayúsculas', async () => {
    const res = await buscar('car');
    expect(res.status).toBe(200);
    expect(nombres(res)).toEqual(['Carlos', 'carla']);
  });

  test('con menos de 2 letras responde lista vacía', async () => {
    const res = await buscar('c');
    expect(res.body).toEqual([]);
  });

  test('sin texto responde lista vacía', async () => {
    const res = await request(app).get('/users/search');
    expect(res.body).toEqual([]);
  });

  test('no devuelve la contraseña ni el correo', async () => {
    const res = await buscar('pedro');
    expect(res.body[0]).not.toHaveProperty('password');
    expect(res.body[0]).not.toHaveProperty('email');
  });
});

describe('GET /users/other/:id', () => {
  test('es público y devuelve el perfil con sus favoritos (200)', async () => {
    const a = await crearUsuario(app);
    const res = await perfil(a.id);
    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.favorites).toEqual([]);
  });

  test('incluye las reseñas recientes', async () => {
    const a = await crearUsuario(app);
    await request(app)
      .post('/reviews/crear')
      .set('Authorization', a.token)
      .send({ movieId: 550, movieTitle: 'Fight Club', rating: 4, watchedAt: '2026-01-15' });
    const res = await perfil(a.id, a.token);
    expect(res.body.recentReviews).toHaveLength(1);
  });

  test('un id inválido responde 400', async () => {
    const res = await perfil('abc');
    expect(res.status).toBe(400);
  });

  test('un usuario que no existe responde 404', async () => {
    const res = await perfil(new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(404);
  });
});
