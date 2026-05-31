# ADR-001: SQLite Over Postgres

## Context

The assignment needs durable run and step persistence that can be created, queried, and replayed locally. It does not require multi-tenant operation, production migrations, hosted infrastructure, or concurrent worker execution.

## Decision

Use SQLite through Node's built-in `node:sqlite` module for the take-home persistence layer.

## Consequences

This keeps setup simple and lets tests create isolated in-memory databases without services or containers. It also keeps the implementation focused on the runtime contract: create runs, persist ordered steps, mark runs finished, list runs, and read runs with steps.

The trade-off is that this is not a production database posture. There is no migration framework, no Postgres-specific concurrency model, and `node:sqlite` may emit an experimental warning on some Node versions. A production version should move to a stable database package or hosted database driver with migrations.
