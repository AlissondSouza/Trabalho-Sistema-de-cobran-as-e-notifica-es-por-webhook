const crypto = require("node:crypto");
const { executar, transacao } = require("./database");

const STATUS = ["pending", "approved", "rejected", "cancelled"];
const STATUS_WEBHOOK = ["approved", "rejected", "cancelled"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUNAS = "id, cliente, valor, status, criado_em, atualizado_em";

function idValido(id) {
    return typeof id === "string" && UUID.test(id);
}

function formatar(linha) {
    return {
        id: linha.id,
        cliente: linha.cliente,
        valor: Number(linha.valor),
        status: linha.status,
        criadoEm: linha.criado_em,
        atualizadoEm: linha.atualizado_em
    };
}

async function criarPagamento(cliente, valor) {
    const id = crypto.randomUUID();
    await executar(
        `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
         VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(3))`,
        [id, cliente, valor]
    );
    return buscarPagamento(id);
}

async function buscarPagamento(id) {
    const [linhas] = await executar(`SELECT ${COLUNAS} FROM pagamentos WHERE id = ?`, [id]);
    return linhas.length ? formatar(linhas[0]) : null;
}

async function listarPagamentos(status) {
    const [linhas] = status
        ? await executar(`SELECT ${COLUNAS} FROM pagamentos WHERE status = ? ORDER BY criado_em DESC`, [status])
        : await executar(`SELECT ${COLUNAS} FROM pagamentos ORDER BY criado_em DESC`);
    return linhas.map(formatar);
}

async function listarEventos() {
    const [linhas] = await executar(
        `SELECT evento_id, pagamento_id, status, recebido_em
         FROM eventos_webhook ORDER BY recebido_em DESC LIMIT 100`
    );
    return linhas.map((linha) => ({
        eventoId: linha.evento_id,
        pagamentoId: linha.pagamento_id,
        status: linha.status,
        recebidoEm: linha.recebido_em
    }));
}

// Registra o evento e atualiza o pagamento na mesma transação.
// Retorna { resultado: "processado" | "duplicado" | "nao_encontrado", pagamento? }.
async function processarEvento(pagamentoId, status, eventoId) {
    try {
        const encontrado = await transacao(async (connection) => {
            const [linhas] = await connection.execute(
                "SELECT id FROM pagamentos WHERE id = ? FOR UPDATE",
                [pagamentoId]
            );
            if (linhas.length === 0) {
                return false;
            }
            // A chave primária de eventos_webhook rejeita evento_id repetido (ER_DUP_ENTRY).
            await connection.execute(
                `INSERT INTO eventos_webhook (evento_id, pagamento_id, status, recebido_em)
                 VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
                [eventoId, pagamentoId, status]
            );
            await connection.execute(
                "UPDATE pagamentos SET status = ?, atualizado_em = UTC_TIMESTAMP(3) WHERE id = ?",
                [status, pagamentoId]
            );
            return true;
        });

        if (!encontrado) {
            return { resultado: "nao_encontrado" };
        }
        return { resultado: "processado", pagamento: await buscarPagamento(pagamentoId) };
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return { resultado: "duplicado" };
        }
        throw error;
    }
}

module.exports = {
    STATUS,
    STATUS_WEBHOOK,
    idValido,
    criarPagamento,
    buscarPagamento,
    listarPagamentos,
    listarEventos,
    processarEvento
};
