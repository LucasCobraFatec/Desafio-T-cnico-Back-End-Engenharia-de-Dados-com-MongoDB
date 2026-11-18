const mongoose = require('mongoose');

const produtoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  estoque: { type: Number, required: true },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
});

module.exports = mongoose.model('Produto', produtoSchema);