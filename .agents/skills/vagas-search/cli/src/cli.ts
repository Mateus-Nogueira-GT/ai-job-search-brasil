#!/usr/bin/env bun
// Self-contained CLI for searching Brazilian job postings on VAGAS.com.br.
// Zero runtime dependencies; runs anywhere `bun` is available.

import { runSearch } from "./commands/search.js"
import { runDetail } from "./commands/detail.js"
import { slugify, writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", c: "city", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (key === "help" || key === "h" || next === undefined || next.startsWith("-")) {
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

const HELP = `vagas-search — busca vagas no VAGAS.com.br (Brasil)

USAGE
  bun run src/cli.ts search --query "<texto>" [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <texto>   Cargo ou palavra-chave. OBRIGATÓRIO.
  --city, -c <cidade>   Cidade (ex.: "São Paulo", "Belo Horizonte").
  --jobage <dias>       Publicadas nos últimos N dias (filtro local).
  --remote              Só vagas "100% Home Office".
  --limit, -n <n>       Máximo de resultados emitidos.
  --format <fmt>        json (padrão) | table | plain.

  Uma busca retorna no máximo ~40 vagas (o site não pagina para visitantes);
  refine com termos mais específicos ou --city.

EXAMPLES
  bun run src/cli.ts search -q "analista financeiro" -c "São Paulo" --jobage 14 --format table
  bun run src/cli.ts search -q "engenheiro de dados" --remote
  bun run src/cli.ts detail v2840369 --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "city", "jobage", "remote", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function bad(error: string, code = "BAD_ARG"): number {
  writeError(error, code)
  return 1
}

function wholeNumber(raw: string | boolean | string[]): number | null {
  const v = typeof raw === "string" ? Number(raw.trim()) : NaN
  return Number.isInteger(v) && v >= 1 ? v : null
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]
  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }
  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      return bad(`unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`, "UNKNOWN_FLAG")
    }
  }

  if (cmd === "search") {
    if (flags.query === undefined) return bad("the --query/-q flag is required", "MISSING_REQUIRED")
    if (typeof flags.query !== "string" || !slugify(flags.query)) return bad("--query requires a non-empty value with letters or digits")
    if (flags.city !== undefined && (typeof flags.city !== "string" || !slugify(flags.city))) return bad("--city requires a value")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) return bad(`--format must be one of json|table|plain, got "${fmt}"`)
    if (flags.remote !== undefined && flags.remote !== true) return bad("--remote takes no value")
    let jobage: number | undefined
    if (flags.jobage !== undefined) {
      const v = wholeNumber(flags.jobage)
      if (v === null) return bad(`--jobage must be a whole number of at least 1, got "${flags.jobage}"`)
      jobage = v
    }
    let limit: number | undefined
    if (flags.limit !== undefined) {
      const v = wholeNumber(flags.limit)
      if (v === null) return bad(`--limit must be a whole number of at least 1, got "${flags.limit}"`)
      limit = v
    }

    return runSearch({
      query: flags.query,
      city: typeof flags.city === "string" ? flags.city : undefined,
      remote: flags.remote === true,
      jobage,
      limit,
      format: fmt as "json" | "table" | "plain",
    })
  }

  if (cmd === "detail") {
    const input = (flags._ as string[])[1]
    if (!input) return bad("detail requires an <id|url>", "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) return bad(`--format must be one of json|plain, got "${fmt}"`)
    return runDetail({ input, format: fmt as "json" | "plain" })
  }

  return bad(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    writeError(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
    process.exit(1)
  })
