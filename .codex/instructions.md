# ExpandIQ AgentKit

## General principles

- Follow ticket scope exactly.
- Prefer deterministic implementations.
- Avoid speculative abstractions.
- Use TDD.
- Keep vertical slices thin.
- Do not introduce infrastructure not required by the ticket.
- Do not create shared packages until duplication exists.
- Prefer explicit contracts.
- Minimise dependencies.

## Before implementation

1. Summarise the ticket.
2. Identify acceptance criteria.
3. Write tests first.
4. Implement the smallest change possible.

## Before completion

- lint passes
- typecheck passes
- tests pass
- build passes