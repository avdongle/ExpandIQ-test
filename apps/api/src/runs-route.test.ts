import { afterEach, describe, expect, it } from "vitest";

import { createServer, type ApiServer } from "./server.js";
import { createSQLitePersistence, type SQLitePersistence } from "./sqlite-persistence.js";

type TestContext = {
  persistence: SQLitePersistence;
  server: ApiServer;
};

const contexts: TestContext[] = [];

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(({ server }) => server.close()));
});

describe("runs API routes", () => {
  it("creates a run and returns a run id", async () => {
    const { server } = createTestServer(["run-create"]);

    const response = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Create a report from the docs"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      run_id: "run-create",
      run: {
        id: "run-create",
        goal: "Create a report from the docs",
        status: "finished",
        reason: "succeeded",
        total_cost: 0.008,
        final_answer:
          "Report complete: searched docs, fetched source material, and summarised the findings."
      }
    });
  });

  it("returns an internal error if a created run cannot be read back", async () => {
    const { persistence, server } = createTestServer(["run-read-back"]);
    const originalMarkRunFinished = persistence.markRunFinished.bind(persistence);
    const originalReadRun = persistence.readRun.bind(persistence);
    let finished = false;

    persistence.markRunFinished = (runId, input) => {
      const run = originalMarkRunFinished(runId, input);
      finished = true;
      return run;
    };
    persistence.readRun = (runId) => (finished ? null : originalReadRun(runId));

    const response = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Create a report from the docs"
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: "Internal Server Error",
      message: "Created run run-read-back could not be read back from persistence"
    });
  });

  it("rejects missing, empty, and whitespace-only goals", async () => {
    const { server } = createTestServer(["run-validation"]);

    for (const payload of [{}, { goal: "" }, { goal: "   " }]) {
      const response = await server.inject({
        method: "POST",
        url: "/runs",
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "goal must be a non-empty string"
        }
      });
    }
  });

  it("applies max step and max cost defaults", async () => {
    const { persistence, server } = createTestServer(["run-defaults"]);

    const response = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Create a report from the docs"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(persistence.readRun("run-defaults")).toMatchObject({
      reason: "succeeded",
      totalCost: 0.008
    });
  });

  it("rejects max_steps and max_cost_usd above the local caps", async () => {
    const { server } = createTestServer(["run-caps"]);

    const maxStepsResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Create a report from the docs",
        max_steps: 51
      }
    });
    const maxCostResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Create a report from the docs",
        max_cost_usd: 2.01
      }
    });

    expect(maxStepsResponse.statusCode).toBe(400);
    expect(maxStepsResponse.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "max_steps must be an integer between 1 and 50"
      }
    });
    expect(maxCostResponse.statusCode).toBe(400);
    expect(maxCostResponse.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "max_cost_usd must be a number between 0.001 and 2"
      }
    });
  });

  it("lists recent runs newest first with pagination metadata", async () => {
    const { server } = createTestServer(["run-old", "run-middle", "run-new"]);

    await createRun(server, "Old default request");
    await createRun(server, "Middle report request");
    await createRun(server, "Newest retry request");

    const response = await server.inject({
      method: "GET",
      url: "/runs?limit=2&offset=0"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      pagination: {
        limit: 2,
        offset: 0,
        total: 3,
        next_offset: 2
      },
      runs: [{ id: "run-new" }, { id: "run-middle" }]
    });
  });

  it("returns run state and ordered steps", async () => {
    const { server } = createTestServer(["run-detail"]);
    await createRun(server, "Create a report from the docs");

    const response = await server.inject({
      method: "GET",
      url: "/runs/run-detail"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      run: {
        id: "run-detail",
        status: "finished",
        reason: "succeeded",
        final_answer:
          "Report complete: searched docs, fetched source material, and summarised the findings."
      },
      steps: [
        { step_number: 1, kind: "tool_call" },
        { step_number: 2, kind: "tool_call" },
        { step_number: 3, kind: "tool_call" },
        { step_number: 4, kind: "final" }
      ]
    });
  });

  it("returns RUN_NOT_FOUND for unknown run ids", async () => {
    const { server } = createTestServer(["run-missing"]);

    const response = await server.inject({
      method: "GET",
      url: "/runs/missing-run"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      }
    });
  });
});

function createTestServer(runIds: string[]): TestContext {
  const persistence = createSQLitePersistence(":memory:");
  let clockTick = 0;
  const server = createServer({
    clock: {
      nowIso: () => {
        clockTick += 1;
        return new Date(Date.UTC(2026, 4, 31, 1, 0, clockTick)).toISOString();
      },
      nowMs: () => clockTick * 1000
    },
    persistence,
    createRunId: () => {
      const nextRunId = runIds.shift();
      if (nextRunId === undefined) {
        throw new Error("Test ran out of run ids");
      }

      return nextRunId;
    }
  });
  contexts.push({ persistence, server });

  return { persistence, server };
}

async function createRun(server: ApiServer, goal: string): Promise<void> {
  const response = await server.inject({
    method: "POST",
    url: "/runs",
    payload: { goal }
  });

  expect(response.statusCode).toBe(201);
}
