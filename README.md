<div align="center">

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        ◆   P A Y M E N T   O P E R A T I O N S   ◆           ║
║                                                              ║
║      SISTEMA DE COBRANÇAS E NOTIFICAÇÕES POR WEBHOOK         ║
║              UNIDADE DE DEMONSTRAÇÃO // SIM-01               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

![Status](https://img.shields.io/badge/STATUS-OPERACIONAL-F2A900?style=flat-square&labelColor=14171A)
![Ambiente](https://img.shields.io/badge/AMBIENTE-SIMULA%C3%87%C3%83O-F2A900?style=flat-square&labelColor=14171A)
![Node](https://img.shields.io/badge/NODE.JS-20%2B-8A9199?style=flat-square&labelColor=14171A)
![Express](https://img.shields.io/badge/EXPRESS-5-8A9199?style=flat-square&labelColor=14171A)
![MySQL](https://img.shields.io/badge/MYSQL-8-8A9199?style=flat-square&labelColor=14171A)
![Testes](https://img.shields.io/badge/TESTES-15%20CEN%C3%81RIOS-3FB68B?style=flat-square&labelColor=14171A)

**`CLASSIFICAÇÃO: EDUCACIONAL`** &nbsp;·&nbsp; **`TEATRO DE OPERAÇÕES: LOCALHOST`** &nbsp;·&nbsp; **`MUNIÇÃO REAL: NENHUMA`**

</div>

---

> **⚠ REGRAS DE ENGAJAMENTO**
> Este projeto **não processa pagamentos reais**, não se integra a provedores de pagamento e não gera QR Code PIX pagável. Todas as operações e notificações são **simuladas**.

Aplicação web **educacional** que cria cobranças de demonstração, guarda os dados no MySQL e recebe atualizações de status por webhook.

---

## ▌ÍNDICE TÁTICO

| Cód. | Seção | Conteúdo |
|:---:|---|---|
| `01` | [Briefing da missão](#briefing) | O que o sistema faz |
| `02` | [Arsenal](#arsenal) | Tecnologias |
| `03` | [Inserção](#insercao) | Início rápido |
| `04` | [Preparação do terreno](#preparacao) | Variáveis de ambiente e banco de dados |
| `05` | [Plano de operação](#plano) | Como funciona |
| `06` | [Centro de comando](#comando) | Interface |
| `07` | [Canais de comunicação](#canais) | API |
| `08` | [Campo de treinamento](#treinamento) | Postman ou Insomnia |
| `09` | [Simulações de combate](#simulacoes) | Testes automatizados |
| `10` | [Protocolos de defesa](#defesa) | Segurança |
| `11` | [Contramedidas](#contramedidas) | Solução de problemas |
| `12` | [Planta da base](#planta) | Estrutura de pastas |
| `13` | [Relatório de inteligência](#inteligencia) | Limitações conhecidas |

---

<a id="briefing"></a>

## ▌01 // BRIEFING DA MISSÃO

**Objetivo:** controlar o ciclo de vida de uma cobrança, da criação à confirmação por webhook, sem perder dados e sem processar a mesma notificação duas vezes.

| Objetivo | Descrição |
|---|---|
| `OBJ-1` Persistência | Cria pagamentos de demonstração e os guarda de forma permanente no MySQL |
| `OBJ-2` Reconhecimento | Consulta um pagamento pelo identificador, lista todos e filtra por status |
| `OBJ-3` Comunicação segura | Recebe notificações de webhook autenticadas por token e atualiza o status |
| `OBJ-4` Idempotência | O mesmo evento de webhook nunca é processado duas vezes |
| `OBJ-5` Validação | Valida as entradas e responde com códigos HTTP adequados (`400`, `401`, `404`, `409`) |
| `OBJ-6` Comando | Oferece um painel web para criar, consultar e simular notificações |

**Estados de um pagamento:**

| Status | Significado |
|---|---|
| 🟡 `pending` | Aguardando notificação |
| 🟢 `approved` | Aprovado |
| 🔴 `rejected` | Rejeitado |
| ⚪ `cancelled` | Cancelado |

---

<a id="arsenal"></a>

## ▌02 // ARSENAL

| Equipamento | Função |
|---|---|
| **Node.js 20+** (testado com 24) | Plataforma de execução |
| **Express 5** | Servidor HTTP e rotas |
| **MySQL 8** (driver `mysql2`) | Armazenamento permanente e transações |
| **dotenv** | Carrega as variáveis de ambiente |
| **HTML, CSS e JavaScript puros** | Interface, sem frameworks |
| **`node:test`** | Testes automatizados, sem dependências extras |

---

<a id="insercao"></a>

## ▌03 // INSERÇÃO

**Pré-requisitos:** [Node.js](https://nodejs.org) instalado e [MySQL](https://dev.mysql.com/downloads/) em execução.

**`FASE 1`** — Instalar as dependências:

```bash
npm install
```

**`FASE 2`** — Copiar `.env.example` para `.env` e preencher os valores (veja [Preparação do terreno](#preparacao)).

**`FASE 3`** — Criar o banco e as tabelas:

```bash
npm run db:setup
```

**`FASE 4`** — Iniciar o servidor:

```bash
npm start
```

**`FASE 5`** — Abrir `http://localhost:5000` (ou a porta definida em `PORT`).

---

<a id="preparacao"></a>

## ▌04 // PREPARAÇÃO DO TERRENO

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta do servidor (padrão `5000`) | `5000` |
| `WEBHOOK_TOKEN` | Token secreto exigido no cabeçalho `x-webhook-token` | `meu-token-secreto` |
| `MYSQL_HOST` | Endereço do MySQL | `localhost` |
| `MYSQL_PORT` | Porta do MySQL | `3306` |
| `MYSQL_USER` | Usuário do MySQL | `seu_usuario` |
| `MYSQL_PASSWORD` | Senha do MySQL | `sua_senha` |
| `MYSQL_DATABASE` | Nome do banco da aplicação | `webhook` |
| `MYSQL_DATABASE_TEST` | Banco usado apenas pelos testes | `webhook_test` |

> **⚠ SIGILO:** o arquivo `.env` não deve ser versionado nem compartilhado (ele já está no `.gitignore`).

### Banco de dados

`npm run db:setup` cria o banco definido em `MYSQL_DATABASE` (se não existir) e executa `database.sql`. O comando pode ser repetido sem perder dados. Se preferir fazer manualmente, crie o banco e execute `database.sql` dentro dele pelo MySQL Workbench ou pelo cliente `mysql`.

| Tabela | Colunas |
|---|---|
| `pagamentos` | `id` (UUID, chave primária), `cliente`, `valor`, `status` (`pending`, `approved`, `rejected`, `cancelled`), `criado_em`, `atualizado_em` |
| `eventos_webhook` | `evento_id` (chave primária, impede eventos repetidos), `pagamento_id` (chave estrangeira para `pagamentos`), `status`, `recebido_em` |

---

<a id="plano"></a>

## ▌05 // PLANO DE OPERAÇÃO

```
[ ALFA ]     POST /pagamentos          grava o pagamento com status "pending"
    │
    ▼
[ BRAVO ]    POST /webhook/pagamento   confere o token e valida o corpo
    │
    ▼
[ CHARLIE ]  Transação no MySQL        registra o evento e atualiza o status
    │
    ▼
[ DELTA ]    GET /pagamentos/:id       devolve o pagamento com o novo status
```

**◆ Idempotência** — o registro do evento e a atualização do pagamento acontecem na mesma transação. Como `evento_id` é chave primária, um evento repetido é recusado pelo próprio MySQL, a transação é desfeita e o pagamento não é alterado. Isso vale também para notificações iguais que chegam ao mesmo tempo: apenas uma é processada e as demais recebem `409`.

**◆ Simulação** — a interface não conhece o token. Ela chama `POST /pagamentos/:id/simular`, e é o servidor que monta a notificação e a envia ao próprio `/webhook/pagamento` com o token.

---

<a id="comando"></a>

## ▌06 // CENTRO DE COMANDO

A interface é um painel de operações com identidade visual própria, de inspiração tática (tema escuro com destaques em laranja). Ela tem cinco telas:

| Tela | Função |
|---|---|
| **VISÃO GERAL** | Totais por status, valores somados, últimos pagamentos, últimas mudanças de status e últimos eventos |
| **CRIAR PAGAMENTO** | Formulário de cobrança e painel com os dados do pagamento criado |
| **PAGAMENTOS** | Lista com filtro por status, busca por cliente ou identificador e detalhes de cada pagamento |
| **MONITOR DE WEBHOOK** | Simulação de notificações, registro das respostas da sessão e histórico de eventos gravados no MySQL |
| **STATUS DO SISTEMA** | Situação real da API, do MySQL e do token do webhook |

No monitor é possível enviar uma notificação, **reenviar o mesmo evento** (o servidor responde `409`) e **testar um token inválido** (o servidor responde `401`). Todos os dados exibidos vêm da API; nada é fictício.

---

<a id="canais"></a>

## ▌07 // CANAIS DE COMUNICAÇÃO

Todas as respostas são em JSON. Erros têm o formato `{ "erro": "mensagem" }`.

| Canal | Método | Rota | Finalidade |
|:---:|---|---|---|
| `C-1` | `POST` | `/pagamentos` | Cria um pagamento de demonstração |
| `C-2` | `GET` | `/pagamentos` | Lista os pagamentos (filtro opcional `?status=`) |
| `C-3` | `GET` | `/pagamentos/:id` | Consulta um pagamento pelo identificador |
| `C-4` | `POST` | `/webhook/pagamento` | Recebe a notificação de mudança de status |
| `C-5` | `POST` | `/pagamentos/:id/simular` | Simula uma notificação (usada pela interface) |
| `C-6` | `GET` | `/webhook/eventos` | Lista os eventos de webhook já processados |
| `C-7` | `GET` | `/status` | Informa a situação da API, do banco e do webhook |

**Códigos de resposta:**

| Código | Sinal | Situação |
|:---:|:---:|---|
| `200` / `201` | 🟢 | Operação concluída |
| `400` | 🟡 | Dados inválidos ou JSON malformado |
| `401` | 🔴 | Token do webhook ausente ou incorreto |
| `404` | 🟡 | Pagamento ou rota inexistente |
| `409` | 🟠 | Evento duplicado, recusado |
| `500` | 🔴 | Falha no banco |

### `C-1` POST /pagamentos

Corpo:

```json
{ "cliente": "Ana Silva", "valor": 50.5 }
```

- `cliente`: texto obrigatório, até 255 caracteres.
- `valor`: número maior que zero (não aceita texto, como `"50"`); é arredondado para duas casas decimais.

Resposta `201`:

```json
{
  "mensagem": "Pagamento criado",
  "pagamento": {
    "id": "3f0c2a7e-8a52-4f4e-9d1b-6f1f1f6d2c11",
    "cliente": "Ana Silva",
    "valor": 50.5,
    "status": "pending",
    "criadoEm": "2026-11-14T15:30:00.000Z",
    "atualizadoEm": null
  }
}
```

Códigos: `201` criado, `400` dados inválidos. Exemplo de erro `400`:

```json
{ "erro": "Informe um valor numérico maior que zero." }
```

### `C-2` GET /pagamentos

Parâmetro opcional `status`: `pending`, `approved`, `rejected` ou `cancelled`.

- Listar todos: `GET /pagamentos`
- Filtrar: `GET /pagamentos?status=approved`

Resposta `200`:

```json
{
  "total": 1,
  "pagamentos": [
    { "id": "3f0c2a7e-...", "cliente": "Ana Silva", "valor": 50.5, "status": "approved", "criadoEm": "...", "atualizadoEm": "..." }
  ]
}
```

Códigos: `200` sucesso, `400` status de filtro inválido.

### `C-3` GET /pagamentos/:id

Resposta `200`: o objeto do pagamento (mesmo formato acima).

Códigos: `200` encontrado, `400` identificador fora do formato UUID, `404` pagamento não encontrado.

### `C-4` POST /webhook/pagamento

**Canal autenticado.** Cabeçalho obrigatório: `x-webhook-token: <valor de WEBHOOK_TOKEN>`

Corpo:

```json
{
  "pagamentoId": "3f0c2a7e-8a52-4f4e-9d1b-6f1f1f6d2c11",
  "status": "approved",
  "eventoId": "evt-001"
}
```

- `pagamentoId`: UUID de um pagamento existente.
- `status`: `approved`, `rejected` ou `cancelled`.
- `eventoId`: identificador único do evento, texto de até 100 caracteres.

Resposta `200`:

```json
{ "mensagem": "Webhook processado", "pagamento": { "id": "3f0c2a7e-...", "status": "approved", "...": "..." } }
```

| Código | Situação |
|:---:|---|
| `200` | Evento processado e status atualizado |
| `400` | Corpo inválido (`pagamentoId`, `status` ou `eventoId`) |
| `401` | Token ausente ou incorreto |
| `404` | Pagamento não encontrado |
| `409` | Evento já processado (duplicado) |

Resposta de um evento duplicado:

```json
{ "erro": "Evento já processado", "duplicado": true }
```

### `C-5` POST /pagamentos/:id/simular

Usada pelo Monitor de webhook. O servidor monta a notificação e a envia ao próprio `/webhook/pagamento` com o token, sem expor o token ao navegador.

Corpo opcional: `{ "status": "approved", "eventoId": "evt-001" }`. O padrão do `status` é `approved`; se `eventoId` não for enviado, o servidor gera um. Repetir o mesmo `eventoId` resulta em `409`. As respostas e os códigos são os mesmos do webhook.

### `C-6` GET /webhook/eventos

Devolve os 100 eventos processados mais recentes. Resposta `200`:

```json
{
  "total": 1,
  "eventos": [
    { "eventoId": "evt-001", "pagamentoId": "3f0c2a7e-...", "status": "approved", "recebidoEm": "2026-11-14T15:31:00.000Z" }
  ]
}
```

### `C-7` GET /status

Resposta `200`:

```json
{ "api": "online", "banco": "online", "webhook": "configurado", "horario": "2026-11-14T15:30:00.000Z" }
```

- `banco`: `online` ou `offline`, conforme uma consulta de teste ao MySQL.
- `webhook`: `configurado` ou `sem_token`, conforme a variável `WEBHOOK_TOKEN`. O valor do token nunca é devolvido.

---

<a id="treinamento"></a>

## ▌08 // CAMPO DE TREINAMENTO

Roteiro para Postman ou Insomnia, com o servidor em execução (troque `5000` pela sua porta, se for outra):

| Exercício | Cenário | Requisição | Resultado esperado |
|:---:|---|---|:---:|
| `T-1` | Criar pagamento | `POST http://localhost:5000/pagamentos` com `{ "cliente": "Ana Silva", "valor": 50 }` | 🟢 `201` (copie o `id`) |
| `T-2` | Consultar | `GET http://localhost:5000/pagamentos/<id>` | 🟢 `200` |
| `T-3` | Listar e filtrar | `GET http://localhost:5000/pagamentos?status=pending` | 🟢 `200` |
| `T-4` | Enviar webhook | `POST http://localhost:5000/webhook/pagamento` com o cabeçalho `x-webhook-token` e `{ "pagamentoId": "<id>", "status": "approved", "eventoId": "evt-001" }` | 🟢 `200` |
| `T-5` | Evento duplicado | Repita o `T-4` sem mudar o `eventoId` | 🟠 `409` |
| `T-6` | Token inválido | Repita o `T-4` com outro valor no cabeçalho | 🔴 `401` |
| `T-7` | Requisição inválida | `POST /pagamentos` com `{ "cliente": "", "valor": -1 }` | 🟡 `400` |

Em todas as requisições com corpo, use o cabeçalho `Content-Type: application/json`.

Exemplo equivalente ao `T-4` com `curl`:

```bash
curl -X POST http://localhost:5000/webhook/pagamento -H "Content-Type: application/json" -H "x-webhook-token: SEU_TOKEN" -d "{\"pagamentoId\":\"ID_DO_PAGAMENTO\",\"status\":\"approved\",\"eventoId\":\"evt-001\"}"
```

---

<a id="simulacoes"></a>

## ▌09 // SIMULAÇÕES DE COMBATE

```bash
npm test
```

São **15 testes de integração**. Eles sobem a aplicação em uma porta livre e usam o MySQL configurado no `.env`, em um banco separado (`MYSQL_DATABASE_TEST`, padrão `webhook_test`), criado automaticamente.

> **⚠ ATENÇÃO:** o banco de testes é **esvaziado a cada execução**. O banco da aplicação não é tocado.

| Cenário coberto |
|---|
| Criação de pagamento com sucesso e com dados inválidos |
| Consulta por identificador (válido, inválido e inexistente) |
| Atualização de status pelo webhook e registro do evento |
| Rejeição de evento duplicado, inclusive com envios simultâneos |
| Token de webhook inválido ou ausente |
| Corpo de webhook inválido e pagamento inexistente |
| Listagem e filtro por status |
| Simulação pela rota usada na interface, inclusive com evento repetido |
| Histórico de eventos, status do sistema e rota inexistente |

---

<a id="defesa"></a>

## ▌10 // PROTOCOLOS DE DEFESA

| Protocolo | Medida |
|---|---|
| `DEF-1` Credenciais | Credenciais do banco e token do webhook ficam apenas no `.env`; nada disso está escrito no código |
| `DEF-2` Token | O token nunca é enviado ao navegador: a simulação é feita pelo servidor |
| `DEF-3` Injeção de SQL | Os dados recebidos nas requisições chegam ao MySQL sempre como parâmetros das consultas |
| `DEF-4` Injeção de scripts | A interface monta o conteúdo sem interpretar HTML vindo dos dados, como o nome do cliente |

---

<a id="contramedidas"></a>

## ▌11 // CONTRAMEDIDAS

| Ameaça detectada | Causa provável | Contramedida |
|---|---|---|
| `Access denied for user ...` | Usuário ou senha incorretos | Revise `MYSQL_USER` e `MYSQL_PASSWORD` no `.env` |
| `ECONNREFUSED` | MySQL parado ou porta errada | Inicie o MySQL e confira `MYSQL_HOST` e `MYSQL_PORT` |
| `Unknown database` ou tabela inexistente | Banco ainda não criado | Rode `npm run db:setup` |
| `EADDRINUSE` | Porta já em uso | Mude `PORT` no `.env` ou encerre o outro processo |
| Webhook sempre responde `401` | `WEBHOOK_TOKEN` vazio ou diferente do cabeçalho | Defina o token no `.env` e reinicie o servidor |
| MySQL aparece como "Sem conexão" no painel | Servidor sem acesso ao banco | Veja a tela **Status do sistema** e as linhas acima |

Depois de alterar o `.env`, reinicie o servidor para aplicar as mudanças.

---

<a id="planta"></a>

## ▌12 // PLANTA DA BASE

```
├── server.js                  # inicia o servidor
├── database.sql               # criação das tabelas
├── .env.example               # modelo das variáveis de ambiente
├── package.json
├── src/
│   ├── app.js                 # configuração do Express, /status e tratamento de erros
│   ├── routes/
│   │   ├── paymentRoutes.js   # rotas /pagamentos
│   │   └── webhookRoutes.js   # rotas /webhook
│   ├── store/
│   │   ├── database.js        # pool de conexões e transações
│   │   ├── paymentStore.js    # consultas e regras de pagamento
│   │   └── setup.js           # cria o banco e as tabelas
│   └── public/
│       ├── index.html         # estrutura do painel
│       ├── styles.css         # sistema visual
│       └── app.js             # lógica da interface (chamadas à API)
└── tests/
    └── api.test.js            # testes automatizados
```

---

<a id="inteligencia"></a>

## ▌13 // RELATÓRIO DE INTELIGÊNCIA

Limitações conhecidas:

- O sistema não armazena o status anterior de um pagamento.
- Eventos recusados (duplicados ou com token inválido) não são gravados no banco. Eles aparecem apenas no "Registro da sessão" do monitor e somem ao recarregar a página.
- As fontes (Rajdhani e Inter) são carregadas do Google Fonts; sem internet, o navegador usa fontes do sistema.
- Não há login de usuários: o projeto foi pensado para uso local, em ambiente de estudo.
- Os selos coloridos do topo deste documento são imagens do shields.io e só aparecem com internet.

---

<div align="center">

```
◆ ─────────────  FIM DA TRANSMISSÃO  ───────────── ◆
```

**PAYMENT OPERATIONS** · projeto educacional · nenhum pagamento real é processado

<sub>Identidade visual original, apenas inspirada em jogos táticos. Sem vínculo com a Ubisoft e sem uso de marcas, logotipos ou materiais da franquia Rainbow Six Siege.</sub>

</div>
