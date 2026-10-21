import { describe, expect, test } from "bun:test";
import { errorCode, runCLI } from "./helpers";

// Every case below fails validation before any request is made, so the suite is offline.
describe("search flag validation", () => {
  const cases: Array<[string[], string]> = [
    [["search"], "MISSING_REQUIRED"],
    [["search", "-q", ""], "BAD_ARG"],
    [["search", "-q", "x", "--bogus", "1"], "UNKNOWN_FLAG"],
    [["search", "-q", "x", "--state", "ZZ"], "BAD_ARG"],
    [["search", "-q", "x", "--remote", "remote,hybrid"], "BAD_ARG"],
    [["search", "-q", "x", "--type", "efetivo"], "BAD_ARG"],
    [["search", "-q", "x", "--jobage", "0.5"], "BAD_ARG"],
    [["search", "-q", "x", "--jobage", "7", "--sort", "relevance"], "CONFLICTING_FLAGS"],
    [["search", "-q", "x", "--page", "0"], "BAD_ARG"],
    [["search", "-q", "x", "--format", "csv"], "BAD_ARG"],
    [["detail"], "NO_ID"],
    [["detail", "12345678"], "BAD_ID"],
    [["detail", "https://acme.gupy.io/jobs/1", "--format", "table"], "BAD_ARG"],
    [["nope"], "BAD_CMD"],
  ];
  for (const [args, code] of cases) {
    test(`${args.join(" ") || "(empty)"} -> ${code}`, async () => {
      const r = await runCLI(args);
      expect(r.exitCode).toBe(1);
      expect(errorCode(r)).toBe(code);
    });
  }

  test("--help exits 0", async () => {
    const r = await runCLI(["search", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("--query");
  });
});
