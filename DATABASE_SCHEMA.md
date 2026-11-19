# Esquema do banco SIGPSC

O banco em uso é o MariaDB `sigpsc` já existente. O Prisma usa o provider `mysql`. As tabelas originais foram preservadas. As mudanças aplicadas são aditivas.

## Ajustes aplicados

- `processos.horas_semanais_max`, `processos.restricoes`, `processos.tribunal`
- `documentos.codigo_verificacao` (único) e `documentos.em_quarentena`
- Chaves estrangeiras de processo, histórico, transferência, frequência, anexo, escala e item de validação passaram a `ON DELETE RESTRICT`

Não há exclusão em cascata do histórico judicial nem dos registros de frequência. O aplicativo não oferece exclusão definitiva desses registros.

## Núcleo operacional

| Tabela | Papel |
| --- | --- |
| `usuarios`, `perfis`, `telas`, `perfil_telas`, `sessoes` | Identidade, perfil e sessão |
| `prestadores`, `prestador_contatos_emergencia` | Pessoa em cumprimento |
| `processos`, `processo_historico_situacao`, `varas`, `comarcas` | Processo e determinação registrados na mesma linha do processo |
| `locais`, `atividades`, `escalas` | Onde, o que e quando |
| `registros_horas`, `registro_anexos`, `validacoes_lote`, `validacoes_lote_itens` | Frequência e validação |
| `documentos`, `relatorios_emitidos`, `modelos_documento` | Arquivos e PDFs emitidos |
| `auditoria`, `notificacoes`, `config_geral` | Rastro, alertas e parâmetros |
| `redefinicoes_senha`, `email_envios` | Recuperação de senha, sem envio automático |

Identificadores permanecem inteiros sem sinal, como no banco original. A view `vw_lista_do_dia` mistura collations e não é consultada; a lista do dia é montada na aplicação.

## Horas

A fonte de verdade é `registros_horas`, em minutos inteiros. Só entram no saldo os registros com status aprovado. Pendentes aparecem à parte. O saldo restante é `max(0, minutos determinados − minutos aprovados)`.
