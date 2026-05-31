import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLiteRow } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { createServer, type ApiServer } from "./server.js";
import { createSQLitePersistence } from "./sqlite-persistence.js";

type TestContext = {
  dbPath: string;
  server: ApiServer;
  tempDir: string;
};

const contexts: TestContext[] = [];

afterEach(async () => {
  const currentContexts = contexts.splice(0);
  await Promise.all(currentContexts.map(({ server }) => server.close()));

  for (const { tempDir } of currentContexts) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("runs API integration", () => {
  it("creates, executes, persists, and reads back a retry-success run", async () => {
    const { dbPath, server } = createIntegrationServer("run-retry-api");

    const createResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Research the Q3 report and summarise it, with one transient retry case"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      run_id: "run-retry-api",
      run: {
        id: "run-retry-api",
        status: "finished",
        reason: "succeeded",
        total_cost: 0.003,
        final_answer: "Retry flow complete: recovered from a transient lookup error."
      }
    });

    const readResponse = await server.inject({
      method: "GET",
      url: "/runs/run-retry-api"
    });

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      run: {
        id: "run-retry-api",
        status: "finished",
        reason: "succeeded",
        final_answer: "Retry flow complete: recovered from a transient lookup error."
      },
      steps: [
        {
          step_number: 1,
          kind: "tool_call",
          result: {
            ok: true,
            retry: {
              attempts: 2,
              recovered: true,
              errors: [{ code: "TRANSIENT_LOOKUP", recoverable: true }]
            }
          }
        },
        { step_number: 2, kind: "final" }
      ]
    });

    const db = new DatabaseSync(dbPath);
    try {
      const runRow = getRequiredRow(
        db,
        "SELECT status, reason, total_cost, final_answer, finished_at FROM runs WHERE id = ?",
        "run-retry-api"
      );
      expect(readString(runRow, "status")).toBe("finished");
      expect(readString(runRow, "reason")).toBe("succeeded");
      expect(readNumber(runRow, "total_cost")).toBe(0.003);
      expect(readString(runRow, "final_answer")).toBe(
        "Retry flow complete: recovered from a transient lookup error."
      );
      expect(readString(runRow, "finished_at")).toBe("2026-05-31T01:00:06.000Z");

      const stepRows = db
        .prepare(
          "SELECT step_number, kind, args_json, result_json FROM steps WHERE run_id = ? ORDER BY step_number ASC"
        )
        .all("run-retry-api");
      expect(stepRows.map((row) => readNumber(row, "step_number"))).toEqual([1, 2]);
      expect(stepRows.map((row) => readString(row, "kind"))).toEqual(["tool_call", "final"]);
      expect(parseJSON(readString(stepRows[0], "result_json"))).toMatchObject({
        ok: true,
        retry: {
          attempts: 2,
          recovered: true,
          errors: [{ code: "TRANSIENT_LOOKUP", recoverable: true }]
        }
      });
    } finally {
      db.close();
    }
  });

  it("creates, persists, and reads back a stuck terminal run", async () => {
    const { dbPath, server } = createIntegrationServer("run-stuck-api");

    const createResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        goal: "Trigger stuck scenario"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      run_id: "run-stuck-api",
      run: {
        id: "run-stuck-api",
        status: "finished",
        reason: "stuck",
        total_cost: 0.006,
        final_answer: null
      }
    });

    const readResponse = await server.inject({
      method: "GET",
      url: "/runs/run-stuck-api"
    });

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      run: {
        id: "run-stuck-api",
        status: "finished",
        reason: "stuck",
        final_answer: null
      },
      steps: [
        { step_number: 1, kind: "tool_call" },
        { step_number: 2, kind: "tool_call" },
        { step_number: 3, kind: "tool_call" }
      ]
    });

    const db = new DatabaseSync(dbPath);
    try {
      const runRow = getRequiredRow(
        db,
        "SELECT status, reason, total_cost, final_answer, finished_at FROM runs WHERE id = ?",
        "run-stuck-api"
      );
      expect(readString(runRow, "status")).toBe("finished");
      expect(readString(runRow, "reason")).toBe("stuck");
      expect(readNumber(runRow, "total_cost")).toBe(0.006);
      expect(runRow.final_answer).toBeNull();
      expect(readString(runRow, "finished_at")).toBe("2026-05-31T01:00:08.000Z");

      const stepRows = db
        .prepare(
          "SELECT step_number, args_json FROM steps WHERE run_id = ? ORDER BY step_number ASC"
        )
        .all("run-stuck-api");
      expect(stepRows.map((row) => readNumber(row, "step_number"))).toEqual([1, 2, 3]);
      expect(stepRows.map((row) => parseJSON(readString(row, "args_json")))).toEqual([
        { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
        { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 },
        { tool: "fetch_doc", args: { docId: "loop-doc" }, cost: 0.002 }
      ]);
    } finally {
      db.close();
    }
  });
});

function createIntegrationServer(runId: string): TestContext {
  const tempDir = mkdtempSync(join(tmpdir(), "expandiq-api-integration-"));
  const dbPath = join(tempDir, "runs.sqlite");
  let clockTick = 0;
  const server = createServer({
    clock: {
      nowIso: () => {
        clockTick += 1;
        return new Date(Date.UTC(2026, 4, 31, 1, 0, clockTick)).toISOString();
      },
      nowMs: () => clockTick * 1000
    },
    createRunId: () => runId,
    persistence: createSQLitePersistence(dbPath)
  });
  const context = { dbPath, server, tempDir };
  contexts.push(context);

  return context;
}

function getRequiredRow(db: DatabaseSync, sql: string, id: string): SQLiteRow {
  const row = db.prepare(sql).get(id);
  if (row === undefined) {
    throw new Error(`Expected database row for ${id}`);
  }

  return row;
}

function readString(row: SQLiteRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Expected ${column} to be a string`);
  }

  return value;
}

function readNumber(row: SQLiteRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new Error(`Expected ${column} to be a number`);
  }

  return value;
}

function parseJSON(value: string): unknown {
  return JSON.parse(value) as unknown;
}
