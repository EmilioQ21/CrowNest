// Se sustituyen los modelos por dobles para probar los controladores sin base de datos.
jest.mock('../../models/review.js', () => {
  const ReviewMock = jest.fn();
  ReviewMock.find = jest.fn();
  ReviewMock.findOne = jest.fn();
  ReviewMock.findByIdAndUpdate = jest.fn();
  ReviewMock.findOneAndDelete = jest.fn();
  ReviewMock.countDocuments = jest.fn();
  return ReviewMock;
});
jest.mock('../../models/user.js', () => ({ findById: jest.fn() }));

const Review = require('../../models/review.js');
const User = require('../../models/user.js');
const controller = require('../../controllers/review_api_controllers');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Simula la cadena populate().sort().skip().limit() de Mongoose.
const mockCadena = (resultado) => {
  const limit = jest.fn().mockResolvedValue(resultado);
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  return { populate: jest.fn().mockReturnValue({ sort }) };
};

beforeEach(() => jest.resetAllMocks());

describe('createReview', () => {
  test('guarda la reseña y responde 201', async () => {
    Review.mockImplementation(function (datos) {
      this.save = jest.fn().mockResolvedValue({ _id: 'r1', ...datos });
    });
    const req = { user: { _id: 'u1' }, body: { movieId: 10, rating: 4 } };
    const res = mockRes();

    await controller.createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].msg).toBe('Reseña guardada con éxito');
  });

  test('responde 400 si no se puede guardar', async () => {
    Review.mockImplementation(function () {
      this.save = jest.fn().mockRejectedValue(new Error('rating inválido'));
    });
    const res = mockRes();

    await controller.createReview({ user: { id: 'u1' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ msg: 'rating inválido', status: 400 });
  });
});

