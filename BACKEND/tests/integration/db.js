const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

async function conectar() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

async function limpiar() {
  const colecciones = mongoose.connection.collections;
  for (const nombre of Object.keys(colecciones)) {
    await colecciones[nombre].deleteMany({});
  }
}

async function desconectar() {
  await mongoose.disconnect();
  await mongo.stop();
}

module.exports = { conectar, limpiar, desconectar };
