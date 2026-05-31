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

  it("emits varied high-cost calls for the cost-cap flow", () => {
    const first = mockLlm({
      goal: "Run an expensive budget test",
      past_steps: [],
      candidate_tools: TOOLS
    });
    const second = mockLlm({
      goal: "Run an expensive budget test",
      past_steps: [step(1, "query_sql", { sql: "select * from account_activity limit 25 offset 0" })],
      candidate_tools: TOOLS
    });

    expect(first).toEqual({
      type: "tool_call",
      tool: "query_sql",
      args: { sql: "select * from account_activity limit 25 offset 0" },
      cost: 0.18
    });
    expect(second).toEqual({
      type: "tool_call",
      tool: "query_sql",
      args: { sql: "select * from account_activity limit 25 offset 25" },
      cost: 0.18
    });
  });

  it("emits a transient lookup call before the retry scenario final answer", () => {
    const first = mockLlm({
      goal: "Handle a transient retry case",
      past_steps: [],
      candidate_tools: TOOLS
    });
    const final = mockLlm({
      goal: "Handle a transient retry case",
      past_steps: [step(1, "lookup_contact", { contactId: "transient-contact" })],
      candidate_tools: TOOLS
    });

    expect(first).toEqual({
      type: "tool_call",
      tool: "lookup_contact",
      args: { contactId: "transient-contact" },
      cost: 0.002
    });
    expect(final).toEqual({
      type: "final",
      content: "Retry flow complete: recovered from a transient lookup error.",
      cost: 0.001
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
