// Se sustituyen bcrypt, jsonwebtoken y los modelos por dobles para probar sin base de datos.
jest.mock('bcrypt', () => ({ hashSync: jest.fn(), compare: jest.fn(), compareSync: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn() }));
jest.mock('../../models/user.js', () => {
  const UserMock = jest.fn();
  UserMock.findOne = jest.fn();
  UserMock.findById = jest.fn();
  UserMock.find = jest.fn();
  UserMock.findByIdAndUpdate = jest.fn();
  UserMock.findByIdAndDelete = jest.fn();
  return UserMock;
});
jest.mock('../../models/list.js', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../models/review.js', () => ({ find: jest.fn() }));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/user.js');
const List = require('../../models/list.js');
const Review = require('../../models/review.js');
const controller = require('../../controllers/users_api_controllers');

const ID_VALIDO = '64b7f0c2a1b2c3d4e5f60718';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Atajos para simular las cadenas de Mongoose: find().select(), find().sort(), etc.
const conSelect = (valor) => ({ select: jest.fn().mockResolvedValue(valor) });
const conSort = (valor) => ({ sort: jest.fn().mockResolvedValue(valor) });
const falla = () => new Error('falló');

// Simula que new User(datos).save() guarda y devuelve el usuario con un _id.
const usuarioNuevo = () =>
  User.mockImplementation(function (datos) {
    this.save = jest.fn().mockResolvedValue({ _id: 'u1', ...datos });
  });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

const datosRegistro = {
  name: 'Ana',
  email: 'ana@correo.com',
  password: '12345678',
  confirm_password: '12345678',
};

describe('registerUser', () => {
  test('responde 401 si las contraseñas no coinciden', async () => {
    const res = mockRes();
    const body = { ...datosRegistro, confirm_password: 'otra' };

    await controller.registerUser({ body }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(User).not.toHaveBeenCalled();
  });

  test('guarda la contraseña encriptada y crea la lista Favoritos', async () => {
    bcrypt.hashSync.mockReturnValue('hash');
    jwt.sign.mockReturnValue('tok');
    usuarioNuevo();
    List.findOne.mockReturnValue(conSort({ id: 4 }));
    const res = mockRes();

    await controller.registerUser({ body: datosRegistro }, res);

    expect(bcrypt.hashSync).toHaveBeenCalledWith('12345678', 10);
    expect(User).toHaveBeenCalledWith(expect.objectContaining({ password: 'hash' }));
    const lista = { id: 5, userId: 'u1', nombre: 'Favoritos', isDefault: true };
    expect(List.create).toHaveBeenCalledWith(expect.objectContaining(lista));
    expect(res.json.mock.calls[0][0].token).toBe('tok');
  });
});

describe('registerUser, casos de borde y errores', () => {
  test('usa el id 1 para Favoritos si todavía no hay listas', async () => {
    usuarioNuevo();
    List.findOne.mockReturnValue(conSort(null));

    await controller.registerUser({ body: datosRegistro }, mockRes());

    expect(List.create.mock.calls[0][0].id).toBe(1);
  });

  test('responde con el usuario completo, incluida la contraseña cifrada (H3)', async () => {
    bcrypt.hashSync.mockReturnValue('hash');
    usuarioNuevo();
    List.findOne.mockReturnValue(conSort(null));
    const res = mockRes();

    await controller.registerUser({ body: datosRegistro }, res);

    expect(res.json.mock.calls[0][0].user.password).toBe('hash');
  });

  test('responde 400 si no se puede guardar el usuario', async () => {
    User.mockImplementation(function () {
      this.save = jest.fn().mockRejectedValue(new Error('email duplicado'));
    });
    const res = mockRes();

    await controller.registerUser({ body: datosRegistro }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ msg: 'email duplicado', status: 400 });
  });
});

describe('login', () => {
  const req = { body: { email: 'ana@correo.com', password: '12345678' } };
  const usuario = { _id: 'u1', email: 'ana@correo.com', password: 'hash' };

  test('responde 401 si el usuario no existe', async () => {
    User.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].msg).toBe('Usuario no encontrado');
  });

  test('responde 401 si la contraseña es incorrecta', async () => {
    User.findOne.mockResolvedValue(usuario);
    bcrypt.compare.mockResolvedValue(false);
    const res = mockRes();

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].msg).toBe('Contraseña incorrecta');
  });

  test('entrega un token si los datos son correctos', async () => {
    User.findOne.mockResolvedValue(usuario);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('tok');
    const res = mockRes();

    await controller.login(req, res);

    expect(res.json).toHaveBeenCalledWith({ token: 'tok', user: usuario });
  });
});

