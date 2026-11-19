# Marketplace API — Persistência com Node.js, Express e MongoDB

Este projeto apresenta a evolução de uma API de marketplace construída em **Node.js** e **Express**, migrando o armazenamento temporário em memória para persistência real em banco de dados NoSQL (**MongoDB / MongoDB Atlas**) com **Mongoose** e gerenciamento seguro de credenciais via **Dotenv**.

---

## 🚀 Tecnologias Utilizadas

* **Node.js**: Ambiente de execução JavaScript no lado do servidor.
* **Express**: Framework web para criação das rotas e middlewares da API REST.
* **MongoDB / MongoDB Atlas**: Banco de dados NoSQL orientado a documentos (local ou em nuvem).
* **Mongoose**: ODM (Object Data Modeling) para definição de Schemas, validações e relacionamentos (`ObjectId` + `populate`).
* **Dotenv**: Carregamento de variáveis de ambiente a partir de um arquivo `.env`.
* **Nodemon**: Reinicialização automática do servidor durante o desenvolvimento.

---

## 📂 Estrutura do Projeto

```text
marketplace-mongo/
├── .env             # Variáveis de ambiente (string de conexão MONGO_URI)
├── package.json     # Dependências e scripts de execução
└── server.js        # Conexão com MongoDB, Schemas, Models e rotas da API
```

> **Nota:** Certifique-se de adicionar `.env` e `node_modules/` ao seu `.gitignore` para não expor credenciais de acesso ao banco no repositório.

---

## 🛠️ Instalação e Configuração

### 1. Instalar as dependências

No terminal, dentro da pasta do projeto, instale os pacotes necessários:

```bash
npm init -y
npm install express mongoose dotenv
npm install -D nodemon
```

### 2. Configurar o arquivo `.env`

Na raiz do projeto, crie um arquivo chamado `.env` e defina a variável `MONGO_URI` apontando para o seu MongoDB local ou cluster do MongoDB Atlas:

```env
# Exemplo para MongoDB Atlas (com o nome do banco 'marketplace' definido na URI)
MONGO_URI=mongodb+srv://<usuario>:<senha>@cluster0.xxxxx.mongodb.net/marketplace?retryWrites=true&w=majority

# Ou para MongoDB local:
# MONGO_URI=mongodb://localhost:27017/marketplace
```

> **Dica:** Caso o nome do banco (`/marketplace`) não seja informado após `.mongodb.net/`, o MongoDB utilizará o banco padrão `test`.

### 3. Configurar o script no `package.json`

Garanta que o script `dev` execute o arquivo principal do servidor:

```json
"scripts": {
  "dev": "nodemon server.js"
}
```

### 4. Iniciar o servidor

```bash
npm run dev
```

Se tudo estiver configurado corretamente, o terminal exibirá:
`Conectado ao MongoDB com sucesso!`
`Marketplace rodando em http://localhost:3000`

---

## 🧱 Modelagem de Dados (Schemas)

* **Usuario (`UsuarioSchema`)**:
  * `nome` (`String`, obrigatório)
  * `tipo` (`String`, obrigatório, valores permitidos: `'vendedor'` ou `'comprador'`)
* **Produto (`ProdutoSchema`)**:
  * `vendedorId` (`ObjectId`, referência para `'Usuario'`, obrigatório)
  * `nome` (`String`, obrigatório)
  * `preco` (`Number`, obrigatório)
  * `estoque` (`Number`, obrigatório)
* **Pedido (`PedidoSchema`)**:
  * `compradorId` (`ObjectId`, referência para `'Usuario'`, obrigatório)
  * `produtoId` (`ObjectId`, referência para `'Produto'`, obrigatório)
  * `quantidade` (`Number`, obrigatório)
  * `valorTotal` (`Number`, obrigatório)
  * `data` (`Date`, padrão `Date.now`)

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/usuarios` | Cadastra um novo usuário (`vendedor` ou `comprador`). |
| `POST` | `/produtos` | Anuncia um novo produto (valida se o `vendedorId` pertence a um `vendedor`). |
| `GET` | `/produtos` | Lista produtos com `estoque > 0` e traz o nome do vendedor via `.populate('vendedorId', 'nome')`. |
| `POST` | `/pedidos` | Realiza uma compra (valida comprador e estoque, atualiza o estoque no banco e registra o pedido). |

---

## 🧪 Fluxo de Testes (Thunder Client / Postman)

Siga a ordem abaixo para testar o ciclo completo e validar a persistência no **MongoDB Atlas** (*Data Explorer → Collections*):

### 1. Cadastrar Vendedor (`POST http://localhost:3000/usuarios`)
```json
{
  "nome": "Loja do Cobra",
  "tipo": "vendedor"
}
```
*(Guarde o `_id` retornado)*

### 2. Cadastrar Comprador (`POST http://localhost:3000/usuarios`)
```json
{
  "nome": "Ana Compradora",
  "tipo": "comprador"
}
```
*(Guarde o `_id` retornado)*

### 3. Anunciar Produto (`POST http://localhost:3000/produtos`)
```json
{
  "vendedorId": "ID_DO_VENDEDOR_AQUI",
  "nome": "Teclado Mecânico",
  "preco": 250.00,
  "estoque": 5
}
```
*(Guarde o `_id` do produto retornado)*

### 4. Listar Vitrine (`GET http://localhost:3000/produtos`)
Retorna os produtos com estoque disponível e o campo `vendedorId` populado com `_id` e `nome`.

### 5. Realizar Compra (`POST http://localhost:3000/pedidos`)
```json
{
  "compradorId": "ID_DO_COMPRADOR_AQUI",
  "produtoId": "ID_DO_PRODUTO_AQUI",
  "quantidade": 2
}
```
*(Ao consultar `GET /produtos` novamente ou inspecionar a coleção `produtos` no Atlas, o estoque estará atualizado para `3`.)*