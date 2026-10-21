import {
  SEARCH_URL,
  PAGE_SIZE,
  httpFetch,
  parseSearch,
  filterByAge,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query: string
  state?: string // Gupy state name, already resolved from UF
  city?: string
  workplace?: string // Gupy workplaceType
  contractType?: string // Gupy vacancy type code
  pcd: boolean
  jobage?: number
  sort: "recent" | "relevance"
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("jobName", opts.query)
  params.set("limit", String(PAGE_SIZE))
  params.set("offset", String((opts.page - 1) * PAGE_SIZE))
  if (opts.state) params.set("state", opts.state)
  if (opts.city) params.set("city", opts.city)
  if (opts.workplace) params.set("workplaceType", opts.workplace)
  if (opts.contractType) params.set("type", opts.contractType)
  if (opts.pcd) params.set("isPWD", "true")
  if (opts.sort === "recent") {
    params.set("sortBy", "publishedDate")
    params.set("sortOrder", "desc")
  }
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const header =
    "ID".padEnd(9) + " " + "VAGA".padEnd(44) + " " + "EMPRESA".padEnd(24) + " " +
    "LOCAL".padEnd(20) + " " + "REGIME".padEnd(14) + " DATA"
  const rows = cards.map((c) =>
    [
      c.id.padEnd(9),
      c.title.slice(0, 44).padEnd(44),
      (c.company || "—").slice(0, 24).padEnd(24),
      (c.location || "—").slice(0, 20).padEnd(20),
      (c.contractType || "—").slice(0, 14).padEnd(14),
      c.date || "—",
    ].join(" "),
  )
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const body = await httpFetch(buildUrl(opts))
    if (body === null) {
      writeError("Gupy search endpoint not found (the API may have moved)", "SEARCH_FAILED")
      return 1
    }
    const { total, cards: parsed } = parseSearch(JSON.parse(body))
    let cards = parsed
    if (opts.jobage !== undefined) cards = filterByAge(cards, opts.jobage)
    if (opts.limit !== undefined) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workplace || "—"} · ${c.contractType || "—"}` +
              `\n  publicada: ${c.date || "—"} · inscrições até: ${c.deadline || "—"}${c.pcd ? " · vaga PcD/afirmativa" : ""}` +
              `\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, total, page: opts.page, pageSize: PAGE_SIZE }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
