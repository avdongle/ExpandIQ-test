import { describe, expect, it } from "vitest";

import type { ToolError } from "./tool-error.js";
import type { ToolResult } from "./tool-result.js";

describe("tool result contracts", () => {
  it("supports successful results", () => {
    const result: ToolResult<{ value: number }> = {
      ok: true,
      data: { value: 1 },
      error: null
    };

    expect(result).toEqual({
      ok: true,
      data: { value: 1 },
      error: null
    });
  });

  it("supports successful results without payloads", () => {
    const result: ToolResult<null> = {
      ok: true,
      data: null,
      error: null
    };

    expect(result.data).toBeNull();
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

  it("prevents invalid result states at typecheck time", () => {
    // @ts-expect-error success results cannot include an error.
    const invalidSuccess: ToolResult = {
      ok: true,
      data: {},
      error: {
        code: "X",
        message: "Invalid",
        recoverable: false
      }
    };

    // @ts-expect-error failure results cannot include data.
    const invalidFailure: ToolResult = {
      ok: false,
      data: {},
      error: {
        code: "X",
        message: "Invalid",
        recoverable: false
      }
    };

    expect(invalidSuccess.ok).toBe(true);
    expect(invalidFailure.ok).toBe(false);
  });
});
