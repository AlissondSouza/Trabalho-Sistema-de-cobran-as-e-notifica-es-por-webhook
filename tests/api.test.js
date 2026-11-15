// Testes de integração: sobem a aplicação em uma porta livre e usam um banco MySQL
// separado (MYSQL_DATABASE_TEST, padrão "webhook_test"), criado automaticamente.
require("dotenv").config({ quiet: true });
process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE_TEST || "webhook_test";
process.env.WEBHOOK_TOKEN = "token-de-teste";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const app = require("../src/app");
const { executar, encerrar } = require("../src/store/database");
const { prepararBanco } = require("../src/store/setup");

const TOKEN = { "x-webhook-token": "token-de-teste" };
let server;
let baseUrl;

before(async () => {
    await prepararBanco();
    await executar("DELETE FROM eventos_webhook");
    await executar("DELETE FROM pagamentos");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await encerrar();
});

async function api(method, path, body, headers = {}) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
}

async function criar(cliente = "Ana Silva", valor = 50) {
    const { body } = await api("POST", "/pagamentos", { cliente, valor });
    return body.pagamento;
}

function webhook(body, headers = TOKEN) {
    return api("POST", "/webhook/pagamento", body, headers);
}

test("cria um pagamento com status pending", async () => {
    const { status, body } = await api("POST", "/pagamentos", { cliente: "  Ana Silva ", valor: 50.5 });
    assert.equal(status, 201);
    assert.match(body.pagamento.id, /^[0-9a-f-]{36}$/);
    assert.equal(body.pagamento.cliente, "Ana Silva");
    assert.equal(body.pagamento.valor, 50.5);
    assert.equal(body.pagamento.status, "pending");
    assert.ok(body.pagamento.criadoEm);
});

test("rejeita criação com dados inválidos", async () => {
    const invalidos = [
        {},
        { cliente: "", valor: 10 },
        { cliente: "Ana", valor: 0 },
        { cliente: "Ana", valor: -5 },
        { cliente: "Ana", valor: "10" },
        { cliente: 123, valor: 10 },
        "{ json quebrado"
    ];
    for (const corpo of invalidos) {
        const { status, body } = await api("POST", "/pagamentos", corpo);
        assert.equal(status, 400, JSON.stringify(corpo));
        assert.ok(body.erro);
    }
});

test("consulta um pagamento pelo identificador (lido do MySQL)", async () => {
    const pagamento = await criar("Bruno Lima", 120);
    const { status, body } = await api("GET", `/pagamentos/${pagamento.id}`);
    assert.equal(status, 200);
    assert.deepEqual(body, pagamento);

    const [linhas] = await executar("SELECT cliente FROM pagamentos WHERE id = ?", [pagamento.id]);
    assert.equal(linhas[0].cliente, "Bruno Lima");
});

test("consulta: identificador inválido retorna 400 e inexistente retorna 404", async () => {
    assert.equal((await api("GET", "/pagamentos/abc")).status, 400);
    assert.equal((await api("GET", `/pagamentos/${crypto.randomUUID()}`)).status, 404);
});

test("webhook atualiza o status e registra o evento", async () => {
    const pagamento = await criar();
    const { status, body } = await webhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-atualiza" });
    assert.equal(status, 200);
    assert.equal(body.pagamento.status, "approved");
    assert.ok(body.pagamento.atualizadoEm);

    const consulta = await api("GET", `/pagamentos/${pagamento.id}`);
    assert.equal(consulta.body.status, "approved");

    const [eventos] = await executar("SELECT pagamento_id FROM eventos_webhook WHERE evento_id = ?", ["evt-atualiza"]);
    assert.equal(eventos[0].pagamento_id, pagamento.id);
});

test("evento duplicado é rejeitado e não altera o pagamento", async () => {
    const pagamento = await criar();
    const primeiro = await webhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-duplicado" });
    assert.equal(primeiro.status, 200);

    const repetido = await webhook({ pagamentoId: pagamento.id, status: "cancelled", eventoId: "evt-duplicado" });
    assert.equal(repetido.status, 409);
    assert.equal(repetido.body.duplicado, true);

    const consulta = await api("GET", `/pagamentos/${pagamento.id}`);
    assert.equal(consulta.body.status, "approved");

    const [eventos] = await executar("SELECT COUNT(*) AS total FROM eventos_webhook WHERE evento_id = ?", ["evt-duplicado"]);
    assert.equal(eventos[0].total, 1);
});

