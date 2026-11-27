// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const db = require('./db');

beforeAll(() => db.conectar(), 120000);
afterAll(() => db.desconectar());

describe('Configuración de integración', () => {
  test('la base de datos en memoria está conectada', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  test('la app responde sin conectarse a Atlas', async () => {
    const res = await request(app).get('/ruta-que-no-existe');
    expect(res.status).toBe(404);
  });
});
