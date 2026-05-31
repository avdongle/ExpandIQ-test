import { describe, expect, it } from "vitest";
import type { ToolMetadata } from "@expandiq-agentkit/runtime-contracts";

import {
  dispatchTool,
  type ToolHandler,
  type ToolHandlerRegistry
} from "./tool-runtime.js";

describe("tool runtime executor", () => {
  it("returns a structured non-recoverable error for unknown tools", () => {
    const result = dispatchTool({
      tool: "missing_tool",
      args: {},
      maxRetries: 2,
      handlers: {}
    });

    expect(result).toEqual({
      ok: false,
      data: null,
      error: {
        code: "UNKNOWN_TOOL",
        message: "No tool handler is configured for missing_tool.",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false,
        errors: [
          {
            code: "UNKNOWN_TOOL",
            message: "No tool handler is configured for missing_tool.",
            recoverable: false
          }
        ]
      }
    });
  });

  it("does not execute a handler when tool metadata is missing", () => {
    let calls = 0;

    const result = dispatchTool({
      tool: "unregistered_tool",
      args: {},
      maxRetries: 2,
      registry: [],
      handlers: {
        unregistered_tool: () => {
          calls += 1;

          return {
            ok: true,
            data: { accepted: true },
            error: null
          };
        }
      }
    });

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "UNKNOWN_TOOL",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false
      }
    });
  });

  it("retries recoverable errors and returns the eventual success", () => {
    let calls = 0;
    const handlers: ToolHandlerRegistry = {
      lookup_contact: () => {
        calls += 1;

        if (calls === 1) {
          return {
            ok: false,
            data: null,
            error: {
              code: "TRANSIENT_LOOKUP",
              message: "Temporary lookup failure.",
              recoverable: true
            }
          };
        }

        return {
          ok: true,
          data: { contactId: "contact-1", email: "casey@example.com" },
          error: null
        };
      }
    };

    const result = dispatchTool({
      tool: "lookup_contact",
      args: { contactId: "contact-1" },
      maxRetries: 2,
      handlers
    });

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      ok: true,
      data: { contactId: "contact-1", email: "casey@example.com" },
      retry: {
        attempts: 2,
        recovered: true,
        errors: [
          {
            code: "TRANSIENT_LOOKUP",
            recoverable: true
          }
        ]
      }
    });
  });

  it("stops recoverable retries at the configured attempt limit", () => {
    let calls = 0;
    const alwaysTransient: ToolHandler = () => {
      calls += 1;

      return {
        ok: false,
        data: null,
        error: {
          code: "TRANSIENT_FAILURE",
          message: "Still failing.",
          recoverable: true
        }
      };
    };

    const result = dispatchTool({
      tool: "lookup_contact",
      args: { contactId: "contact-1" },
      maxRetries: 1,
      handlers: { lookup_contact: alwaysTransient }
    });

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "TRANSIENT_FAILURE",
        recoverable: true
      },
      retry: {
        attempts: 2,
        recovered: false,
        errors: [
          { code: "TRANSIENT_FAILURE", recoverable: true },
          { code: "TRANSIENT_FAILURE", recoverable: true }
        ]
      }
    });
  });

  it("does not retry semantic non-recoverable tool errors", () => {
    let calls = 0;

    const result = dispatchTool({
      tool: "query_sql",
      args: { sql: "drop table accounts" },
      maxRetries: 2,
      handlers: {
        query_sql: () => {
          calls += 1;

          return {
            ok: false,
            data: null,
            error: {
              code: "SEMANTIC_TOOL_ERROR",
              message: "Only read-only SQL is allowed.",
              recoverable: false
            }
          };
        }
      }
    });

    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "SEMANTIC_TOOL_ERROR",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false
      }
    });
  });

  it("converts raw handler exceptions into structured tool errors", () => {
    const result = dispatchTool({
      tool: "fetch_doc",
      args: { docId: "doc-1" },
      maxRetries: 2,
      handlers: {
        fetch_doc: () => {
          throw new Error("database connection closed");
        }
      }
    });

    expect(result).toEqual({
      ok: false,
      data: null,
      error: {
        code: "TOOL_EXCEPTION",
        message: "database connection closed",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false,
        errors: [
          {
            code: "TOOL_EXCEPTION",
            message: "database connection closed",
            recoverable: false
          }
        ]
      }
    });
  });

  it("requires an idempotency key before non-idempotent tools can execute", () => {
    let calls = 0;
    const registry: readonly ToolMetadata[] = [
      {
        id: "create_invoice",
        name: "Create Invoice",
        description: "Create a customer invoice.",
        keywords: ["create", "invoice"],
        idempotent: false,
        parallelSafe: false
      }
    ];

    const missingKey = dispatchTool({
      tool: "create_invoice",
      args: { customerId: "customer-1" },
      maxRetries: 2,
      registry,
      handlers: {
        create_invoice: () => {
          calls += 1;

          return {
            ok: true,
            data: { accepted: true },
            error: null
          };
        }
      }
    });

    expect(calls).toBe(0);
    expect(missingKey).toMatchObject({
      ok: false,
      error: {
        code: "IDEMPOTENCY_KEY_REQUIRED",
        recoverable: false
      },
      retry: {
        attempts: 1,
        recovered: false
      }
    });

    const withKey = dispatchTool({
      tool: "create_invoice",
      args: { customerId: "customer-1", idempotency_key: "invoice-1" },
      maxRetries: 2,
      registry,
      handlers: {
        create_invoice: () => {
          calls += 1;

          return {
            ok: true,
            data: { accepted: true },
            error: null
          };
        }
      }
    });

    expect(calls).toBe(1);
    expect(withKey).toMatchObject({
      ok: true,
      data: { accepted: true },
      retry: {
        attempts: 1,
        recovered: false,
        errors: []
      }
    });
  });
});
