import type { JSONValue, RunStep, RunSummary, TerminalReason } from "./types.js";

export type StatusTone = "success" | "warning" | "danger" | "active" | "neutral";

export function formatTerminalReason(reason: TerminalReason | null, maxCostUsd = 0.5): string {
  switch (reason) {
    case "succeeded":
      return "The run completed successfully.";
    case "step_cap":
      return "The run stopped after using the maximum allowed number of steps.";
    case "cost_cap":
      return `The run stopped after reaching the $${maxCostUsd.toFixed(2)} budget limit.`;
    case "stuck":
      return "The agent repeated the same tool call too many times, so the runtime stopped it.";
    case "timeout":
      return "The run exceeded the allowed execution time.";
    case "error":
      return "The run stopped because an unrecoverable error occurred.";
    case null:
      return "The agent is working through the next tool step.";
    default:
      return "The run stopped for an unrecognised reason.";
  }
}

export function formatRunOutcome(run: RunSummary): string {
  if (run.status === "running") {
    return "Running";
  }

  if (run.reason === "succeeded") {
    return "Succeeded";
  }

  return formatTerminalReason(run.reason);
}

export function formatRunStatusLabel(run: Pick<RunSummary, "status" | "reason">): string {
  if (run.status === "running") {
    return "Running";
  }

  switch (run.reason) {
    case "succeeded":
      return "Succeeded";
    case "cost_cap":
      return "Reached budget";
    case "step_cap":
      return "Step limit reached";
    case "stuck":
      return "Stuck";
    case "timeout":
      return "Timed out";
    case "error":
      return "Error";
    default:
      return "Stopped";
  }
}

export function getRunStatusTone(run: Pick<RunSummary, "status" | "reason"> | null): StatusTone {
  if (run === null) {
    return "neutral";
  }

  if (run.status === "running") {
    return "active";
  }

  switch (run.reason) {
    case "succeeded":
      return "success";
    case "cost_cap":
    case "step_cap":
    case "stuck":
    case "timeout":
      return "warning";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatStepActivity(step: RunStep): string {
  if (step.kind === "final") {
    return "Prepared the final answer.";
  }

  if (step.kind === "error") {
    const message = readStringField(step.result, "message");
    return message === null ? "Hit an error while planning the next step." : `Hit an error: ${message}`;
  }

  const tool = readStringField(step.args, "tool");
  switch (tool) {
    case "search_docs":
      return "Searching documents";
    case "fetch_doc":
      return "Fetching document";
    case "summarise_text":
      return "Summarising text";
    case "query_sql":
      return "Querying data";
    case "lookup_contact":
      return "Looking up contact";
    case "send_email":
      return "Preparing email action";
    case "create_calendar_event":
      return "Preparing calendar event";
    case "translate":
      return "Translating text";
    case "fetch_weather":
      return "Fetching weather";
    case "web_search":
      return "Searching the web";
    case "wait":
      return "Waiting";
    default:
      return "Running tool";
  }
}

export function formatStepResultSummary(step: RunStep): string {
  if (step.kind === "final") {
    return "The runtime produced the final answer.";
  }

  if (step.kind === "error") {
    const message = readStringField(step.result, "message");
    return message === null ? "The planner hit an error." : message;
  }

  const ok = readBooleanField(step.result, "ok");
  if (ok === false) {
    const error = readNestedStringField(step.result, "error", "message");
    return error === null ? "The tool returned an error result." : error;
  }

  return ok === true ? "Tool completed successfully." : "Tool result recorded.";
}

export function formatRelativeTime(value: string, now = new Date()): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
  if (elapsedSeconds < 60) {
    return "just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

export function formatJsonDetails(value: JSONValue): string {
  return JSON.stringify(value, null, 2);
}

function readStringField(value: JSONValue, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const field = value[key];
  return typeof field === "string" ? field : null;
}

function readBooleanField(value: JSONValue, key: string): boolean | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const field = value[key];
  return typeof field === "boolean" ? field : null;
}

function readNestedStringField(value: JSONValue, parentKey: string, childKey: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return readStringField(value[parentKey], childKey);
}
