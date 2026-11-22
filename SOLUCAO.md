# 🧩 Solução: Modelagem, Agregações, Performance e Transações ACID

Este documento apresenta a solução técnica completa para a atividade final do banco de dados **MongoDB (`marketplace`)**, cobrindo:
1. **Modelagem e Evolução de Schema** (Avaliações de Produtos e Logs de Auditoria de Pedidos).
2. **Aggregation Framework** (Relatório de Faturamento por Categoria e Ranking de Clientes VIP em São Paulo).
3. **Diagnóstico e Otimização de Performance** (Análise `.explain("executionStats")` antes e depois do índice composto pela regra **ESR**).
4. **Consistência e Transações ACID** (Checkout atômico com `withTransaction` e rollback).

---

## 1. Modelagem e Evolução de Schema

### 1.1. Avaliações de Produtos (Reviews)
Para suportar dezenas de milhares de avaliações em produtos populares sem ultrapassar o limite de **16 MB** por documento e mantendo a leitura da tela do produto instantânea, aplicamos o padrão híbrido **Subset Pattern + Computed Pattern** (combinando *Embedding* e *Referencing*):

* **Embedding (`products`)**: Embutimos os indicadores pré-calculados (`ratingSummary.averageRating` e `ratingSummary.totalReviews`) e um subconjunto restrito contendo **apenas as 10 avaliações mais recentes** (`recentReviews`), limitadas no momento da escrita com `$slice: -10`.
* **Referencing (`reviews`)**: Mantemos uma coleção dedicada para armazenar o histórico completo e ilimitado de avaliações, referenciando `productId` e `userId`.

#### Modelo JSON — Coleção `products` (Subset + Computed Fields)
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

#### Modelo JSON — Coleção `reviews` (Referencing para histórico completo)
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

