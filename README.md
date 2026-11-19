# SIGPSC

Sistema de gestão da prestação de serviços à comunidade. As telas continuam no app Lovable (TanStack Start). O backend NestJS em `backend/` grava no MariaDB `sigpsc` já existente.

**App publicado:** https://sigpsc.lovable.app

## Frontend

```sh
bun install
bun run dev
```

O Vite encaminha `/api` e `/verificar` para `http://127.0.0.1:3340`.

## Backend

```sh
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

A senha inicial do administrador, quando gerada, fica em `backend/.admin-password`. Não versionar `.env` nem essa senha.

Detalhes: `BACKEND_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`.

O editor Lovable continua em [lovable.dev/projects/47bc3509-68f6-4f2a-a174-cf7c7f0a936d](https://lovable.dev/projects/47bc3509-68f6-4f2a-a174-cf7c7f0a936d). Alterações visuais feitas lá voltam para este repositório.
