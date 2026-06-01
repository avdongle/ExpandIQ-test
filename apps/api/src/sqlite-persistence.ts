import { DatabaseSync, type SQLiteRow } from "node:sqlite";

export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

export type RunStatus = "running" | "finished";

export type RunRecord = {
  id: string;
  goal: string;
  status: RunStatus;
  reason: string | null;
  totalCost: number;
  finalAnswer: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type StepRecord = {
  id: string;
  runId: string;
  stepNumber: number;
  kind: string;
  cost: number;
  args: JSONValue;
  result: JSONValue;
  startedAt: string;
  finishedAt: string | null;
};

export type RunWithSteps = RunRecord & {
  steps: StepRecord[];
};

export type CreateRunInput = {
  id: string;
  goal: string;
  startedAt?: string;
};

export type PersistStepInput = {
  id: string;
  runId: string;
  stepNumber: number;
  kind: string;
  cost?: number;
  args: JSONValue;
  result: JSONValue;
  startedAt?: string;
  finishedAt?: string | null;
};

export type MarkRunFinishedInput = {
  status?: RunStatus;
  reason: string;
  totalCost?: number;
  finalAnswer?: string | null;
  finishedAt?: string;
};

export type SQLitePersistence = {
  createRun(input: CreateRunInput): RunRecord;
  persistStep(input: PersistStepInput): StepRecord;
  markRunFinished(runId: string, input: MarkRunFinishedInput): RunRecord | null;
  listRuns(): RunRecord[];
  readRun(runId: string): RunWithSteps | null;
  close(): void;
};

export function createSQLitePersistence(location: string): SQLitePersistence {
  const db = new DatabaseSync(location);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'finished')),
      reason TEXT,
      total_cost REAL NOT NULL DEFAULT 0,
      final_answer TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      kind TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      args_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      UNIQUE (run_id, step_number)
    );
  `);
  ensureRunsFinalAnswerColumn(db);
  ensureStepsCostColumn(db);

  return {
    createRun(input) {
      const run: RunRecord = {
        id: input.id,
        goal: input.goal,
        status: "running",
        reason: null,
        totalCost: 0,
        finalAnswer: null,
        startedAt: input.startedAt ?? new Date().toISOString(),
        finishedAt: null
      };

      db.prepare(
        "INSERT INTO runs (id, goal, status, reason, total_cost, final_answer, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        run.id,
        run.goal,
        run.status,
        run.reason,
        run.totalCost,
        run.finalAnswer,
        run.startedAt,
        run.finishedAt
      );

      return run;
    },

    persistStep(input) {
      const step: StepRecord = {
        id: input.id,
        runId: input.runId,
        stepNumber: input.stepNumber,
        kind: input.kind,
        cost: input.cost ?? 0,
        args: input.args,
        result: input.result,
        startedAt: input.startedAt ?? new Date().toISOString(),
        finishedAt: input.finishedAt ?? null
      };

      db.prepare(
        "INSERT INTO steps (id, run_id, step_number, kind, cost, args_json, result_json, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        step.id,
        step.runId,
        step.stepNumber,
        step.kind,
        step.cost,
        serializeJSONValue(step.args),
        serializeJSONValue(step.result),
        step.startedAt,
        step.finishedAt
      );

      return step;
    },

    markRunFinished(runId, input) {
      const currentRun = readRunRecord(db, runId);
      if (currentRun === null) {
        return null;
      }

      const finishedAt = input.finishedAt ?? new Date().toISOString();
      const totalCost = input.totalCost ?? currentRun.totalCost;
      const finalAnswer = input.finalAnswer ?? currentRun.finalAnswer;
      db.prepare(
        "UPDATE runs SET status = ?, reason = ?, total_cost = ?, final_answer = ?, finished_at = ? WHERE id = ?"
      ).run(
        input.status ?? "finished",
        input.reason,
        totalCost,
        finalAnswer,
        finishedAt,
        runId
      );

      return readRunRecord(db, runId);
    },

    listRuns() {
      return db
        .prepare(
          "SELECT id, goal, status, reason, total_cost, final_answer, started_at, finished_at FROM runs ORDER BY started_at DESC, id DESC"
        )
        .all()
        .map(toRunRecord);
    },

    readRun(runId) {
      const run = readRunRecord(db, runId);
      if (run === null) {
        return null;
      }

      const steps = db
        .prepare(
          "SELECT id, run_id, step_number, kind, cost, args_json, result_json, started_at, finished_at FROM steps WHERE run_id = ? ORDER BY step_number ASC"
        )
        .all(runId)
        .map(toStepRecord);

      return { ...run, steps };
    },

    close() {
      db.close();
    }
  };
}

function readRunRecord(db: DatabaseSync, runId: string): RunRecord | null {
  const row = db
    .prepare(
      "SELECT id, goal, status, reason, total_cost, final_answer, started_at, finished_at FROM runs WHERE id = ?"
    )
    .get(runId);

  return row === undefined ? null : toRunRecord(row);
}

function ensureRunsFinalAnswerColumn(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(runs)").all();
  const hasFinalAnswer = columns.some((row) => readString(row, "name") === "final_answer");

  if (!hasFinalAnswer) {
    db.exec("ALTER TABLE runs ADD COLUMN final_answer TEXT;");
  }
}

function ensureStepsCostColumn(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(steps)").all();
  const hasCost = columns.some((row) => readString(row, "name") === "cost");

  if (!hasCost) {
    db.exec("ALTER TABLE steps ADD COLUMN cost REAL NOT NULL DEFAULT 0;");
  }
}

function toRunRecord(row: SQLiteRow): RunRecord {
  const status = readString(row, "status");
  if (status !== "running" && status !== "finished") {
    throw new Error(`Invalid run status: ${status}`);
  }

  return {
    id: readString(row, "id"),
    goal: readString(row, "goal"),
    status,
    reason: readNullableString(row, "reason"),
    totalCost: readNumber(row, "total_cost"),
    finalAnswer: readNullableString(row, "final_answer"),
    startedAt: readString(row, "started_at"),
    finishedAt: readNullableString(row, "finished_at")
  };
}

function toStepRecord(row: SQLiteRow): StepRecord {
  return {
    id: readString(row, "id"),
    runId: readString(row, "run_id"),
    stepNumber: readNumber(row, "step_number"),
    kind: readString(row, "kind"),
    cost: readNumber(row, "cost"),
    args: parseJSONValue(readString(row, "args_json")),
    result: parseJSONValue(readString(row, "result_json")),
    startedAt: readString(row, "started_at"),
    finishedAt: readNullableString(row, "finished_at")
  };
}

function readString(row: SQLiteRow | undefined, key: string): string {
  const value = row?.[key];
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string`);
  }

  return value;
}

function readNullableString(row: SQLiteRow, key: string): string | null {
  const value = row[key];
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string or null`);
  }

  return value;
}

function readNumber(row: SQLiteRow | undefined, key: string): number {
  const value = row?.[key];
  if (typeof value !== "number") {
    throw new Error(`Expected ${key} to be a number`);
  }

  return value;
}

function parseJSONValue(serialized: string): JSONValue {
  return JSON.parse(serialized) as JSONValue;
}

function serializeJSONValue(value: JSONValue): string {
  return JSON.stringify(value);
}
