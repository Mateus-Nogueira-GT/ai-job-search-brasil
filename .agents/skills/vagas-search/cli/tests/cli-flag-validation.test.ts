import { describe, expect, test } from "bun:test";
import { errorCode, runCLI } from "./helpers";

// Every case fails validation before any request, so the suite is offline.
describe("flag validation", () => {
  const cases: Array<[string[], string]> = [
    [["search"], "MISSING_REQUIRED"],
    [["search", "-q", "!!!"], "BAD_ARG"],
    [["search", "-q", "x", "--page", "2"], "UNKNOWN_FLAG"],
    [["search", "-q", "x", "--jobage", "abc"], "BAD_ARG"],
    [["search", "-q", "x", "--limit", "0"], "BAD_ARG"],
    [["search", "-q", "x", "--format", "csv"], "BAD_ARG"],
    [["search", "-q", "x", "--remote", "yes"], "BAD_ARG"],
    [["detail"], "NO_ID"],
    [["detail", "https://evil.io/vagas/v2840369"], "BAD_ID"],
    [["nope"], "BAD_CMD"],
  ];
  for (const [args, code] of cases) {
    test(`${args.join(" ") || "(empty)"} -> ${code}`, async () => {
      const r = await runCLI(args);
      expect(r.exitCode).toBe(1);
      expect(errorCode(r)).toBe(code);
    });
  }
});
