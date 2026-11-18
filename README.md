# Marketplace API - Refatoração para MongoDB & Mongoose

Este repositório contém a evolução de um sistema de marketplace monolítico construído em **Node.js** e **Express**. O objetivo principal da atividade foi migrar o armazenamento de dados que antes utilizava **arrays em memória** para um banco de dados NoSQL (**MongoDB**), utilizando a biblioteca **Mongoose** para modelagem, validação e relacionamentos.

---

## 🚀 Tecnologias Utilizadas

- **Node.js**: Ambiente de execução JavaScript no servidor.
- **Express**: Framework web minimalista para Node.js.
- **MongoDB**: Banco de dados NoSQL orientado a documentos.
- **Mongoose**: ODM (Object Data Modeling) para modelar os dados e gerenciar as relações no MongoDB.
- **Nodemon**: Ferramenta de desenvolvimento para reiniciar automaticamente o servidor a cada alteração de código.

---

## 📂 Estrutura do Projeto

O projeto foi organizado de forma modular, separando os modelos de dados da lógica das rotas do servidor:

```text
marketplace-mongo/
├── models/
│   ├── Usuario.js   # Schema e Model para Usuários (Compradores e Vendedores)
│   ├── Produto.js   # Schema e Model para Produtos (Com referência ao Vendedor)
│   └── Pedido.js    # Schema e Model para Pedidos (Com referências e valor total)
├── package.json     # Configuração de dependências e scripts
└── server.js        # Arquivo principal com a conexão e rotas da API
```

---

## 🛠️ Passo a Passo da Implementação

### 1. Instalação e Configuração
No terminal, inicializamos o projeto e instalamos as dependências necessárias:
```bash
npm init -y
npm install express mongoose
npm install -D nodemon
```

### 2. Modelagem dos Dados (Mongoose Schemas)
Criamos os schemas para estruturar os documentos no MongoDB:
* **Usuário (`models/Usuario.js`)**: Define `nome` (String) e `tipo` (enum: `comprador` ou `vendedor`).
* **Produto (`models/Produto.js`)**: Define `nome`, `preco`, `estoque` e o `vendedorId` referenciando o modelo de `Usuario` (`ObjectId`).
* **Pedido (`models/Pedido.js`)**: Registra a compra vinculando o `compradorId`, `produtoId`, a `quantidade`, o `valorTotal` e a `data` padrão (`Date.now`).

### 3. Conexão com o Banco e Rotas (`server.js`)
O servidor conecta-se localmente ao MongoDB e disponibiliza as rotas refatoradas:
* `POST /usuarios`: Cadastra um usuário.
* `POST /produtos`: Valida se o usuário é um vendedor antes de cadastrar o produto.
* `GET /produtos`: Lista a vitrine filtrando apenas produtos com estoque disponível (`$gt: 0`).
* `POST /pedidos`: Valida o comprador, confere o estoque, decrementa o estoque do produto utilizando `.save()`, calcula o total e cria o pedido.

---

## 🕹️ Como Executar o Projeto

1. Certifique-se de que o seu **MongoDB** local está rodando.
2. Inicie o servidor em modo de desenvolvimento com o comando:
   ```bash
   npm run dev
   ```
3. O servidor estará rodando em: `http://localhost:3000`

---

## 🧪 Testando as Rotas (Exemplo no Thunder Client / Postman)

Para testar o fluxo completo do marketplace, siga esta ordem:

1. **Cadastrar Vendedor** (`POST /usuarios`)
   ```json
   {
     "nome": "Carlos Vendedor",
     "tipo": "vendedor"
   }
   ```
   *(Copie o `_id` retornado)*

2. **Cadastrar Comprador** (`POST /usuarios`)
   ```json
   {
     "nome": "Ana Compradora",
     "tipo": "comprador"
   }
   ```
   *(Copie o `_id` retornado)*

3. **Anunciar Produto** (`POST /produtos`)
   *(Cole o `_id` do vendedor no campo `vendedorId`)*
   ```json
   {
     "vendedorId": "ID_DO_VENDEDOR_AQUI",
     "nome": "Mouse Gamer",
     "preco": 150.00,
     "estoque": 10
   }
   ```
   *(Copie o `_id` do produto retornado)*

4. **Listar Vitrine** (`GET /produtos`)
   *Retorna todos os produtos disponíveis (`estoque > 0`).*

5. **Realizar Pedido** (`POST /pedidos`)
   *(Cole os IDs correspondentes do comprador e do produto)*
   ```json
   {
     "compradorId": "ID_DO_COMPRADOR_AQUI",
     "produtoId": "ID_DO_PRODUTO_AQUI",
     "quantidade": 2
   }
   ```