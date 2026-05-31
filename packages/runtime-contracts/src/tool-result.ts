import type { ToolError } from "./tool-error.js";

export type ToolResult<T = unknown> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ToolError };
