# ADR-004: Synchronous Runtime

## Context

The take-home needs an end-to-end local runtime that can be run and tested easily. Background jobs, queues, cancellation, streaming, and resume support would increase the implementation surface substantially.

## Decision

Execute each mock agent run synchronously inside `POST /runs`, persist all completed work before returning, and keep the frontend polling code ready for future asynchronous states.

## Consequences

The API is simple to reason about, integration tests are deterministic, and the reviewer can start a run and immediately inspect persisted state.

The trade-off is that this design is not appropriate for long-running production agent work. A production version should move run execution to a worker, return a running state immediately, stream or poll progress, and support cancellation and resume semantics.
