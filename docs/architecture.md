# Architecture

## Purpose

ExpandIQ AgentKit is a deterministic local slice of a tool-calling agent runtime. It is designed to show the core production-shaped behaviours the assignment asks for: explicit contracts, tool retrieval, mock LLM planning, validated tool execution, bounded retries, guard-based termination, durable step replay, a thin API, a minimal frontend, and focused tests.

It is not a production service. The project favours repeatability and reviewer clarity over infrastructure breadth.

## Runtime Boundaries

- `packages/runtime-contracts`: shared TypeScript contracts for terminal reasons, tool metadata, tool results, tool errors, and deterministic top-K retrieval.
- `apps/api`: Fastify route factory, mock LLM planner, agent loop, mock tool executor, SQLite persistence, and backend tests.
- `apps/web`: Vite React frontend that creates runs, lists recent runs, loads run details, and renders user-friendly terminal states.
- `docs` and `prompts`: architecture notes, ADRs, walkthrough material, review status, and AI-assist records.

## Request Flow

1. The frontend posts a goal to `POST /runs`.
2. The API validates the trimmed goal and bounded optional controls: `max_steps` and `max_cost_usd`.
3. The API creates a run ID and calls `executeMockAgentRun`.
4. The runner creates a SQLite run record.
5. Before each planner call, the runner retrieves a deterministic top-K candidate tool set from the registry.
6. The mock LLM returns either a `tool_call` or `final` response with a fixed mock cost.
7. Tool calls are dispatched through the executor, which validates metadata, idempotency requirements, handler availability, and retry policy.
8. Each executed tool call is persisted as an ordered step.
9. Final responses are persisted as a final step and the run is marked `succeeded`.
10. Guard or error exits mark the run with an explicit terminal reason.
11. The frontend reads runs with `GET /runs` and details with `GET /runs/:id`.

## Retrieval

`retrieveTools(goal, registry, topK)` uses deterministic lexical scoring:

- normalize and tokenize the goal;
- score exact name, name-token, keyword, description, and phrase overlap;
- sort by score descending, then tool name, then original registry order;
- return at most `topK` tool metadata entries.

This keeps planner inputs stable and explainable without embeddings, vector stores, network calls, or LLM-based routing.

## Mock LLM

The mock planner selects scenarios from goal keywords:

- `report`, `summary`, or `docs`: search docs, fetch a doc, summarize it, then return a final answer.
- `stuck` or `loop`: repeat the same `fetch_doc` call until stuck detection terminates.
- `expensive`, `budget`, or `cost cap`: emit costly SQL calls so the budget guard can terminate.
- `retry` or `transient`: trigger a recoverable contact lookup and then finish.
- `timeout`, `slow`, `sleep`, `wait`, or `wall clock`: call the deterministic wait tool for just over 60 seconds so the next loop boundary terminates with `timeout`.
- anything else: fetch a default document and finish.

The planner rejects tool calls that are not present in the retrieved candidate set. That makes retrieval quality visible during tests instead of silently bypassing the retriever.

## Tool Execution

All tool calls pass through one executor boundary. The executor:

- validates that the tool exists in metadata;
- rejects missing handlers;
- enforces idempotency keys for non-idempotent tools;
- converts handler successes and failures into the shared `ToolResult` contract;
- catches raw exceptions as structured non-recoverable errors;
- retries recoverable errors up to `maxRetries`;
- records retry metadata in the persisted step result.

Semantic failures such as unknown tools and validation errors are not retried.

## Persistence

SQLite stores:

- `runs`: goal, status, terminal reason, total cost, final answer, start time, and finish time.
- `steps`: ordered step number, kind, explicit cost, arguments, result JSON, start time, and finish time.

`listRuns` returns newest runs first. `readRun` returns a run with ordered steps for deterministic replay.

The implementation uses Node's built-in `node:sqlite` module. That keeps the dependency surface small for the take-home, but it is a known trade-off because the module may emit an experimental warning depending on the Node version.

## Guards

Runs always finish with one terminal reason:

- `succeeded`: final answer accepted and persisted.
- `step_cap`: loop exhausted the configured step count.
- `cost_cap`: planner cost pushed the run to or above the configured budget before more work continued.
- `stuck`: the same tool and canonicalized args repeated enough times.
- `timeout`: the runtime exceeded the configured elapsed time before the next planner call.
- `error`: planner failure or non-recoverable tool result.

Guard ordering is deterministic: timeout before planner call, cost accumulation after planner response, cost cap before dispatch or final persistence, tool execution and persistence, then stuck detection. Timeout is checked between loop iterations with the injected clock; the runtime does not attempt cancellation-safe interruption of an in-flight planner or tool handler. The timeout demo makes this visible by waiting just over 60 seconds inside a tool, then stopping at the following loop boundary.

## Frontend

The frontend provides the required minimal workflow:

- enter a goal;
- start a run;
- display a user-friendly outcome;
- show a prominent final answer when available;
- list previous runs;
- inspect ordered step details.

The backend currently executes synchronously inside `POST /runs`, so the frontend normally loads the completed run immediately. Polling remains in place for any future backend that reports `running` after creation.

## Production Patterns Considered, Intentionally Scoped Down

- API gateway: represented by a thin Fastify boundary with request validation. Auth, tenancy, and gateway policy are out of scope.
- Budget guards: implemented locally with max steps, max cost, timeout, stuck detection, and retry limits.
- Circuit breakers: approximated by recoverable vs semantic tool errors, bounded retries, and structured failures.
- Queueing: useful for long-running jobs, but omitted to preserve deterministic synchronous review and avoid background infrastructure outside the take-home scope.
- Caching: possible future work for retrieval or deterministic tool outputs, but not needed for the small registry.
- Scaling: not addressed; this is a single-node local exercise.

## Key Trade-Offs

- Deterministic mock planning is easy to test but intentionally narrow.
- Lexical retrieval is transparent but vocabulary-sensitive.
- SQLite is simple to run locally but lacks production migration and concurrency patterns here.
- Synchronous execution keeps the code understandable but is not suitable for long-running production agents.
- The UI is concise and functional rather than a complete product shell.