describe('login, errores', () => {
  test('responde 500 si falla la base de datos', async () => {
    User.findOne.mockRejectedValue(falla());
    const res = mockRes();

    await controller.login({ body: { email: 'a@a.com', password: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('optionalAuth', () => {
  test('sigue sin usuario si no hay token', async () => {
    const req = { headers: {} };
    const next = jest.fn();

    await controller.optionalAuth(req, mockRes(), next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('guarda el usuario si el token es válido', async () => {
    jwt.verify.mockReturnValue({ id: 'u1' });
    const req = { headers: { authorization: 'tok' } };
    const next = jest.fn();

    await controller.optionalAuth(req, mockRes(), next);

    expect(req.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalled();
  });

  test('sigue sin usuario si el token es inválido', async () => {
    jwt.verify.mockImplementation(() => {
      throw falla();
    });
    const req = { headers: { authorization: 'malo' } };
    const next = jest.fn();

    await controller.optionalAuth(req, mockRes(), next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('authMiddelwere', () => {
  test('responde 401 si no hay token', async () => {
    const res = mockRes();
    const next = jest.fn();

    await controller.authMiddelwere({ headers: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('responde 401 si el token es inválido o expiró', async () => {
    jwt.verify.mockImplementation((token, clave, aviso) => aviso(falla()));
    const res = mockRes();
    const next = jest.fn();

    await controller.authMiddelwere({ headers: { authorization: 'malo' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('guarda el usuario y continúa si el token es válido', async () => {
    jwt.verify.mockImplementation((token, clave, aviso) => aviso(null, { id: 'u1' }));
    const req = { headers: { authorization: 'tok' } };
    const next = jest.fn();

    await controller.authMiddelwere(req, mockRes(), next);

    expect(req.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalled();
  });
});

describe('getUser', () => {
  test('responde 404 si el usuario no existe', async () => {
    User.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.getUser({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve el usuario encontrado', async () => {
    User.findOne.mockResolvedValue({ _id: 1, name: 'Ana' });
    const res = mockRes();

    await controller.getUser({ params: { id: '1' } }, res);

    expect(res.json).toHaveBeenCalledWith({ _id: 1, name: 'Ana' });
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findOne.mockRejectedValue(falla());
    const res = mockRes();

    await controller.getUser({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getSocialData', () => {
  test('responde 404 si el usuario no existe', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.getSocialData({ params: { id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve amigos, solicitudes y sugerencias', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', friends: ['f1'], friend_request: ['r1'] });
    const sugerencias = { limit: jest.fn().mockReturnValue(conSelect([{ name: 'S' }])) };
    User.find
      .mockReturnValueOnce(conSelect([{ name: 'F' }]))
      .mockReturnValueOnce(conSelect([{ name: 'R' }]))
      .mockReturnValueOnce(sugerencias);
    const res = mockRes();

    await controller.getSocialData({ params: { id: 'u1' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      friends: [{ name: 'F' }],
      requests: [{ name: 'R' }],
      suggestions: [{ name: 'S' }],
    });
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findById.mockRejectedValue(falla());
    const res = mockRes();

    await controller.getSocialData({ params: { id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const personas = [{ _id: 'f1' }, { _id: 'r1' }, { _id: 'x1' }];
const reqUsuarios = (type, query = {}) => ({ params: { id: 'u1', type }, query });

describe('getUsers, filtros', () => {
  beforeEach(() => {
    User.findById.mockResolvedValue({ friends: ['f1'], friend_request: ['r1'] });
    User.find.mockResolvedValue(personas);
  });

  test('tipo 1 devuelve a quienes no son amigos ni tienen solicitud', async () => {
    const res = mockRes();

    await controller.getUsers(reqUsuarios('1'), res);

    expect(res.json.mock.calls[0][0].data.map((u) => u._id)).toEqual(['x1']);
  });

  test('tipo 2 devuelve solo los amigos', async () => {
    const res = mockRes();

    await controller.getUsers(reqUsuarios('2'), res);

    expect(res.json.mock.calls[0][0].data.map((u) => u._id)).toEqual(['f1']);
  });

  test('tipo 3 devuelve solo las solicitudes', async () => {
    const res = mockRes();

    await controller.getUsers(reqUsuarios('3'), res);

    expect(res.json.mock.calls[0][0].data.map((u) => u._id)).toEqual(['r1']);
  });
});

describe('getUsers, casos de borde y errores', () => {
  test('responde 404 si el usuario no existe', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.getUsers(reqUsuarios('1'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 400 si el tipo de búsqueda no es válido', async () => {
    User.findById.mockResolvedValue({ friends: [], friend_request: [] });
    User.find.mockResolvedValue(personas);
    const res = mockRes();

    await controller.getUsers(reqUsuarios('9'), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getUsers, paginación y errores', () => {
  test('pagina los resultados', async () => {
    User.findById.mockResolvedValue({ friends: ['f1', 'f2'] });
    User.find.mockResolvedValue([{ _id: 'f1' }, { _id: 'f2' }]);
    const res = mockRes();

    await controller.getUsers(reqUsuarios('2', { page: '2', limit: '1' }), res);

    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.total).toBe(2);
    expect(respuesta.data.map((u) => u._id)).toEqual(['f2']);
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findById.mockRejectedValue(falla());
    const res = mockRes();

    await controller.getUsers(reqUsuarios('1'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('searchUsers', () => {
  test('devuelve una lista vacía si la búsqueda tiene menos de 2 letras', async () => {
    const res = mockRes();

    await controller.searchUsers({ query: { q: 'a' } }, res);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(User.find).not.toHaveBeenCalled();
  });

  test('devuelve solo datos públicos, sin la contraseña', async () => {
    const usuario = { _id: 'u1', name: 'Ana', nick_name: 'an', public: true, password: 'hash' };
    User.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([usuario]) });
    const res = mockRes();

    await controller.searchUsers({ query: { q: 'an' } }, res);

    const resultado = res.json.mock.calls[0][0];
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).not.toHaveProperty('password');
  });

  test('responde 500 si falla la base de datos', async () => {
    User.find.mockImplementation(() => {
      throw falla();
    });
    const res = mockRes();

    await controller.searchUsers({ query: { q: 'an' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const reqPerfil = (body) => ({ user: { id: 'u1' }, body });
const actualizaA = (usuario) => User.findByIdAndUpdate.mockReturnValue(conSelect(usuario));

describe('updateUserInfo, contraseña', () => {
  beforeEach(() => {
    User.findById.mockResolvedValue({ password: 'hashViejo' });
    actualizaA({ _id: 'u1' });
  });

  test('si la contraseña es la misma, no la actualiza', async () => {
    bcrypt.compareSync.mockReturnValue(true);

    await controller.updateUserInfo(reqPerfil({ password: 'igual', name: 'Ana' }), mockRes());

    expect(User.findByIdAndUpdate.mock.calls[0][1]).not.toHaveProperty('password');
    expect(bcrypt.hashSync).not.toHaveBeenCalled();
  });

  test('si la contraseña es nueva, la guarda encriptada', async () => {
    bcrypt.compareSync.mockReturnValue(false);
    bcrypt.hashSync.mockReturnValue('hashNuevo');

    await controller.updateUserInfo(reqPerfil({ password: 'nueva1234' }), mockRes());

    expect(User.findByIdAndUpdate.mock.calls[0][1].password).toBe('hashNuevo');
  });
});

describe('updateUserInfo, perfil y errores', () => {
  test('responde 404 si el usuario no existe', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateUserInfo(reqPerfil({ name: 'Ana' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('actualiza el perfil y responde sin la contraseña', async () => {
    User.findById.mockResolvedValue({ password: 'hashViejo' });
    actualizaA({ _id: 'u1', name: 'Ana' });
    const res = mockRes();

    await controller.updateUserInfo(reqPerfil({ name: 'Ana' }), res);

    expect(res.json).toHaveBeenCalledWith({
      msg: 'Perfil actualizado correctamente',
      user: { _id: 'u1', name: 'Ana' },
    });
  });

  test('responde 400 si falla la actualización', async () => {
    User.findById.mockRejectedValue(falla());
    const res = mockRes();

    await controller.updateUserInfo(reqPerfil({ name: 'Ana' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteUserInfo', () => {
  const req = { user: { id: 'u1' }, params: { id: 'u2' } };

  test('responde 404 si el usuario no existe', async () => {
    User.findByIdAndDelete.mockResolvedValue(null);
    const res = mockRes();

    await controller.deleteUserInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('borra la cuenta del id de la URL, sin compararlo con el token (H2)', async () => {
    User.findByIdAndDelete.mockResolvedValue({ _id: 'u2' });
    const res = mockRes();

    await controller.deleteUserInfo(req, res);

    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u2');
    expect(res.json).toHaveBeenCalledWith({ msg: 'Cuenta de usuario eliminada correctamente' });
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findByIdAndDelete.mockRejectedValue(falla());
    const res = mockRes();

    await controller.deleteUserInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const reqOtro = (id = ID_VALIDO) => ({ params: { id } });
const resenasRecientes = (valor) => ({
  sort: () => ({ limit: () => conSelect(valor) }),
});

describe('getOtherUser', () => {
  test('responde 400 si el id no es válido', async () => {
    const res = mockRes();

    await controller.getOtherUser(reqOtro('abc'), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('responde 404 si el usuario no existe', async () => {
    User.findById.mockReturnValue(conSelect(null));
    const res = mockRes();

    await controller.getOtherUser(reqOtro(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve el perfil, los favoritos y las últimas reseñas', async () => {
    User.findById.mockReturnValue(conSelect({ name: 'Ana' }));
    List.findOne.mockResolvedValue({ peliculas: [{ tmdbId: 1 }] });
    Review.find.mockReturnValue(resenasRecientes([{ movieTitle: 'Alien' }]));
    const res = mockRes();

    await controller.getOtherUser(reqOtro(), res);

    expect(res.json).toHaveBeenCalledWith({
      user: { name: 'Ana' },
      favorites: [{ tmdbId: 1 }],
      recentReviews: [{ movieTitle: 'Alien' }],
    });
  });
});

describe('getOtherUser, casos de borde y errores', () => {
  test('devuelve favoritos vacíos si no hay lista de favoritos', async () => {
    User.findById.mockReturnValue(conSelect({ name: 'Ana' }));
    List.findOne.mockResolvedValue(null);
    Review.find.mockReturnValue(resenasRecientes([]));
    const res = mockRes();

    await controller.getOtherUser(reqOtro(), res);

    expect(res.json.mock.calls[0][0].favorites).toEqual([]);
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findById.mockImplementation(() => {
      throw falla();
    });
    const res = mockRes();

    await controller.getOtherUser(reqOtro(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const reqAmigo = { params: { id: 'u2' }, user: { id: 'u1' } };
const usuarioDestino = (datos) => ({ friends: [], friend_request: [], public: false, ...datos });

describe('addFriend, rechazos', () => {
  test('responde 400 si intentas agregarte a ti mismo', async () => {
    const res = mockRes();

    await controller.addFriend({ params: { id: 'u1' }, user: { id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('responde 404 si el usuario no existe', async () => {
    User.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 400 si ya son amigos', async () => {
    User.findById.mockResolvedValue(usuarioDestino({ friends: ['u1'] }));
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('responde 400 si ya enviaste una solicitud', async () => {
    User.findById.mockResolvedValue(usuarioDestino({ friend_request: ['u1'] }));
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('addFriend, aceptados y errores', () => {
  test('si el perfil es público, los hace amigos al instante', async () => {
    User.findById.mockResolvedValue(usuarioDestino({ public: true }));
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.json.mock.calls[0][0].status).toBe('friends');
  });

  test('si el perfil es privado, envía una solicitud pendiente', async () => {
    User.findById.mockResolvedValue(usuarioDestino({ public: false }));
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    const cambio = { $addToSet: { friend_request: 'u1' } };
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u2', cambio);
    expect(res.json.mock.calls[0][0].status).toBe('pending');
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findById.mockRejectedValue(falla());
    const res = mockRes();

    await controller.addFriend(reqAmigo, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const reqSolicitud = (action) => ({
  params: { requestId: 'r1' },
  body: { action },
  user: { id: 'u1' },
});

describe('handleFriendRequest', () => {
  test('responde 400 si la acción no es válida', async () => {
    const res = mockRes();

    await controller.handleFriendRequest(reqSolicitud('borrar'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('al aceptar, quita la solicitud y los hace amigos', async () => {
    const res = mockRes();

    await controller.handleFriendRequest(reqSolicitud('accept'), res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(3);
    expect(res.json).toHaveBeenCalledWith({ msg: 'Solicitud aceptada. Ahora son amigos.' });
  });
});

describe('handleFriendRequest, rechazo y errores', () => {
  test('al rechazar, solo quita la solicitud', async () => {
    const res = mockRes();

    await controller.handleFriendRequest(reqSolicitud('reject'), res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ msg: 'Solicitud rechazada correctamente.' });
  });

  test('responde 500 si falla la base de datos', async () => {
    User.findByIdAndUpdate.mockRejectedValue(falla());
    const res = mockRes();

    await controller.handleFriendRequest(reqSolicitud('accept'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
