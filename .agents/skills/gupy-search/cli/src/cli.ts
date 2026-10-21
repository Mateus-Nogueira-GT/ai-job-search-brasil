#!/usr/bin/env bun
// Self-contained CLI for searching Brazilian job postings on Gupy
// (portal.gupy.io), the applicant-tracking system behind most large Brazilian
// employers' career pages. No external CLI framework and zero runtime
// dependencies, so it runs anywhere `bun` is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { CONTRACT_TYPES, contractTypeFromFlag, resolveState, workplaceFromFlag, writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Flags that never take a value, so `--pcd <positional>` cannot swallow the positional.
const BOOLEAN_FLAGS = new Set(["pcd", "help", "h"])

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", s: "state", c: "city", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const TYPE_FLAGS = Object.values(CONTRACT_TYPES).map((v) => v.flag).join("|")

const HELP = `gupy-search — busca vagas no Gupy (portal.gupy.io), Brasil

USAGE
  bun run src/cli.ts search --query "<texto>" [flags]
  bun run src/cli.ts detail <url> [--format json|plain]

SEARCH FLAGS
  --query, -q <texto>    Cargo, habilidade ou palavra-chave. OBRIGATÓRIO.
  --state, -s <UF|nome>  Estado: "SP", "MG" ou "São Paulo".
  --city, -c <nome>      Cidade, exatamente como o Gupy grava (ex.: "Belo Horizonte").
  --remote <modo>        remoto|hibrido|presencial (ou remote|hybrid|onsite).
  --type <regime>        ${TYPE_FLAGS}
  --pcd                  Só vagas afirmativas/abertas a pessoas com deficiência.
  --jobage <dias>        Publicadas nos últimos N dias (filtro local; implica --sort recent).
  --sort <ordem>         recent (mais recentes) | relevance (padrão sem --jobage).
  --page <n>             Página 1-indexada (20 resultados por página).
  --limit, -n <n>        Máximo de resultados emitidos.
  --format <fmt>         json (padrão) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "desenvolvedor python" --remote remoto --jobage 14 --format table
  bun run src/cli.ts search -q "analista de dados" -s SP --type clt --format table
  bun run src/cli.ts search -q "estágio engenharia" -s MG --type estagio
  bun run src/cli.ts detail https://empresa.gupy.io/jobs/12345678 --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "state", "city", "remote", "type", "pcd", "jobage", "sort", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function bad(error: string, code = "BAD_ARG"): number {
  writeError(error, code)
  return 1
}

function nonEmpty(flags: Flags, name: string): string | null | undefined {
  const v = flags[name]
  if (v === undefined) return undefined
  if (typeof v !== "string" || !v.trim()) return null
  return v.trim()
}

function wholeNumber(raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  return Number.isInteger(val) && val >= 1 ? val : null
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Unknown flags are an error, never silently dropped: a discarded filter
  // changes what the search returns with no warning.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      return bad(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
    }
  }

  if (cmd === "search") {
    const query = nonEmpty(flags, "query")
    if (!query) return bad("the --query/-q flag is required and needs a non-empty value", query === undefined ? "MISSING_REQUIRED" : "BAD_ARG")

    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) return bad(`--format must be one of json|table|plain, got "${fmt}"`)

    let state: string | undefined
    const rawState = nonEmpty(flags, "state")
    if (rawState === null) return bad("--state requires a value (UF like SP, or a state name)")
    if (rawState !== undefined) {
      const resolved = resolveState(rawState)
      if (!resolved) return bad(`--state: unknown Brazilian state "${rawState}" (use a UF such as SP, RJ, MG)`)
      state = resolved
    }

    const city = nonEmpty(flags, "city")
    if (city === null) return bad("--city requires a value")

    let workplace: string | undefined
    if (flags.remote !== undefined) {
      const w = typeof flags.remote === "string" ? workplaceFromFlag(flags.remote) : null
      if (!w) return bad(`--remote must be one of remoto|hibrido|presencial, got ${typeof flags.remote === "string" ? `"${flags.remote}"` : "no value"}`)
      workplace = w
    }

    let contractType: string | undefined
    if (flags.type !== undefined) {
      const t = typeof flags.type === "string" ? contractTypeFromFlag(flags.type) : null
      if (!t) return bad(`--type must be one of ${TYPE_FLAGS}, got ${typeof flags.type === "string" ? `"${flags.type}"` : "no value"}`)
      contractType = t
    }

    let jobage: number | undefined
    if (flags.jobage !== undefined) {
      const v = wholeNumber(flags.jobage)
      if (v === null) return bad(`--jobage must be a whole number of at least 1, got "${flags.jobage}"`)
      jobage = v
    }

    let sort: SearchOpts["sort"] = jobage !== undefined ? "recent" : "relevance"
    if (flags.sort !== undefined) {
      if (flags.sort !== "recent" && flags.sort !== "relevance") return bad(`--sort must be recent|relevance, got "${flags.sort}"`)
      // A relevance-sorted page filtered by age silently loses fresh postings
      // ranked below the first page, so the pair is refused instead.
      if (flags.sort === "relevance" && jobage !== undefined) {
        return bad("--jobage filters client-side and needs --sort recent (the default with --jobage)", "CONFLICTING_FLAGS")
      }
      sort = flags.sort
    }

    let page = 1
    if (flags.page !== undefined) {
      const v = wholeNumber(flags.page)
      if (v === null) return bad(`--page must be a whole number of at least 1, got "${flags.page}"`)
      page = v
    }
    let limit: number | undefined
    if (flags.limit !== undefined) {
      const v = wholeNumber(flags.limit)
      if (v === null) return bad(`--limit must be a whole number of at least 1, got "${flags.limit}"`)
      limit = v
    }

    const opts: SearchOpts = {
      query,
      state,
      city: city ?? undefined,
      workplace,
      contractType,
      pcd: flags.pcd === true,
      jobage,
      sort,
      page,
      limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const input = (flags._ as string[])[1]
    if (!input) return bad("detail requires a Gupy posting <url>", "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) return bad(`--format must be one of json|plain, got "${fmt}"`)
    const opts: DetailOpts = { input, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  return bad(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    writeError(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
    process.exit(1)
  })
