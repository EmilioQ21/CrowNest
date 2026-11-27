// Se sustituye el modelo List por un doble para probar el controlador sin base de datos.
jest.mock('../../models/list.js', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
}));

const List = require('../../models/list.js');
const controller = require('../../controllers/list_api_controllers');

const ID_VALIDO = '64b7f0c2a1b2c3d4e5f60718';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Petición de prueba: usuario "u1" con parámetros y cuerpo opcionales.
const mockReq = (params = {}, body = {}) => ({ user: { id: 'u1' }, params, body });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getLists', () => {
  test('devuelve las listas del usuario del token', async () => {
    List.find.mockResolvedValue([{ id: 1 }]);
    const res = mockRes();

    await controller.getLists(mockReq(), res);

    expect(List.find).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  test('responde 500 si falla la base de datos', async () => {
    List.find.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.getLists(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener listas' });
  });
});

describe('getListById', () => {
  test('convierte el id a número y busca solo listas del usuario', async () => {
    List.findOne.mockResolvedValue({ id: 3 });
    const res = mockRes();

    await controller.getListById(mockReq({ id: '3' }), res);

    expect(List.findOne).toHaveBeenCalledWith({ id: 3, userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith({ id: 3 });
  });

  test('responde 404 si la lista no existe o no es del usuario', async () => {
    List.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.getListById(mockReq({ id: '3' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 500 si falla la base de datos', async () => {
    List.findOne.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.getListById(mockReq({ id: '3' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const datosLista = { nombre: 'Pendientes', descripcion: 'd', visibilidad: 'publica' };
const conUltimo = (ultimo) => ({ sort: jest.fn().mockResolvedValue(ultimo) });

describe('createList', () => {
  test('responde 400 si faltan nombre o visibilidad', async () => {
    const res = mockRes();

    await controller.createList(mockReq({}, { nombre: 'Pendientes' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(List.create).not.toHaveBeenCalled();
  });

  test('crea la lista con el siguiente id', async () => {
    List.findOne.mockReturnValue(conUltimo({ id: 7 }));
    List.create.mockResolvedValue({ id: 8 });
    const res = mockRes();

    await controller.createList(mockReq({}, datosLista), res);

    expect(List.create).toHaveBeenCalledWith({
      id: 8,
      userId: 'u1',
      ...datosLista,
      peliculas: [],
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('createList, casos de borde y errores', () => {
  test('usa el id 1 si todavía no hay listas', async () => {
    List.findOne.mockReturnValue(conUltimo(null));
    List.create.mockResolvedValue({ id: 1 });

    await controller.createList(mockReq({}, datosLista), mockRes());

    expect(List.create.mock.calls[0][0].id).toBe(1);
  });

  test('responde 500 si falla al guardar', async () => {
    List.findOne.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('x')) });
    const res = mockRes();

    await controller.createList(mockReq({}, datosLista), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getListsByUser', () => {
  test('el dueño ve sus listas sin filtrar por visibilidad', async () => {
    List.find.mockResolvedValue([]);
    const req = { user: { id: ID_VALIDO }, params: { userId: ID_VALIDO } };

    await controller.getListsByUser(req, mockRes());

    const filtro = List.find.mock.calls[0][0];
    expect(filtro.isDefault).toBe(false);
    expect(filtro.visibilidad).toBeUndefined();
  });

  test('otro usuario ve solo las listas públicas', async () => {
    List.find.mockResolvedValue([]);
    const req = { user: { id: 'otro' }, params: { userId: ID_VALIDO } };

    await controller.getListsByUser(req, mockRes());

    expect(List.find.mock.calls[0][0].visibilidad).toBe('publica');
  });

  test('responde 500 si el id del usuario no es válido', async () => {
    const res = mockRes();

    await controller.getListsByUser(mockReq({ userId: 'abc' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('addMovie', () => {
  const pelicula = { tmdbId: 10, titulo: 'Alien', poster_path: '/a.jpg' };

  test('responde 400 si faltan datos de la película', async () => {
    const res = mockRes();

    await controller.addMovie(mockReq({ id: '5' }, { tmdbId: 10 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('agrega la película solo en una lista del usuario', async () => {
    List.findOneAndUpdate.mockResolvedValue({ id: 5 });
    const res = mockRes();

    await controller.addMovie(mockReq({ id: '5' }, pelicula), res);

    expect(List.findOneAndUpdate.mock.calls[0][0]).toEqual({ id: 5, userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith({ id: 5 });
  });

  test('responde 404 si la lista no existe o no es del usuario', async () => {
    List.findOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await controller.addMovie(mockReq({ id: '5' }, pelicula), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 500 si falla la base de datos', async () => {
    List.findOneAndUpdate.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.addMovie(mockReq({ id: '5' }, pelicula), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('removeMovie', () => {
  const params = { id: '5', tmdbId: '10' };

  test('quita la película indicada de la lista del usuario', async () => {
    List.findOneAndUpdate.mockResolvedValue({ id: 5 });
    const res = mockRes();

    await controller.removeMovie(mockReq(params), res);

    expect(List.findOneAndUpdate.mock.calls[0][0]).toEqual({ id: 5, userId: 'u1' });
    expect(List.findOneAndUpdate.mock.calls[0][1].$pull).toEqual({ peliculas: { tmdbId: 10 } });
    expect(res.json).toHaveBeenCalledWith({ id: 5 });
  });

  test('responde 404 si la lista no existe o no es del usuario', async () => {
    List.findOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await controller.removeMovie(mockReq(params), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 500 si falla la base de datos', async () => {
    List.findOneAndUpdate.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.removeMovie(mockReq(params), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteList', () => {
  test('responde 404 si la lista no existe o no es del usuario', async () => {
    List.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.deleteList(mockReq({ id: '2' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(List.deleteOne).not.toHaveBeenCalled();
  });

  test('no deja eliminar la lista de Favoritos', async () => {
    List.findOne.mockResolvedValue({ id: 2, isDefault: true });
    const res = mockRes();

    await controller.deleteList(mockReq({ id: '2' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(List.deleteOne).not.toHaveBeenCalled();
  });

  test('elimina una lista propia', async () => {
    List.findOne.mockResolvedValue({ id: 2, isDefault: false });
    const res = mockRes();

    await controller.deleteList(mockReq({ id: '2' }), res);

    expect(List.deleteOne).toHaveBeenCalledWith({ id: 2 });
    expect(res.json).toHaveBeenCalledWith({ message: 'Lista eliminada correctamente' });
  });

  test('responde 500 si falla la base de datos', async () => {
    List.findOne.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.deleteList(mockReq({ id: '2' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateList', () => {
  test('actualiza solo los campos que se enviaron', async () => {
    List.findOneAndUpdate.mockResolvedValue({ id: 1 });
    const res = mockRes();

    await controller.updateList(mockReq({ id: '1' }, { nombre: 'Nueva' }), res);

    const cambios = List.findOneAndUpdate.mock.calls[0][1];
    expect(cambios.nombre).toBe('Nueva');
    expect(cambios.descripcion).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  test('responde 404 si la lista no existe o no es del usuario', async () => {
    List.findOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateList(mockReq({ id: '1' }, { nombre: 'Nueva' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 500 si falla la base de datos', async () => {
    List.findOneAndUpdate.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.updateList(mockReq({ id: '1' }, { nombre: 'Nueva' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
