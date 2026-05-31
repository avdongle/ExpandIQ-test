import { mockLlm, type MockLlmResponse } from "./mock-llm.js";
import { TOOLS, type ToolMetadata } from "./mock-tools.js";
import type { JSONValue, SQLitePersistence, StepRecord } from "./sqlite-persistence.js";
import { dispatchTool } from "./tool-runtime.js";

type TerminalReason = "step_cap" | "cost_cap" | "stuck" | "timeout" | "error" | "succeeded";

export type ExecuteMockAgentRunInput = {
  persistence: SQLitePersistence;
  runId: string;
  goal: string;
  maxCostUsd?: number;
  maxRetries?: number;
  maxSteps?: number;
  registry?: readonly ToolMetadata[];
  stuckCallThreshold?: number;
};

export async function executeMockAgentRun({
  persistence,
  runId,
  goal,
  maxCostUsd = 1,
  maxRetries = 1,
  maxSteps = 10,
  registry = TOOLS,
  stuckCallThreshold = 3
}: ExecuteMockAgentRunInput): Promise<void> {
  persistence.createRun({ id: runId, goal });

  let totalCost = 0;

  for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber += 1) {
    const currentRun = persistence.readRun(runId);
    const pastSteps = currentRun?.steps ?? [];
    let response: MockLlmResponse;

    try {
      response = mockLlm({
        goal,
        past_steps: pastSteps,
        candidate_tools: registry
      });
    } catch (error) {
      persistence.persistStep({
        id: `${runId}-step-${stepNumber}`,
        runId,
        stepNumber,
        kind: "error",
        args: { type: "planner" },
        result: {
          code: "MOCK_LLM_ERROR",
          message: error instanceof Error ? error.message : "Mock LLM planner failed."
        },
        finishedAt: new Date().toISOString()
      });
      finishRun(persistence, runId, "error", totalCost);
      return;
    }

    totalCost = roundCost(totalCost + response.cost);

    if (response.type === "final") {
      persistence.persistStep({
        id: `${runId}-step-${stepNumber}`,
        runId,
        stepNumber,
        kind: "final",
        args: { type: "final" },
        result: { content: response.content, cost: response.cost },
        finishedAt: new Date().toISOString()
      });
      const terminalReason = totalCost > maxCostUsd ? "cost_cap" : "succeeded";
      finishRun(persistence, runId, terminalReason, totalCost);
      return;
    }

    const toolResult = dispatchTool({
      tool: response.tool,
      args: response.args,
      maxRetries
    });

    persistence.persistStep({
      id: `${runId}-step-${stepNumber}`,
      runId,
      stepNumber,
      kind: "tool_call",
      args: {
        tool: response.tool,
        args: response.args,
        cost: response.cost
      },
      result: toolResult as unknown as JSONValue,
      finishedAt: new Date().toISOString()
    });

    if (!toolResult.ok) {
      finishRun(persistence, runId, "error", totalCost);
      return;
    }

    if (totalCost > maxCostUsd) {
      finishRun(persistence, runId, "cost_cap", totalCost);
      return;
    }

    const updatedRun = persistence.readRun(runId);
    if (updatedRun !== null && isStuck(updatedRun.steps, stuckCallThreshold)) {
      finishRun(persistence, runId, "stuck", totalCost);
      return;
    }
  }

  finishRun(persistence, runId, "step_cap", totalCost);
}

function finishRun(
  persistence: SQLitePersistence,
  runId: string,
  reason: TerminalReason,
  totalCost: number
): void {
  persistence.markRunFinished(runId, {
    reason,
    totalCost,
    finishedAt: new Date().toISOString()
  });
}

function isStuck(steps: readonly StepRecord[], stuckCallThreshold: number): boolean {
  const toolSteps = steps.filter((step) => step.kind === "tool_call");
  const recentSteps = toolSteps.slice(-stuckCallThreshold);

  if (recentSteps.length < stuckCallThreshold) {
    return false;
  }

  const [firstStep] = recentSteps;
  const firstSignature = toolCallSignature(firstStep);

  return recentSteps.every((step) => toolCallSignature(step) === firstSignature);
}

function toolCallSignature(step: StepRecord): string {
  const args = step.args;

  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return JSON.stringify(args);
  }

  return JSON.stringify(args);
}

function roundCost(cost: number): number {
  return Number(cost.toFixed(6));
}
