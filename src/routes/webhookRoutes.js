const express = require("express");

const { STATUS_WEBHOOK, idValido, processarEvento, listarEventos } = require("../store/paymentStore");

const router = express.Router();

// Histórico (somente leitura) dos eventos processados, usado pelo monitor da interface.
router.get("/eventos", async (req, res) => {
    const eventos = await listarEventos();
    return res.json({ total: eventos.length, eventos });
});

router.post("/pagamento", async (req, res) => {
    const tokenEsperado = process.env.WEBHOOK_TOKEN;
    if (!tokenEsperado || req.get("x-webhook-token") !== tokenEsperado) {
        return res.status(401).json({ erro: "Token do webhook inválido" });
    }

    const { pagamentoId, status, eventoId } = req.body ?? {};

    if (!idValido(pagamentoId)) {
        return res.status(400).json({ erro: "pagamentoId inválido." });
    }
    if (!STATUS_WEBHOOK.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_WEBHOOK.join(", ")}.` });
    }
    if (typeof eventoId !== "string" || !eventoId.trim() || eventoId.length > 100) {
        return res.status(400).json({ erro: "Informe um eventoId (texto de até 100 caracteres)." });
    }

    const { resultado, pagamento } = await processarEvento(pagamentoId, status, eventoId.trim());

    if (resultado === "nao_encontrado") {
        return res.status(404).json({ erro: "Pagamento não encontrado" });
    }
    if (resultado === "duplicado") {
        return res.status(409).json({ erro: "Evento já processado", duplicado: true });
    }
    return res.status(200).json({ mensagem: "Webhook processado", pagamento });
});

module.exports = router;
