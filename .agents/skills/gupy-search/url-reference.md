# Gupy URL Reference

Public, unauthenticated surfaces used by this skill (verified 2026-10-21).

## Search

```
GET https://portal.gupy.io/api/job-search/jobs
```

| Param | Meaning | Example |
|-------|---------|---------|
| `jobName` | Free-text query (matches job titles) | `analista de dados` |
| `limit` / `offset` | Pagination | `20` / `40` |
| `state` | Full state name (not UF) | `São Paulo` |
| `city` | City name | `Campinas` |
| `workplaceType` | `remote` · `hybrid` · `on-site` | `remote` |
| `type` | Vacancy type code (below) | `vacancy_legal_entity` |
| `isPWD` | Only PcD-flagged vacancies | `true` |
| `sortBy` / `sortOrder` | `publishedDate` / `desc` | — |

Response: `{ "data": [ { id, name, description, careerPageName, type, publishedDate,
applicationDeadline, workplaceType, city, state, jobUrl, disabilities, ... } ],
"pagination": { total, limit, offset } }`.

Vacancy type codes: `vacancy_type_effective` (CLT), `vacancy_legal_entity` (PJ),
`vacancy_type_internship` (estágio), `vacancy_type_trainee`, `vacancy_type_apprentice`,
`vacancy_type_temporary`, `vacancy_type_talent_pool`, `vacancy_type_freelancer`,
`vacancy_type_autonomous`, `vacancy_type_associate`, `vacancy_type_lecturer`,
`vacancy_type_volunteer`, `vacancy_type_summer`, `vacancy_type_outsource`,
`vacancy_type_parter` (sic).

## Detail

```
GET https://<empresa>.gupy.io/jobs/<id>
```

Next.js page; `<script id="__NEXT_DATA__">` → `props.pageProps.job` holds `name`,
`description`, `responsibilities`, `prerequisites`, `relevantExperiences` (HTML),
`jobType`, `workplaceType`, `addressCity`/`addressState(ShortName)`, `jobSteps[]`,
`status` (`published` while open), `publishedAt`, `registerEndDate` (application cutoff),
`expiresAt`, `handicapped`, `careerPage.name`.

An unknown id answers `307` to the career-page home — the CLI does not follow redirects and
reports `NOT_FOUND`. The search payload's `jobUrl` (`/job/<base64 {"jobId":...}>?jobBoardSource=...`)
is a tracking form of the same page.
