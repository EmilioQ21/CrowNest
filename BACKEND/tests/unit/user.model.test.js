// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para poder cargar el modelo en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const User = require('../../models/user');

const datosValidos = {
  name: 'Ana',
  email: 'ana@correo.com',
  password: 'contrasena123',
  joined_at: new Date(),
};

describe('Modelo User', () => {
  test('acepta un usuario válido', () => {
    expect(new User(datosValidos).validateSync()).toBeUndefined();
  });

  test('rechaza un usuario sin email', () => {
    const error = new User({ ...datosValidos, email: undefined }).validateSync();
    expect(error.errors.email).toBeDefined();
  });

  test('rechaza un usuario sin nombre', () => {
    const error = new User({ ...datosValidos, name: undefined }).validateSync();
    expect(error.errors.name).toBeDefined();
  });

  test('rechaza una contraseña de menos de 8 caracteres', () => {
    const error = new User({ ...datosValidos, password: 'abc' }).validateSync();
    expect(error).toBeDefined();
  });
});
