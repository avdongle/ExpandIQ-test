# ExpandIQ AgentKit

ExpandIQ AgentKit is a small TypeScript take-home project that demonstrates a deterministic tool-calling agent runtime. It includes shared runtime contracts, a Fastify API, SQLite persistence, a mock LLM planner, a bounded tool executor, and a minimal React frontend for creating and inspecting runs.

The implementation is intentionally local and deterministic. It does not call real LLMs, external APIs, queues, auth providers, or deployment infrastructure.

## Quick Start

Prerequisites:

- Node.js with `node:sqlite` support.
- pnpm 10.12.1, matching the root `packageManager` field.

Install dependencies:

```sh
pnpm install
```

Verify the workspace:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Run Locally

The frontend is a Vite React app in `apps/web`. It calls the backend through a Vite dev-server proxy, so browser requests use `/runs` while Vite forwards them to Fastify.

Build the workspace once:

```sh
pnpm build
```

Start the API from the built package:

```sh
node --input-type=module -e "import { createServer } from './apps/api/dist/server.js'; const server = createServer(); await server.listen({ port: 3000, host: '127.0.0.1' }); console.log('API listening on http://127.0.0.1:3000'); process.on('SIGINT', async () => { await server.close(); process.exit(0); });"
```

In a second terminal, start the web app:

```sh
pnpm --filter @expandiq-agentkit/web dev
```

Vite serves the app at the URL printed by the command, usually `http://localhost:5173`.

By default the proxy expects the API at `http://localhost:3000`. Override it when needed:

```sh
VITE_API_PROXY_TARGET=http://localhost:4000 pnpm --filter @expandiq-agentkit/web dev
```

## Demo Goals

Use these goals to exercise the deterministic scenarios:

- `Create a report from the docs`: successful multi-step run.
- `This loop is stuck`: repeated tool call until the stuck guard fires.
- `Run an expensive budget test`: cost-cap termination.
- `Handle a transient retry case`: recoverable tool error followed by retry success.
- `Fetch the default document`: default one-tool run and final answer.

## Architecture Summary

- `packages/runtime-contracts` defines terminal reasons, tool metadata, structured tool results, tool errors, and deterministic lexical retrieval.
- `apps/api` owns Fastify routes, SQLite persistence, mock LLM planning, runtime orchestration, and tool execution.
- `apps/web` owns the single-page React interface for starting runs, viewing results, and inspecting step details.
- `prompts` and `docs/ai-assist-log.md` record the AI-assisted development workflow.

The core loop creates a run, retrieves a top-K tool set before each planner call, asks the mock LLM for either a tool call or a final answer, executes tool calls through one validated executor boundary, persists ordered steps, and finishes with an explicit terminal reason.

See [docs/architecture.md](docs/architecture.md) for the full flow.

## Design Decisions

- SQLite is used for local durable replay instead of Postgres to keep setup simple.
- The mock LLM is deterministic and keyword-driven so tests can assert exact flows without network calls or model drift.
- Tool retrieval is lexical and stable rather than embedding-based.
- Runtime execution is synchronous for this exercise; polling exists in the frontend for future asynchronous backends.
- Guards are local and explicit: step cap, cost cap, stuck detection, timeout, structured errors, and bounded retries.

ADRs:

- [ADR-001: SQLite over Postgres](docs/adr/ADR-001-sqlite-over-postgres.md)
- [ADR-002: Deterministic Mock LLM](docs/adr/ADR-002-deterministic-mock-llm.md)
- [ADR-003: Tool Retrieval Strategy](docs/adr/ADR-003-tool-retrieval-strategy.md)
- [ADR-004: Synchronous Runtime](docs/adr/ADR-004-synchronous-runtime.md)

## API

The Fastify server exposes:

- `POST /runs`: validate a goal, execute a deterministic run synchronously, and return the created run.
- `GET /runs`: list recent runs with limit/offset pagination.
- `GET /runs/:id`: return one run and its ordered persisted steps.

The route layer is deliberately thin. Request validation and local budget caps cover take-home abuse risk without adding auth, tenancy, shared rate limiting, or background infrastructure.

## Known Gaps

- No real LLM integration, model provider SDK, external API calls, auth, Docker setup, deployment pipeline, queue, streaming updates, resume endpoint, or parallel tool execution.
- API runs execute synchronously, so the frontend usually receives a completed run immediately after creation.
- SQLite uses Node's built-in `node:sqlite` module, which currently emits an experimental warning on some Node versions.
- There is no migration framework or multi-process concurrency model.
- Retrieval is deterministic and explainable, but it cannot infer intent outside the tool registry vocabulary.
- The UI is intentionally minimal and focuses on the required run workflow rather than a full product shell.

## AI Assistance

This repository was developed with AI coding assistance under human direction. The workflow used Linear ticket selection, scoped branches, test-first changes where practical, and human review of generated code before committing.

Details are recorded in [docs/ai-assist-log.md](docs/ai-assist-log.md). The prompt used to pull the next ticket is in [prompts/pull-next-linear-ticket.md](prompts/pull-next-linear-ticket.md).

## Handover

Use [docs/walkthrough.md](docs/walkthrough.md) for the reviewer walkthrough and live demo sequence. Use [docs/review.md](docs/review.md) for the current checklist status and remaining risks.
