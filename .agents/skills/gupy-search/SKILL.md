---
name: gupy-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Brazil, find
  Brazilian job listings, or look up a specific Gupy posting — even if they don't
  mention Gupy explicitly. Gupy is the applicant-tracking system behind the career
  pages of most large Brazilian employers (Itaú, Ambev, Boticário, Stefanini,
  Magalu, Natura, etc.), so its public portal is the broadest single source of
  corporate vacancies in the country. Covers CLT, PJ, estágio, trainee, jovem
  aprendiz, temporário and banco de talentos, filtered by state, city, workplace
  model (remoto/híbrido/presencial) and PcD/affirmative vacancies. Trigger
  phrases: vagas, vaga de emprego, buscar vagas, procurar emprego, emprego em São
  Paulo, vagas remotas, vagas home office, vagas CLT, vagas PJ, estágio, trainee,
  programa de trainee, jovem aprendiz, vagas PcD, gupy, jobs in Brazil, Brazilian
  jobs, work in Brazil, job search brazil, hiring brazil.
context: fork
enabled: true  # Brazilian portal - set to false to keep it installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/gupy-search/cli/src/cli.ts *)
---

# Gupy Search Skill

Busca vagas ao vivo no **Portal Gupy** (portal.gupy.io). Sem autenticação, sem chave de API
e **zero dependências de runtime** — roda só com `bun`.

## When to use this skill

- Search Brazilian job openings by keyword, job title or technology
- Narrow by state (UF), city, workplace model, contract regime (CLT, PJ, estágio, ...) or PcD
- Get the full posting (description, responsibilities, requirements, benefits, selection steps)

## Commands

### Search job listings

```bash
bun run .agents/skills/gupy-search/cli/src/cli.ts search --query "<texto>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search. **Required.** Gupy matches the job title, so short title-like terms ("analista de dados", "desenvolvedor python") work better than long phrases.
- `--state <UF|nome>` / `-s` — `SP`, `MG`, `"Rio Grande do Sul"`... (UF is translated to the state name Gupy filters on).
- `--city <nome>` / `-c` — city exactly as Gupy stores it (`"Belo Horizonte"`, `"Campinas"`).
- `--remote <modo>` — `remoto` | `hibrido` | `presencial` (English `remote|hybrid|onsite` also accepted).
- `--type <regime>` — `clt` | `pj` | `estagio` | `trainee` | `aprendiz` | `temporario` | `banco-de-talentos` | `freelancer` | `autonomo` | ...
- `--pcd` — only vacancies flagged for people with disabilities (affirmative or open to PcD).
- `--jobage <days>` — posted within N days. **Client-side filter**: it implies `--sort recent`, and combining it with `--sort relevance` is rejected.
- `--sort recent|relevance` — default `relevance` (or `recent` when `--jobage` is set).
- `--page <n>` — 1-indexed, 20 results per page. `--limit <n>` / `-n` — client-side cap.
- `--format json|table|plain` — default `json`.

Remote postings have no city/state; their `location` is `"Remoto"`. A `--state`/`--city` filter therefore excludes them — run a separate `--remote remoto` query for remote roles.

### Fetch full job detail

```bash
bun run .agents/skills/gupy-search/cli/src/cli.ts detail <url> [--format json|plain]
```

Pass the `url` from a search result (`https://<empresa>.gupy.io/jobs/<id>`); the tracking form
`https://<empresa>.gupy.io/job/eyJ...` is accepted too. **A bare id is not enough** — the
posting lives on the employer's subdomain. Returns description, responsibilities
(`responsibilities`), requirements (`requirements`), benefits/additional info
(`additionalInfo`), selection steps (`steps`), application cutoff (`deadline`) and `isActive`
(`false` = the posting is no longer published).

## Usage examples

```bash
# Python, remote, last 14 days
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "python" --remote remoto --jobage 14 --format table

# Data analyst, CLT, São Paulo state
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "analista de dados" -s SP --type clt --format table

# Engineering internships in Minas Gerais
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "estágio engenharia" -s MG --type estagio --format table

# Full posting
bun run .agents/skills/gupy-search/cli/src/cli.ts detail https://empresa.gupy.io/jobs/12345678 --format plain
```

## Output fields (search)

`id`, `title`, `company`, `location` (`"Cidade / UF"` or `"Remoto"`), `workplace`
(Remoto/Híbrido/Presencial), `contractType` (e.g. `Efetivo (CLT)`, `Pessoa Jurídica (PJ)`,
`Estágio`), `date` (published, YYYY-MM-DD), `deadline` (application cutoff), `pcd`, `url`.
`meta.total` is Gupy's match count (the endpoint caps some broad queries at 100).

All errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Notes

- Search uses the JSON endpoint behind portal.gupy.io's own search page; detail reads the
  `__NEXT_DATA__` JSON embedded in the employer's career page. `portal.gupy.io/robots.txt`
  disallows nothing. Keep volume low anyway — this is a personal job-search tool.
- Gupy postings usually include steps such as *Teste de perfil/Mapeamento comportamental*,
  *Teste de lógica*, *Entrevista Inteligente* (async video/AI screening) and *Entrevista com o
  gestor*. The `steps` array tells you which ones to prepare for — see
  `.claude/skills/job-application-assistant/10-mercado-brasileiro.md`.
- Salary is almost never published on Gupy. Use `tools/clt_pj.py` and market research for benchmarks.
