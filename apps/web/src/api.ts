import type { CreateRunResponse, RunDetail, RunsResponse } from "./types.js";

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_COST_USD = 0.5;

export class ApiClientError extends Error {
  readonly userMessage: string;
  readonly technicalMessage: string;

  constructor(userMessage: string, technicalMessage: string) {
    super(technicalMessage);
    this.name = "ApiClientError";
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
  }
}

export async function createRun(goal: string): Promise<CreateRunResponse> {
  return requestJson<CreateRunResponse>("/runs", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      goal,
      max_steps: DEFAULT_MAX_STEPS,
      max_cost_usd: DEFAULT_MAX_COST_USD
    })
  });
}

export async function listRuns(): Promise<RunsResponse> {
  return requestJson<RunsResponse>("/runs?limit=20");
}

export async function getRun(runId: string): Promise<RunDetail> {
  return requestJson<RunDetail>(`/runs/${encodeURIComponent(runId)}`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ApiClientError(
      "The API is not reachable. Start the backend and check the frontend proxy target, then try again.",
      readTechnicalError(error)
    );
  }

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const apiMessage = readApiErrorMessage(body);
    const technicalMessage =
      apiMessage === null
        ? `Request failed with status ${response.status}`
        : `Request failed with status ${response.status}: ${apiMessage}`;
    throw new ApiClientError(
      "The API could not complete that request. Check the backend logs or try again.",
      technicalMessage
    );
  }

  return body as T;
}

function readApiErrorMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return null;
}

function readTechnicalError(error: unknown): string {
  return error instanceof Error ? error.message : "Network request failed";
}
