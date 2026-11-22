require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado ao MongoDB com sucesso!'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// --- MODELOS (SCHEMAS) ---

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: { type: String, enum: ['vendedor', 'comprador'], required: true }
});
const Usuario = mongoose.model('Usuario', UsuarioSchema);

const ProdutoSchema = new mongoose.Schema({
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  estoque: { type: Number, required: true }
});
const Produto = mongoose.model('Produto', ProdutoSchema);

const PedidoSchema = new mongoose.Schema({
  compradorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
  quantidade: { type: Number, required: true },
  valorTotal: { type: Number, required: true },
  data: { type: Date, default: Date.now }
});
const Pedido = mongoose.model('Pedido', PedidoSchema);

// --- ROTAS ---

// 1. Cadastrar Usuário
app.post('/usuarios', async (req, res) => {
  try {
    const { nome, tipo } = req.body;
    const novoUsuario = await Usuario.create({ nome, tipo });
    res.status(201).json(novoUsuario);
  } catch (error) {
    res.status(400).json({ erro: 'Dados inválidos para cadastro.', detalhes: error.message });
  }
});

// 2. Anunciar Produto (Apenas Vendedores)
app.post('/produtos', async (req, res) => {
  try {
    const { vendedorId, nome, preco, estoque } = req.body;
    const vendedor = await Usuario.findOne({ _id: vendedorId, tipo: 'vendedor' });

    if (!vendedor) {
      return res.status(403).json({ erro: 'Vendedor não encontrado ou sem permissão.' });
    }

    const novoProduto = await Produto.create({ vendedorId, nome, preco, estoque });
    res.status(201).json(novoProduto);
  } catch (error) {
    res.status(400).json({ erro: 'Erro ao cadastrar produto.', detalhes: error.message });
  }
});

// 3. Listar Vitrine (Trazendo dados do vendedor com populate)
app.get('/produtos', async (req, res) => {
  try {
    const disponiveis = await Produto.find({ estoque: { $gt: 0 } })
      .populate('vendedorId', 'nome'); // Mostra o nome da loja em vez de apenas o ID
    res.json(disponiveis);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});


// 4. Realizar Compra (Apenas Compradores)
app.post('/pedidos', async (req, res) => {
  try {
    const { compradorId, produtoId, quantidade } = req.body;

    const comprador = await Usuario.findOne({ _id: compradorId, tipo: 'comprador' });
    if (!comprador) {
      return res.status(403).json({ erro: 'Comprador inválido.' });
    }

    const produto = await Produto.findById(produtoId);
    if (!produto || produto.estoque < quantidade) {
      return res.status(400).json({ erro: 'Produto indisponível ou estoque insuficiente.' });
    }

    // Atualiza o estoque no banco
    produto.estoque -= quantidade;
    await produto.save();

    const valorTotal = produto.preco * quantidade;
    const novoPedido = await Pedido.create({
      compradorId,
      produtoId,
      quantidade,
      valorTotal
    });







    res.status(201).json(novoPedido);
  } catch (error) {
    res.status(400).json({ erro: 'Erro ao processar pedido.', detalhes: error.message });
  }
});

// 1. Faturamento por categoria (últimos 90 dias, PAID, SHIPPED ou DELIVERED)
app.get("/relatorios/faturamento-categoria", async (req, res) => {
  try {
    const dataLimite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const resultado = await mongoose.connection.db.collection("orders").aggregate([
      {
        $match: {
          status: { $in: ["PAID", "SHIPPED", "DELIVERED"] },
          createdAt: { $gte: dataLimite }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          faturamentoTotal: {
            $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] }
          },
          quantidadeItensVendidos: { $sum: "$items.quantity" }
        }
      },
      { $sort: { faturamentoTotal: -1 } }
    ]).toArray();

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 2. Ranking de clientes VIP em São Paulo (paginado com $facet)
app.get("/relatorios/clientes-vip-sp", async (req, res) => {
  try {
    const resultado = await mongoose.connection.db.collection("orders").aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "usuario"
        }
      },
      { $unwind: "$usuario" },
      { $match: { "usuario.city": "São Paulo" } },
      {
        $group: {
          _id: "$usuario._id",
          nome: { $first: "$usuario.name" },
          email: { $first: "$usuario.email" },
          totalGasto: { $sum: "$totalAmount" },
          quantidadePedidos: { $sum: 1 }
        }
      },
      { $sort: { totalGasto: -1 } },
      {
        $facet: {
          rankingTop10: [{ $limit: 10 }],
          totalClientesElegiveis: [{ $count: "total" }]
        }
      }
    ]).toArray();

    res.json(resultado[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});



app.listen(3000, () => {
  console.log('Marketplace rodando em http://localhost:3000');
});
