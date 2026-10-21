import { buildSearchUrl, filterByAge, htmlFetch, parseSearchPage, parseTotal, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query: string
  city?: string
  remote: boolean
  jobage?: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const header = "ID".padEnd(8) + " " + "VAGA".padEnd(44) + " " + "EMPRESA".padEnd(22) + " " + "NÍVEL".padEnd(10) + " " + "LOCAL".padEnd(22) + " DATA"
  const rows = cards.map((c) =>
    [c.id.padEnd(8), c.title.slice(0, 44).padEnd(44), (c.company || "—").slice(0, 22).padEnd(22), (c.level || "—").slice(0, 10).padEnd(10), (c.location || "—").slice(0, 22).padEnd(22), c.date || "—"].join(" "),
  )
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl(opts.query, opts.city)
    const html = await htmlFetch(url)
    let cards = html === null ? [] : parseSearchPage(html)
    const total = html === null ? 0 : parseTotal(html)
    if (opts.remote) cards = cards.filter((c) => c.remote)
    if (opts.jobage !== undefined) cards = filterByAge(cards, opts.jobage)
    if (opts.limit !== undefined) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") process.stdout.write(renderTable(cards) + "\n")
    else if (opts.format === "plain" && cards.length === 0) process.stdout.write("Nenhum resultado.\n")
    else if (opts.format === "plain")
      process.stdout.write(
        cards.map((c) => `${c.title}\n  ${c.company || "—"} · ${c.level || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  ${c.url}`).join("\n\n") + "\n",
      )
    else process.stdout.write(JSON.stringify({ meta: { count: cards.length, total, source: url }, results: cards }, null, 2) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
