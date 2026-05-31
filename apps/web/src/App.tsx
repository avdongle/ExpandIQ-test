import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";

import { createRun, getRun, listRuns } from "./api.js";
import {
  formatJsonDetails,
  formatRelativeTime,
  formatRunOutcome,
  formatStepActivity,
  formatTerminalReason
} from "./formatters.js";
import type { RunDetail, RunStep, RunSummary } from "./types.js";

type LoadState = "idle" | "loading" | "error";

const POLL_INTERVAL_MS = 1500;

export function App(): ReactElement {
  const [goal, setGoal] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  const refreshRuns = useCallback(async () => {
    setListState("loading");
    try {
      const response = await listRuns();
      setRuns(response.runs);
      setListState("idle");
    } catch (error) {
      setListState("error");
      setErrorMessage(readErrorMessage(error));
    }
  }, []);

  const loadRun = useCallback(async (runId: string) => {
    setDetailState("loading");
    try {
      const detail = await getRun(runId);
      setSelectedRun(detail);
      setDetailState("idle");
      setErrorMessage(null);
      return detail;
    } catch (error) {
      setDetailState("error");
      setErrorMessage(readErrorMessage(error));
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    if (selectedRun?.run.status !== "running") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadRun(selectedRun.run.id).then((detail) => {
        if (detail?.run.status === "finished") {
          void refreshRuns();
        }
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadRun, refreshRuns, selectedRun?.run.id, selectedRun?.run.status]);

  const selectedRunSummary = selectedRun?.run ?? null;
  const isFinished = selectedRunSummary?.status === "finished";
  const finalAnswer = selectedRunSummary?.final_answer;
  const statusMessage = useMemo(() => {
    if (selectedRunSummary === null) {
      return "No run selected.";
    }

    return formatRunOutcome(selectedRunSummary);
  }, [selectedRunSummary]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedGoal = goal.trim();
    if (trimmedGoal.length === 0) {
      setGoalError("Enter a goal before starting a run.");
      return;
    }

    setGoalError(null);
    setErrorMessage(null);
    setCreating(true);
    try {
      const response = await createRun(trimmedGoal);
      setGoal("");
      await refreshRuns();
      await loadRun(response.run_id);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="masthead">
          <div>
            <p className="eyebrow">ExpandIQ AgentKit</p>
            <h1 id="app-title">Agent run workspace</h1>
          </div>
          <span className="status-pill" aria-live="polite">
            {statusMessage}
          </span>
        </div>

        <form className="goal-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="goal">Goal</label>
          <div className="goal-row">
            <textarea
              id="goal"
              name="goal"
              rows={3}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Create a report from the docs"
              aria-describedby={goalError === null ? undefined : "goal-error"}
            />
            <button type="submit" disabled={creating}>
              {creating ? "Starting" : "Start run"}
            </button>
          </div>
          {goalError === null ? null : (
            <p id="goal-error" className="field-error">
              {goalError}
            </p>
          )}
        </form>

        {errorMessage === null ? null : (
          <div className="notice error" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="run-panel" aria-labelledby="run-heading" aria-live="polite">
          <div className="panel-heading">
            <h2 id="run-heading">Selected run</h2>
            {selectedRunSummary === null ? null : (
              <span className="muted">Cost ${selectedRunSummary.total_cost.toFixed(3)}</span>
            )}
          </div>

          {detailState === "loading" && selectedRun === null ? (
            <p className="empty-state">Loading run details...</p>
          ) : selectedRun === null ? (
            <p className="empty-state">Start a run or choose a previous run.</p>
          ) : (
            <RunDetailView
              run={selectedRun.run}
              steps={selectedRun.steps}
              finalAnswer={finalAnswer}
              isFinished={isFinished}
            />
          )}
        </section>
      </section>

      <aside className="history-panel" aria-labelledby="history-heading">
        <div className="panel-heading">
          <h2 id="history-heading">Past runs</h2>
          <button className="secondary-button" type="button" onClick={() => void refreshRuns()}>
            Refresh
          </button>
        </div>
        {listState === "loading" && runs.length === 0 ? (
          <p className="empty-state">Loading past runs...</p>
        ) : listState === "error" && runs.length === 0 ? (
          <p className="empty-state">Past runs could not be loaded.</p>
        ) : runs.length === 0 ? (
          <p className="empty-state">No past runs yet.</p>
        ) : (
          <ul className="run-list">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  className="run-row"
                  type="button"
                  onClick={() => void loadRun(run.id)}
                  aria-current={selectedRunSummary?.id === run.id ? "true" : undefined}
                >
                  <span className="run-goal">{run.goal}</span>
                  <span className="run-meta">
                    <span>{formatRunOutcome(run)}</span>
                    <span>{formatRelativeTime(run.finished_at ?? run.started_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  );
}

function RunDetailView({
  run,
  steps,
  finalAnswer,
  isFinished
}: {
  run: RunSummary;
  steps: RunStep[];
  finalAnswer: string | null | undefined;
  isFinished: boolean;
}): ReactElement {
  return (
    <div className="run-detail">
      <div>
        <p className="run-title">{run.goal}</p>
        <p className="terminal-message">
          {isFinished ? formatTerminalReason(run.reason) : "The run is working through its plan."}
        </p>
      </div>

      {finalAnswer === null || finalAnswer === undefined ? null : (
        <section className="final-answer" aria-label="Final answer">
          <h3>Final answer</h3>
          <p>{finalAnswer}</p>
        </section>
      )}

      {steps.length === 0 ? (
        <p className="empty-state">No steps have been recorded yet.</p>
      ) : (
        <ol className="timeline">
          {steps.map((step) => (
            <li key={step.id}>
              <div>
                <p>{formatStepActivity(step)}</p>
                <span className="muted">Step {step.step_number}</span>
              </div>
              <details>
                <summary>Raw details</summary>
                <pre>{formatJsonDetails({ args: step.args, result: step.result })}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
