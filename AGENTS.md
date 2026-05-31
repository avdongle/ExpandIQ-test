# Agent Workflow Rules

These rules are mandatory for autonomous coding agents working in this repository.

Work on one Linear issue only. Use one branch and one PR per Linear ticket, and keep all changes scoped to that ticket. Do not implement stretch goals or application features unless the ticket explicitly requires them.

## Branch And PR Rules

- Never commit directly to `main`.
- Never push directly to `main`.
- Never open a PR from `main`.
- Before modifying files, check `git status` and the current branch.
- If currently on `main`, create a feature branch before making changes.
- Use one branch and one PR per Linear ticket.
- Include the Linear ticket ID in branch names, commit messages, and PR titles when available.
- Prefer small, reviewable commits.

## Startup Checklist

```sh
git status
git branch --show-current
git fetch origin
```

## Before Coding

- Read the Linear issue description fully.
- Identify the acceptance criteria.
- Follow TDD where the ticket specifies tests.
- Do not add speculative abstractions.
- Prefer deterministic, explicit implementations.

## During Coding

- Keep changes within the issue scope.
- Do not add auth, Docker, queues, streaming, real LLM calls, or external APIs unless explicitly required.
- Do not introduce broad abstractions.
- Record any AI-assist notes or prompt history where required by the take-home.

## Before Commit Checklist

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Before Completion

- Run lint, typecheck, tests, and build before marking work complete.
- Update README or docs if behavior changed.
- Summarise files changed and commands run.
