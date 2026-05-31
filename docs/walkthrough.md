# Walkthrough

## Setup

1. Install dependencies.

   ```sh
   pnpm install
   ```

2. Run the verification suite.

   ```sh
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

## Start The App

1. Start the API after building.

   ```sh
   node --input-type=module -e "import { createServer } from './apps/api/dist/server.js'; const server = createServer(); await server.listen({ port: 3000, host: '127.0.0.1' }); console.log('API listening on http://127.0.0.1:3000'); process.on('SIGINT', async () => { await server.close(); process.exit(0); });"
   ```

2. Start the frontend in another terminal.

   ```sh
   pnpm --filter @expandiq-agentkit/web dev
   ```

3. Open the Vite URL printed in the terminal.

## Demo Script

Use the frontend goal box for each scenario.

### Successful Run

Goal:

```text
Create a report from the docs
```

Expected result:

- final answer says the report completed;
- ordered steps show docs search, doc fetch, summarization, and final response;
- terminal reason is `succeeded`.

### Stuck Guard

Goal:

```text
This loop is stuck
```

Expected result:

- repeated `fetch_doc` tool calls with the same args;
- terminal reason is `stuck`;
- no hidden retry or infinite loop.

### Cost Cap

Goal:

```text
Run an expensive budget test
```

Expected result:

- costly SQL tool calls progress until the budget guard is reached;
- terminal reason is `cost_cap`;
- the run stops before more work continues.

### Recoverable Retry

Goal:

```text
Handle a transient retry case
```

Expected result:

- contact lookup records retry metadata;
- the run recovers and produces a final answer;
- terminal reason is `succeeded`.

## Discussion Points

- Why the mock LLM is deterministic.
- Why retrieval is lexical rather than embedding-based.
- How the executor normalizes tool failures and retries recoverable errors.
- How SQLite enables local replay.
- Why the API is synchronous for the take-home.
- Which production patterns were considered but intentionally scoped down.

## Files To Reference

- [README.md](../README.md)
- [architecture.md](architecture.md)
- [ai-assist-log.md](ai-assist-log.md)
- [ADR-001: SQLite over Postgres](adr/ADR-001-sqlite-over-postgres.md)
- [ADR-002: Deterministic Mock LLM](adr/ADR-002-deterministic-mock-llm.md)
- [ADR-003: Tool Retrieval Strategy](adr/ADR-003-tool-retrieval-strategy.md)
- [ADR-004: Synchronous Runtime](adr/ADR-004-synchronous-runtime.md)
