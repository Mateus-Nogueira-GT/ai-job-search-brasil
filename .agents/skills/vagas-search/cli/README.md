# vagas-search-cli

CLI para buscar vagas brasileiras no **VAGAS.com.br**.

**Fonte de dados**: páginas `vagas.com.br/vagas-de-<termo>` (busca) e o JSON-LD
`JobPosting` de `vagas.com.br/vagas/v<id>` (detalhe).
**Autenticação**: nenhuma. **Dependências**: nenhuma em runtime (`bun` + `fetch`).

## Instalação

```bash
cd .agents/skills/vagas-search/cli
bun install   # opcional — só instala tipos de desenvolvimento
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `search` | Busca vagas (`--query` obrigatório) |
| `detail` | Detalhe completo de uma vaga (id ou URL) |

Veja `bun run src/cli.ts --help` e o `SKILL.md` para todos os filtros.

## Testes

```bash
bun test          # offline: fixtures salvas em tests/fixtures/
bun run typecheck
```
