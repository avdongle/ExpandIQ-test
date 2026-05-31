import { describe, expect, it } from "vitest";

import { createSQLitePersistence, type RunStatus } from "./sqlite-persistence.js";

describe("SQLite persistence", () => {
  it("creates and reads a run", () => {
    const persistence = createSQLitePersistence(":memory:");

    const run = persistence.createRun({
      id: "run-1",
      goal: "Summarise the account notes",
      startedAt: "2026-05-31T01:00:00.000Z"
    });

    expect(run).toEqual({
      id: "run-1",
      goal: "Summarise the account notes",
      status: "running",
      reason: null,
      totalCost: 0,
      startedAt: "2026-05-31T01:00:00.000Z",
      finishedAt: null
    });
    expect(persistence.readRun("run-1")).toEqual({ ...run, steps: [] });
    const status: RunStatus = run.status;
    expect(status).toBe("running");

    persistence.close();
  });

  it("persists steps in step number order and marks a run finished with a reason", () => {
    const persistence = createSQLitePersistence(":memory:");
    persistence.createRun({
      id: "run-1",
      goal: "Draft follow-up",
      startedAt: "2026-05-31T01:00:00.000Z"
    });

    persistence.persistStep({
      id: "step-1",
      runId: "run-1",
      stepNumber: 2,
      kind: "tool_call",
      args: { tool: "crm.lookup", accountId: "acct-1" },
      result: { notesFound: true },
      startedAt: "2026-05-31T01:02:00.000Z",
      finishedAt: "2026-05-31T01:02:30.000Z"
    });
    persistence.persistStep({
      id: "step-2",
      runId: "run-1",
      stepNumber: 1,
      kind: "message",
      args: { prompt: "Find the account notes" },
      result: "Found the account notes.",
      startedAt: "2026-05-31T01:01:00.000Z",
      finishedAt: "2026-05-31T01:01:30.000Z"
    });
    persistence.markRunFinished("run-1", {
      status: "finished",
      reason: "succeeded",
      totalCost: 0.42,
      finishedAt: "2026-05-31T01:03:00.000Z"
    });

    expect(persistence.readRun("run-1")).toEqual({
      id: "run-1",
      goal: "Draft follow-up",
      status: "finished",
      reason: "succeeded",
      totalCost: 0.42,
      startedAt: "2026-05-31T01:00:00.000Z",
      finishedAt: "2026-05-31T01:03:00.000Z",
      steps: [
        {
          id: "step-2",
          runId: "run-1",
          stepNumber: 1,
          kind: "message",
          args: { prompt: "Find the account notes" },
          result: "Found the account notes.",
          startedAt: "2026-05-31T01:01:00.000Z",
          finishedAt: "2026-05-31T01:01:30.000Z"
        },
        {
          id: "step-1",
          runId: "run-1",
          stepNumber: 2,
          kind: "tool_call",
          args: { tool: "crm.lookup", accountId: "acct-1" },
          result: { notesFound: true },
          startedAt: "2026-05-31T01:02:00.000Z",
          finishedAt: "2026-05-31T01:02:30.000Z"
        }
      ]
    });

    persistence.close();
  });

  it("enforces step foreign keys", () => {
    const persistence = createSQLitePersistence(":memory:");

    expect(() =>
      persistence.persistStep({
        id: "step-1",
        runId: "missing-run",
        stepNumber: 1,
        kind: "message",
        args: { prompt: "Find the account notes" },
        result: "No run exists.",
        startedAt: "2026-05-31T01:01:00.000Z"
      })
    ).toThrow();

    persistence.close();
  });

  it("preserves existing total cost when finishing without a new cost", () => {
    const persistence = createSQLitePersistence(":memory:");
    persistence.createRun({
      id: "run-1",
      goal: "Draft follow-up",
      startedAt: "2026-05-31T01:00:00.000Z"
    });
    persistence.markRunFinished("run-1", {
      status: "finished",
      reason: "succeeded",
      totalCost: 1.25,
      finishedAt: "2026-05-31T01:03:00.000Z"
    });

    expect(
      persistence.markRunFinished("run-1", {
        reason: "succeeded",
        finishedAt: "2026-05-31T01:04:00.000Z"
      })
    ).toMatchObject({
      status: "finished",
      reason: "succeeded",
      totalCost: 1.25,
      finishedAt: "2026-05-31T01:04:00.000Z"
    });

    persistence.close();
  });

  it("uses a valid finished status when status is omitted", () => {
    const persistence = createSQLitePersistence(":memory:");
    persistence.createRun({
      id: "run-1",
      goal: "Draft follow-up",
      startedAt: "2026-05-31T01:00:00.000Z"
    });

    expect(
      persistence.markRunFinished("run-1", {
        reason: "succeeded",
        finishedAt: "2026-05-31T01:03:00.000Z"
      })
    ).toMatchObject({
      status: "finished",
      reason: "succeeded"
    });

    persistence.close();
  });

  it("lists runs newest first", () => {
    const persistence = createSQLitePersistence(":memory:");
    const tieBreaker = persistence.createRun({
      id: "run-z",
      goal: "Same time request",
      startedAt: "2026-05-31T01:00:00.000Z"
    });
    const oldestById = persistence.createRun({
      id: "run-a",
      goal: "Old request",
      startedAt: "2026-05-31T01:00:00.000Z"
    });
    const newest = persistence.createRun({
      id: "run-new",
      goal: "New request",
      startedAt: "2026-05-31T02:00:00.000Z"
    });

    expect(persistence.listRuns()).toEqual([newest, tieBreaker, oldestById]);

    persistence.close();
  });
});
