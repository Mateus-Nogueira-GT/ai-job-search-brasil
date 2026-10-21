// Data source: Gupy, the ATS most large Brazilian employers use. Two public,
// unauthenticated surfaces:
//   - search: the JSON endpoint portal.gupy.io's own job-search page calls
//     (https://portal.gupy.io/api/job-search/jobs). portal.gupy.io/robots.txt
//     disallows nothing (checked 2026-10-21).
//   - detail: each employer's career page (https://<sub>.gupy.io/jobs/<id>) is a
//     Next.js page whose __NEXT_DATA__ script carries the full posting as JSON.
// Neither needs a DOM parser; the CLI has zero runtime dependencies.

export const SEARCH_URL = "https://portal.gupy.io/api/job-search/jobs"

/** Page size the CLI requests. The endpoint accepts larger values; 20 keeps volume low. */
export const PAGE_SIZE = 20

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; gupy-search-cli/1.0; personal job search)"

/** Fetch with exponential backoff on 429/5xx. Returns null on a 404. */
export async function httpFetch(url: string, accept = "application/json"): Promise<string | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5" },
      // Gupy answers an unknown job id with a 307 to the career-page home;
      // following it would parse the home page as if it were the posting.
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404 || (response.status >= 300 && response.status < 400)) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/** Gupy's vacancy `type` codes -> the CLI's --tipo values and a pt-BR label. */
export const CONTRACT_TYPES: Record<string, { flag: string; label: string }> = {
  vacancy_type_effective: { flag: "clt", label: "Efetivo (CLT)" },
  vacancy_legal_entity: { flag: "pj", label: "Pessoa Jurídica (PJ)" },
  vacancy_type_internship: { flag: "estagio", label: "Estágio" },
  vacancy_type_trainee: { flag: "trainee", label: "Trainee" },
  vacancy_type_apprentice: { flag: "aprendiz", label: "Jovem Aprendiz" },
  vacancy_type_temporary: { flag: "temporario", label: "Temporário" },
  vacancy_type_talent_pool: { flag: "banco-de-talentos", label: "Banco de Talentos" },
  vacancy_type_freelancer: { flag: "freelancer", label: "Freelancer" },
  vacancy_type_autonomous: { flag: "autonomo", label: "Autônomo" },
  vacancy_type_associate: { flag: "associado", label: "Associado" },
  vacancy_type_lecturer: { flag: "docente", label: "Docente" },
  vacancy_type_volunteer: { flag: "voluntario", label: "Voluntário" },
  vacancy_type_summer: { flag: "summer", label: "Summer Job" },
  vacancy_type_outsource: { flag: "terceiro", label: "Terceirizado" },
  // Gupy's own spelling.
  vacancy_type_parter: { flag: "socio", label: "Sócio / Parceiro" },
}

export function contractTypeFromFlag(flag: string): string | null {
  const f = flag.trim().toLowerCase()
  for (const [code, v] of Object.entries(CONTRACT_TYPES)) if (v.flag === f) return code
  return null
}

export function contractLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return CONTRACT_TYPES[code]?.label ?? code
}

/** --modelo value -> Gupy workplaceType. */
export function workplaceFromFlag(mode: string): string | null {
  switch (mode.trim().toLowerCase()) {
    case "remoto":
    case "remote":
      return "remote"
    case "hibrido":
    case "híbrido":
    case "hybrid":
      return "hybrid"
    case "presencial":
    case "onsite":
    case "on-site":
      return "on-site"
    default:
      return null
  }
}

const WORKPLACE_LABEL: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  "on-site": "Presencial",
}

/**
 * Gupy filters `state` by the full state name ("São Paulo"), not the UF.
 * Accept either and send the name, so `--estado SP` works.
 */
export const UF_TO_STATE: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Resolve a UF or a state name (accents optional) to Gupy's state name. */
export function resolveState(input: string): string | null {
  const up = input.trim().toUpperCase()
  if (UF_TO_STATE[up]) return UF_TO_STATE[up]
  const f = fold(input)
  for (const name of Object.values(UF_TO_STATE)) if (fold(name) === f) return name
  return null
}

const STATE_TO_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_TO_STATE).map(([uf, name]) => [name, uf]),
)

// ---------------------------------------------------------------------------
// Search parsing
// ---------------------------------------------------------------------------

export interface GupyRawJob {
  id: number
  name: string
  description?: string | null
  careerPageName?: string | null
  type?: string | null
  publishedDate?: string | null
  applicationDeadline?: string | null
  workplaceType?: string | null
  city?: string | null
  state?: string | null
  jobUrl?: string | null
  disabilities?: boolean | null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  workplace: string | null
  contractType: string | null
  date: string | null
  deadline: string | null
  pcd: boolean
  url: string
}

