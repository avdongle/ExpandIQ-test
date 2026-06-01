import { DEFAULT_TOOL_RETRIEVAL_TOP_K, retrieveTools } from "@expandiq-agentkit/runtime-contracts";

import { mockLlm, type MockLlmResponse } from "./mock-llm.js";
import { TOOLS, type ToolMetadata } from "./mock-tools.js";
import type { JSONValue, SQLitePersistence, StepRecord } from "./sqlite-persistence.js";
import { dispatchTool } from "./tool-runtime.js";

type TerminalReason = "step_cap" | "cost_cap" | "stuck" | "timeout" | "error" | "succeeded";

export type AgentClock = {
  nowIso(): string;
  nowMs(): number;
};

type MockLlm = (request: {
  goal: string;
  past_steps: readonly StepRecord[];
  candidate_tools: readonly ToolMetadata[];
}) => MockLlmResponse;

export type ExecuteMockAgentRunInput = {
  persistence: SQLitePersistence;
  runId: string;
  goal: string;
  clock?: AgentClock;
  maxCostUsd?: number;
  maxRetries?: number;
  maxSteps?: number;
  mockLlm?: MockLlm;
  registry?: readonly ToolMetadata[];
  sleep?: (durationMs: number) => Promise<void>;
  stuckCallThreshold?: number;
  timeoutMs?: number;
  topK?: number;
};

export async function executeMockAgentRun({
  clock = systemClock,
  mockLlm: planner = mockLlm,
  persistence,
  runId,
  goal,
  maxCostUsd = 0.5,
  maxRetries = 1,
  maxSteps = 20,
  registry = TOOLS,
  sleep,
  stuckCallThreshold = 3,
  timeoutMs = 60_000,
  topK = DEFAULT_TOOL_RETRIEVAL_TOP_K
}: ExecuteMockAgentRunInput): Promise<void> {
  persistence.createRun({ id: runId, goal, startedAt: clock.nowIso() });

  let totalCost = 0;
  const startedAtMs = clock.nowMs();
  const callCounts = new Map<string, number>();

  for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber += 1) {
    if (clock.nowMs() - startedAtMs >= timeoutMs) {
      finishRun(persistence, runId, "timeout", totalCost, clock);
      return;
    }

    const currentRun = persistence.readRun(runId);
    const pastSteps = currentRun?.steps ?? [];
    let response: MockLlmResponse;

    try {
      response = planner({
        goal,
        past_steps: pastSteps,
        candidate_tools: retrieveTools(goal, registry, topK)
      });
    } catch (error) {
      persistence.persistStep({
        id: `${runId}-step-${stepNumber}`,
        runId,
        stepNumber,
        kind: "error",
        cost: 0,
        args: { type: "planner" },
        result: {
          code: "MOCK_LLM_ERROR",
          message: error instanceof Error ? error.message : "Mock LLM planner failed."
        },
        startedAt: clock.nowIso(),
        finishedAt: clock.nowIso()
      });
      finishRun(persistence, runId, "error", totalCost, clock);
      return;
    }

    totalCost = roundCost(totalCost + response.cost);

    if (response.type === "final") {
      if (totalCost >= maxCostUsd) {
        finishRun(persistence, runId, "cost_cap", totalCost, clock);
        return;
      }

      persistence.persistStep({
        id: `${runId}-step-${stepNumber}`,
        runId,
        stepNumber,
        kind: "final",
        cost: response.cost,
        args: { type: "final" },
        result: { content: response.content, cost: response.cost },
        startedAt: clock.nowIso(),
        finishedAt: clock.nowIso()
      });
      finishRun(persistence, runId, "succeeded", totalCost, clock, response.content);
      return;
    }

    if (totalCost >= maxCostUsd) {
      finishRun(persistence, runId, "cost_cap", totalCost, clock);
      return;
    }

    const signature = toolCallSignature(response.tool, response.args);
    const nextCallCount = (callCounts.get(signature) ?? 0) + 1;
    callCounts.set(signature, nextCallCount);

    const toolResult = await dispatchTool({
      tool: response.tool,
      args: response.args,
      maxRetries,
      sleep
    });

    persistence.persistStep({
      id: `${runId}-step-${stepNumber}`,
      runId,
      stepNumber,
      kind: "tool_call",
      cost: response.cost,
      args: {
        tool: response.tool,
        args: response.args,
        cost: response.cost
      },
      result: toolResult as unknown as JSONValue,
      startedAt: clock.nowIso(),
      finishedAt: clock.nowIso()
    });

    if (!toolResult.ok) {
      finishRun(persistence, runId, "error", totalCost, clock);
      return;
    }

    if (nextCallCount >= stuckCallThreshold) {
      finishRun(persistence, runId, "stuck", totalCost, clock);
      return;
    }
  }

  finishRun(persistence, runId, "step_cap", totalCost, clock);
}

function finishRun(
  persistence: SQLitePersistence,
  runId: string,
  reason: TerminalReason,
  totalCost: number,
  clock: AgentClock,
  finalAnswer?: string
): void {
  persistence.markRunFinished(runId, {
    reason,
    totalCost,
    finalAnswer,
    finishedAt: clock.nowIso()
  });
}

function toolCallSignature(tool: string, args: Record<string, string>): string {
  return `${tool}:${canonicalJSONStringify(args)}`;
}

function canonicalJSONStringify(value: JSONValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJSONStringify(item)).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSONStringify(value[key] ?? null)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function roundCost(cost: number): number {
  return Number(cost.toFixed(6));
}

const systemClock: AgentClock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => performance.now()
};
