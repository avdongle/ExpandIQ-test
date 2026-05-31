import { describe, expect, it } from "vitest";

import { executeMockAgentRun, type AgentClock } from "./agent-runner.js";
import { TOOLS } from "./mock-tools.js";
import { createSQLitePersistence } from "./sqlite-persistence.js";

describe("mock agent runner", () => {
  it("persists report steps and succeeds", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-report",
      goal: "Create a report from the docs"
    });

    const run = persistence.readRun("run-report");
    expect(run).toMatchObject({
      status: "finished",
      reason: "succeeded",
      totalCost: 0.008,
      finalAnswer: "Report complete: searched docs, fetched source material, and summarised the findings."
    });
    expect(run?.steps.map((currentStep) => currentStep.kind)).toEqual([
      "tool_call",
      "tool_call",
      "tool_call",
      "final"
    ]);
    expect(run?.steps.at(-1)?.result).toEqual({
      content: "Report complete: searched docs, fetched source material, and summarised the findings.",
      cost: 0.001
    });

    persistence.close();
  });

  it("terminates repeated calls as stuck", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-stuck",
      goal: "This loop is stuck"
    });

    const run = persistence.readRun("run-stuck");
    expect(run).toMatchObject({
      status: "finished",
      reason: "stuck",
      totalCost: 0.006
    });
    expect(run?.steps).toHaveLength(3);
    expect(run?.steps.map((currentStep) => currentStep.args)).toEqual([
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 }
    ]);

    persistence.close();
  });

  it("terminates with cost cap before executing a tool call that crosses the cap", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-cost-cap",
      goal: "Run an expensive budget test",
      maxCostUsd: 0.05
    });

    const run = persistence.readRun("run-cost-cap");
    expect(run).toMatchObject({
      status: "finished",
      reason: "cost_cap",
      totalCost: 0.08
    });
    expect(run?.steps).toHaveLength(0);

    persistence.close();
  });

  it("terminates with cost cap when the final response crosses the cap", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-final-cost-cap",
      goal: "Create a report from the docs",
      maxCostUsd: 0.008
    });

    const run = persistence.readRun("run-final-cost-cap");
    expect(run).toMatchObject({
      status: "finished",
      reason: "cost_cap",
      totalCost: 0.008,
      finalAnswer: null
    });
    expect(run?.steps.map((step) => step.kind)).toEqual([
      "tool_call",
      "tool_call",
      "tool_call"
    ]);

    persistence.close();
  });

  it("terminates with error when the mock LLM planner throws", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-planner-error",
      goal: "Create a report from the docs",
      registry: []
    });

    const run = persistence.readRun("run-planner-error");
    expect(run).toMatchObject({
      status: "finished",
      reason: "error",
      totalCost: 0
    });
    expect(run?.steps).toEqual([
      expect.objectContaining({
        kind: "error",
        args: { type: "planner" },
        result: {
          code: "MOCK_LLM_ERROR",
          message: "Mock LLM selected unavailable tool: search_docs"
        }
      })
    ]);

    persistence.close();
  });

  it("retries a recoverable tool error and succeeds with retry metadata", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-retry",
      goal: "Handle a transient retry case"
    });

    const run = persistence.readRun("run-retry");
    expect(run).toMatchObject({
      status: "finished",
      reason: "succeeded",
      totalCost: 0.003
    });
    expect(run?.steps).toHaveLength(2);
    expect(run?.steps[0]?.result).toMatchObject({
      ok: true,
      retry: {
        attempts: 2,
        recovered: true,
        errors: [
          {
            code: "TRANSIENT_LOOKUP",
            recoverable: true
          }
        ]
      }
    });

    persistence.close();
  });

  it("passes narrowed candidate tools to the mock LLM before every planner call", async () => {
    const persistence = createSQLitePersistence(":memory:");
    const candidateToolIds: string[][] = [];

    await executeMockAgentRun({
      persistence,
      runId: "run-retrieval",
      goal: "Create a report from the docs",
      topK: 2,
      mockLlm(request) {
        candidateToolIds.push(request.candidate_tools.map((tool) => tool.id));

        if (request.past_steps.length === 0) {
          return {
            type: "tool_call",
            tool: "search_docs",
            args: { query: "report source docs" },
            cost: 0.002
          };
        }

        return {
          type: "final",
          content: "Done with narrowed tools.",
          cost: 0.001
        };
      }
    });

    expect(candidateToolIds).toEqual([
      ["search_docs", "fetch_doc"],
      ["search_docs", "fetch_doc"]
    ]);
    expect(candidateToolIds.every((ids) => ids.length < TOOLS.length)).toBe(true);

    persistence.close();
  });

  it("terminates with step cap before requesting another planner response", async () => {
    const persistence = createSQLitePersistence(":memory:");
    let plannerCalls = 0;

    await executeMockAgentRun({
      persistence,
      runId: "run-step-cap",
      goal: "Keep fetching docs",
      maxSteps: 2,
      mockLlm() {
        plannerCalls += 1;

        return {
          type: "tool_call",
          tool: "fetch_doc",
          args: { docId: `doc-${plannerCalls}` },
          cost: 0.001
        };
      }
    });

    const run = persistence.readRun("run-step-cap");
    expect(run).toMatchObject({
      status: "finished",
      reason: "step_cap",
      totalCost: 0.002
    });
    expect(run?.steps).toHaveLength(2);
    expect(plannerCalls).toBe(2);

    persistence.close();
  });

  it("terminates with timeout using an injected clock", async () => {
    const persistence = createSQLitePersistence(":memory:");
    let clockCalls = 0;
    const clock: AgentClock = {
      nowIso: () => "2026-05-31T01:00:00.000Z",
      nowMs: () => {
        clockCalls += 1;
        return clockCalls === 1 ? 0 : 61_000;
      }
    };

    await executeMockAgentRun({
      persistence,
      runId: "run-timeout",
      goal: "Create a report from the docs",
      timeoutMs: 60_000,
      clock
    });

    const run = persistence.readRun("run-timeout");
    expect(run).toMatchObject({
      status: "finished",
      reason: "timeout",
      totalCost: 0
    });
    expect(run?.steps).toHaveLength(0);

    persistence.close();
  });

  it("does not retry non-recoverable tool errors", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-non-recoverable",
      goal: "Use a missing tool",
      mockLlm() {
        return {
          type: "tool_call",
          tool: "missing_tool",
          args: {},
          cost: 0.001
        };
      }
    });

    const run = persistence.readRun("run-non-recoverable");
    expect(run).toMatchObject({
      status: "finished",
      reason: "error",
      totalCost: 0.001
    });
    expect(run?.steps[0]?.result).toMatchObject({
      ok: false,
      error: {
        code: "UNKNOWN_TOOL",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false
      }
    });

    persistence.close();
  });

  it("persists send_email idempotency validation failures from the executor", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-email-idempotency",
      goal: "Email a contact",
      mockLlm() {
        return {
          type: "tool_call",
          tool: "send_email",
          args: { contactId: "contact-1", body: "Hello" },
          cost: 0.001
        };
      }
    });

    const run = persistence.readRun("run-email-idempotency");
    expect(run).toMatchObject({
      status: "finished",
      reason: "error",
      totalCost: 0.001
    });
    expect(run?.steps).toHaveLength(1);
    expect(run?.steps[0]?.result).toMatchObject({
      ok: false,
      error: {
        code: "IDEMPOTENCY_KEY_REQUIRED",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false
      }
    });

    persistence.close();
  });
});
