const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');

const PORT = 3100;

async function iniciar() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app.listen(PORT, () => {
    console.log(`Servidor de prueba en puerto ${PORT} con base en memoria`);
  });
}

iniciar();