test("eventos duplicados simultâneos: apenas um é processado", async () => {
    const pagamento = await criar();
    const corpo = { pagamentoId: pagamento.id, status: "approved", eventoId: "evt-simultaneo" };
    const respostas = await Promise.all([webhook(corpo), webhook(corpo), webhook(corpo)]);
    const codigos = respostas.map((resposta) => resposta.status).sort();
    assert.deepEqual(codigos, [200, 409, 409]);
});

test("webhook rejeita token inválido ou ausente", async () => {
    const pagamento = await criar();
    const corpo = { pagamentoId: pagamento.id, status: "approved", eventoId: "evt-token" };
    assert.equal((await webhook(corpo, { "x-webhook-token": "errado" })).status, 401);
    assert.equal((await webhook(corpo, {})).status, 401);

    const consulta = await api("GET", `/pagamentos/${pagamento.id}`);
    assert.equal(consulta.body.status, "pending");
});

test("webhook rejeita dados inválidos e pagamento inexistente", async () => {
    const pagamento = await criar();
    const invalidos = [
        {},
        { pagamentoId: "abc", status: "approved", eventoId: "e1" },
        { pagamentoId: pagamento.id, status: "pending", eventoId: "e1" },
        { pagamentoId: pagamento.id, status: "pago", eventoId: "e1" },
        { pagamentoId: pagamento.id, status: "approved" },
        { pagamentoId: pagamento.id, status: "approved", eventoId: "  " }
    ];
    for (const corpo of invalidos) {
        assert.equal((await webhook(corpo)).status, 400, JSON.stringify(corpo));
    }

    const inexistente = await webhook({ pagamentoId: crypto.randomUUID(), status: "approved", eventoId: "evt-404" });
    assert.equal(inexistente.status, 404);
});

test("lista pagamentos e filtra por status", async () => {
    const aprovado = await criar("Carla", 10);
    const rejeitado = await criar("Davi", 20);
    await webhook({ pagamentoId: aprovado.id, status: "approved", eventoId: "evt-lista-1" });
    await webhook({ pagamentoId: rejeitado.id, status: "rejected", eventoId: "evt-lista-2" });

    const todos = await api("GET", "/pagamentos");
    assert.equal(todos.status, 200);
    assert.equal(todos.body.total, todos.body.pagamentos.length);
    assert.ok(todos.body.total >= 2);

    for (const status of ["pending", "approved", "rejected", "cancelled"]) {
        const { body } = await api("GET", `/pagamentos?status=${status}`);
        assert.ok(body.pagamentos.every((pagamento) => pagamento.status === status), status);
    }
    const rejeitados = await api("GET", "/pagamentos?status=rejected");
    assert.ok(rejeitados.body.pagamentos.some((pagamento) => pagamento.id === rejeitado.id));

    assert.equal((await api("GET", "/pagamentos?status=pago")).status, 400);
});

test("simulação envia a notificação ao webhook e atualiza o status", async () => {
    const pagamento = await criar();
    const { status, body } = await api("POST", `/pagamentos/${pagamento.id}/simular`, { status: "cancelled" });
    assert.equal(status, 200);
    assert.equal(body.pagamento.status, "cancelled");

    assert.equal((await api("POST", `/pagamentos/${crypto.randomUUID()}/simular`, {})).status, 404);
});

test("simulação com eventoId repetido é recusada como duplicada", async () => {
    const pagamento = await criar();
    const corpo = { status: "approved", eventoId: "evt-sim-repetido" };
    assert.equal((await api("POST", `/pagamentos/${pagamento.id}/simular`, corpo)).status, 200);
    assert.equal((await api("POST", `/pagamentos/${pagamento.id}/simular`, corpo)).status, 409);
});

test("lista os eventos de webhook processados", async () => {
    const pagamento = await criar();
    await webhook({ pagamentoId: pagamento.id, status: "rejected", eventoId: "evt-historico" });
    const { status, body } = await api("GET", "/webhook/eventos");
    assert.equal(status, 200);
    assert.equal(body.total, body.eventos.length);
    const evento = body.eventos.find((item) => item.eventoId === "evt-historico");
    assert.equal(evento.pagamentoId, pagamento.id);
    assert.equal(evento.status, "rejected");
    assert.ok(evento.recebidoEm);
});

test("status do sistema informa API, banco e webhook", async () => {
    const { status, body } = await api("GET", "/status");
    assert.equal(status, 200);
    assert.equal(body.api, "online");
    assert.equal(body.banco, "online");
    assert.equal(body.webhook, "configurado");
});

test("rota inexistente retorna 404 em JSON", async () => {
    const { status, body } = await api("GET", "/nao-existe");
    assert.equal(status, 404);
    assert.ok(body.erro);
});
