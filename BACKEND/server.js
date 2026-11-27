const mongoose = require('mongoose');
const app = require('./app.js');
const dbConfig = require('./database/config.js');

const PORT = 3000;

// Conexión a MongoDB
mongoose
  .connect(dbConfig.MONGODB_URI)
  .then(() => {
    console.log('Conexión exitosa a MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`Servidor en puerto ${PORT}`);
    });
  })
  .catch((err) => console.error('Error de conexión:', err));
