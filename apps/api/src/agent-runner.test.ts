import { describe, expect, it } from "vitest";

import { executeMockAgentRun, type AgentClock } from "./agent-runner.js";
import type {
  CreateRunInput,
  MarkRunFinishedInput,
  PersistStepInput,
  RunRecord,
  RunWithSteps,
  SQLitePersistence,
  StepRecord
} from "./sqlite-persistence.js";

describe("mock agent runner guards", () => {
  it("terminates with step cap after the configured number of tool calls", async () => {
    const persistence = createMemoryPersistence();
    let plannerCalls = 0;

    await executeMockAgentRun({
      persistence,
      runId: "run-step-cap",
      goal: "Fetch docs until capped",
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

    expect(persistence.readRun("run-step-cap")).toMatchObject({
      status: "finished",
      reason: "step_cap",
      totalCost: 0.002,
      steps: [
        expect.objectContaining({
          args: { tool: "fetch_doc", args: { docId: "doc-1" }, cost: 0.001 }
        }),
        expect.objectContaining({
          args: { tool: "fetch_doc", args: { docId: "doc-2" }, cost: 0.001 }
        })
      ]
    });
    expect(plannerCalls).toBe(2);
  });

  it("terminates with cost cap before persisting a tool call that exceeds the budget", async () => {
    const persistence = createMemoryPersistence();

    await executeMockAgentRun({
      persistence,
      runId: "run-cost-cap",
      goal: "Run expensive budget query",
      maxCostUsd: 0.05
    });

    expect(persistence.readRun("run-cost-cap")).toMatchObject({
      status: "finished",
      reason: "cost_cap",
      totalCost: 0.18,
      steps: []
    });
  });

  it("terminates with stuck after the same tool call signature repeats", async () => {
    const persistence = createMemoryPersistence();

    await executeMockAgentRun({
      persistence,
      runId: "run-stuck",
      goal: "This loop is stuck",
      stuckCallThreshold: 3
    });

    const run = persistence.readRun("run-stuck");

    expect(run).toMatchObject({
      status: "finished",
      reason: "stuck",
      totalCost: 0.006
    });
    expect(run?.steps.map((step) => step.args)).toEqual([
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
      { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 }
    ]);
  });

  it("terminates with timeout using an injected deterministic clock", async () => {
    const persistence = createMemoryPersistence();
    let nowMsCalls = 0;
    const clock: AgentClock = {
      nowIso: () => "2026-05-31T01:00:00.000Z",
      nowMs: () => {
        nowMsCalls += 1;

        return nowMsCalls === 1 ? 0 : 60_000;
      }
    };

    await executeMockAgentRun({
      persistence,
      runId: "run-timeout",
      goal: "Create a report from docs",
      clock,
      timeoutMs: 60_000
    });

    expect(persistence.readRun("run-timeout")).toMatchObject({
      status: "finished",
      reason: "timeout",
      totalCost: 0,
      steps: []
    });
  });
});

describe("mock agent runner retry behaviour", () => {
  it("persists recovered retry metadata and reaches the final answer", async () => {
    const persistence = createMemoryPersistence();

    await executeMockAgentRun({
      persistence,
      runId: "run-retry",
      goal: "Handle a transient retry case"
    });

    const run = persistence.readRun("run-retry");

    expect(run).toMatchObject({
      status: "finished",
      reason: "succeeded",
      totalCost: 0.003,
      finalAnswer: "Retry flow complete: recovered from a transient lookup error."
    });
    expect(run?.steps[0]?.result).toMatchObject({
      ok: true,
      retry: {
        attempts: 2,
        recovered: true,
        errors: [{ code: "TRANSIENT_LOOKUP", recoverable: true }]
      }
    });
  });

  it("persists non-recoverable tool errors without retrying", async () => {
    const persistence = createMemoryPersistence();

    await executeMockAgentRun({
      persistence,
      runId: "run-semantic-error",
      goal: "Send an email without an idempotency key",
      mockLlm() {
        return {
          type: "tool_call",
          tool: "send_email",
          args: { contactId: "contact-1", body: "Hello" },
          cost: 0.001
        };
      }
    });

    expect(persistence.readRun("run-semantic-error")).toMatchObject({
      status: "finished",
      reason: "error",
      totalCost: 0.001,
      steps: [
        expect.objectContaining({
          result: {
            ok: false,
            data: null,
            error: {
              code: "IDEMPOTENCY_KEY_REQUIRED",
              message: "send_email requires args.idempotency_key before execution.",
              recoverable: false
            },
            retry: {
              attempts: 1,
              recovered: false,
              errors: [
                {
                  code: "IDEMPOTENCY_KEY_REQUIRED",
                  message: "send_email requires args.idempotency_key before execution.",
                  recoverable: false
                }
              ]
            }
          }
        })
      ]
    });
  });
});

function createMemoryPersistence(): SQLitePersistence {
  const runs = new Map<string, RunRecord>();
  const steps = new Map<string, StepRecord[]>();

  return {
    createRun(input: CreateRunInput) {
      const run: RunRecord = {
        id: input.id,
        goal: input.goal,
        status: "running",
        reason: null,
        totalCost: 0,
        finalAnswer: null,
        startedAt: input.startedAt ?? "2026-05-31T01:00:00.000Z",
        finishedAt: null
      };

      runs.set(run.id, run);
      steps.set(run.id, []);

      return run;
    },
    persistStep(input: PersistStepInput) {
      const step: StepRecord = {
        id: input.id,
        runId: input.runId,
        stepNumber: input.stepNumber,
        kind: input.kind,
        args: input.args,
        result: input.result,
        startedAt: input.startedAt ?? "2026-05-31T01:00:00.000Z",
        finishedAt: input.finishedAt ?? null
      };

      steps.set(step.runId, [...(steps.get(step.runId) ?? []), step]);

      return step;
    },
    markRunFinished(runId: string, input: MarkRunFinishedInput) {
      const run = runs.get(runId);

      if (run === undefined) {
        return null;
      }

      const finishedRun: RunRecord = {
        ...run,
        status: input.status ?? "finished",
        reason: input.reason,
        totalCost: input.totalCost ?? run.totalCost,
        finalAnswer: input.finalAnswer ?? run.finalAnswer,
        finishedAt: input.finishedAt ?? "2026-05-31T01:00:00.000Z"
      };

      runs.set(runId, finishedRun);

      return finishedRun;
    },
    listRuns() {
      return [...runs.values()];
    },
    readRun(runId: string): RunWithSteps | null {
      const run = runs.get(runId);

      if (run === undefined) {
        return null;
      }

      return {
        ...run,
        steps: [...(steps.get(runId) ?? [])].sort(
          (left, right) => left.stepNumber - right.stepNumber
        )
      };
    },
    close() {
      runs.clear();
      steps.clear();
    }
  };
}
