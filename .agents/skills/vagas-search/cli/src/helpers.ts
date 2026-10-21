// Data source: VAGAS.com.br public search pages. No authentication.
//   - search: https://www.vagas.com.br/vagas-de-<termo>[-em-<cidade>] - server-
//     rendered HTML, one <li class="vaga ..."> card per posting (up to ~40 per
//     term; the site exposes no deeper pagination to anonymous clients).
//   - detail: https://www.vagas.com.br/vagas/v<id> - carries a schema.org
//     JobPosting JSON-LD block plus a header with salary range and contract type.
// robots.txt (checked 2026-10-21) allows both paths; it disallows /vagas/pesquisas,
// /api/ and /v1/, which this CLI never requests.

export const BASE_URL = "https://www.vagas.com.br"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; vagas-search-cli/1.0; personal job search)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns null on 404. */
export async function htmlFetch(url: string): Promise<string | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

/** "Engenheiro de Dados São Paulo" -> "engenheiro-de-dados-sao-paulo" (the site's URL slug rule). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildSearchUrl(query: string, city?: string): string {
  const q = slugify(query)
  const c = city ? `-em-${slugify(city)}` : ""
  return `${BASE_URL}/vagas-de-${q}${c}?ordenar_por=mais_recentes`
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => numericEntity(parseInt(d, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => numericEntity(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
}

function clean(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    .split("\n")
    .map((l) => clean(l))
    .filter((l) => l !== "" && l !== "-")
    .join("\n")
    .trim()
  return text || null
}

/** Today's date in Brazil (America/Sao_Paulo), as YYYY-MM-DD. */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** "Hoje" | "Ontem" | "Há 5 dias" | "21/09/2026" -> YYYY-MM-DD (null if unrecognised). */
export function parseRelativeDate(text: string, now: Date = new Date()): string | null {
  const t = text.trim().toLowerCase()
  const today = todayInBrazil(now)
  if (t === "hoje") return today
  if (t === "ontem") return shiftDays(today, 1)
  const ago = t.match(/^h[áa]\s+(\d+)\s+dias?$/)
  if (ago) return shiftDays(today, parseInt(ago[1], 10))
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  level: string | null
  location: string | null
  remote: boolean
  date: string | null
  snippet: string | null
  url: string
}

export function parseSearchPage(html: string, now: Date = new Date()): JobCard[] {
  const cards: JobCard[] = []
  const chunks = html.split(/<li class="vaga (?:odd|even)\s*"/).slice(1)
  for (const chunk of chunks) {
    const link = chunk.match(/<a class="link-detalhes-vaga"[^>]*data-id-vaga="(\d+)"[^>]*title="([^"]*)"[^>]*href="([^"]+)"/)
    if (!link) continue
    const [, id, rawTitle, href] = link
    const company = chunk.match(/<span class="emprVaga">([\s\S]*?)<\/span>/)
    const level = chunk.match(/<span class="nivelVaga">([\s\S]*?)<\/span>/)
    const snippet = chunk.match(/<div class="detalhes">([\s\S]*?)<\/div>/)
    // The location div also holds a tooltip ("A empresa aceita candidaturas de...");
    // keep only the text before it.
    const loc = chunk.match(/<div class="vaga-local">([\s\S]*?)(?:<div class="tooltip-place"|<\/div>)/)
    const date = chunk.match(/<span class="data-publicacao">([\s\S]*?)<\/span>/)
    const location = loc ? clean(loc[1]) || null : null
    const path = decodeHtmlEntities(href).split("?")[0]
    cards.push({
      id,
      title: decodeHtmlEntities(rawTitle).trim(),
      company: company ? clean(company[1]) || null : null,
      level: level ? clean(level[1]) || null : null,
      location,
      remote: !!location && /home office|remoto/i.test(location),
      date: date ? parseRelativeDate(clean(date[1]), now) : null,
      snippet: snippet ? clean(snippet[1]).slice(0, 300) || null : null,
      url: path.startsWith("/") ? `${BASE_URL}${path}` : `${BASE_URL}/vagas/v${id}`,
    })
  }
  return cards
}

/** The page's "<h1>224 vagas de emprego para ...</h1>" count (more than the ~40 cards shown). */
export function parseTotal(html: string): number | null {
  const m = html.match(/<h1>\s*([\d.]+)\s+vagas?\b/)
  return m ? parseInt(m[1].replace(/\./g, ""), 10) : null
}

export function filterByAge(cards: JobCard[], days: number, now: Date = new Date()): JobCard[] {
  const cutoff = shiftDays(todayInBrazil(now), days)
  return cards.filter((c) => c.date !== null && c.date >= cutoff)
}

/**
 * Accept "v2840369", "2840369" or a vagas.com.br /vagas/v<id>[/slug] URL.
 * Any other host is rejected via real URL parsing (look-alikes included).
 */
export function normalizeId(input: string): string | null {
  const t = input.trim()
  const bare = t.match(/^v?(\d{5,})$/i)
  if (bare) return bare[1]
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (!/^(www\.)?vagas\.com\.br$/i.test(u.hostname)) return null
  const m = u.pathname.match(/^\/vagas\/v(\d{5,})(?:\/[^/]*)?\/?$/)
  return m ? m[1] : null
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  level: string | null
  location: string | null
  contractType: string | null
  salary: string | null
  benefits: string[]
  date: string | null
  validThrough: string | null
  description: string | null
  url: string
  isActive: boolean
}

export function parseDetailPage(html: string, id: string, now: Date = new Date()): JobDetail | null {
  let posting: Record<string, any> | null = null
  for (const m of html.matchAll(/<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1])
      if (d && d["@type"] === "JobPosting") posting = d
    } catch {
      // A malformed sibling block (ads, breadcrumbs) must not hide the posting.
    }
  }
  if (!posting) return null

  const header = (re: RegExp) => {
    const m = html.match(re)
    return m ? clean(m[1]) || null : null
  }
  const salaryRaw = header(/Faixa salarial\s*<\/span>\s*<span>([\s\S]*?)<\/span>/)
  const contract = header(/<span class="info-modelo-contratual"[^>]*>([\s\S]*?)<\/span>/)
  const level = header(/job-hierarchylist__item--level"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/)
  const descHtml = html.match(/<div class="job-tab-content job-description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/)

  const addr = posting.jobLocation?.address ?? {}
  const location = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(" / ") || null
  const benefits = typeof posting.jobBenefits === "string"
    ? posting.jobBenefits.split(",").map((b: string) => b.trim()).filter(Boolean)
    : []
  const validThrough = typeof posting.validThrough === "string" ? posting.validThrough.slice(0, 10) : null

  return {
    id,
    title: typeof posting.title === "string" ? posting.title.trim() : "(sem título)",
    company: posting.hiringOrganization?.name?.trim() || null,
    level,
    location,
    contractType: contract ? contract.replace(/^Regime\s+/i, "") : null,
    salary: salaryRaw,
    benefits,
    date: typeof posting.datePosted === "string" ? posting.datePosted.slice(0, 10) : null,
    validThrough,
    description: htmlToText(descHtml?.[1]) ?? (typeof posting.description === "string" ? posting.description : null),
    url: `${BASE_URL}/vagas/v${id}`,
    // validThrough is the only closed-state signal the page carries.
    isActive: validThrough === null || validThrough >= todayInBrazil(now),
  }
}
