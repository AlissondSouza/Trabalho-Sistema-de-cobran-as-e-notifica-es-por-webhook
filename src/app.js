const express = require('express');
const path = require('node:path');

const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const { executar } = require("./store/database");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Situação real da aplicação, usada pelos indicadores da interface.
app.get("/status", async (req, res) => {
    let banco = "online";
    try {
        await executar("SELECT 1");
    } catch {
        banco = "offline";
    }
    res.json({
        api: "online",
        banco,
        webhook: process.env.WEBHOOK_TOKEN ? "configurado" : "sem_token",
        horario: new Date().toISOString()
    });
});

app.use("/pagamentos", paymentRoutes);
app.use("/webhook", webhookRoutes);

app.use((req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
});

// Erros de qualquer rota (o Express 5 encaminha rejeições de handlers async para cá).
app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ erro: "O corpo da requisição não é um JSON válido." });
    }
    console.error("Erro interno:", error);
    return res.status(500).json({ erro: "Erro interno. Verifique a conexão com o banco de dados." });
});

module.exports = app;
