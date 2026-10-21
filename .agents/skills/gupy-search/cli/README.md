# gupy-search-cli

CLI para buscar vagas brasileiras no **Portal Gupy** (portal.gupy.io).

**Fonte de dados**: endpoint JSON `portal.gupy.io/api/job-search/jobs` (busca) e o
`__NEXT_DATA__` das páginas de carreira `https://<empresa>.gupy.io/jobs/<id>` (detalhe).
**Autenticação**: nenhuma. **Dependências**: nenhuma em runtime (`bun` + `fetch`).

## Instalação

```bash
cd .agents/skills/gupy-search/cli
bun install   # opcional — só instala tipos de desenvolvimento
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `search` | Busca vagas (`--query` obrigatório) |
| `detail` | Detalhe completo de uma vaga (passe a URL do resultado) |

Veja `bun run src/cli.ts --help` e o `SKILL.md` para todos os filtros.

## Testes

```bash
bun test          # offline: fixtures salvas em tests/fixtures/
bun run typecheck
```
