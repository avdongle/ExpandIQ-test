import { describe, expect, it } from "vitest";

import { executeMockAgentRun } from "./agent-runner.js";
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
      totalCost: 0.008
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

  it("terminates with cost cap after persisting the step that crosses the cap", async () => {
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
    expect(run?.steps).toHaveLength(1);
    expect(run?.steps[0]?.kind).toBe("tool_call");

    persistence.close();
  });

  it("terminates with cost cap when the final response crosses the cap", async () => {
    const persistence = createSQLitePersistence(":memory:");

    await executeMockAgentRun({
      persistence,
      runId: "run-final-cost-cap",
      goal: "Create a report from the docs",
      maxCostUsd: 0.007
    });

    const run = persistence.readRun("run-final-cost-cap");
    expect(run).toMatchObject({
      status: "finished",
      reason: "cost_cap",
      totalCost: 0.008
    });
    expect(run?.steps).toHaveLength(4);
    expect(run?.steps.at(-1)?.kind).toBe("final");

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
});
