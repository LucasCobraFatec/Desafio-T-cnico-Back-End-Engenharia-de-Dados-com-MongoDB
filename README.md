# 🛒 Marketplace MongoDB — Modelagem, Agregações, Performance (ESR) e Transações ACID

Sistema de marketplace desenvolvido com **Node.js**, **Express** e **MongoDB** (utilizando **Mongoose** para a API principal e o **MongoDB Native Driver** para geração de massa de dados, *pipelines* analíticos, otimização de índices e transações ACID em Replica Set local `rs0`).

---

## 🛠️ Stack Tecnológica e Estrutura do Projeto

* **Runtime & API:** Node.js & Express
* **Banco de Dados:** MongoDB (Instância local configurada como Replica Set `rs0` em `C:\data\db`)
* **Camada de Dados:** Mongoose e MongoDB Native Driver (`client.startSession()` + `session.withTransaction()`)
* **Ferramentas Auxiliares:** Dotenv & Nodemon

### Estrutura de Diretórios

```text
├── seed/
│   ├── package.json
│   └── seed.js
├── .env
├── checkout.js
├── package.json
├── server.js
└── README.md
```

---

## 🚀 Como Executar Localmente

### 1. Subir o MongoDB com Replica Set (`rs0`)

Para executar transações multi-documento (ACID), o MongoDB local deve estar rodando como **Replica Set**:

```powershell
# 1. Criar diretório de dados (caso ainda não exista)
New-Item -ItemType Directory -Path "C:\data\db" -Force

# 2. Iniciar o servidor MongoDB com Replica Set rs0
mongod --replSet rs0 --dbpath "C:\data\db"
```

Em outro terminal, conecte via `mongosh` e inicialize o Replica Set:

```javascript
mongosh "mongodb://localhost:27017"

rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
});
```

### 2. Configurar e Iniciar a API Principal

Na raiz do projeto, instale as dependências e crie o arquivo `.env`:

```powershell
npm install
```

Conteúdo do `.env`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/marketplace?replicaSet=rs0
```

Inicie o servidor:

```powershell
npm run dev
```

### 3. Popular o Banco com Carga de Dados em Massa (`seed.js`)

O script de *seeding* limpa o banco `marketplace` e insere um volume realista para testes de agregação, performance e transações:
* **Produtos (`products`):** `1.000` documentos
* **Usuários (`users`):** `5.000` documentos (com saldo em carteira `walletBalance`)
* **Pedidos (`orders`):** `100.000` documentos (inseridos em lotes de `10.000`)

```powershell
cd seed
npm install
node seed.js
```

---

## 🧩 1. Modelagem e Evolução de Schema (*Embedding* vs. *Referencing*)

### 1.1. Avaliações de Produtos (`reviews`)
Para suportar dezenas de milhares de avaliações em produtos populares sem atingir o limite de **16 MB** por documento e mantendo a leitura da vitrine instantânea, foi adotado o padrão híbrido **Subset Pattern + Computed Pattern**:

* **Embedding (`products`):** Embute indicadores pré-calculados (`ratingSummary.averageRating` e `ratingSummary.totalReviews`) e um subconjunto restrito às **10 avaliações mais recentes** (`recentReviews`), limitadas na escrita com `$slice: -10`.
* **Referencing (`reviews`):** Coleção dedicada para armazenar o histórico completo e ilimitado de avaliações, referenciando `productId` e `userId`.

#### Exemplo JSON — Coleção `products`
```json
{
  "_id": ObjectId("6b036975f9052fe402081b3c"),
  "sku": "SKU-00001",
  "name": "Produto Exemplo 1",
  "category": "Esportes",
  "price": 96.9,
  "stock": 120,
  "sellerId": "SELLER-12",
  "active": true,
  "ratingSummary": {
    "averageRating": 4.8,
    "totalReviews": 15420
  },
  "recentReviews": [
    {
      "reviewId": ObjectId("6b036999f9052fe402081a01"),
      "authorName": "Cliente 42",
      "rating": 5,
      "comment": "Excelente qualidade e entrega rápida!",
      "createdAt": ISODate("2026-11-22T14:30:00Z")
    }
  ]
}
```

#### Exemplo JSON — Coleção `reviews`
```json
{
  "_id": ObjectId("6b036999f9052fe402081a01"),
  "productId": ObjectId("6b036975f9052fe402081b3c"),
  "userId": ObjectId("6b036975f9052fe402081f24"),
  "authorName": "Cliente 42",
  "rating": 5,
  "comment": "Excelente qualidade e entrega rápida!",
  "createdAt": ISODate("2026-11-22T14:30:00Z")
}
```

### 1.2. Logs de Auditoria de Pedidos (`statusHistory`)
Para registrar as transições de estado do pedido (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`), utilizamos **Embedding** com o array limitado (`statusHistory`) dentro do próprio documento de `orders`:

* **Bounded Array:** Um pedido possui poucas mudanças de estado ao longo de seu ciclo de vida.
* **Coesão e Leitura Atômica:** A trilha de auditoria é recuperada na mesma consulta do pedido, dispensando `$lookup`.

