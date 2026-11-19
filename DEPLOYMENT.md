# Implantação

O backend escuta em `PORT` (3340 neste ambiente, porque 3333 já está ocupada por outro processo). O Vite encaminha `/api` e `/verificar` para `http://127.0.0.1:3340`.

## Local

```sh
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run db:extend
npm run dev
```

`DATABASE_URL` aponta para o MariaDB existente. `db:extend` só adiciona colunas e recria chaves com `RESTRICT`. Não apaga dados.

Na primeira subida, se a senha do administrador ainda for o marcador antigo, ela é trocada por `ADMIN_INITIAL_PASSWORD`. A senha gerada fica em `backend/.admin-password`, que não entra no git. Se `SEED_DEMO=true` e não houver prestadores, a carga de demonstração roda uma vez.

Frontend:

```sh
bun install
bun run dev
```

## Docker

`backend/docker-compose.yml` publica a API apenas em `127.0.0.1:3340` e monta um volume para os arquivos. O MariaDB não é iniciado pelo compose e não deve ser exposto. O arquivo `.env` fica fora da imagem.

## Backup

O banco é o MariaDB remoto já administrado. A cópia dos arquivos enviados é o diretório `backend/storage` (ou o volume `sigpsc-arquivos`). Restaurar é repor o banco e esse diretório juntos, porque o metadado do arquivo está em `documentos`.
