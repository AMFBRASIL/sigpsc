# Segurança

- Senha nova com Argon2id. Hash legado bcrypt (`$2y$`) ainda é aceito na verificação.
- Sessão é o SHA-256 do token, guardado em `sessoes`. O token bruto fica só no cookie.
- Bloqueio progressivo após o limite de tentativas configurado em `config_geral`.
- Limite em memória: 600 requisições por minuto por IP e 10 logins a cada 15 minutos.
- CORS em desenvolvimento aceita `localhost` e `127.0.0.1` em qualquer porta. Em produção vale só `CORS_ORIGINS`.
- Helmet aplica os cabeçalhos de segurança.
- Prisma parametriza as consultas. Trechos em SQL bruto usam parâmetros.
- Auditoria mascara CPF e remove senha, token e hash.
- Upload aceita PDF, JPEG e PNG pela assinatura do arquivo, até 10 MB. PDF com indício de JavaScript fica em quarentena e não é baixado.
- Arquivos ficam em diretório privado. O download exige sessão e permissão da tela.
- CSV e XLSX prefixam células que começam com `=`, `+`, `-`, `@` ou tabulação.
- O QR Code e o hash SHA-256 confirmam a emissão. Não são assinatura digital certificada.

## Limites atuais

- O limite de taxa e o bloqueio não usam Redis. Reiniciar o processo zera os contadores em memória.
- A configuração pede MFA, mas uma conta sem segredo ainda entra e recebe `mfaEnrollmentRequired`, para o sistema não ficar inacessível.
- Não há antivírus externo. A quarentena de PDF é uma checagem de conteúdo, não um ClamAV.
- Não há município separado no banco. O isolamento de unidade usa `usuarios.local_id`. Supervisor sem local vê o conjunto de demonstração.
- Recuperação de senha grava a mensagem em `email_envios` e não devolve o token. Não há provedor de e-mail configurado.
