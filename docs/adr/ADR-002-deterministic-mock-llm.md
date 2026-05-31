# ADR-002: Deterministic Mock LLM

## Context

The assignment asks for a mock LLM that can drive normal completion, stuck detection, cost-cap, and retry flows. Real LLM calls would add API keys, network failure modes, latency, cost, and nondeterministic test results.

## Decision

Use a deterministic keyword-driven planner in `apps/api/src/mock-llm.ts`. It returns either `tool_call` or `final` responses with fixed mock costs and validates that selected tools are present in the retrieved candidate set.

## Consequences

The runtime can be tested precisely and replayed reliably. Demo goals always exercise the same scenario, and guard behaviour is observable without external services.

The trade-off is limited language understanding. Scenario selection is intentionally narrow, and the planner is not a substitute for model evaluation. A production version would add a real model adapter behind the same response contract, with stronger prompt, schema, retry, and observability controls.
