# Review Pass

## Current status by checklist area

- Deterministic mock LLM: complete. The mock planner is keyword-driven and produces stable tool-call/final sequences.
- Tool registry and retrieval: complete. Registry metadata and deterministic top-K lexical retrieval are covered by focused tests.
- Structured tool error handling: complete. Unknown tools, missing metadata, idempotency validation failures, recoverable errors, non-recoverable semantic errors, and thrown handler exceptions become structured results.
- Bounded retry behaviour: complete for tool execution. Recoverable errors retry up to `maxRetries + 1` attempts and persist retry metadata.
- Safety guards: mostly complete. Step cap, cost cap, stuck detection, and timeout are implemented and integration-tested.
- Per-step persistence: mostly complete. Tool calls and final/error planner steps are persisted. Guard-only exits such as cost cap before dispatch and timeout do not create artificial tool steps, which matches the current invariant that executed tool calls are persisted.
- Minimal frontend: partial. `apps/web` currently exposes metadata only and does not provide a browser demo.
- README/design docs/AI-assist log: partial before this pass. README covered commands and runtime notes; this pass adds architecture and review docs and links to the prompt log.

## Risks found

- The assignment mentions an API boundary; the current API package has no Fastify HTTP route layer or request validation. This should be called out as a known gap rather than implied complete.
- The frontend is too skeletal to demonstrate the agent runtime end to end.
- `createSQLitePersistence` uses Node's experimental `node:sqlite`, which is acceptable for the take-home but should stay documented.
- `markRunFinished` can be called more than once and will overwrite the terminal reason. The runner currently calls it once per path, but an explicit persistence-level guard would better enforce the invariant.
- The runner catches planner errors and tool handler exceptions, but persistence errors are not wrapped. A SQLite write failure would escape as a raw exception.
- Retrieval is deterministic but simple; goals with vocabulary mismatch may hide tools the mock LLM expects, causing planner errors.

## Tests that should be added before final submission

- Persistence invariant test that a finished run cannot be marked finished again with a different terminal reason, if that invariant is enforced in code.
- Integration test for a persistence failure path, or a documented decision that storage failures are allowed to escape.
- API route tests if a Fastify boundary is added: request validation, happy-path run creation, invalid input, and run readback.
- Frontend smoke test once the minimal UI exists.
- Retry integration test for exhausted recoverable failures inside the full runner, not only the tool executor.
- Retrieval/runner test for vocabulary mismatch or empty top-K behaviour with a clear terminal reason.

## Manual demo paths to verify

- Report success: run a goal like `Create a report from the docs` and confirm three tool steps, one final step, `reason = "succeeded"`, and stable total cost.
- Stuck guard: run `This loop is stuck` and confirm three repeated tool steps followed by `reason = "stuck"`.
- Cost guard: run `Run an expensive budget test` with a low max cost and confirm no tool dispatch occurs after the cost cap is crossed.
- Retry recovery: run `Handle a transient retry case` and confirm the first tool step succeeds with retry metadata showing one recoverable error.
- Planner error: run with an empty registry and confirm a structured planner error step plus `reason = "error"`.

## Known gaps to mention in README

- No real LLM integration, external APIs, auth, Docker, queues, streaming, caching, parallel tool execution, resume endpoint, or deployment pipeline.
- No real Fastify HTTP server yet; the API is currently a package-level runtime boundary.
- Frontend is not yet a usable runtime demo.
- SQLite uses Node's experimental `node:sqlite`.
- The system is production-shaped for review, not production-ready.
