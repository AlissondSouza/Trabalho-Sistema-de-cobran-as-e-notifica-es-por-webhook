// Cria o banco (MYSQL_DATABASE) e as tabelas de database.sql. Uso: npm run db:setup
require("dotenv").config({ quiet: true });

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { configuracao } = require("./database");

async function prepararBanco() {
    const banco = process.env.MYSQL_DATABASE || "";
    if (!/^\w+$/.test(banco)) {
        throw new Error("Defina MYSQL_DATABASE no arquivo .env (apenas letras, números e _).");
    }

    const connection = await mysql.createConnection({ ...configuracao(), multipleStatements: true });
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${banco}\``);
        await connection.query(`USE \`${banco}\``);
        await connection.query(fs.readFileSync(path.join(__dirname, "..", "..", "database.sql"), "utf8"));

        // Atualiza a tabela criada pela primeira versão do projeto.
        const [colunas] = await connection.query("SHOW COLUMNS FROM pagamentos LIKE 'atualizado_em'");
        if (colunas.length === 0) {
            await connection.query(
                `ALTER TABLE pagamentos
                 ADD COLUMN atualizado_em DATETIME(3) NULL,
                 MODIFY status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending'`
            );
        }
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    prepararBanco()
        .then(() => console.log(`Banco "${process.env.MYSQL_DATABASE}" pronto.`))
        .catch((error) => {
            console.error("Erro ao preparar o banco:", error.message);
            process.exit(1);
        });
}

module.exports = { prepararBanco };
