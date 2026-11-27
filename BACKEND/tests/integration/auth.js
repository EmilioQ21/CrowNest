const request = require('supertest');

let contador = 0;

async function crearUsuario(app) {
  contador += 1;
  const datos = {
    name: `usuario${contador}`,
    email: `usuario${contador}@correo.com`,
    password: 'Password123',
    confirm_password: 'Password123',
  };
  const registro = await request(app).post('/users').send(datos);
  if (registro.status >= 300) {
    throw new Error(`No se pudo registrar el usuario de prueba (${registro.status})`);
  }
  const login = await request(app)
    .post('/login')
    .send({ email: datos.email, password: datos.password });
  const usuario = login.body.user;
  return { token: login.body.token, id: String(usuario._id || usuario.id) };
}

module.exports = { crearUsuario };
