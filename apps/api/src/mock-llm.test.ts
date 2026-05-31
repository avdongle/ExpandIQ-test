import { describe, expect, it } from "vitest";

import { mockLlm } from "./mock-llm.js";
import { TOOLS } from "./mock-tools.js";
import type { StepRecord } from "./sqlite-persistence.js";

describe("mock LLM scenarios", () => {
  it("returns a report progression followed by a final response", () => {
    const first = mockLlm({
      goal: "Create a report from the docs",
      past_steps: [],
      candidate_tools: TOOLS
    });
    const second = mockLlm({
      goal: "Create a report from the docs",
      past_steps: [step(1, "search_docs")],
      candidate_tools: TOOLS
    });
    const third = mockLlm({
      goal: "Create a report from the docs",
      past_steps: [step(1, "search_docs"), step(2, "fetch_doc")],
      candidate_tools: TOOLS
    });
    const final = mockLlm({
      goal: "Create a report from the docs",
      past_steps: [
        step(1, "search_docs"),
        step(2, "fetch_doc"),
        step(3, "summarise_text")
      ],
      candidate_tools: TOOLS
    });

    expect(first).toMatchObject({ type: "tool_call", tool: "search_docs" });
    expect(second).toMatchObject({ type: "tool_call", tool: "fetch_doc" });
    expect(third).toMatchObject({ type: "tool_call", tool: "summarise_text" });
    expect(final).toEqual({
      type: "final",
      content: "Report complete: searched docs, fetched source material, and summarised the findings.",
      cost: 0.001
    });
  });

  it("repeats the same call for the stuck flow", () => {
    const responses = [0, 1, 2].map((index) =>
      mockLlm({
        goal: "This loop is stuck",
        past_steps: Array.from({ length: index }, (_, stepIndex) =>
          step(stepIndex + 1, "fetch_doc", { docId: "loop-doc" })
        ),
        candidate_tools: TOOLS
      })
    );

    expect(responses).toEqual([
      {
        type: "tool_call",
        tool: "fetch_doc",
        args: { docId: "loop-doc" },
        cost: 0.002
      },
      {
        type: "tool_call",
        tool: "fetch_doc",
        args: { docId: "loop-doc" },
        cost: 0.002
      },
      {
        type: "tool_call",
        tool: "fetch_doc",
        args: { docId: "loop-doc" },
        cost: 0.002
      }
    ]);
  });

  it("emits high costs for the cost-cap flow", () => {
    expect(
      mockLlm({
        goal: "Run an expensive budget test",
        past_steps: [],
        candidate_tools: TOOLS
      })
    ).toEqual({
      type: "tool_call",
      tool: "query_sql",
      args: { sql: "select * from account_activity" },
      cost: 0.08
    });
  });
});

function step(
  stepNumber: number,
  tool: string,
  args: Record<string, string> = {}
): StepRecord {
  return {
    id: `step-${stepNumber}`,
    runId: "run-1",
    stepNumber,
    kind: "tool_call",
    args: { tool, args, cost: 0.001 },
    result: { ok: true },
    startedAt: "2026-05-31T01:00:00.000Z",
    finishedAt: "2026-05-31T01:00:01.000Z"
  };
}