function isoDate(v: string | null | undefined): string | null {
  if (!v) return null
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * Canonical posting URL: https://<sub>.gupy.io/jobs/<id>. The search payload's
 * jobUrl carries a base64 tracking hash (/job/eyJ...?jobBoardSource=...) that
 * changes per listing surface; the canonical form is stable, which matters for
 * dedup in seen_jobs.json.
 */
export function canonicalUrl(jobUrl: string | null | undefined, id: string): string | null {
  if (!jobUrl) return null
  try {
    const u = new URL(jobUrl)
    if (!/(^|\.)gupy\.io$/i.test(u.hostname)) return null
    return `https://${u.hostname.toLowerCase()}/jobs/${id}`
  } catch {
    return null
  }
}

export function formatLocation(city?: string | null, state?: string | null, workplace?: string | null): string | null {
  const uf = state ? (STATE_TO_UF[state] ?? state) : null
  const place = [city || null, uf].filter(Boolean).join(" / ")
  if (place) return place
  return workplace === "remote" ? "Remoto" : null
}

export function parseSearch(payload: unknown): { total: number | null; cards: JobCard[] } {
  const data = (payload as { data?: unknown })?.data
  if (!Array.isArray(data)) throw new Error("Unexpected Gupy search response (no data array)")
  const total = (payload as { pagination?: { total?: number } }).pagination?.total ?? null
  const cards: JobCard[] = []
  for (const raw of data as GupyRawJob[]) {
    if (!raw || typeof raw.id !== "number" || !raw.name) continue
    const id = String(raw.id)
    const url = canonicalUrl(raw.jobUrl, id)
    if (!url) continue
    cards.push({
      id,
      title: raw.name.trim(),
      company: raw.careerPageName?.trim() || null,
      location: formatLocation(raw.city, raw.state, raw.workplaceType),
      workplace: raw.workplaceType ? (WORKPLACE_LABEL[raw.workplaceType] ?? raw.workplaceType) : null,
      contractType: contractLabel(raw.type),
      date: isoDate(raw.publishedDate),
      deadline: isoDate(raw.applicationDeadline),
      pcd: raw.disabilities === true,
      url,
    })
  }
  return { total, cards }
}

/** Drop cards older than `days` (client-side; the endpoint has no recency filter). */
export function filterByAge(cards: JobCard[], days: number, now: Date = new Date()): JobCard[] {
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
  return cards.filter((c) => c.date !== null && c.date >= cutoff)
}

// ---------------------------------------------------------------------------
// Detail parsing
// ---------------------------------------------------------------------------

/**
 * Accept a Gupy posting URL in either form:
 *   https://<sub>.gupy.io/jobs/<id>
 *   https://<sub>.gupy.io/job/<base64 {"jobId":<id>,...}>
 * Returns the canonical URL, or null for anything else. A bare numeric id is not
 * enough: the detail page lives on the employer's subdomain, which only the URL
 * carries. Real URL parsing keeps look-alike hosts (gupy.io.evil.com) out.
 */
export function normalizeDetailInput(input: string): string | null {
  const trimmed = input.trim()
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  if (!/^[a-z0-9-]+\.gupy\.io$/.test(host) || host === "portal.gupy.io") return null
  const direct = u.pathname.match(/^\/jobs\/(\d+)\/?$/)
  if (direct) return `https://${host}/jobs/${direct[1]}`
  const hashed = u.pathname.match(/^\/job\/([A-Za-z0-9+/=_-]+)\/?$/)
  if (hashed) {
    try {
      const json = JSON.parse(Buffer.from(hashed[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
      if (typeof json?.jobId === "number") return `https://${host}/jobs/${json.jobId}`
    } catch {
      return null
    }
  }
  return null
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
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
}

/** Rich-text HTML -> plain text with line breaks preserved per block/list item. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = withBreaks
    .split("\n")
    .map((l) => decodeHtmlEntities(l.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim())
    .filter((l) => l !== "" && l !== "-")
    .join("\n")
    .trim()
  return text || null
}

export interface JobDetail extends JobCard {
  description: string | null
  responsibilities: string | null
  requirements: string | null
  additionalInfo: string | null
  steps: string[]
  isActive: boolean
}

/** Pull the posting out of a career page's __NEXT_DATA__. */
export function parseDetailPage(html: string, url: string): JobDetail | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return null
  }
  const job = (data as { props?: { pageProps?: { job?: Record<string, unknown> } } })?.props?.pageProps?.job
  if (!job || typeof job.id !== "number") return null
  const s = (k: string) => (typeof job[k] === "string" ? (job[k] as string) : null)
  const steps = Array.isArray(job.jobSteps)
    ? (job.jobSteps as Array<{ name?: string; order?: number }>)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((st) => st.name ?? "")
        .filter(Boolean)
    : []
  const career = job.careerPage as { name?: string } | undefined
  const workplace = s("workplaceType")
  return {
    id: String(job.id),
    title: (s("name") ?? "(sem título)").trim(),
    company: career?.name?.trim() || null,
    location: formatLocation(s("addressCity"), s("addressState"), workplace),
    workplace: workplace ? (WORKPLACE_LABEL[workplace] ?? workplace) : null,
    contractType: contractLabel(s("jobType")),
    date: isoDate(s("publishedAt")),
    // registerEndDate is the application cutoff; expiresAt is when the
    // posting is unpublished, usually later.
    deadline: isoDate(s("registerEndDate")) ?? isoDate(s("expiresAt")),
    pcd: job.handicapped === true,
    url,
    description: htmlToText(s("description")),
    responsibilities: htmlToText(s("responsibilities")),
    requirements: htmlToText(s("prerequisites")),
    additionalInfo: htmlToText(s("relevantExperiences")),
    steps,
    isActive: s("status") === "published",
  }
}
