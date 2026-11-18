const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: { type: String, enum: ['comprador', 'vendedor'], required: true }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
