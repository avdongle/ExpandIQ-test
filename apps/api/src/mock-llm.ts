import type { ToolMetadata } from "./mock-tools.js";

export type MockLlmToolCallResponse = {
  type: "tool_call";
  tool: string;
  args: Record<string, string>;
  cost: number;
};

export type MockLlmFinalResponse = {
  type: "final";
  content: string;
  cost: number;
};

export type MockLlmResponse = MockLlmToolCallResponse | MockLlmFinalResponse;

export type MockLlmRequest = {
  goal: string;
  past_steps: readonly unknown[];
  candidate_tools: readonly ToolMetadata[];
};

export function mockLlm(request: MockLlmRequest): MockLlmResponse {
  const scenario = selectScenario(request.goal);
  const stepCount = request.past_steps.length;

  if (scenario === "report") {
    return reportResponse(stepCount, request.candidate_tools);
  }

  if (scenario === "stuck") {
    return toolCall(request.candidate_tools, "fetch_doc", { docId: "loop-doc" }, 0.002);
  }

  if (scenario === "cost-cap") {
    return toolCall(
      request.candidate_tools,
      "query_sql",
      { sql: `select * from account_activity limit 25 offset ${stepCount * 25}` },
      0.18
    );
  }

  if (scenario === "retry") {
    if (stepCount === 0) {
      return toolCall(
        request.candidate_tools,
        "lookup_contact",
        { contactId: "transient-contact" },
        0.002
      );
    }

    return {
      type: "final",
      content: "Retry flow complete: recovered from a transient lookup error.",
      cost: 0.001
    };
  }

  if (scenario === "timeout") {
    return toolCall(request.candidate_tools, "wait", { delayMs: "61000" }, 0.001);
  }

  if (stepCount === 0) {
    return toolCall(request.candidate_tools, "fetch_doc", { docId: "default-doc" }, 0.002);
  }

  return {
    type: "final",
    content: "Default flow complete.",
    cost: 0.001
  };
}

function selectScenario(goal: string): "report" | "stuck" | "cost-cap" | "retry" | "timeout" | "default" {
  const normalizedGoal = goal.toLowerCase();

  if (/\b(stuck|loop)\b/.test(normalizedGoal)) {
    return "stuck";
  }

  if (/\b(expensive|budget)\b/.test(normalizedGoal) || normalizedGoal.includes("cost cap")) {
    return "cost-cap";
  }

  if (/\b(retry|transient)\b/.test(normalizedGoal)) {
    return "retry";
  }

  if (
    /\b(timeout|slow|sleep|wait)\b/.test(normalizedGoal) ||
    normalizedGoal.includes("wall clock") ||
    normalizedGoal.includes("wall-clock")
  ) {
    return "timeout";
  }

  if (/\b(report|summary|docs)\b/.test(normalizedGoal)) {
    return "report";
  }

  return "default";
}

function reportResponse(
  stepCount: number,
  candidateTools: readonly ToolMetadata[]
): MockLlmResponse {
  if (stepCount === 0) {
    return toolCall(candidateTools, "search_docs", { query: "report source docs" }, 0.002);
  }

  if (stepCount === 1) {
    return toolCall(candidateTools, "fetch_doc", { docId: "report-doc-1" }, 0.002);
  }

  if (stepCount === 2) {
    return toolCall(candidateTools, "summarise_text", { text: "report-doc-1" }, 0.003);
  }

  return {
    type: "final",
    content: "Report complete: searched docs, fetched source material, and summarised the findings.",
    cost: 0.001
  };
}

function toolCall(
  candidateTools: readonly ToolMetadata[],
  tool: string,
  args: Record<string, string>,
  cost: number
): MockLlmToolCallResponse {
  if (!candidateTools.some((candidateTool) => candidateTool.id === tool)) {
    throw new Error(`Mock LLM selected unavailable tool: ${tool}`);
  }

  return {
    type: "tool_call",
    tool,
    args,
    cost
  };
}
