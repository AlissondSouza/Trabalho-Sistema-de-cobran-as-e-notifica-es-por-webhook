const mysql = require("mysql2/promise");

let pool;

function configuracao() {
    return {
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        timezone: "Z" // as datas são gravadas em UTC
    };
}

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            ...configuracao(),
            database: process.env.MYSQL_DATABASE,
            connectionLimit: 10
        });
    }
    return pool;
}

function executar(sql, valores) {
    return getPool().execute(sql, valores);
}

// Executa fn(connection) dentro de uma transação: commit se concluir, rollback se lançar erro.
async function transacao(fn) {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const resultado = await fn(connection);
        await connection.commit();
        return resultado;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function encerrar() {
    if (pool) {
        await pool.end();
        pool = undefined;
    }
}

module.exports = { configuracao, executar, transacao, encerrar };
