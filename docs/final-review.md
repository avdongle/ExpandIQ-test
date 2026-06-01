# Final Review

## Submission Readiness

Status: Pass with documented scope limits.

ExpandIQ AgentKit satisfies the required local take-home scope: deterministic mock planning, tool retrieval, guarded runtime execution, structured tool results, SQLite persistence, Fastify run APIs, a minimal React UI, focused tests, and handover documentation. The implementation intentionally avoids real LLM calls, external APIs, auth, queues, streaming, Docker, and deployment infrastructure.

## Requirement Matrix

| Area | Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Backend | `POST /runs` creates and executes a run | Pass | `apps/api/src/server.ts`, `apps/api/src/runs-route.test.ts`, `apps/api/src/api.integration.test.ts` | Request validation bounds goal length, steps, and cost. |
| Backend | `GET /runs` lists recent runs | Pass | `apps/api/src/server.ts`, `apps/api/src/runs-route.test.ts`, `apps/api/src/sqlite-persistence.test.ts` | Supports limit and offset pagination. |
| Backend | `GET /runs/:id` reads a run with ordered steps | Pass | `apps/api/src/server.ts`, `apps/api/src/api.integration.test.ts` | Missing runs return `RUN_NOT_FOUND`. |
| Backend | Tool retrieval narrows planner candidates | Pass | `packages/runtime-contracts/src/tool-retrieval.ts`, `packages/runtime-contracts/src/tool-retrieval.test.ts` | Lexical scoring is deterministic and stable. |
| Backend | Agent runtime loop executes tool-calling runs | Pass | `apps/api/src/agent-runner.ts`, `apps/api/src/agent-runner.test.ts` | Retrieves tools before each planner call and persists each step. |
| Backend | Step cap guard | Pass | `apps/api/src/agent-runner.ts`, `apps/api/src/agent-runner.test.ts` | Terminates with `step_cap`. |
| Backend | Cost cap guard | Pass | `apps/api/src/agent-runner.ts`, `apps/api/src/agent-runner.test.ts` | Terminates before persisting work that crosses the budget. |
| Backend | Stuck detector | Pass | `apps/api/src/agent-runner.ts`, `apps/api/src/agent-runner.test.ts`, `apps/api/src/api.integration.test.ts` | Repeated canonical tool call signatures terminate as `stuck`. |
| Backend | Timeout guard | Pass | `apps/api/src/agent-runner.ts`, `apps/api/src/agent-runner.test.ts` | Uses injectable clock for deterministic coverage. |
| Backend | Retry behaviour | Pass | `apps/api/src/tool-runtime.ts`, `apps/api/src/tool-runtime.test.ts`, `apps/api/src/agent-runner.test.ts` | Recoverable errors retry and persist retry metadata. |
| Backend | Structured tool error contract | Pass | `packages/runtime-contracts/src/tool-error.ts`, `packages/runtime-contracts/src/tool-result.ts`, `apps/api/src/tool-runtime.ts` | Semantic errors are not retried. |
| Backend | SQLite persistence | Pass | `apps/api/src/sqlite-persistence.ts`, `apps/api/src/sqlite-persistence.test.ts`, `apps/api/src/api.integration.test.ts` | Runs and steps are durable and read back in order. |
| Backend | Unit tests | Pass | `apps/api/src/*.test.ts`, `packages/runtime-contracts/src/*.test.ts` | Covers contracts, retrieval, planner, guards, tools, persistence, and routes. |
| Backend | Integration test | Pass | `apps/api/src/agent-runner.integration.test.ts`, `apps/api/src/api.integration.test.ts` | Verifies runtime/API/persistence behaviour together. |
| Frontend | Goal submission UI | Pass | `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx` | Validates empty goals and posts through the API client. |
| Frontend | Progress/loading display | Pass | `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx` | Shows creating, list loading, detail loading, and polling states. |
| Frontend | Final answer prominence | Pass | `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx` | Final answer renders in a dedicated section when present. |
| Frontend | Human-readable terminal reasons | Pass | `apps/web/src/formatters.ts`, `apps/web/src/formatters.test.ts` | Maps runtime reasons to reviewer-facing copy. |
| Frontend | Past runs list | Pass | `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx` | Lists and selects previous runs. |
| Frontend | Error states | Pass | `apps/web/src/App.tsx`, `apps/web/src/api.ts`, `apps/web/src/App.test.tsx` | API errors and load failures are displayed. |
| Frontend | Accessibility basics | Pass | `apps/web/src/App.tsx` | Uses labels, headings, `aria-live`, `role="alert"`, and current selection state. |
| Documentation | README run instructions | Pass | `README.md` | Includes install, verify, API start, web start, and demo goals. |
| Documentation | Architecture and decisions | Pass | `docs/architecture.md`, `docs/adr/*.md` | Documents runtime boundaries and major trade-offs. |
| Documentation | Known gaps | Pass | `README.md`, `docs/review.md` | Gaps are explicit and aligned with take-home scope. |
| Documentation | AI-assist log and prompt history | Pass | `docs/ai-assist-log.md`, `prompts/pull-next-linear-ticket.md` | Records tool usage, workflow, and standing ticket prompt. |
| Documentation | Walkthrough preparation | Pass | `docs/demo-walkthrough.md`, `docs/walkthrough.md` | Provides a demo sequence and reviewer talking points. |
| CI | PR checks execute verification commands | Pass | `.github/workflows/pr-checks.yml` | Runs install, lint, typecheck, test, and build on PRs. |

