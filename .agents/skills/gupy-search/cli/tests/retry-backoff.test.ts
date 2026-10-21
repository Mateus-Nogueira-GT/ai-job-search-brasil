import { afterEach, describe, expect, test } from "bun:test";
import { httpFetch } from "../src/helpers";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
});

function instantTimers() {
  globalThis.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as unknown as typeof setTimeout;
}

function stubFetch(responses: Array<() => Response>): { calls: number; init?: RequestInit } {
  const state: { calls: number; init?: RequestInit } = { calls: 0 };
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    state.init = init;
    const i = Math.min(state.calls, responses.length - 1);
    state.calls++;
    return responses[i]();
  }) as unknown as typeof fetch;
  return state;
}

describe("httpFetch", () => {
  test("retries a 429 and succeeds", async () => {
    instantTimers();
    const s = stubFetch([() => new Response("", { status: 429 }), () => new Response("{}", { status: 200 })]);
    expect(await httpFetch("https://portal.gupy.io/x")).toBe("{}");
    expect(s.calls).toBe(2);
  });

  test("gives up after max retries on 5xx", async () => {
    instantTimers();
    const s = stubFetch([() => new Response("", { status: 503 })]);
    await expect(httpFetch("https://portal.gupy.io/x")).rejects.toThrow("503");
    expect(s.calls).toBe(7);
  });

  test("treats 404 and redirects as not found, without following", async () => {
    const s = stubFetch([() => new Response("", { status: 307, headers: { location: "/" } })]);
    expect(await httpFetch("https://a.gupy.io/jobs/1")).toBeNull();
    expect(s.init?.redirect).toBe("manual");
    expect(s.init?.signal).toBeInstanceOf(AbortSignal);
  });
});
