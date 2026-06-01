import { describe, expect, it } from "vitest";

import {
  formatRelativeTime,
  formatStepActivity,
  formatTerminalReason
} from "./formatters.js";
import type { RunStep } from "./types.js";

describe("formatTerminalReason", () => {
  it("translates terminal reasons into human messages", () => {
    expect(formatTerminalReason("cost_cap", 0.25)).toContain("$0.25 budget");
    expect(formatTerminalReason("stuck")).toContain("repeated the same action");
    expect(formatTerminalReason("timeout")).toContain("time limit");
    expect(formatTerminalReason("unexpected")).toContain("unrecognised reason");
  });
});

describe("formatStepActivity", () => {
  it("renders known tools in friendly language", () => {
    expect(formatStepActivity(step({ tool: "search_docs", args: { query: "report" } }))).toBe(
      "Searched the docs for relevant material."
    );
    expect(formatStepActivity(step({ tool: "wait", args: { delayMs: "61000" } }))).toBe(
      "Waited long enough to hit the time limit."
    );
  });

  it("keeps unknown tools friendly instead of exposing raw JSON", () => {
    expect(formatStepActivity(step({ tool: "unknown_tool", args: { noisy: true } }))).toBe(
      "Ran a tool step."
    );
  });
});

describe("formatRelativeTime", () => {
  it("formats recent run timestamps", () => {
    expect(
      formatRelativeTime(
        "2026-05-31T01:00:00.000Z",
        new Date("2026-05-31T01:05:00.000Z")
      )
    ).toBe("5m ago");
  });
});

function step(args: RunStep["args"]): RunStep {
  return {
    id: "step-1",
    run_id: "run-1",
    step_number: 1,
    kind: "tool_call",
    cost: 0.001,
    args,
    result: { ok: true },
    started_at: "2026-05-31T01:00:00.000Z",
    finished_at: "2026-05-31T01:00:01.000Z"
  };
}
