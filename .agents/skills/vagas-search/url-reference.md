# VAGAS.com.br URL Reference (verified 2026-10-21)

## Search

```
GET https://www.vagas.com.br/vagas-de-<termo-slug>[-em-<cidade-slug>]?ordenar_por=mais_recentes
```

Slug: lowercase, accents stripped, non-alphanumerics → `-`. Server-rendered HTML; one
`<li class="vaga odd|even">` per posting with `a.link-detalhes-vaga[data-id-vaga]`,
`span.emprVaga`, `span.nivelVaga`, `div.vaga-local`, `span.data-publicacao`
(`Hoje` · `Ontem` · `Há N dias` · `dd/mm/aaaa`). `?pagina=N` returns no cards to anonymous clients.

## Detail

```
GET https://www.vagas.com.br/vagas/v<id>        (301 → /vagas/v<id>/<slug>)
```

`<script type="application/ld+json">` with `@type: JobPosting` (`title`, `datePosted`,
`validThrough`, `hiringOrganization.name`, `jobLocation.address`, `jobBenefits`) plus header
markup: `Faixa salarial` span, `span.info-modelo-contratual` ("Regime CLT"),
`.job-hierarchylist__item--level`, and `div.job-description__text` (full HTML description).
An unknown id returns a generic search page without a JobPosting block → `NOT_FOUND`.

## robots.txt

Disallows `/auth/`, `/v1/`, `/api/`, `/vagas/pesquisas`, `/users/`, among others. Neither path above is disallowed.
