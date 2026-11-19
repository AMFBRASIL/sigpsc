# Testes

## Backend

```sh
cd backend
npm test
```

O arquivo `backend/test/domain.test.ts` cobre CPF, duração com intervalo, horário invertido, sobreposição, saldo (400 h determinadas e 125 h 30 min validadas resultam em 274 h 30 min e 31,375%) e neutralização de fórmula em planilha. Nesta sessão: 8 testes, 8 aprovações.

`npx tsc -p tsconfig.json --noEmit` no backend deve terminar sem erro.

O script `backend/scripts/smoke.mjs` exercita login, sessão, horário inválido, sobreposição, aprovação idempotente, saldo, upload rejeitado e acesso sem sessão contra a API em execução. A última execução completa anterior a esta integração foi 12 de 12. Ela deixou um registro aprovado de 14:00–16:00 em 18/11/2026 para André Luiz Ferreira.

## Frontend

```sh
bun run test
```

Vitest: 3 arquivos, 28 testes, todos aprovados depois da ligação com a API. Em `MODE=test` o estado de horas continua em memória, para o formulário seguir usando o prestador de exemplo `1`.

## O que ainda não tem teste automatizado

Limite semanal pela HTTP, negação entre unidades com um usuário preso a um `local_id`, duas aprovações simultâneas além da repetição idempotente, e geração de PDF no script de fumaça.
