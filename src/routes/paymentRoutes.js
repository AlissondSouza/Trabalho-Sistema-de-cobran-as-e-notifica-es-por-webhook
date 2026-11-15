const express = require("express");
const crypto = require("node:crypto");

const {
    STATUS,
    idValido,
    criarPagamento,
    buscarPagamento,
    listarPagamentos
} = require("../store/paymentStore");

const router = express.Router();
const VALOR_MAXIMO = 99999999.99; // limite da coluna DECIMAL(10, 2)

router.post("/", async (req, res) => {
    const { cliente, valor } = req.body ?? {};
    if (typeof cliente !== "string" || !cliente.trim() || cliente.trim().length > 255) {
        return res.status(400).json({ erro: "Informe o nome do cliente (até 255 caracteres)." });
    }
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > VALOR_MAXIMO) {
        return res.status(400).json({ erro: "Informe um valor numérico maior que zero." });
    }

    const pagamento = await criarPagamento(cliente.trim(), Math.round(valor * 100) / 100);
    return res.status(201).json({ mensagem: "Pagamento criado", pagamento });
});

router.get("/", async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !STATUS.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Use: ${STATUS.join(", ")}.` });
    }
    const pagamentos = await listarPagamentos(status);
    return res.json({ total: pagamentos.length, pagamentos });
});

router.get("/:id", async (req, res) => {
    if (!idValido(req.params.id)) {
        return res.status(400).json({ erro: "Identificador de pagamento inválido." });
    }
    const pagamento = await buscarPagamento(req.params.id);
    if (!pagamento) {
        return res.status(404).json({ erro: "Pagamento não encontrado" });
    }
    return res.json(pagamento);
});

// Simulação: o próprio servidor envia a notificação ao endpoint de webhook,
// assim o token nunca é exposto ao navegador.
router.post("/:id/simular", async (req, res) => {
    const resposta = await fetch(`http://127.0.0.1:${req.socket.localPort}/webhook/pagamento`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-webhook-token": process.env.WEBHOOK_TOKEN ?? ""
        },
        body: JSON.stringify({
            pagamentoId: req.params.id,
            status: req.body?.status ?? "approved",
            // eventoId opcional: permite reenviar o mesmo evento para demonstrar a duplicidade
            eventoId: req.body?.eventoId ?? `sim-${crypto.randomUUID()}`
        })
    });
    return res.status(resposta.status).json(await resposta.json());
});

module.exports = router;
