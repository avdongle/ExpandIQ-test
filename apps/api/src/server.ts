import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { executeMockAgentRun, type AgentClock } from "./agent-runner.js";
import {
  createSQLitePersistence,
  type JSONValue,
  type RunRecord,
  type SQLitePersistence,
  type StepRecord
} from "./sqlite-persistence.js";

const DEFAULT_MAX_STEPS = 20;
const MAX_STEPS_CAP = 50;
const DEFAULT_MAX_COST_USD = 0.5;
const MAX_COST_USD_CAP = 2;
const MIN_COST_USD = 0.001;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export type ApiServer = FastifyInstance;

export type CreateServerOptions = {
  clock?: AgentClock;
  createRunId?: () => string;
  persistence?: SQLitePersistence;
};

type CreateRunBody = {
  goal?: unknown;
  max_steps?: unknown;
  max_cost_usd?: unknown;
};

type ListRunsQuery = {
  limit?: unknown;
  offset?: unknown;
};

type RunRouteParams = {
  id?: unknown;
};

type ErrorCode = "VALIDATION_ERROR" | "RUN_NOT_FOUND";

export function createServer({
  clock,
  createRunId = createDefaultRunId,
  persistence = createSQLitePersistence(":memory:")
}: CreateServerOptions = {}): ApiServer {
  const server = Fastify({ logger: false });

  server.addHook("onClose", async () => {
    persistence.close();
  });

  server.post<{ Body: CreateRunBody }>("/runs", async (request, reply) => {
    const validation = validateCreateRunBody(request.body);
    if (!validation.ok) {
      return reply.code(400).send(errorResponse("VALIDATION_ERROR", validation.message));
    }

    const runId = createRunId();
    await executeMockAgentRun({
      persistence,
      runId,
      goal: validation.goal,
      clock,
      maxSteps: validation.maxSteps,
      maxCostUsd: validation.maxCostUsd
    });

    const run = persistence.readRun(runId);
    if (run === null) {
      throw new Error(`Created run ${runId} could not be read back from persistence`);
    }

    return reply.code(201).send({
      run_id: runId,
      run: toRunDto(run)
    });
  });

  server.get<{ Querystring: ListRunsQuery }>("/runs", async (request, reply) => {
    const pagination = validatePaginationQuery(request.query);
    if (!pagination.ok) {
      return reply.code(400).send(errorResponse("VALIDATION_ERROR", pagination.message));
    }

    const allRuns = persistence.listRuns();
    const runs = allRuns
      .slice(pagination.offset, pagination.offset + pagination.limit)
      .map(toRunDto);
    const nextOffset =
      pagination.offset + pagination.limit < allRuns.length
        ? pagination.offset + pagination.limit
        : null;

    return reply.send({
      runs,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total: allRuns.length,
        next_offset: nextOffset
      }
    });
  });

  server.get<{ Params: RunRouteParams }>("/runs/:id", async (request, reply) => {
    const runId = typeof request.params.id === "string" ? request.params.id : "";
    const run = persistence.readRun(runId);
    if (run === null) {
      return reply.code(404).send(errorResponse("RUN_NOT_FOUND", "Run not found"));
    }

    return reply.send({
      run: toRunDto(run),
      steps: run.steps.map(toStepDto)
    });
  });

  return server;
}

function validateCreateRunBody(
  body: CreateRunBody | undefined
):
  | { ok: true; goal: string; maxSteps: number; maxCostUsd: number }
  | { ok: false; message: string } {
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  if (goal.length === 0) {
    return { ok: false, message: "goal must be a non-empty string" };
  }

  if (goal.length > 2_000) {
    return { ok: false, message: "goal must be 2000 characters or fewer" };
  }

  const maxSteps = body?.max_steps === undefined ? DEFAULT_MAX_STEPS : body.max_steps;
  if (
    typeof maxSteps !== "number" ||
    !Number.isInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > MAX_STEPS_CAP
  ) {
    return { ok: false, message: "max_steps must be an integer between 1 and 50" };
  }

  const maxCostUsd = body?.max_cost_usd ?? DEFAULT_MAX_COST_USD;
  if (
    typeof maxCostUsd !== "number" ||
    !Number.isFinite(maxCostUsd) ||
    maxCostUsd < MIN_COST_USD ||
    maxCostUsd > MAX_COST_USD_CAP
  ) {
    return { ok: false, message: "max_cost_usd must be a number between 0.001 and 2" };
  }

  return { ok: true, goal, maxSteps, maxCostUsd };
}

function validatePaginationQuery(
  query: ListRunsQuery
):
  | { ok: true; limit: number; offset: number }
  | { ok: false; message: string } {
  const limit = parseOptionalInteger(query.limit, DEFAULT_LIST_LIMIT);
  if (limit === null || limit < 1 || limit > MAX_LIST_LIMIT) {
    return { ok: false, message: "limit must be an integer between 1 and 100" };
  }

  const offset = parseOptionalInteger(query.offset, 0);
  if (offset === null || offset < 0) {
    return { ok: false, message: "offset must be a non-negative integer" };
  }

  return { ok: true, limit, offset };
}

function parseOptionalInteger(value: unknown, defaultValue: number): number | null {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function createDefaultRunId(): string {
  return `run-${randomUUID()}`;
}

function errorResponse(code: ErrorCode, message: string): { error: { code: ErrorCode; message: string } } {
  return {
    error: {
      code,
      message
    }
  };
}

function toRunDto(run: RunRecord): {
  id: string;
  goal: string;
  status: RunRecord["status"];
  reason: string | null;
  total_cost: number;
  final_answer: string | null;
  started_at: string;
  finished_at: string | null;
} {
  return {
    id: run.id,
    goal: run.goal,
    status: run.status,
    reason: run.reason,
    total_cost: run.totalCost,
    final_answer: run.finalAnswer,
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

function toStepDto(step: StepRecord): {
  id: string;
  run_id: string;
  step_number: number;
  kind: string;
  args: JSONValue;
  result: JSONValue;
  started_at: string;
  finished_at: string | null;
} {
  return {
    id: step.id,
    run_id: step.runId,
    step_number: step.stepNumber,
    kind: step.kind,
    args: step.args,
    result: step.result,
    started_at: step.startedAt,
    finished_at: step.finishedAt
  };
}