## Evaluation Notes

Correctness: The runtime exercises successful, stuck, cost-cap, retry, and default flows with deterministic fixtures and tests.

Design judgement: The implementation keeps a clear boundary between shared contracts, API orchestration, persistence, tool execution, and frontend presentation. Production patterns are represented only where they clarify the assignment.

Code quality: The code is TypeScript-first, explicit, and locally testable. Error and terminal states use typed contracts instead of ad hoc strings at call sites.

Testing: Tests cover contracts, retrieval, terminal reasons, planner behaviour, persistence, route validation, tool retries, frontend formatting, React workflows, and integration read-back.

Pragmatism: SQLite, lexical retrieval, synchronous execution, and a deterministic mock LLM reduce setup and model drift while still demonstrating the agent runtime behaviours.

Communication: README, architecture notes, ADRs, AI-assist log, review notes, and walkthrough documents give reviewers a direct path through the project.

UI/UX craft: The UI is intentionally small: goal entry, run status, final answer, ordered step details, and past runs. It avoids turning the assignment into a full product shell.

## Known Gaps

- No real LLM integration, provider SDK, external API calls, auth, tenancy, queues, streaming, Docker, deployment pipeline, or resume endpoint.
- Runs execute synchronously, so visible progress is limited to frontend loading and any future `running` state polling.
- SQLite uses Node's built-in `node:sqlite`, which can emit experimental warnings depending on the Node version.
- Retrieval is deterministic and explainable but vocabulary-sensitive.
- Persistence has no migration framework or multi-process concurrency model.

## Why This Solution Is Intentionally Small

The assignment asks for a minimal local agent-runtime service, not production infrastructure. The project therefore implements the behaviours that matter for review: deterministic planning, bounded tool execution, explicit guard termination, durable replay, API read-back, frontend inspection, and tests. Larger concerns such as auth, queues, streaming, real LLMs, deployment, and distributed reliability are documented as gaps because adding them would obscure the core evaluation target.

## Verification

Final verification for this branch was run on 2026-06-01:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm lint` | Pass | ESLint completed with no findings. |
| `pnpm typecheck` | Pass | Runtime contracts, API, and web projects typechecked. |
| `pnpm test` | Pass | 16 test files and 79 tests passed. Node emitted the documented `node:sqlite` experimental warning. |
| `pnpm build` | Pass | Runtime contracts, web, and API packages built successfully. |
