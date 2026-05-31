export type ApiStatus = {
  service: "api";
  status: "ready";
};

export function getApiStatus(): ApiStatus {
  return {
    service: "api",
    status: "ready"
  };
}

export { createSQLitePersistence } from "./sqlite-persistence.js";
export { executeMockAgentRun } from "./agent-runner.js";
export { createServer } from "./server.js";
export type { ApiServer, CreateServerOptions } from "./server.js";
export { mockLlm } from "./mock-llm.js";
export type {
  MockLlmFinalResponse,
  MockLlmResponse,
  MockLlmToolCallResponse
} from "./mock-llm.js";
export type {
  CreateRunInput,
  JSONValue,
  MarkRunFinishedInput,
  PersistStepInput,
  RunRecord,
  RunStatus,
  RunWithSteps,
  SQLitePersistence,
  StepRecord
} from "./sqlite-persistence.js";
