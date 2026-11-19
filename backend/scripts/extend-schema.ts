import mysql from "mysql2/promise";

async function main() {
const url = new URL(process.env.DATABASE_URL ?? "");
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  multipleStatements: true,
});

const statements = [
  "ALTER TABLE processos DROP FOREIGN KEY processos_ibfk_1",
  "ALTER TABLE processos ADD CONSTRAINT processos_ibfk_1 FOREIGN KEY (prestador_id) REFERENCES prestadores (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE processo_historico_situacao DROP FOREIGN KEY processo_historico_situacao_ibfk_1",
  "ALTER TABLE processo_historico_situacao ADD CONSTRAINT processo_historico_situacao_ibfk_1 FOREIGN KEY (processo_id) REFERENCES processos (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE processo_transferencias_local DROP FOREIGN KEY processo_transferencias_local_ibfk_1",
  "ALTER TABLE processo_transferencias_local ADD CONSTRAINT processo_transferencias_local_ibfk_1 FOREIGN KEY (processo_id) REFERENCES processos (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE registros_horas DROP FOREIGN KEY registros_horas_ibfk_1",
  "ALTER TABLE registros_horas ADD CONSTRAINT registros_horas_ibfk_1 FOREIGN KEY (processo_id) REFERENCES processos (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE registro_anexos DROP FOREIGN KEY registro_anexos_ibfk_1",
  "ALTER TABLE registro_anexos ADD CONSTRAINT registro_anexos_ibfk_1 FOREIGN KEY (registro_id) REFERENCES registros_horas (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE escalas DROP FOREIGN KEY escalas_ibfk_1",
  "ALTER TABLE escalas ADD CONSTRAINT escalas_ibfk_1 FOREIGN KEY (processo_id) REFERENCES processos (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE validacoes_lote_itens DROP FOREIGN KEY validacoes_lote_itens_ibfk_2",
  "ALTER TABLE validacoes_lote_itens ADD CONSTRAINT validacoes_lote_itens_ibfk_2 FOREIGN KEY (registro_id) REFERENCES registros_horas (id) ON UPDATE RESTRICT ON DELETE RESTRICT",
  "ALTER TABLE processos ADD COLUMN IF NOT EXISTS horas_semanais_max DECIMAL(5,2) NULL",
  "ALTER TABLE processos ADD COLUMN IF NOT EXISTS restricoes TEXT NULL",
  "ALTER TABLE processos ADD COLUMN IF NOT EXISTS tribunal VARCHAR(120) NULL",
  "ALTER TABLE documentos ADD COLUMN IF NOT EXISTS codigo_verificacao CHAR(16) NULL",
  "ALTER TABLE documentos ADD COLUMN IF NOT EXISTS em_quarentena TINYINT(1) NOT NULL DEFAULT 0",
  "CREATE UNIQUE INDEX IF NOT EXISTS documentos_codigo_verificacao ON documentos (codigo_verificacao)",
  "ALTER TABLE email_envios ADD COLUMN IF NOT EXISTS corpo MEDIUMTEXT NULL",
];

for (const sql of statements) {
  try {
    await conn.query(sql);
    console.log("ok", sql.slice(0, 72));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/check that column\/key exists|Duplicate key name|Can't DROP/i.test(message)) {
      console.log("skip", message.slice(0, 120));
      continue;
    }
    throw error;
  }
}
await conn.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
