import { BASE_URL, htmlFetch, normalizeId, parseDetailPage, writeError } from "../helpers.js"

export interface DetailOpts {
  input: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.input)
  if (!id) {
    writeError(`Could not parse a VAGAS.com.br job id from "${opts.input}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(`${BASE_URL}/vagas/v${id}`)
    const job = html === null ? null : parseDetailPage(html, id)
    if (!job) {
      writeError("Vaga não encontrada (removida, expirada ou id inválido)", "NOT_FOUND")
      return 1
    }
    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.level || "—"} · ${job.location || "—"}`,
        `Regime: ${job.contractType || "—"} · Faixa salarial: ${job.salary || "não informada"}`,
        `Publicada: ${job.date || "—"} · Válida até: ${job.validThrough || "—"}`,
        `Status: ${job.isActive ? "ATIVA" : "ENCERRADA"}`,
        job.benefits.length ? `Benefícios: ${job.benefits.join(", ")}` : "",
        "",
        job.description || "(sem descrição)",
        "",
        `URL: ${job.url}`,
      ].filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
