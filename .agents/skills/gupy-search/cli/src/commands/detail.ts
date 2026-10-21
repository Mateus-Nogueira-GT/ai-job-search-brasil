import { httpFetch, normalizeDetailInput, parseDetailPage, writeError } from "../helpers.js"

export interface DetailOpts {
  input: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const url = normalizeDetailInput(opts.input)
  if (!url) {
    writeError(
      `Could not read a Gupy posting URL from "${opts.input}" - pass the result's url (https://<empresa>.gupy.io/jobs/<id>); a bare id is not enough because the posting lives on the employer's subdomain`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await httpFetch(url, "text/html,application/xhtml+xml")
    const job = html === null ? null : parseDetailPage(html, url)
    if (!job) {
      writeError("Vaga não encontrada (removida, expirada ou URL inválida)", "NOT_FOUND")
      return 1
    }
    if (opts.format === "plain") {
      const section = (title: string, body: string | null) => (body ? `\n## ${title}\n${body}` : "")
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"} · ${job.workplace || "—"}`,
        `Regime: ${job.contractType || "—"}`,
        `Publicada: ${job.date || "—"} · Inscrições até: ${job.deadline || "—"}`,
        job.pcd ? "Vaga também/exclusivamente para PcD" : "",
        `Status: ${job.isActive ? "ATIVA" : "ENCERRADA / NÃO PUBLICADA"}`,
        job.steps.length ? `Etapas: ${job.steps.join(" → ")}` : "",
        section("Descrição", job.description),
        section("Responsabilidades e atribuições", job.responsibilities),
        section("Requisitos e qualificações", job.requirements),
        section("Informações adicionais", job.additionalInfo),
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
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
