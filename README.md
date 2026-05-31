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
