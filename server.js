const express = require('express');
const mongoose = require('mongoose');
const Usuario = require('./models/usuarios');
const Produto = require('./models/produto');
const Pedido = require('./models/Pedido');

const app = express();
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect('mongodb://localhost:27017/marketplace')
  .then(() => console.log('Conectado ao MongoDB!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

app.post('/usuarios', async (req, res) => {
  try {
    const {nome, tipo} = req.body;
    const novoUsuario = await Usuario.create({ nome, tipo });
    res.status(201).json(novoUsuario);
  } catch (err) {
    res.status(400).json({ error: 'Erro ao cadastrar usuário.' , detalhes: err.message});

         }
 });

app.post('/produtos', async (req, res) => {
    try {
        const { nome, preco, estoque, vendedorId } = req.body;
        const vendedor = await Usuario.findById(vendedorId);
        if (!vendedor || vendedor.tipo !== 'vendedor') {
            return res.status(400).json({ error: 'ID do vendedor inválido ou usuário não é um vendedor.' });
        }
        const novoProduto = await Produto.create({ nome, preco, estoque, vendedorId });
        res.status(201).json(novoProduto);
    } catch (err) {
        res.status(400).json({ error: 'Erro ao cadastrar produto.', detalhes: err.message });
    }   
})

app.get('/produtos', async (req, res) => {
    try {
        const produtosDisponiveis = await Produto.find({ estoque: { $gt: 0 } });
        res.json(produtosDisponiveis);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar produtos.', detalhes: err.message });
    }
});


app.post('/pedidos', async (req, res) => {
  try {
    const { compradorId, produtoId, quantidade } = req.body;
    const comprador = await Usuario.findById(compradorId);
    if (!comprador || comprador.tipo !== 'comprador') {
      return res.status(400).json({ error: 'ID do comprador inválido ou usuário não é um comprador.' });
    }
    const produto = await Produto.findById(produtoId);
    if (!produto) {
      return res.status(400).json({ error: 'ID do produto inválido.' });
    }
    if (produto.estoque < quantidade) {
      return res.status(400).json({ error: 'Quantidade solicitada maior que o estoque disponível.' });
    }

    produto.estoque -= quantidade;
  await produto.save();
  const valorTotal = produto.preco * quantidade;
  const novoPedido = await Pedido.create({ compradorId, produtoId, quantidade, valorTotal });
  res.status(201).json(novoPedido);


  } catch (err) {
    res.status(400).json({ error: 'Erro ao criar pedido.', detalhes: err.message });
 
  
   }
});


// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log('Marketplace rodando em http://localhost:3000');
});