# API SIGPSC

Base: `/api/v1`. Documentação interativa: `GET /api/docs` no processo do backend.

Toda rota mutável em `/api` exige o cabeçalho `X-Sigpsc-Request: 1`. A sessão vai no cookie `sigpsc_session` (`HttpOnly`, `SameSite=Lax`; `Secure` apenas em produção).

## Autenticação

- `POST /auth/login` — e-mail ou CPF e senha. Resposta 201 com cookie.
- `POST /auth/logout` — encerra a sessão atual.
- `POST /auth/forgot-password` e `POST /auth/reset-password`
- `POST /auth/password` — troca autenticada.
- `GET /auth/me`
- `POST /auth/mfa/setup` e `POST /auth/mfa/confirm`

## Operação

- `GET/POST /prestadores`, `GET/PATCH /prestadores/:id`
- `GET/POST /attendance`, `PATCH /attendance/:id`
- `POST /attendance/:id/approve|reject|request-correction`
- `POST /attendance/batch`
- `GET /judicial-orders/:id/balance` — saldo do processo
- `POST /documents/upload` — campo de arquivo `file`
- `GET /documents/:id/download`
- `POST /documents/generate` — PDF A4
- `GET /reports/attendance?formato=csv|xlsx`
- `GET /workspace` — contrato usado pelas telas
- `POST /schedules`, `POST /schedules/:id/cancel`
- `POST /users`, `PATCH /users/:id`
- `PATCH /profiles/:id/screens`
- `GET /health`
- `GET /public/documentos/:codigo` e `GET /verificar/:codigo` — só autenticidade, tipo, número e data

Erros seguem `{ message, code }`. Em produção a resposta não inclui stack.

## Códigos usados pelo motor de horas

`HORARIO`, `SOBREPOSICAO`, `LIMITE`, `RETROATIVO`, `FUTURO`, `VINCULO`, `SITUACAO`, `VALIDACAO`.
