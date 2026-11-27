// Recorridos de sistema: un flujo por requisito, como una cadena de peticiones a la API.
// RF-03 (TMDB) no se prueba aquí porque el frontend consulta TMDB directamente.
// mongoose-unique-validator es ESM y el modelo no lo usa; se sustituye para cargar la app en Jest.
jest.mock('mongoose-unique-validator', () => jest.fn());

const request = require('supertest');
const app = require('../../app');
const List = require('../../models/list');
const db = require('../integration/db');
const { crearUsuario } = require('../integration/auth');

const pelicula = { tmdbId: 550, titulo: 'Fight Club', poster_path: '/poster.jpg', año: '1999' };

beforeAll(() => db.conectar(), 120000);
afterEach(() => db.limpiar());
afterAll(() => db.desconectar());

const con = (peticion, token) => peticion.set('Authorization', token);
const entrar = (email, password) => request(app).post('/login').send({ email, password });
const crearResena = (token, extra = {}) =>
  con(request(app).post('/reviews/crear'), token).send({
    movieId: 550,
    movieTitle: 'Fight Club',
    rating: 4,
    watchedAt: '2026-03-10',
    ...extra,
  });
const misResenas = (token) => con(request(app).get('/reviews/mis-resenas'), token);
const listasDe = (userId, token) => con(request(app).get(`/lists/user/${userId}`), token);
const ids = (res) => res.body.data.map((u) => u._id);

describe('RF-01 Registro de usuario', () => {
  test('se registra, recibe su lista Favoritos y puede iniciar sesión', async () => {
    const datos = { name: 'ana', email: 'ana@correo.com', password: 'Password123' };
    const registro = await request(app)
      .post('/users')
      .send({ ...datos, confirm_password: datos.password });
    expect(registro.status).toBe(200);
    const listas = await List.find({ userId: registro.body.user._id });
    expect(listas).toHaveLength(1);
    expect(listas[0]).toMatchObject({ nombre: 'Favoritos', isDefault: true });
    const login = await entrar(datos.email, datos.password);
    expect(login.status).toBe(200);
    const propias = await con(request(app).get('/lists'), login.body.token);
    expect(propias.body.map((l) => l.nombre)).toEqual(['Favoritos']);
  });
});

describe('RF-02 Inicio de sesión y acceso sin cuenta', () => {
  test('el login da un token válido; sin sesión solo se ve lo público', async () => {
    const a = await crearUsuario(app);
    const login = await entrar(a.email, a.password);
    expect((await con(request(app).get('/lists'), login.body.token)).status).toBe(200);
    expect((await entrar(a.email, 'incorrecta')).status).toBe(401);
    expect((await request(app).get('/lists')).status).toBe(401);
    expect((await request(app).get('/reviews/pelicula/550')).status).toBe(200);
    expect((await request(app).get('/reviews/mis-resenas')).status).toBe(401);
  });
});

describe('RF-04 Reseñas propias', () => {
  test('crea, valida, edita y borra una reseña', async () => {
    const a = await crearUsuario(app);
    const creada = await crearResena(a.token);
    expect(creada.status).toBe(201);
    const id = creada.body.review._id;
    expect((await crearResena(a.token, { rating: 6 })).status).toBe(400);
    expect((await crearResena(a.token, { reviewText: 'a'.repeat(1501) })).status).toBe(400);
    const cambio = { rating: 3, reviewText: 'Cambié de opinión' };
    const editada = await con(request(app).put(`/reviews/editar/${id}`), a.token).send(cambio);
    expect(editada.body.review.rating).toBe(3);
    const borrada = await con(request(app).delete(`/reviews/borrar/${id}`), a.token);
    expect(borrada.status).toBe(200);
    expect((await misResenas(a.token)).body).toHaveLength(0);
  });
});

describe('RF-05 Ver reseñas de una película y de otros usuarios', () => {
  test('cualquiera ve las reseñas de la película y de otro usuario', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await crearResena(a.token);
    await crearResena(b.token, { rating: 2 });
    const deLaPelicula = await request(app).get('/reviews/pelicula/550');
    expect(deLaPelicula.body.totalReviews).toBe(2);
    const deA = await con(request(app).get(`/reviews/otras-resenas/${a.id}`), b.token);
    expect(deA.body).toHaveLength(1);
    expect(deA.body[0].userId).toBe(a.id);
  });
});

