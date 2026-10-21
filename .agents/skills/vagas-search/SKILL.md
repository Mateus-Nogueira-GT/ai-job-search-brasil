---
name: vagas-search
version: 1.0.0
description: >
  Use this skill to search Brazilian job listings on VAGAS.com.br, one of the
  oldest general job boards in Brazil, strong in administrative, finance,
  commercial, healthcare, industry and operations roles (and the source of many
  postings that show a salary range). Invoke when the user wants jobs in Brazil
  by keyword or city, or to read a specific VAGAS.com.br posting. Trigger
  phrases: vagas.com, vagas.com.br, vagas de emprego, emprego em <cidade>,
  procurar emprego, vagas administrativas, vagas financeiro, vagas com salário,
  faixa salarial, jobs in Brazil.
context: fork
enabled: true  # Brazilian portal - set to false to keep it installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/vagas-search/cli/src/cli.ts *)
---

# VAGAS.com.br Search Skill

Busca vagas ao vivo no VAGAS.com.br. Sem autenticação, zero dependências de runtime.

## Commands

### Search

```bash
bun run .agents/skills/vagas-search/cli/src/cli.ts search --query "<texto>" [flags]
```

- `--query <text>` / `-q` — **required.** Turned into the site's URL slug (`analista financeiro` → `/vagas-de-analista-financeiro`).
- `--city <cidade>` / `-c` — e.g. `"São Paulo"`, `"Belo Horizonte"` (→ `-em-belo-horizonte`).
- `--jobage <days>` — posted within N days (client-side filter on the card date).
- `--remote` — only cards whose location reads "100% Home Office".
- `--limit <n>` / `-n`, `--format json|table|plain`.

**Matching is literal and stem-sensitive**: `contabil` finds 224 postings where `contador`
finds 1. Prefer the root/area term (`contabil`, `administrativo`, `logistica`) and check
`meta.total` — when it is much larger than `meta.count`, narrow with `--city` or a more
specific term rather than assuming you saw everything.

**No pagination.** One query returns at most ~40 cards (the site does not paginate for
anonymous clients). Use specific terms and `--city` rather than broad ones. There is no
`--page` flag; passing one is rejected.

### Detail

```bash
bun run .agents/skills/vagas-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric id from search (`2840369`, `v2840369`) or a `vagas.com.br/vagas/v<id>/...` URL.
Returns `contractType` (e.g. `CLT`, `PJ`), **`salary`** (the posted range, e.g.
`R$ 6.000 a R$ 7.000`, or null), `benefits[]`, `level`, `date`, `validThrough`, full
`description`, and `isActive` (`false` once `validThrough` has passed).

## Examples

```bash
bun run .agents/skills/vagas-search/cli/src/cli.ts search -q "analista financeiro" -c "São Paulo" --jobage 14 --format table
bun run .agents/skills/vagas-search/cli/src/cli.ts search -q "engenheiro de produção" -c "Curitiba" --format table
bun run .agents/skills/vagas-search/cli/src/cli.ts detail v2840369 --format plain
```

## Notes

- Search output fields: `id`, `title`, `company` (often `Confidencial`), `level` (Júnior/Pleno/Sênior/...), `location` (`"Cidade / UF"`), `remote`, `date`, `snippet`, `url`.
- robots.txt allows `/vagas-de-*` and `/vagas/v*`; it disallows `/vagas/pesquisas`, `/api/`, `/v1/`, which this CLI never calls.
- Tech roles are thinner here than on Gupy/LinkedIn; VAGAS is most useful for non-tech and for salary signals.
- Errors go to **stderr** as `{ "error": "...", "code": "..." }`, exit code `1`.
