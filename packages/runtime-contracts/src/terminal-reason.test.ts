import { describe, expect, it } from "vitest";

import { TERMINAL_REASONS } from "./terminal-reason.js";

describe("terminal reasons", () => {
  it("matches the assignment terminal values exactly", () => {
    expect(TERMINAL_REASONS).toEqual([
      "step_cap",
      "cost_cap",
      "stuck",
      "timeout",
      "error",
      "succeeded"
    ]);
  });

  it("does not contain duplicate terminal values", () => {
    expect(new Set(TERMINAL_REASONS).size).toBe(TERMINAL_REASONS.length);
  });
});
