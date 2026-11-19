# Arquitetura do backend SIGPSC

## Diagnóstico do projeto existente

O repositório é um frontend institucional construído com Lovable, TanStack Start, React 19, Vite, Tailwind e TanStack Query. Não havia API, ORM, autenticação real nem persistência.

O que existe hoje:

- Rotas de dashboard, lista do dia, prestadores, registro de horas, validação, escalas, documentos, relatórios, notificações, usuários, perfis, configurações e área do prestador.
- Estado de demonstração em memória (`DemoProvider`) e cadastros estáticos em `src/lib/mock-data.ts` e `src/lib/access-demo.ts`.
- O cálculo de duração no formulário é apenas prévia. A duração oficial passa a ser calculada no servidor.
- A tela de login apenas navegava para o dashboard.
- O arquivo `src/server.ts` é o adaptador de SSR do TanStack Start, não um backend de negócio.
- Não há pasta `supabase/` nem `drizzle/`. A regra do projeto de não editar migrations desses diretórios permanece.

O banco informado já existe e está em uso. É MariaDB 10.11 (`sigpsc`), com dezenas de tabelas, chaves estrangeiras, perfis, telas, locais, atividades e um usuário administrador cuja senha ainda era um placeholder (`TROQUE_ESTE_HASH`). Prestadores, processos e horas estavam vazios. A view `vw_lista_do_dia` falha por colação mista e não é usada. As views `vw_processo_resumo`, `vw_horas_por_mes` e `vw_horas_por_local` respondem.

## Decisão de banco

O enunciado pedia PostgreSQL. O banco institucional já entregue é MariaDB, com modelo alinhado às telas atuais (prestador, processo, registro de horas, perfil por tela, auditoria, documento, escala).

Criar um PostgreSQL paralelo dividiria a fonte da verdade e exigiria copiar ou abandonar o esquema já implantado. O backend usa esse MariaDB via Prisma (`provider = "mysql"`). Consultas continuam parametrizadas. A integridade relacional existente é preservada. Nenhuma tabela foi apagada e nenhum dado anterior foi removido.

Consequências aceitas:

- Não há constraint de exclusão para sobreposição de horários. A regra é aplicada em transação com `SELECT … FOR UPDATE`.
- Identificadores permanecem inteiros sem sinal, como já estão no banco. UUID novo quebraria as chaves atuais.
- Exclusão física de processo, hora aprovada e auditoria não é exposta. O esquema não tem `deleted_at` generalizado; o serviço recusa `DELETE` nesses históricos.
- Redis, BullMQ e S3 não estão no ambiente entregue. Notificações e exportações são gravadas de forma durável no MariaDB e os arquivos ficam em diretório privado. Os pontos de configuração estão no `.env.example` para Redis e S3 quando a infraestrutura existir. ClamAV não está instalado: o upload valida assinatura, tamanho e recusa PDF com ação JavaScript, colocando o arquivo em quarentena. Isso não substitui antivírus institucional.

Colunas aditivas, sem reescrever tabelas:

- `processos.horas_semanais_max`, `processos.restricoes`, `processos.tribunal`
- `documentos.codigo_verificacao`, `documentos.em_quarentena`

A determinação judicial permanece na linha de `processos`, que já guarda número CNJ, vara, horas, prazo e situação. Vários processos por prestador cobrem determinações distintas sem uma segunda tabela concorrente.

## Backend

Aplicação NestJS em `backend/`, TypeScript strict, prefixo `/api/v1`.

Módulos: autenticação e sessão, usuários e perfis, prestadores, processos, frequência e cálculo de horas, catálogo (locais, atividades, escalas), documentos e PDF, relatórios, dashboard, notificações, auditoria e configurações.

Regras que não ficam no navegador:

- Duração em minutos inteiros, descontando intervalo.
- Saldo, percentual e limite semanal.
- Sobreposição, duplicidade e jornada com saída anterior à entrada.
- Aprovação transacional e idempotente.
- Escopo por unidade do usuário.
- Permissão pela tabela `perfil_telas`.
- CPF validado e mascarado em lista e log.

Autenticação: Argon2id, cookie `sigpsc_session` HttpOnly e SameSite=Lax, identificador da sessão é o SHA-256 do token. Bloqueio progressivo, taxa de login, cabeçalho `X-Sigpsc-Request` nas alterações, Helmet e CORS com origem explícita. MFA TOTP existe para quem já habilitou `dois_fatores`. A configuração pede segundo fator, mas o único administrador ainda não tem segredo cadastrado; bloquear o login deixaria o sistema sem operador. A sessão é emitida e a resposta informa `mfaEnrollmentRequired`. A inscrição é feita em `/api/v1/auth/mfa/setup`.

A senha placeholder do administrador é substituída, uma única vez, por `ADMIN_INITIAL_PASSWORD` do ambiente local. Ela não entra no repositório.

## Frontend

As telas, o formulário em etapas e o shell permanecem. O `DemoProvider` continua sendo o estado compartilhado da sessão de uso. Fora dos testes, ele carrega e grava na API. Os testes de formulário seguem em memória, sem rede.

O proxy do Vite encaminha `/api` para o backend, então o cookie fica no mesmo site do navegador.

## O que esta entrega cobre

Cadastro e consulta de prestadores e processos, registro e validação de horas com saldo oficial, dashboard, escalas, documentos com download autenticado, PDF com hash e código de verificação, exportação CSV e XLSX, notificações, auditoria, usuários e perfis já existentes no banco, e testes do motor de horas, do CPF e do fluxo HTTP crítico.

## Pendências conscientes

- Redis, fila BullMQ e worker separados.
- Bucket S3 e antivírus ClamAV.
- Assinatura digital ICP-Brasil. O QR e o hash comprovam a emissão do sistema, não uma assinatura certificada.
- Envio de e-mail: a tabela `config_email` não tem provedor configurado. Recuperação de senha grava o token e não o devolve na resposta.
- A view `vw_lista_do_dia` precisa de correção de colação pela administração do banco. A lista do dia é montada por consulta própria.
- Isolamento por município: o esquema atual não tem tabela de municípios. O isolamento implementado é por unidade (`usuarios.local_id`).
