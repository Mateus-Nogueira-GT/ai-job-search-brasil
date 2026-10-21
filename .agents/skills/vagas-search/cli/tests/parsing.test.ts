import { describe, expect, test } from "bun:test";
import { join } from "path";
import {
  buildSearchUrl,
  filterByAge,
  normalizeId,
  parseDetailPage,
  parseRelativeDate,
  parseSearchPage,
  parseTotal,
  slugify,
} from "../src/helpers";

const fixture = (name: string) => join(import.meta.dir, "fixtures", name);
// Fixtures were saved on 2026-10-21 (America/Sao_Paulo); pin "now" to that day.
const NOW = new Date("2026-10-21T15:00:00Z");

describe("slugify / buildSearchUrl", () => {
  test("follows the site's slug rule", () => {
    expect(slugify("Engenheiro(a) de Dados Sênior")).toBe("engenheiro-a-de-dados-senior");
    expect(buildSearchUrl("analista financeiro", "São Paulo")).toBe(
      "https://www.vagas.com.br/vagas-de-analista-financeiro-em-sao-paulo?ordenar_por=mais_recentes",
    );
  });
});

describe("parseRelativeDate", () => {
  test("handles every date form the cards use", () => {
    expect(parseRelativeDate("Hoje", NOW)).toBe("2026-10-21");
    expect(parseRelativeDate("Ontem", NOW)).toBe("2026-10-20");
    expect(parseRelativeDate("Há 5 dias", NOW)).toBe("2026-10-16");
    expect(parseRelativeDate("30/09/2026", NOW)).toBe("2026-09-30");
    expect(parseRelativeDate("semana passada", NOW)).toBeNull();
  });
  test("uses Brazil's calendar day, not UTC", () => {
    // 01:00 UTC on the 22nd is still the 21st in São Paulo.
    expect(parseRelativeDate("Hoje", new Date("2026-10-22T01:00:00Z"))).toBe("2026-10-21");
  });
});

describe("parseSearchPage", () => {
  test("parses the saved search cards", async () => {
    const cards = parseSearchPage(await Bun.file(fixture("search-python.html")).text(), NOW);
    expect(cards.length).toBe(6);
    const first = cards[0];
    expect(first.id).toBe("2840369");
    expect(first.title).toBe("Analista de Controladoria Sênior");
    expect(first.company).toBe("Confidencial");
    expect(first.level).toBe("Sênior");
    expect(first.location).toBe("Taboão da Serra / SP");
    expect(first.date).toBe("2026-10-21");
    expect(first.url).toBe("https://www.vagas.com.br/vagas/v2840369/analista-de-controladoria-senior");
    expect(cards.every((c) => c.date !== null)).toBe(true);
  });
  test("filterByAge keeps only recent cards", async () => {
    const cards = parseSearchPage(await Bun.file(fixture("search-python.html")).text(), NOW);
    expect(filterByAge(cards, 1, NOW).every((c) => c.date! >= "2026-10-20")).toBe(true);
  });
  test("parseTotal reads the headline count", async () => {
    expect(parseTotal(await Bun.file(fixture("search-python.html")).text())).toBe(40);
    expect(parseTotal("<h1>1.234 vagas de emprego para x</h1>")).toBe(1234);
    expect(parseTotal("<h1>1 vaga de emprego para x</h1>")).toBe(1);
  });
  test("an empty page yields no cards", () => {
    expect(parseSearchPage("<html><body>nada</body></html>")).toEqual([]);
  });
});

describe("normalizeId", () => {
  test("accepts ids and vagas.com.br URLs", () => {
    expect(normalizeId("v2840369")).toBe("2840369");
    expect(normalizeId("2840369")).toBe("2840369");
    expect(normalizeId("https://www.vagas.com.br/vagas/v2840369/analista")).toBe("2840369");
    expect(normalizeId("vagas.com.br/vagas/v2840369")).toBe("2840369");
  });
  test("rejects other hosts and look-alikes", () => {
    expect(normalizeId("https://www.vagas.com.br.evil.io/vagas/v2840369")).toBeNull();
    expect(normalizeId("https://www.vagas.com.br@evil.io/vagas/v2840369")).toBeNull();
    expect(normalizeId("https://acme.gupy.io/jobs/2840369")).toBeNull();
  });
});

describe("parseDetailPage", () => {
  test("combines JSON-LD with the header fields", async () => {
    const job = parseDetailPage(await Bun.file(fixture("detail-v2840369.html")).text(), "2840369", NOW)!;
    expect(job.title).toBe("Analista de Controladoria Sênior");
    expect(job.contractType).toBe("CLT");
    expect(job.salary).toBe("R$ 6.000 a R$ 7.000");
    expect(job.level).toBe("Sênior");
    expect(job.location).toBe("Taboão da Serra / SP");
    expect(job.isActive).toBe(true);
    expect(job.benefits).toContain("Assistência médica");
    expect(job.description).toContain("Requisitos:");
  });
  test("marks a posting past validThrough as inactive", async () => {
    const html = await Bun.file(fixture("detail-v2840369.html")).text();
    expect(parseDetailPage(html, "2840369", new Date("2027-01-10T12:00:00Z"))!.isActive).toBe(false);
  });
  test("returns null without a JobPosting block", () => {
    expect(parseDetailPage('<script type="application/ld+json">{"@type":"WebSite"}</script>', "1")).toBeNull();
  });
});
