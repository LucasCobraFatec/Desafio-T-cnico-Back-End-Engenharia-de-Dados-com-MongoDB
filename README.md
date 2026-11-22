🛒 Marketplace API & Performance Lab

API RESTful e laboratório de banco de dados de um sistema de marketplace desenvolvido com Node.js, Express e MongoDB (utilizando Mongoose para modelagem da aplicação principal e o driver nativo do MongoDB para geração de carga em massa, agregações, otimização de índices e transações ACID).

📋 Funcionalidades Implementadas

Usuários (POST /usuarios): Cadastro de compradores e vendedores com validação de papéis (comprador | vendedor).

Produtos (POST /produtos e GET /produtos): Criação de produtos vinculados a vendedores e listagem com relacionamento populado (.populate()).

Pedidos (POST /pedidos): Criação de pedidos com validação de existência de comprador/produto, checagem de estoque e baixa automática no inventário.

Carga de Dados em Massa (seed/seed.js): Script de seeding local para popular o banco marketplace com grandes volumes de documentos (products, users e orders).

Relatórios Analíticos (GET /relatorios/...): Pipelines do Aggregation Framework executados diretamente no MongoDB para faturamento por categoria e ranking paginado de clientes VIP ($facet).

Checkout Transacional ACID (checkout.js): Operação atômica multi-documento (client.startSession() + session.withTransaction()) em Replica Set (rs0) validando estoque e saldo em carteira, debitando valores com $inc e garantindo rollback (abortTransaction) em caso de falha.

Modelagem e Otimização (SOLUCAO.md): Evolução de schema (evitando Unbounded Arrays e o limite de 16 MB) e diagnóstico de performance com índices compostos (Regra ESR).

🛠️ Tecnologias Utilizadas

Node.js & Express

MongoDB (Instância Local configurada como Replica Set rs0)

Mongoose (ODM da API principal)

MongoDB Native Driver (Script de Seed em lote, pipelines analíticos e transações ACID)

Dotenv & Nodemon

📂 Estrutura do Projeto

├── seed/
│   ├── package.json
│   └── seed.js
├── .env
├── checkout.js
├── package.json
├── server.js
├── README.md
└── SOLUCAO.md


🚀 Como Executar o Projeto

1. Pré-requisitos e Replica Set Local (rs0)

Para executar transações multi-documento (ACID), o MongoDB local deve rodar em modo Replica Set:

# 1. Criar diretório de dados (caso não exista)
New-Item -ItemType Directory -Path "C:\data\db" -Force

# 2. Iniciar o servidor MongoDB com Replica Set rs0
mongod --replSet rs0 --dbpath "C:\data\db"


Em outro terminal, inicialize o Replica Set via mongosh:

mongosh "mongodb://localhost:27017"
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
});


2. Configuração da API Principal

Na raiz do projeto, instale as dependências e configure o arquivo .env:

npm install


Crie um arquivo .env na raiz com as seguintes variáveis:

PORT=3000
MONGO_URI=mongodb://localhost:27017/marketplace?replicaSet=rs0


Inicie o servidor:

npm run dev


📊 Carga de Dados em Massa (Seed)

Para simular um ambiente de alto volume e avaliar consultas, agregações e transações, utilize o script isolado na pasta seed/:

Produtos (products): 1.000 documentos

Usuários (users): 5.000 documentos (com saldo em carteira walletBalance)

Pedidos (orders): 100.000 documentos (inseridos em lotes de 10.000)

cd seed
npm init -y && npm install mongodb
node seed.js


Nota: A execução do seed.js limpa o banco marketplace antes de inserir os novos registros.

📈 Relatórios com Aggregation Framework

1. Faturamento por Categoria (Últimos 90 Dias)

GET /relatorios/faturamento-categoria

Filtra pedidos com status PAID, SHIPPED ou DELIVERED realizados nos últimos 90 dias ($match), desmembra items ($unwind), agrupa por categoria ($group) somando faturamento e quantidade vendida, e ordena de forma decrescente ($sort).

2. Ranking de Clientes VIP em São Paulo (Paginado)

GET /relatorios/clientes-vip-sp

Cruza orders com users ($lookup), filtra clientes da cidade de "São Paulo" ($match), agrega total gasto e quantidade de pedidos ($group), e usa $facet para retornar simultaneamente o Top 10 clientes e a contagem total de clientes elegíveis.

⚡ Resumo de Otimização de Performance (Regra ESR)

Para eliminar a lentidão na busca de pedidos por cidade, status e data de criação (db.orders.find({ shippingCity: "São Paulo", status: "DELIVERED", createdAt: { $gte: ... } }).sort({ createdAt: -1 })), foi criado o índice composto seguindo a regra ESR (Equality, Sort, Range):

db.orders.createIndex({ shippingCity: 1, status: 1, createdAt: -1 });


Métrica

Antes (COLLSCAN)

Depois (IXSCAN + FETCH)

Melhoria

Tempo (executionTimeMillis)

297 ms

53 ms

~82% mais rápido

Documentos Examinados

100.000

462

-99,54% leituras

Chaves Examinadas

0

462

Busca indexada direta

🔒 Consistência e Transações ACID (checkout.js)

O script checkout.js executa o fluxo atômico de compra (criarPedidoTransacional) garantindo que estoque, saldo em carteira e registro de pedido sejam atualizados em conjunto ou revertidos via abortTransaction:

node checkout.js


Valida disponibilidade de estoque (stock >= quantity) em products.

Valida saldo suficiente (walletBalance >= price * quantity) em users.

Debita o estoque ($inc: { stock: -quantity }) e o saldo ($inc: { walletBalance: -totalAmount }).

Registra o novo pedido na coleção orders com status: "PAID".

Os detalhes completos de modelagem, pipelines, planos de execução (.explain("executionStats")) e transações ACID estão documentados em SOLUCAO.md.

🧪 Exemplos de Endpoints CRUD

Criar Usuário (POST /usuarios)

{
  "nome": "João Silva",
  "tipo": "vendedor"
}


Criar Produto (POST /produtos)

{
  "vendedorId": "ID_DO_VENDEDOR",
  "nome": "Teclado Mecânico",
  "preco": 350.00,
  "estoque": 20
}


Listar Produtos (GET /produtos)

Criar Pedido (POST /pedidos)

{
  "compradorId": "ID_DO_COMPRADOR",
  "produtoId": "ID_DO_PRODUTO",
  "quantidade": 2
}