### 1.2. Logs de Auditoria de Pedidos
Para registrar o histórico de transições de status do pedido (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`), utilizamos **Embedding** através do array `statusHistory` dentro do próprio documento de `orders`:

* **Bounded Array (Crescimento previsível)**: Um pedido passa por poucas mudanças de estado ao longo do seu ciclo de vida.
* **Coesão e leitura atômica**: Toda a trilha de auditoria acompanha o pedido em uma única consulta, sem necessidade de junções (`$lookup`).

#### Modelo JSON — Coleção `orders` (Histórico de Status embutido)
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

### 1.3. Justificativa Arquitetural
* **Prevenção de Unbounded Arrays (Limite de 16 MB)**: O array `recentReviews` em `products` é estritamente limitado aos últimos 10 itens (`$slice: -10`). O crescimento ilimitado das avaliações fica isolado em documentos individuais na coleção `reviews`. Já `statusHistory` registra apenas o ciclo finito de estados de um único pedido.
* **Leitura Rápida na Tela do Produto**: Uma única busca por `_id` na coleção `products` entrega os dados do produto, a média das notas, o total de avaliações e as 10 avaliações mais recentes, evitando agregações pesadas em tempo real.

---

## 2. Aggregation Framework

### 2.1. Relatório de Faturamento por Categoria (Últimos 90 Dias)
Filtra pedidos com status `PAID`, `SHIPPED` ou `DELIVERED` realizados nos últimos 90 dias (`$match`), desmembra os itens (`$unwind`), agrupa por categoria (`$group`) somando faturamento (`quantity * unitPrice`) e quantidade total vendida, ordenando do maior para o menor faturamento (`$sort`):

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
Cruza `orders` com `users` (`$lookup`), filtra clientes residentes em `"São Paulo"` (`$match`), agrupa por cliente (`$group`) calculando `totalGasto` e `quantidadePedidos`, ordena pelo maior gasto (`$sort`) e utiliza `$facet` para retornar simultaneamente a página Top 10 e a contagem total de clientes elegíveis:

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

## 3. Diagnóstico e Otimização de Performance

### 3.1. Consulta Avaliada
```javascript
db.orders.find({
  shippingCity: "São Paulo",
  status: "DELIVERED",
  createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
}).sort({ createdAt: -1 }).explain("executionStats");
```

### 3.2. Resultados Antes do Índice (`COLLSCAN`)
* **Tempo de execução (`executionTimeMillis`)**: `297` ms
* **Estágio principal (`stage`)**: `SORT` sobre `COLLSCAN` (varredura completa dos 100.000 documentos da coleção seguida de ordenação em memória)
* **Chaves examinadas (`totalKeysExamined`)**: `0`
* **Documentos examinados (`totalDocsExamined`)**: `100000`
* **Documentos retornados (`nReturned`)**: `462`

### 3.3. Criação do Índice Composto (Regra ESR)
Aplicando a regra **ESR** (*Equality*, *Sort*, *Range*):
* **Equality (Igualdade)**: `shippingCity` e `status`
* **Sort (Ordenação)**: `createdAt: -1`
* **Range (Intervalo)**: `createdAt: { $gte: ... }`

```javascript
db.orders.createIndex({
  shippingCity: 1,
  status: 1,
  createdAt: -1
});
```

### 3.4. Resultados Após o Índice (`IXSCAN` + `FETCH`)
* **Tempo de execução (`executionTimeMillis`)**: `53` ms
* **Estágio principal (`stage`)**: `FETCH` com `inputStage: IXSCAN` utilizando `shippingCity_1_status_1_createdAt_-1` (eliminando o estágio separado de `SORT`, pois o índice já entrega os registros na ordem `createdAt: -1`)
* **Chaves examinadas (`totalKeysExamined`)**: `462`
* **Documentos examinados (`totalDocsExamined`)**: `462`
* **Documentos retornados (`nReturned`)**: `462`

### 3.5. Comparativo de Impacto
| Métrica | Antes do Índice | Depois do Índice (`ESR`) | Ganho / Impacto |
| :--- | :--- | :--- | :--- |
| **Estágio de Execução** | `SORT` + `COLLSCAN` | `FETCH` + `IXSCAN` | Eliminou varredura total e ordenação em memória |
| **Tempo (`executionTimeMillis`)** | `297 ms` | `53 ms` | Redução de `244 ms` (~82% mais rápido) |
| **Chaves Examinadas (`totalKeysExamined`)** | `0` | `462` | Busca indexada direta |
| **Documentos Examinados (`totalDocsExamined`)** | `100.000` | `462` | Redução de `99.538` documentos lidos (-99,54% I/O) |
| **Documentos Retornados (`nReturned`)** | `462` | `462` | Resultado idêntico com mínima leitura em disco |

---

## 4. Consistência e Transações ACID

### 4.1. Estratégia Implementada (`checkout.js`)
Para garantir atomicidade, consistência, isolamento e durabilidade no fluxo de checkout (`criarPedidoTransacional`), utilizamos sessões e transações multi-documento (`client.startSession()` + `session.withTransaction(...)`) conectadas ao Replica Set `rs0`:

1. **Validação de Estoque**: Verifica na coleção `products` se o produto existe e possui `stock >= quantity`.
2. **Validação de Saldo**: Calcula `totalAmount = product.price * quantity` e verifica na coleção `users` se o usuário possui `walletBalance >= totalAmount`.
3. **Débito de Estoque (`$inc`)**: Decrementa `stock` em `-quantity` com filtro condicional (`stock: { $gte: quantity }`) dentro da `session`.
4. **Débito de Carteira (`$inc`)**: Decrementa `walletBalance` em `-totalAmount` com filtro condicional (`walletBalance: { $gte: totalAmount }`) dentro da `session`.
5. **Criação do Pedido**: Insere o documento na coleção `orders` com `status: "PAID"` dentro da `session`.

### 4.2. Garantia de Rollback (`abortTransaction`)
Caso qualquer validação falhe (produto inexistente, estoque insuficiente, saldo insuficiente) ou ocorra falha de concorrência durante as atualizações, uma exceção é lançada e a transação é abortada automaticamente (`abortTransaction`), revertendo qualquer débito parcial e mantendo `products.stock`, `users.walletBalance` e `orders` íntegros.