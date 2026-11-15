require('dotenv').config();

const app = require("./src/app");

if (!process.env.WEBHOOK_TOKEN) {
    console.warn("Atenção: WEBHOOK_TOKEN não definido no .env — todos os webhooks serão rejeitados.");
}

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
})
