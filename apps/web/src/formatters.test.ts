import { describe, expect, it } from "vitest";

import {
  formatRunStatusLabel,
  formatRelativeTime,
  formatStepResultSummary,
  formatStepActivity,
  formatTerminalReason,
  getRunStatusTone
} from "./formatters.js";
import type { RunStep, RunSummary } from "./types.js";

describe("formatTerminalReason", () => {
  it("translates terminal reasons into human messages", () => {
    expect(formatTerminalReason("cost_cap", 0.25)).toContain("$0.25 budget");
    expect(formatTerminalReason("stuck")).toContain("repeated the same tool call");
    expect(formatTerminalReason("timeout")).toContain("execution time");
    expect(formatTerminalReason("unexpected")).toContain("unrecognised reason");
  });
});

describe("formatRunStatusLabel", () => {
  it("keeps terminal labels compact and scan-friendly", () => {
    expect(formatRunStatusLabel(run({ status: "running", reason: null }))).toBe("Running");
    expect(formatRunStatusLabel(run({ reason: "cost_cap" }))).toBe("Reached budget");
    expect(formatRunStatusLabel(run({ reason: "step_cap" }))).toBe("Step limit reached");
    expect(formatRunStatusLabel(run({ reason: "stuck" }))).toBe("Stuck");
  });
});

describe("getRunStatusTone", () => {
  it("maps outcomes to visual tone names", () => {
    expect(getRunStatusTone(null)).toBe("neutral");
    expect(getRunStatusTone(run({ status: "running", reason: null }))).toBe("active");
    expect(getRunStatusTone(run({ reason: "succeeded" }))).toBe("success");
    expect(getRunStatusTone(run({ reason: "error" }))).toBe("danger");
  });
});

describe("formatStepActivity", () => {
  it("renders known tools in friendly language", () => {
    expect(formatStepActivity(step({ tool: "search_docs", args: { query: "report" } }))).toBe(
      "Searching documents"
    );
    expect(formatStepActivity(step({ tool: "wait", args: { delayMs: "61000" } }))).toBe(
      "Waiting"
    );
  });

  it("keeps unknown tools friendly instead of exposing raw JSON", () => {
    expect(formatStepActivity(step({ tool: "unknown_tool", args: { noisy: true } }))).toBe(
      "Running tool"
    );
  });
});

describe("formatStepResultSummary", () => {
  it("summarises tool results without exposing raw JSON first", () => {
    expect(formatStepResultSummary(step({ tool: "search_docs" }))).toBe(
      "Tool completed successfully."
    );
    expect(
      formatStepResultSummary({
        ...step({ tool: "search_docs" }),
        result: { ok: false, error: { message: "Temporary outage" } }
      })
    ).toBe("Temporary outage");
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

function run(overrides: Partial<RunSummary>): RunSummary {
  return {
    id: "run-1",
    goal: "Create a report",
    status: "finished",
    reason: "succeeded",
    total_cost: 0.001,
    final_answer: "Done",
    started_at: "2026-05-31T01:00:00.000Z",
    finished_at: "2026-05-31T01:00:01.000Z",
    ...overrides
  };
}
