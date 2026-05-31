import type { ToolError } from "./tool-error.js";

export interface ToolResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: ToolError | null;
}
