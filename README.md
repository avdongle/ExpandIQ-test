# ExpandIQ-test
Take-home coding challenge

## Local verification

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## SQLite persistence

The API package uses Node's built-in `node:sqlite` module for the take-home SQLite persistence layer. Current Node versions emit an `ExperimentalWarning` for this module; that warning is expected and can be removed later by swapping to a stable SQLite package if needed.

## Tool retrieval

The runtime contracts include a deterministic lexical retriever for narrowing the full tool registry before a mock LLM call. `retrieveTools(goal, registry, topK)` lowercases and tokenizes the goal, scores overlap against tool names, descriptions, and keywords, then returns up to `topK` full tool metadata objects. The default limit is 5.

Ties are resolved by higher score first, then tool name alphabetically, then original registry order if names are duplicated. This keeps results stable across repeated runs without embeddings, vector stores, LLM calls, or external services. The trade-off is that retrieval is explainable and predictable, but it only matches the registry vocabulary and simple keywords.

## Mock LLM scenarios

The API package includes a deterministic mock LLM planner for exercising the AgentKit loop without real model calls, SDKs, API keys, network requests, randomness, or hidden scenario state. The planner receives `goal`, `past_steps`, and `candidate_tools`, then returns either a `tool_call` or `final` response with fixed mock cost.

Scenario selection is keyword-based:

- `report`: goals containing `report`, `summary`, or `docs`; example: `Create a report from the docs`.
- `stuck`: goals containing `stuck` or `loop`; example: `This loop is stuck`.
- `cost-cap`: goals containing `expensive`, `budget`, or `cost cap`; example: `Run an expensive budget test`.
- `retry`: goals containing `retry` or `transient`; example: `Handle a transient retry case`.
- `default`: any other goal; example: `Fetch the default document`.

The report flow completes after three deterministic tool calls and a final response. The stuck flow repeats the same tool and args until the runner marks the run with `reason = "stuck"`. The cost-cap flow emits a high fixed cost so low budgets terminate with `reason = "cost_cap"`. The retry flow triggers one recoverable lookup error, retries within the runtime, then persists a successful logical step with retry metadata.
