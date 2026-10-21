import { describe, expect, test } from "bun:test";
import { join } from "path";
import {
  canonicalUrl,
  filterByAge,
  htmlToText,
  normalizeDetailInput,
  parseDetailPage,
  parseSearch,
  resolveState,
  type JobCard,
} from "../src/helpers";
import { buildUrl } from "../src/commands/search";

const fixture = (name: string) => join(import.meta.dir, "fixtures", name);

describe("parseSearch", () => {
  test("maps the saved search payload to job cards", async () => {
    const { total, cards } = parseSearch(await Bun.file(fixture("search-jobs.json")).json());
    expect(total).toBeGreaterThan(0);
    expect(cards.length).toBe(4);
    const pj = cards.find((c) => c.id === "12729685")!;
    expect(pj.contractType).toBe("Pessoa Jurídica (PJ)");
    expect(pj.workplace).toBe("Remoto");
    expect(pj.location).toBe("Remoto");
    expect(pj.url).toBe("https://vempragestaods.gupy.io/jobs/12729685");
    const itau = cards.find((c) => c.id === "12670391")!;
    expect(itau.location).toBe("São Paulo / SP");
    expect(itau.contractType).toBe("Efetivo (CLT)");
    expect(itau.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("rejects a payload without a data array", () => {
    expect(() => parseSearch({ error: "x" })).toThrow();
  });

  test("skips entries whose jobUrl is not on gupy.io", () => {
    const { cards } = parseSearch({
      data: [{ id: 1, name: "X", jobUrl: "https://evil.example/job/1" }, { id: 2, name: "Y", jobUrl: "https://a.gupy.io/job/abc" }],
    });
    expect(cards.map((c) => c.id)).toEqual(["2"]);
  });
});

describe("canonicalUrl", () => {
  test("drops the tracking hash", () => {
    expect(canonicalUrl("https://Acme.gupy.io/job/eyJ4Ijox?jobBoardSource=gupy_portal", "42")).toBe("https://acme.gupy.io/jobs/42");
  });
  test("refuses look-alike hosts", () => {
    expect(canonicalUrl("https://gupy.io.evil.com/job/x", "42")).toBeNull();
  });
});

describe("normalizeDetailInput", () => {
  test("accepts the canonical form", () => {
    expect(normalizeDetailInput("https://acme.gupy.io/jobs/123")).toBe("https://acme.gupy.io/jobs/123");
    expect(normalizeDetailInput("acme.gupy.io/jobs/123/")).toBe("https://acme.gupy.io/jobs/123");
  });
  test("decodes the base64 /job/<hash> form", () => {
    const hash = Buffer.from(JSON.stringify({ jobId: 12754502, source: "gupy_portal" })).toString("base64");
    expect(normalizeDetailInput(`https://stefanini.gupy.io/job/${hash}?jobBoardSource=gupy_portal`)).toBe(
      "https://stefanini.gupy.io/jobs/12754502",
    );
  });
  test("rejects bare ids, other hosts and the portal itself", () => {
    expect(normalizeDetailInput("12754502")).toBeNull();
    expect(normalizeDetailInput("https://jobs.lever.co/acme/123")).toBeNull();
    expect(normalizeDetailInput("https://acme.gupy.io.evil.com/jobs/1")).toBeNull();
    expect(normalizeDetailInput("https://acme.gupy.io@evil.com/jobs/1")).toBeNull();
    expect(normalizeDetailInput("https://portal.gupy.io/jobs/1")).toBeNull();
  });
});

describe("parseDetailPage", () => {
  test("reads the posting from __NEXT_DATA__", async () => {
    const html = await Bun.file(fixture("detail-stefanini.html")).text();
    const job = parseDetailPage(html, "https://stefanini.gupy.io/jobs/12754502")!;
    expect(job.id).toBe("12754502");
    expect(job.company).toBe("Stefanini Group");
    expect(job.location).toBe("Brasília / DF");
    expect(job.contractType).toBe("Efetivo (CLT)");
    expect(job.isActive).toBe(true);
    expect(job.pcd).toBe(true);
    expect(job.deadline).toBe("2026-11-16");
    expect(job.steps[0]).toBe("Cadastro");
    expect(job.requirements).toContain("Java 21");
    expect(job.responsibilities?.split("\n")[0]).toStartWith("- ");
  });
  test("returns null for a page without posting data", () => {
    expect(parseDetailPage("<html><body>home</body></html>", "https://a.gupy.io/jobs/1")).toBeNull();
  });
});

describe("htmlToText", () => {
  test("keeps list items and decodes entities once", () => {
    expect(htmlToText("<p>A&amp;B &amp;lt;x&amp;gt;</p><ul><li>um</li><li>dois</li></ul>")).toBe("A&B &lt;x&gt;\n- um\n- dois");
  });
});

describe("resolveState", () => {
  test("UF and names, accents optional", () => {
    expect(resolveState("sp")).toBe("São Paulo");
    expect(resolveState("Sao Paulo")).toBe("São Paulo");
    expect(resolveState("rio grande do sul")).toBe("Rio Grande do Sul");
    expect(resolveState("XX")).toBeNull();
  });
});

describe("filterByAge", () => {
  const card = (date: string | null) => ({ date } as JobCard);
  test("drops old and undated cards", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const kept = filterByAge([card("2026-10-20"), card("2026-10-01"), card(null)], 14, now);
    expect(kept.map((c) => c.date)).toEqual(["2026-10-20"]);
  });
});

describe("buildUrl", () => {
  test("translates every filter", () => {
    const url = new URL(
      buildUrl({ query: "dados", state: "São Paulo", city: "Campinas", workplace: "hybrid", contractType: "vacancy_legal_entity", pcd: true, sort: "recent", page: 2, format: "json" }),
    );
    expect(url.origin + url.pathname).toBe("https://portal.gupy.io/api/job-search/jobs");
    const p = url.searchParams;
    expect([p.get("jobName"), p.get("state"), p.get("city"), p.get("workplaceType"), p.get("type"), p.get("isPWD")]).toEqual(
      ["dados", "São Paulo", "Campinas", "hybrid", "vacancy_legal_entity", "true"],
    );
    expect([p.get("offset"), p.get("sortBy"), p.get("sortOrder")]).toEqual(["20", "publishedDate", "desc"]);
  });
});
