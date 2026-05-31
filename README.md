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
