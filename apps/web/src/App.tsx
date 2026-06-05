import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";

import { ApiClientError, createRun, getRun, listRuns } from "./api.js";
import {
  formatJsonDetails,
  formatRelativeTime,
  formatRunStatusLabel,
  formatStepResultSummary,
  formatStepActivity,
  formatTerminalReason,
  getRunStatusTone
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
      setErrorMessage(readUserFacingError(error));
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
      setErrorMessage(readUserFacingError(error));
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
      return "Ready for a deterministic run.";
    }

    return formatRunStatusLabel(selectedRunSummary);
  }, [selectedRunSummary]);
  const selectedTone = getRunStatusTone(selectedRunSummary);

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
      if (response.run !== undefined) {
        setSelectedRun({ run: response.run, steps: [] });
      }
      setGoal("");
      await refreshRuns();
      await loadRun(response.run_id);
    } catch (error) {
      setErrorMessage(readUserFacingError(error));
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
            <h1 id="app-title">AgentKit</h1>
            <p className="masthead-copy">
              Run deterministic AI tool workflows with visible steps and safety guards.
            </p>
            <div className="capability-row" aria-label="Runtime characteristics">
              <span>Mock LLM</span>
              <span>Local runtime</span>
              <span>Deterministic</span>
            </div>
          </div>
          <span className={`status-pill tone-${selectedTone}`} aria-live="polite">
            {statusMessage}
          </span>
        </div>

        <form className="goal-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-heading">
            <label htmlFor="goal">Describe the goal</label>
            <span>AgentKit will plan, run tools, and show the trace.</span>
          </div>
          <div className="goal-row">
            <textarea
              id="goal"
              name="goal"
              rows={3}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Ask the agent to fetch a document, look up a contact, or recover from a transient error..."
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
            <div>
              <p className="section-kicker">Active workflow</p>
              <h2 id="run-heading">Selected run</h2>
            </div>
            {selectedRunSummary === null ? null : (
              <span className="cost-badge">Cost ${selectedRunSummary.total_cost.toFixed(3)}</span>
            )}
          </div>

          {detailState === "loading" && selectedRun === null ? (
            <p className="empty-state">Loading the workflow trace...</p>
          ) : selectedRun === null ? (
            <div className="empty-state empty-panel">
              <strong>Start by describing a goal.</strong>
              <span>
                AgentKit will run a deterministic tool-calling workflow and show each step as it
                happens.
              </span>
            </div>
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
          <div>
            <p className="section-kicker">History</p>
            <h2 id="history-heading">Past runs</h2>
          </div>
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
                    <span className={`mini-status tone-${getRunStatusTone(run)}`}>
                      {formatRunStatusLabel(run)}
                    </span>
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
      <div className="run-summary-card">
        <div>
          <p className="run-title">{run.goal}</p>
          <p className="terminal-message">
            {isFinished ? formatTerminalReason(run.reason) : formatTerminalReason(null)}
          </p>
        </div>
        <span className={`status-pill tone-${getRunStatusTone(run)}`}>
          {formatRunStatusLabel(run)}
        </span>
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
              <div className="timeline-row">
                <span className="step-index">{step.step_number}</span>
                <div className="step-copy">
                  <p>{formatStepActivity(step)}</p>
                  <span className="muted">
                    Step {step.step_number} · {step.kind} · Cost ${step.cost.toFixed(3)}
                  </span>
                  <span className="step-summary">{formatStepResultSummary(step)}</span>
                </div>
              </div>
              <details>
                <summary>View raw step details</summary>
                <pre>{formatJsonDetails({ args: step.args, result: step.result })}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function readUserFacingError(error: unknown): string {
  console.error(error);

  if (error instanceof ApiClientError) {
    return error.userMessage;
  }

  return "Something went wrong. Try again, and check the console for details if it keeps happening.";
}