describe('getUserReviews y getOtherUserReviews', () => {
  test('getUserReviews devuelve las reseñas del usuario del token', async () => {
    Review.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ _id: 'r1' }]) });
    const res = mockRes();

    await controller.getUserReviews({ user: { _id: 'u1' } }, res);

    expect(Review.find).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith([{ _id: 'r1' }]);
  });

  test('getUserReviews responde 500 si falla la base de datos', async () => {
    Review.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('x')) });
    const res = mockRes();

    await controller.getUserReviews({ user: { _id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('getOtherUserReviews busca por el id de la URL', async () => {
    Review.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = mockRes();

    await controller.getOtherUserReviews({ params: { id: 'u2' } }, res);

    expect(Review.find).toHaveBeenCalledWith({ userId: 'u2' });
  });

  test('getOtherUserReviews responde 500 si falla la base de datos', async () => {
    Review.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('x')) });
    const res = mockRes();

    await controller.getOtherUserReviews({ params: { id: 'u2' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

const reqUpdate = { params: { id: 'r1' }, user: { _id: 'u1' }, body: { rating: 5 } };

describe('updateReview', () => {
  test('solo busca reseñas que pertenezcan al usuario del token', async () => {
    Review.findOne.mockResolvedValue(null);

    await controller.updateReview(reqUpdate, mockRes());

    expect(Review.findOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' });
  });

  test('responde 404 y no actualiza si la reseña no es del usuario', async () => {
    Review.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateReview(reqUpdate, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Review.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('updateReview, casos válidos y errores', () => {
  test('actualiza la reseña propia', async () => {
    Review.findOne.mockResolvedValue({ _id: 'r1' });
    Review.findByIdAndUpdate.mockResolvedValue({ _id: 'r1', rating: 5 });
    const res = mockRes();

    await controller.updateReview(reqUpdate, res);

    expect(res.json).toHaveBeenCalledWith({
      msg: 'Reseña actualizada',
      review: { _id: 'r1', rating: 5 },
    });
  });

  test('responde 400 si la actualización falla', async () => {
    Review.findOne.mockRejectedValue(new Error('id inválido'));
    const res = mockRes();

    await controller.updateReview(reqUpdate, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteReview', () => {
  const req = { params: { id: 'r1' }, user: { _id: 'u1' } };

  test('borra solo si la reseña es del usuario del token', async () => {
    Review.findOneAndDelete.mockResolvedValue({ _id: 'r1' });
    const res = mockRes();

    await controller.deleteReview(req, res);

    expect(Review.findOneAndDelete).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith({ msg: 'Reseña eliminada correctamente' });
  });

  test('responde 404 si no existe o no es del usuario', async () => {
    Review.findOneAndDelete.mockResolvedValue(null);
    const res = mockRes();

    await controller.deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 500 si falla la base de datos', async () => {
    Review.findOneAndDelete.mockRejectedValue(new Error('x'));
    const res = mockRes();

    await controller.deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getMovieReviews', () => {
  test('usa página 1 y límite 5 por defecto y calcula las páginas', async () => {
    Review.find.mockReturnValue(mockCadena([{ _id: 'r1' }]));
    Review.countDocuments.mockResolvedValue(12);
    const res = mockRes();

    await controller.getMovieReviews({ params: { movieId: '10' }, query: {} }, res);

    expect(res.json).toHaveBeenCalledWith({
      reviews: [{ _id: 'r1' }],
      totalPages: 3,
      currentPage: 1,
      totalReviews: 12,
    });
  });

  test('filtra por calificación numérica', async () => {
    Review.find.mockReturnValue(mockCadena([]));
    Review.countDocuments.mockResolvedValue(0);

    await controller.getMovieReviews(
      { params: { movieId: '10' }, query: { rating: '4' } },
      mockRes(),
    );

    expect(Review.find).toHaveBeenCalledWith({ movieId: '10', rating: 4 });
  });

  test('no filtra por calificación si el valor es Todas', async () => {
    Review.find.mockReturnValue(mockCadena([]));
    Review.countDocuments.mockResolvedValue(0);

    await controller.getMovieReviews(
      { params: { movieId: '10' }, query: { rating: 'Todas' } },
      mockRes(),
    );

    expect(Review.find).toHaveBeenCalledWith({ movieId: '10' });
  });
});

describe('getMovieReviews con amigos y errores', () => {
  test('si el usuario no tiene amigos, filtra por un id que no existe', async () => {
    User.findById.mockResolvedValue({ friends: [] });
    Review.find.mockReturnValue(mockCadena([]));
    Review.countDocuments.mockResolvedValue(0);

    await controller.getMovieReviews(
      { params: { movieId: '10' }, query: { amigosDe: 'u1' } },
      mockRes(),
    );

    expect(Review.find.mock.calls[0][0].userId).toBeDefined();
  });

  test('filtra por los amigos del usuario', async () => {
    User.findById.mockResolvedValue({ friends: ['64b7f0c2a1b2c3d4e5f60718'] });
    Review.find.mockReturnValue(mockCadena([]));
    Review.countDocuments.mockResolvedValue(0);

    await controller.getMovieReviews(
      { params: { movieId: '10' }, query: { amigosDe: 'u1' } },
      mockRes(),
    );

    expect(Review.find.mock.calls[0][0].userId.$in).toHaveLength(1);
  });
});

describe('getMovieReviews por autor y errores', () => {
  test('filtra por autor', async () => {
    Review.find.mockReturnValue(mockCadena([]));
    Review.countDocuments.mockResolvedValue(0);
    const query = { autor: '64b7f0c2a1b2c3d4e5f60718' };

    await controller.getMovieReviews({ params: { movieId: '10' }, query }, mockRes());

    expect(Review.find.mock.calls[0][0].userId).toBeDefined();
  });

  test('responde 500 si algo falla', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Review.find.mockImplementation(() => {
      throw new Error('x');
    });
    const res = mockRes();

    await controller.getMovieReviews({ params: { movieId: '10' }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
