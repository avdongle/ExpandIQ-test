# ExpandIQ-test
Take-home coding challenge

## Local verification

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Running the app locally

The frontend is a Vite React app in `apps/web`. It calls the backend through a Vite dev-server proxy so local browser requests can use `/runs` without requiring backend CORS changes.

There is not yet a first-class API dev script. Build the workspace once, then start the Fastify server from the built API package:

```sh
pnpm build
node --input-type=module -e "import { createServer } from './apps/api/dist/server.js'; const server = createServer(); await server.listen({ port: 3000, host: '127.0.0.1' }); console.log('API listening on http://127.0.0.1:3000'); process.on('SIGINT', async () => { await server.close(); process.exit(0); });"
```

In a second terminal, start Vite:

```sh
pnpm --filter @expandiq-agentkit/web dev
```

By default the proxy expects the API server at `http://localhost:3000`. Override that with `VITE_API_PROXY_TARGET` if the Fastify server is listening elsewhere:

```sh
VITE_API_PROXY_TARGET=http://localhost:4000 pnpm --filter @expandiq-agentkit/web dev
```

Known frontend gaps: runs execute synchronously on the current backend, so the UI loads the completed run details immediately after creation. Polling remains in place for any future backend state that reports a run as still running. Authentication, routing, streaming updates, cancel/retry actions, and advanced run filters are intentionally out of scope.

## Design and review docs

- [Architecture](docs/architecture.md)
- [Review pass](docs/review.md)
- [AI-assist prompt log](prompts/pull-next-linear-ticket.md)

## SQLite persistence

The API package uses Node's built-in `node:sqlite` module for the take-home SQLite persistence layer. Current Node versions emit an `ExperimentalWarning` for this module; that warning is expected and can be removed later by swapping to a stable SQLite package if needed.

## Tool retrieval

The runtime contracts include a deterministic lexical retriever for narrowing the full tool registry before a mock LLM call. `retrieveTools(goal, registry, topK)` lowercases and tokenizes the goal, scores overlap against tool names, descriptions, and keywords, then returns up to `topK` full tool metadata objects. The default limit is 5.

Ties are resolved by higher score first, then tool name alphabetically, then original registry order if names are duplicated. This keeps results stable across repeated runs without embeddings, vector stores, LLM calls, or external services. The trade-off is that retrieval is explainable and predictable, but it only matches the registry vocabulary and simple keywords.

## Mock LLM scenarios

The API package includes a deterministic mock LLM planner for exercising the AgentKit loop without real model calls, SDKs, API keys, network requests, randomness, or hidden scenario state. The planner receives `goal`, `past_steps`, and `candidate_tools`, then returns either a `tool_call` or `final` response with fixed mock cost.

Scenario selection is keyword-based:

- `report`: goals containing `report`, `summary`, or `docs`; example: `Create a report from the docs`.
- `stuck`: goals containing `stuck` or `loop`; example: `This loop is stuck`.
- `cost-cap`: goals containing `expensive`, `budget`, or `cost cap`; example: `Run an expensive budget test`.
- `retry`: goals containing `retry` or `transient`; example: `Handle a transient retry case`.
- `default`: any other goal; example: `Fetch the default document`.

The report flow completes after three deterministic tool calls and a final response. The stuck flow repeats the same tool and args until the runner marks the run with `reason = "stuck"`. The cost-cap flow emits high-cost `query_sql` calls with varied deterministic SQL offsets so the default frontend budget terminates with `reason = "cost_cap"` before stuck detection. The retry flow triggers one recoverable lookup error, retries within the runtime, then persists a successful logical step with retry metadata.

## Tool execution and retry policy

Tool calls go through one executor boundary in the API package. The executor validates the requested tool before calling a handler, converts every success or failure into the same `ToolResult` shape, catches raw handler exceptions as non-recoverable `TOOL_EXCEPTION` errors, and records retry metadata with the persisted step result.

Recoverable tool errors are retried synchronously up to the configured `maxRetries` value, so total attempts are `maxRetries + 1`. Semantic errors such as unknown tools and validation failures are returned immediately without retry. `send_email` is marked non-idempotent in the mock registry and requires `args.idempotency_key`; the executor rejects the call before the handler runs when that key is missing.

## Runtime loop and guards

`executeMockAgentRun` creates a SQLite run, then runs a synchronous deterministic loop against the mock LLM. Before every planner call it retrieves a narrowed top-K tool list from the registry and passes only `goal`, ordered `past_steps`, and `candidate_tools` into the mock LLM. Tool calls are dispatched through the mock tool runtime, persisted as ordered steps, and final answers are stored on the run plus a final step for replay.

Guard ordering is fixed for repeatable tests: timeout is checked before each planner call, LLM response cost is added before any tool execution, tool-call cost caps stop before dispatch, final responses persist their answer before terminal state is written, repeated `tool_name` plus canonical args trips `stuck` on the third occurrence, and exhausting the configured step count records `step_cap`.

## API routes

The API package exposes a Fastify server factory with `POST /runs`, `GET /runs`, and `GET /runs/:id`. `POST /runs` validates a trimmed `goal`, applies bounded defaults for `max_steps` and `max_cost_usd`, executes the deterministic runtime synchronously for this take-home, and returns the created run ID plus a frontend-friendly run summary. `GET /runs` returns recent runs newest first with `limit` and `offset` pagination metadata. `GET /runs/:id` returns the run summary and ordered persisted steps, or `RUN_NOT_FOUND` for unknown IDs.

Tenant-level HTTP rate limiting is intentionally not implemented in this exercise. Abuse and cost risk are bounded locally through request validation, the `max_steps` and `max_cost_usd` caps, stuck detection, retry bounds, and the runtime timeout guard without introducing auth, tenancy, queues, or shared rate-limit infrastructure.
