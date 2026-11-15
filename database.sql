-- Tabelas do sistema. Execute dentro do banco definido em MYSQL_DATABASE
-- (o comando "npm run db:setup" cria o banco e roda este arquivo).

CREATE TABLE IF NOT EXISTS pagamentos (
    id CHAR(36) PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    criado_em DATETIME(3) NOT NULL,
    atualizado_em DATETIME(3) NULL,
    INDEX idx_pagamentos_status (status)
);

-- Cada evento de webhook processado. A chave primária em evento_id garante
-- que o mesmo evento nunca seja processado duas vezes (idempotência).
CREATE TABLE IF NOT EXISTS eventos_webhook (
    evento_id VARCHAR(100) PRIMARY KEY,
    pagamento_id CHAR(36) NOT NULL,
    status ENUM('approved', 'rejected', 'cancelled') NOT NULL,
    recebido_em DATETIME(3) NOT NULL,
    CONSTRAINT fk_evento_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos (id)
);
