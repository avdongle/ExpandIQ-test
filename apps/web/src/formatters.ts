import type { JSONValue, RunStep, RunSummary, TerminalReason } from "./types.js";

export function formatTerminalReason(reason: TerminalReason | null, maxCostUsd = 0.5): string {
  switch (reason) {
    case "succeeded":
      return "Run completed successfully.";
    case "step_cap":
      return "The run stopped after reaching the step limit.";
    case "cost_cap":
      return `The run stopped after reaching the $${maxCostUsd.toFixed(2)} budget.`;
    case "stuck":
      return "The run stopped because it repeated the same action.";
    case "timeout":
      return "The run stopped after reaching the time limit.";
    case "error":
      return "The run stopped after an internal error. Try a simpler goal.";
    case null:
      return "Run in progress.";
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
      return "Searched the docs for relevant material.";
    case "fetch_doc":
      return "Fetched source material.";
    case "summarise_text":
      return "Summarised the source material.";
    case "query_sql":
      return "Queried structured account data.";
    case "lookup_contact":
      return "Looked up contact details.";
    case "send_email":
      return "Prepared an email through the mock tool.";
    case "wait":
      return "Waited long enough to hit the time limit.";
    default:
      return "Ran a tool step.";
  }
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
