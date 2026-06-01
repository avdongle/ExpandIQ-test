# Demo Walkthrough

## Goal

Present ExpandIQ AgentKit in 10-15 minutes as a deterministic, local tool-calling agent runtime with clear safety boundaries, persistence, API read-back, and a minimal inspection UI.

## Setup

Run the verification suite first:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start the API after building:

```sh
node --input-type=module -e "import { createServer } from './apps/api/dist/server.js'; const server = createServer(); await server.listen({ port: 3000, host: '127.0.0.1' }); console.log('API listening on http://127.0.0.1:3000'); process.on('SIGINT', async () => { await server.close(); process.exit(0); });"
```

Start the frontend in another terminal:

```sh
pnpm --filter @expandiq-agentkit/web dev
```

Open the Vite URL printed by the dev server.

## Repository Tour

1. `packages/runtime-contracts`: terminal reasons, tool metadata, tool result/error contracts, and retrieval.
2. `apps/api`: Fastify routes, mock LLM, agent runner, tool executor, SQLite persistence, and backend tests.
3. `apps/web`: React UI, API client, formatter layer, styles, and frontend tests.
4. `docs`: architecture, ADRs, AI-assist log, review notes, and walkthroughs.
5. `prompts`: prompt history for Linear ticket selection and workflow control.

## Demo Sequence

### Successful Run

Goal:

```text
Create a report from the docs
```

Show:

- `POST /runs` creates a run and returns a finished result.
- The final answer is prominent.
- Step details show docs search, doc fetch, summarization, and final response.
- Terminal reason is human-readable success.

### Stuck Guard

Goal:

```text
This loop is stuck
```

Show:

- Repeated `fetch_doc` calls use the same canonical args.
- The runtime terminates with `stuck`.
- The run stops without hidden retries or infinite execution.

### Cost Cap

Goal:

```text
Run an expensive budget test
```

Show:

- The mock planner emits a costly SQL action.
- The cost cap terminates the run before further work is persisted.
- The UI explains the terminal state without exposing raw implementation details first.

### Recoverable Retry

Goal:

```text
Handle a transient retry case
```

Show:

- The first contact lookup returns a recoverable error.
- The executor retries once and records retry metadata.
- The run succeeds with a final answer.

### Wall-Clock Timeout

Goal:

```text
Show the wall clock timeout demo
```

Show:

- The planner selects the deterministic `wait` tool.
- The tool waits just over 60 seconds.
- The next loop boundary terminates the run with `timeout`.
- The UI explains the time-limit state in friendly language.

### Default Flow

Goal:

```text
Fetch the default document
```

Show:

- Unknown/simple goals still execute a deterministic default path.
- The run remains inspectable through the same API and UI.

## API Checks

Use these if the panel wants to see the backend directly:

```sh
curl -s http://127.0.0.1:3000/runs
curl -s http://127.0.0.1:3000/runs/<run-id>
```

For creating a run:

```sh
curl -s -X POST http://127.0.0.1:3000/runs \
  -H 'content-type: application/json' \
  -d '{"goal":"Handle a transient retry case"}'
```

## Architecture Talking Points

- The runtime retrieves candidate tools before each planner call.
- The mock LLM is deterministic, which makes tests and demos stable.
- The executor is the only tool boundary and normalizes success, failure, and retry metadata.
- Every run finishes with one explicit terminal reason.
- SQLite stores runs and ordered steps for replay and inspection.
- The API is intentionally thin and synchronous for the take-home.

## Test Demonstration

Reference these tests during review:

- `packages/runtime-contracts/src/tool-retrieval.test.ts` for deterministic top-K retrieval.
- `apps/api/src/agent-runner.test.ts` for step cap, cost cap, stuck, timeout, and retry.
- `apps/api/src/api.integration.test.ts` for API, runtime, SQLite persistence, and read-back together.
- `apps/web/src/App.test.tsx` for goal submission, loading/error states, final answers, and past runs.

## Known Gaps To State Clearly

- No real LLM calls or provider integration.
- No external tools or APIs.
- No auth, tenancy, queues, streaming, deployment config, or resume endpoint.
- Synchronous execution limits observable progress for very short local runs.
- Lexical retrieval is explainable but vocabulary-sensitive.

## Closing Position

This is a deliberately small assignment implementation. It demonstrates the required agent runtime behaviours with deterministic evidence, focused tests, and reviewer-friendly handover material without adding infrastructure that would distract from the core brief.
