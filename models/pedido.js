const mongoose = require('mongoose');

const pedidoSchema = new mongoose.Schema({
    compradorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
    quantidade: { type: Number, required: true },
    valorTotal: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', pedidoSchema);
