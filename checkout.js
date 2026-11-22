const { MongoClient, ObjectId } = require('mongodb');

const URI = 'mongodb://localhost:27017/?replicaSet=rs0';
const DB_NAME = 'marketplace';

async function criarPedidoTransacional(client, { userId, productId, quantity }) {
  const session = client.startSession();

  try {
    let pedidoCriado = null;

    await session.withTransaction(async () => {
      const db = client.db(DB_NAME);
      const productsCol = db.collection('products');
      const usersCol = db.collection('users');
      const ordersCol = db.collection('orders');

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Quantidade inválida.');
      }

      const prodObjectId = new ObjectId(productId);
      const userObjectId = new ObjectId(userId);

      // 1. Verificar se o produto existe e possui stock >= quantity
      const product = await productsCol.findOne(
        { _id: prodObjectId },
        { session }
      );
      if (!product) {
        throw new Error('Produto não encontrado.');
      }
      if (product.stock < quantity) {
        throw new Error('Estoque insuficiente para o produto.');
      }

      // 2. Verificar se o usuário existe e possui walletBalance >= (price * quantity)
      const totalAmount = Number((product.price * quantity).toFixed(2));
      const user = await usersCol.findOne(
        { _id: userObjectId },
        { session }
      );
      if (!user) {
        throw new Error('Usuário não encontrado.');
      }
      if (user.walletBalance < totalAmount) {
        throw new Error('Saldo da carteira insuficiente.');
      }

      // 3. Debitar o estoque do produto ($inc) com trava condicional
      const stockUpdate = await productsCol.updateOne(
        { _id: prodObjectId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { session }
      );
      if (stockUpdate.modifiedCount === 0) {
        throw new Error('Falha ao debitar estoque (concorrência ou saldo insuficiente).');
      }

      // 4. Debitar o saldo da carteira do usuário ($inc) com trava condicional
      const walletUpdate = await usersCol.updateOne(
        { _id: userObjectId, walletBalance: { $gte: totalAmount } },
        { $inc: { walletBalance: -totalAmount } },
        { session }
      );
      if (walletUpdate.modifiedCount === 0) {
        throw new Error('Falha ao debitar saldo da carteira.');
      }

      // 5. Inserir o novo documento na coleção orders com status "PAID"
      const novoPedido = {
        userId: userObjectId,
        shippingCity: user.city,
        status: 'PAID',
        items: [
          {
            productId: product._id,
            sku: product.sku,
            category: product.category,
            unitPrice: product.price,
            quantity
          }
        ],
        totalAmount,
        createdAt: new Date()
      };

      const insertResult = await ordersCol.insertOne(novoPedido, { session });
      pedidoCriado = { _id: insertResult.insertedId, ...novoPedido };
    });

    return pedidoCriado;
  } catch (error) {
    // withTransaction executa abortTransaction automaticamente ao lançar erro;
    // se usar startTransaction manual, chame: await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

async function testarCheckout() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const sampleUser = await db.collection('users').findOne({});
    const sampleProduct = await db.collection('products').findOne({ stock: { $gte: 1 } });

    const pedido = await criarPedidoTransacional(client, {
      userId: sampleUser._id.toString(),
      productId: sampleProduct._id.toString(),
      quantity: 1
    });

    console.log('Pedido criado com sucesso:', pedido);
  } catch (err) {
    console.error('Transação abortada (rollback aplicado):', err.message);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  testarCheckout();
}

module.exports = { criarPedidoTransacional };