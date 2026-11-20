const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmageo_db';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connecté avec succès'))
  .catch((err) => {
    console.error('Erreur de connexion MongoDB :', err.message);
    process.exit(1);
  });

module.exports = mongoose;