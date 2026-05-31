import { describe, expect, it } from "vitest";

import type { ToolError } from "./tool-error.js";
import type { ToolResult } from "./tool-result.js";

describe("tool result contracts", () => {
  it("prevents invalid result shapes at typecheck time", () => {
    const invalidResult = {
      ok: true,
      data: { documentId: "doc-1" }
    };

    // @ts-expect-error ToolResult must include the explicit error field.
    const result: ToolResult<{ documentId: string }> = invalidResult;

    expect(result.data?.documentId).toBe("doc-1");
  });

  it("supports successful results", () => {
    const result: ToolResult<{ documentId: string }> = {
      ok: true,
      data: { documentId: "doc-1" },
      error: null
    };

    expect(result).toEqual({
      ok: true,
      data: { documentId: "doc-1" },
      error: null
    });
  });

  it("supports recoverable tool errors", () => {
    const error: ToolError = {
      code: "RATE_LIMITED",
      message: "The tool can be retried later.",
      recoverable: true
    };
    const result: ToolResult = {
      ok: false,
      data: null,
      error
    };

    expect(result.error).toEqual(error);
  });

  it("supports non-recoverable tool errors", () => {
    const error: ToolError = {
      code: "INVALID_INPUT",
      message: "The request cannot be executed.",
      recoverable: false
    };
    const result: ToolResult = {
      ok: false,
      data: null,
      error
    };

    expect(result.error?.recoverable).toBe(false);
  });
});
