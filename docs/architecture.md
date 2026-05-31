# Architecture

## Purpose

This repository implements a small, deterministic agent runtime for the AgentKit take-home. The goal is to show production-shaped judgement in a local slice: deterministic mock LLM planning, tool retrieval, structured tool execution, bounded retries, runtime guards, per-step persistence, useful tests, and honest documentation.

It is not intended to be a production service. The implementation favours replayability, explicit terminal states, and clear failure handling over breadth.

## Runtime boundaries

- `packages/runtime-contracts` owns shared contracts for tool metadata, tool results, terminal reasons, and deterministic lexical retrieval.
- `apps/api` owns the mock LLM, runner loop, SQLite persistence, and tool executor.
- `apps/web` is currently only a minimal metadata package, not a full user-facing frontend.
- `prompts` stores AI-assist notes and workflow prompt material.

The API boundary is currently a TypeScript package boundary rather than a real Fastify HTTP server. If a Fastify route layer is added later, it should stay thin: validate requests, create/read runs, and delegate agent execution to the existing runner.

## Golden path

1. A caller creates a run with a goal.
2. The runner persists the run in SQLite.
3. Before each planner call, the registry is narrowed with deterministic lexical retrieval.
4. The mock LLM receives only the goal, ordered past steps, and candidate tools.
5. Tool calls go through the executor, which validates the tool, runs the handler, converts failures to structured tool results, and applies bounded retry rules.
6. Each executed tool call is persisted as an ordered step.
7. A final planner response is persisted and the run is marked `succeeded` with a final answer.

## Failure paths

- Planner errors are caught, persisted as an `error` step, and terminate the run with `reason = "error"`.
- Unknown tools, missing handlers, idempotency validation failures, handler exceptions, and semantic tool failures are returned as structured tool results.
- Recoverable tool errors are retried with a small bounded policy. Semantic tool errors are recorded and surfaced to the agent loop. Runtime guard failures terminate the run with an explicit reason. This prevents tool failures from being swallowed or misclassified as successful steps.
- Guard failures terminate with one of `step_cap`, `cost_cap`, `stuck`, or `timeout`.
- Cost-cap checks happen after planner cost is added and before dispatching a tool that would exceed the cap.

## Design invariants

- Every run must finish with exactly one terminal reason.
- Every executed tool call must produce a persisted step.
- No raw exception should escape as an unstructured tool result.
- The same goal should produce the same sequence of mock LLM decisions.
- Guards should fail closed, not silently continue.

## Production patterns considered, intentionally scoped down

This implementation borrows production-system thinking without implementing production infrastructure. The local runtime includes request validation, deterministic replay, step-level persistence, budget guards, bounded retries and explicit terminal states. I deliberately did not add queues, distributed workers, caching, streaming, auth or deployment infrastructure because the exercise rewards a small complete slice over speculative architecture.

- API Gateway: maps to the intended Fastify API boundary: a single entry point with request validation and no auth for this exercise. In the current codebase this boundary is not yet an HTTP server; it is represented by the API package exports and should be kept thin if Fastify routes are added.
- Rate limiting: maps to local budget guards such as step cap, cost cap, stuck detection, and timeout, not tenant-level rate limiting.
- Caching: useful future work for tool retrieval results or deterministic tool outputs, but intentionally not built.
- Message queues: useful future work if runs become long-running or need background processing, but this implementation stays synchronous and deterministic.
- Circuit breakers: maps to the tool runtime's bounded retries, recoverable vs semantic error distinction, and explicit structured failures. Recoverable errors can retry; semantic errors and guard failures surface directly.
- Load balancing/autoscaling: out of scope because this is a single-node deterministic exercise.

## Known trade-offs

- Lexical retrieval is deterministic and explainable, but it cannot infer intent beyond registry vocabulary and keywords.
- The mock LLM is predictable and testable, but scenario selection is keyword-based and intentionally narrow.
- SQLite persistence gives durable step replay locally, but there is no migration framework or concurrent worker model.
- The runner is synchronous, which keeps behaviour easy to test but is not suitable for long-running production jobs.
- The frontend is minimal and does not yet demonstrate the runtime through a browser workflow.
- The HTTP/Fastify boundary described in the assignment is not currently implemented; adding it should be a focused follow-up rather than folded into broader infrastructure work.
