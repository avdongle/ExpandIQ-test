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
