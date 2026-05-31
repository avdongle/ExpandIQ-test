# ADR-003: Tool Retrieval Strategy

## Context

The runtime must narrow the full tool registry before each mock LLM call. The assignment allows simple deterministic retrieval and does not require embeddings or vector infrastructure.

## Decision

Use lexical top-K retrieval with stable scoring across tool names, keywords, descriptions, and exact phrase matches.

## Consequences

Retrieval is fast, transparent, deterministic, and easy to test. It avoids vector stores, embedding models, hidden network calls, and additional setup.

The trade-off is vocabulary sensitivity. Goals that use words absent from the registry may retrieve weak candidates. A production version could add curated synonyms, richer metadata, embeddings, or hybrid retrieval while preserving deterministic tie-breakers and test fixtures.
