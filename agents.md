# Agent rules

Work on one Linear issue only.

Before coding:
- Read the issue description fully.
- Identify acceptance criteria.
- Write or update tests first where practical.
- Do not implement stretch goals.

During coding:
- Keep changes within the issue scope.
- Prefer deterministic, explicit code.
- Do not add auth, Docker, queues, streaming, real LLM calls or external APIs.
- Do not introduce broad abstractions.

Before completion:
- Run npm run lint.
- Run npm run typecheck.
- Run npm test.
- Run npm run build.
- Update README or docs if behaviour changed.
- Summarise files changed and tests run.
