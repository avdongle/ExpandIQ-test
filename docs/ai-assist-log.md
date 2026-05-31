# AI-Assist Log

## Tools And Models

- Primary coding assistant: Codex in a local repository workspace.
- Issue management: Linear MCP.
- Repository and PR workflow: local git commands and GitHub CLI.
- AI review input: GitHub Copilot review findings were tracked as Linear review-fix tickets where applicable.

## Workflow

Development followed one Linear ticket per branch. Each ticket was selected from the EXP team, scoped before coding, implemented with focused changes, verified with lint/typecheck/tests/build, committed, pushed, and opened as a PR.

For implementation tickets, tests were written or updated first where practical. For documentation-only A12 work, validation is command execution plus link and content review.

## Prompt History

The standing prompt used to pull the next Linear ticket is stored in [../prompts/pull-next-linear-ticket.md](../prompts/pull-next-linear-ticket.md). It required:

- listing all open EXP issues before selection;
- selecting must-fix and review-fix tickets before normal assignments;
- blocking A13 until A7-A12 were complete;
- using Linear branch names;
- running lint, typecheck, tests, and build;
- committing, pushing, and opening a PR.

## Human Review

Human direction set the ticket order, scope limits, and acceptance criteria through Linear. Generated code and docs were reviewed against the issue description, repository conventions, and test results before commit.

## Contribution Split

Approximate split for this repository:

- Human: ticket definition, scope boundaries, acceptance criteria, prioritization, final judgement, and review decisions.
- AI assistant: code drafting, test drafting, documentation drafting, command execution, and PR workflow support.

The implementation should be evaluated as human-directed AI-assisted work, not as unreviewed generated output.

## Scope Controls

The assistant was explicitly constrained not to add real LLM calls, external APIs, auth, queues, streaming, Docker, or speculative infrastructure unless a ticket required it. This kept the project focused on the take-home runtime.