describe('RF-06 Listas', () => {
  test('crea una lista, agrega y quita películas, cambia su visibilidad y la borra', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    const nueva = { nombre: 'Terror', visibilidad: 'privada' };
    const creada = await con(request(app).post('/lists'), a.token).send(nueva);
    expect(creada.status).toBe(201);
    const id = creada.body.id;
    const agregada = await con(request(app).post(`/lists/${id}/movies`), a.token).send(pelicula);
    expect(agregada.body.peliculas).toHaveLength(1);
    expect((await listasDe(a.id, b.token)).body).toHaveLength(0);
    const cambio = { nombre: 'Terror 2', visibilidad: 'publica' };
    await con(request(app).put(`/lists/${id}`), a.token).send(cambio);
    expect((await listasDe(a.id, b.token)).body.map((l) => l.nombre)).toEqual(['Terror 2']);
    const quitada = await con(request(app).delete(`/lists/${id}/movies/550`), a.token);
    expect(quitada.body.peliculas).toHaveLength(0);
    await con(request(app).delete(`/lists/${id}`), a.token);
    expect((await con(request(app).get(`/lists/${id}`), a.token)).status).toBe(404);
  });
});

describe('RF-07 Buscar usuarios y amistades', () => {
  test('busca a un usuario, le envía una solicitud y la acepta', async () => {
    const a = await crearUsuario(app);
    const b = await crearUsuario(app);
    await con(request(app).put(`/users/${b.id}`), b.token).send({ nick_name: 'Beatriz' });
    const busqueda = await request(app).get('/users/search').query({ q: 'beat' });
    expect(busqueda.body.map((u) => u._id)).toEqual([b.id]);
    const envio = await con(request(app).post(`/users/add-friend/${b.id}`), a.token);
    expect(envio.body.status).toBe('pending');
    expect(ids(await request(app).get(`/users/3/${b.id}`))).toEqual([a.id]);
    const aceptar = con(request(app).post(`/users/friend-request/${a.id}`), b.token);
    await aceptar.send({ action: 'accept' });
    expect(ids(await request(app).get(`/users/2/${a.id}`))).toEqual([b.id]);
  });
});

describe('RF-08 Editar y eliminar el propio perfil', () => {
  test('cambia foto, banner y privacidad, y luego elimina su cuenta', async () => {
    const espia = jest.spyOn(console, 'log').mockImplementation(() => {});
    const a = await crearUsuario(app);
    const cambio = { nick_name: 'Nico', public: true, profile_photo: 3, banner_photo: 2 };
    const edicion = await con(request(app).put(`/users/${a.id}`), a.token).send(cambio);
    expect(edicion.status).toBe(200);
    const publico = await request(app).get(`/users/other/${a.id}`);
    expect(publico.body.user).toMatchObject(cambio);
    const borrado = await con(request(app).delete(`/users/${a.id}`), a.token);
    expect(borrado.status).toBe(200);
    expect((await entrar(a.email, a.password)).status).toBe(401);
    expect((await request(app).get(`/users/other/${a.id}`)).status).toBe(404);
    espia.mockRestore();
  });
});

describe('RF-09 Calendario de películas vistas', () => {
  test('las reseñas traen su fecha de vista y se agrupan por mes', async () => {
    const a = await crearUsuario(app);
    await crearResena(a.token, { movieId: 1, watchedAt: '2026-03-05' });
    await crearResena(a.token, { movieId: 2, watchedAt: '2026-03-20' });
    await crearResena(a.token, { movieId: 3, watchedAt: '2026-04-02' });
    const meses = (await misResenas(a.token)).body.map((r) => r.watchedAt.slice(0, 7));
    expect(meses.filter((m) => m === '2026-03')).toHaveLength(2);
    expect(meses.filter((m) => m === '2026-04')).toHaveLength(1);
  });
});
