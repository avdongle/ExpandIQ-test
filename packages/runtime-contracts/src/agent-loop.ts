import type { ToolMetadata } from "./tool-metadata.js";
import { DEFAULT_TOOL_RETRIEVAL_TOP_K, retrieveTools } from "./tool-retrieval.js";

export type MockLlmRequest = {
  goal: string;
  past_steps: readonly MockLlmPastStep[];
  candidate_tools: readonly ToolMetadata[];
};

export type MockLlmPastStep = {
  kind: string;
  args: unknown;
  result: unknown;
};

export type MockLlm<Response> = (request: MockLlmRequest) => Response | Promise<Response>;

export type RunAgentLoopStepInput<Response> = {
  goal: string;
  mockLlm: MockLlm<Response>;
  pastSteps?: readonly MockLlmPastStep[];
  registry: readonly ToolMetadata[];
  topK?: number;
};

export async function runAgentLoopStep<Response>({
  goal,
  mockLlm,
  pastSteps = [],
  registry,
  topK = DEFAULT_TOOL_RETRIEVAL_TOP_K
}: RunAgentLoopStepInput<Response>): Promise<Response> {
  const candidate_tools = retrieveTools(goal, registry, topK);

  return mockLlm({
    goal,
    past_steps: pastSteps,
    candidate_tools
  });
}
