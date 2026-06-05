// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import type { CreateRunResponse, RunDetail, RunsResponse, RunStep, RunSummary } from "./types.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("creates a synchronous run and loads the completed timeline without manual refresh", async () => {
    const fetchMock = mockFetch([
      jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) }),
      jsonResponse<CreateRunResponse>({ run_id: "run-1", run: finishedRun }),
      jsonResponse<RunsResponse>({ runs: [finishedRun], pagination: pagination(1) }),
      jsonResponse<RunDetail>({
        run: finishedRun,
        steps: [toolStep, finalStep]
      })
    ]);
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Describe the goal"), "Create a report from the docs");
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Report complete.")).toBeTruthy();
    expect(screen.getByLabelText("Final answer")).toBeTruthy();
    expect(screen.getByText("Searching documents")).toBeTruthy();
    expect(screen.getByText("Prepared the final answer.")).toBeTruthy();
    expect(screen.queryByText("The agent is working through the next tool step.")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/runs/run-1", undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      "/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          goal: "Create a report from the docs",
          max_steps: 20,
          max_cost_usd: 0.5
        })
      })
    );
  });

  it("loads a created run even when create only returns a run id", async () => {
    mockFetch([
      jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) }),
      jsonResponse<Partial<CreateRunResponse>>({ run_id: "run-1" }),
      jsonResponse<RunsResponse>({ runs: [finishedRun], pagination: pagination(1) }),
      jsonResponse<RunDetail>({
        run: finishedRun,
        steps: [toolStep, finalStep]
      })
    ]);
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Describe the goal"), "Create a report from the docs");
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Report complete.")).toBeTruthy();
    expect(screen.getByText("Searching documents")).toBeTruthy();
  });

  it("lists past runs and loads a selected run", async () => {
    mockFetch([
      jsonResponse<RunsResponse>({ runs: [finishedRun], pagination: pagination(1) }),
      jsonResponse<RunDetail>({ run: finishedRun, steps: [toolStep, finalStep] })
    ]);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Create a report from the docs/ }));

    expect(await screen.findByText("Report complete.")).toBeTruthy();
    expect(screen.getAllByText("Succeeded").length).toBeGreaterThan(0);
    expect(screen.getByText("Tool completed successfully.")).toBeTruthy();
    expect(screen.getAllByText("View raw step details").length).toBeGreaterThan(0);
  });

  it("renders the intentional empty state before a run is selected", async () => {
    mockFetch([jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) })]);

    render(<App />);

    expect(await screen.findByText("No past runs yet.")).toBeTruthy();
    expect(screen.getByText("Start by describing a goal.")).toBeTruthy();
    expect(
      screen.getByText(/AgentKit will run a deterministic tool-calling workflow/)
    ).toBeTruthy();
  });

  it("renders terminal reasons as human-readable labels and messages", async () => {
    const costCapRun: RunSummary = {
      ...finishedRun,
      id: "run-cost",
      reason: "cost_cap",
      final_answer: null
    };
    mockFetch([
      jsonResponse<RunsResponse>({ runs: [costCapRun], pagination: pagination(1) }),
      jsonResponse<RunDetail>({ run: costCapRun, steps: [] })
    ]);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Create a report from the docs/ }));

    expect((await screen.findAllByText("Reached budget")).length).toBeGreaterThan(0);
    expect(screen.getByText(/reaching the \$0.50 budget limit/)).toBeTruthy();
  });

  it("disables duplicate submissions while a run is being created", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) }))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Describe the goal"), "Create a report from the docs");
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect((screen.getByRole("button", { name: "Starting" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("maps HTTP failures to friendly user-facing messages", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch([
      jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) }),
      jsonResponse({ error: { code: "VALIDATION_ERROR", message: "backend unavailable" } }, 500)
    ]);
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Describe the goal"), "Create a report from the docs");
    await user.click(screen.getByRole("button", { name: "Start run" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The API could not complete that request.");
    expect(alert.textContent).not.toContain("backend unavailable");
    expect(alert.textContent).not.toContain("Request failed with status");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Starting" })).toBeNull();
    });
  });

  it("maps network and proxy failures to friendly user-facing messages", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Describe the goal"), "Create a report from the docs");
    await user.click(screen.getByRole("button", { name: "Start run" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The API is not reachable.");
    expect(alert.textContent).not.toContain("Failed to fetch");
  });

  it("keeps form controls accessible", async () => {
    mockFetch([jsonResponse<RunsResponse>({ runs: [], pagination: pagination(0) })]);

    render(<App />);

    expect(screen.getByLabelText("Describe the goal")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start run" })).toBeTruthy();
    expect(await screen.findByText("No past runs yet.")).toBeTruthy();
  });
});

const runningRun: RunSummary = {
  id: "run-1",
  goal: "Create a report from the docs",
  status: "running",
  reason: null,
  total_cost: 0,
  final_answer: null,
  started_at: "2026-05-31T01:00:00.000Z",
  finished_at: null
};

const finishedRun: RunSummary = {
  ...runningRun,
  status: "finished",
  reason: "succeeded",
  total_cost: 0.008,
  final_answer: "Report complete.",
  finished_at: "2026-05-31T01:01:00.000Z"
};

const toolStep: RunStep = {
  id: "step-1",
  run_id: "run-1",
  step_number: 1,
  kind: "tool_call",
  cost: 0.002,
  args: { tool: "search_docs", args: { query: "report source docs" }, cost: 0.002 },
  result: { ok: true, data: { docIds: ["report-doc-1"] }, error: null },
  started_at: "2026-05-31T01:00:01.000Z",
  finished_at: "2026-05-31T01:00:02.000Z"
};

const finalStep: RunStep = {
  id: "step-2",
  run_id: "run-1",
  step_number: 2,
  kind: "final",
  cost: 0.001,
  args: {},
  result: { content: "Report complete.", cost: 0.001 },
  started_at: "2026-05-31T01:00:03.000Z",
  finished_at: "2026-05-31T01:00:03.000Z"
};

function pagination(total: number): RunsResponse["pagination"] {
  return {
    limit: 20,
    offset: 0,
    total,
    next_offset: null
  };
}

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function mockFetch(responses: Response[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => {
    const nextResponse = responses.shift();
    if (nextResponse === undefined) {
      throw new Error("Unexpected fetch call");
    }

    return nextResponse;
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