#### Exemplo JSON — Coleção `orders`
```json
{
  "_id": ObjectId("6b03698fcbc74fec5c52a5d8"),
  "userId": ObjectId("6b036975f9052fe402081f24"),
  "shippingCity": "Recife",
  "status": "DELIVERED",
  "items": [
    {
      "productId": ObjectId("6b036975f9052fe402081b3c"),
      "sku": "SKU-00001",
      "category": "Esportes",
      "unitPrice": 96.9,
      "quantity": 1
    }
  ],
  "totalAmount": 96.9,
  "createdAt": ISODate("2026-11-22T22:15:43.047Z"),
  "statusHistory": [
    {
      "status": "PENDING",
      "changedAt": ISODate("2026-11-22T22:15:40.000Z"),
      "changedBy": ObjectId("6b036975f9052fe402081f24")
    },
    {
      "status": "PAID",
      "changedAt": ISODate("2026-11-22T22:15:43.047Z"),
      "changedBy": ObjectId("6b036975f9052fe402081f24")
    },
    {
      "status": "SHIPPED",
      "changedAt": ISODate("2026-11-23T09:10:00.000Z"),
      "changedBy": ObjectId("6b036975f9052fe402081001")
    },
    {
      "status": "DELIVERED",
      "changedAt": ISODate("2026-11-25T16:40:00.000Z"),
      "changedBy": ObjectId("6b036975f9052fe402081002")
    }
  ]
}
```

---

## 📈 2. Aggregation Framework

### 2.1. Relatório de Faturamento por Categoria (Últimos 90 Dias)
Filtra pedidos pagos/enviados/entregues nos últimos 90 dias (`$match`), desmembra `items` (`$unwind`), agrupa por categoria (`$group`) somando faturamento (`quantity * unitPrice`) e volume de itens, ordenando do maior para o menor (`$sort`):

```javascript
const dataLimite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

db.orders.aggregate([
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
]);
```

### 2.2. Ranking de Clientes VIP em "São Paulo" (Paginado com `$facet`)
Cruza `orders` com `users` (`$lookup`), filtra residentes de `"São Paulo"` (`$match`), agrega total gasto e quantidade de pedidos (`$group`), ordena pelo maior gasto (`$sort`) e utiliza `$facet` para retornar o Top 10 e a contagem total de clientes elegíveis na mesma execução:

```javascript
db.orders.aggregate([
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
]);
```

---

## ⚡ 3. Diagnóstico e Otimização de Performance (Regra ESR)

### Consulta Avaliada
```javascript
db.orders.find({
  shippingCity: "São Paulo",
  status: "DELIVERED",
  createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
}).sort({ createdAt: -1 }).explain("executionStats");
```

### Índice Composto Criado (Regra ESR: *Equality*, *Sort*, *Range*)
* **Equality:** `shippingCity` e `status`
* **Sort:** `createdAt: -1`
* **Range:** `createdAt: { $gte: ... }`

```javascript
db.orders.createIndex({
  shippingCity: 1,
  status: 1,
  createdAt: -1
});
```

### Comparativo de Execução (`.explain("executionStats")`)

| Métrica | Antes do Índice | Depois do Índice (`ESR`) | Ganho / Impacto |
| :--- | :--- | :--- | :--- |
| **Estágio Principal (`stage`)** | `SORT` + `COLLSCAN` | `FETCH` + `IXSCAN` | Eliminou varredura completa e ordenação em memória |
| **Tempo (`executionTimeMillis`)** | `297 ms` | `53 ms` | Redução de `244 ms` (~82% mais rápido) |
| **Chaves Examinadas (`totalKeysExamined`)** | `0` | `462` | Busca indexada direta (`shippingCity_1_status_1_createdAt_-1`) |
| **Documentos Examinados (`totalDocsExamined`)** | `100.000` | `462` | Redução de `99.538` documentos lidos (-99,54% I/O) |
| **Documentos Retornados (`nReturned`)** | `462` | `462` | Resultado idêntico com mínima leitura em disco |

---

## 🔒 4. Consistência e Transações ACID (`checkout.js`)

O fluxo transacional de compra (`criarPedidoTransacional`) utiliza sessões e transações multi-documento (`client.startSession()` + `session.withTransaction(...)`) no Replica Set `rs0`:

```powershell
node checkout.js
```

### Etapas Atômicas da Transação
1. **Validação de Estoque:** Verifica em `products` se o item existe e possui `stock >= quantity`.
2. **Validação de Saldo:** Calcula `totalAmount = product.price * quantity` e verifica em `users` se `walletBalance >= totalAmount`.
3. **Débito de Estoque (`$inc`):** Decrementa `stock` em `-quantity` com filtro condicional (`stock: { $gte: quantity }`) dentro da `session`.
4. **Débito de Carteira (`$inc`):** Decrementa `walletBalance` em `-totalAmount` com filtro condicional (`walletBalance: { $gte: totalAmount }`) dentro da `session`.
5. **Criação do Pedido:** Insere o documento na coleção `orders` com `status: "PAID"` dentro da `session`.
6. **Garantia de Rollback (`abortTransaction`):** Caso qualquer validação falhe ou ocorra erro de concorrência, a transação é abortada automaticamente, revertendo qualquer alteração parcial.

---

## 🧪 Exemplos de Endpoints CRUD da API

### Criar Usuário (`POST /usuarios`)
```json
{
  "nome": "João Silva",
  "tipo": "vendedor"
}
```

### Criar Produto (`POST /produtos`)
```json
{
  "vendedorId": "ID_DO_VENDEDOR",
  "nome": "Teclado Mecânico",
  "preco": 350.00,
  "estoque": 20
}
```

### Listar Produtos (`GET /produtos`)
Retorna a lista de produtos com os dados do vendedor populados via `.populate()`.

### Criar Pedido (`POST /pedidos`)
```json
{
  "compradorId": "ID_DO_COMPRADOR",
  "produtoId": "ID_DO_PRODUTO",
  "quantidade": 2
}
```
