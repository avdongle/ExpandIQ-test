import { describe, expect, it } from "vitest";
import type { ToolMetadata } from "@expandiq-agentkit/runtime-contracts";

import {
  dispatchTool,
  type ToolHandler,
  type ToolHandlerRegistry
} from "./tool-runtime.js";
import { TOOLS } from "./mock-tools.js";

describe("tool runtime executor", () => {
  it("exposes the expected deterministic mock tool inventory", () => {
    expect(TOOLS.map((tool) => tool.id)).toEqual([
      "search_docs",
      "fetch_doc",
      "send_email",
      "create_calendar_event",
      "query_sql",
      "summarise_text",
      "translate",
      "fetch_weather",
      "lookup_contact",
      "wait",
      "web_search"
    ]);
    expect(
      TOOLS.every(
        (tool) => typeof tool.idempotent === "boolean" && typeof tool.parallelSafe === "boolean"
      )
    ).toBe(true);
  });

  it("returns a structured non-recoverable error for unknown tools", async () => {
    const result = await dispatchTool({
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

  it("does not execute a handler when tool metadata is missing", async () => {
    let calls = 0;

    const result = await dispatchTool({
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

  it("retries recoverable errors and returns the eventual success", async () => {
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

    const result = await dispatchTool({
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

  it("stops recoverable retries at the configured attempt limit", async () => {
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

    const result = await dispatchTool({
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

  it("does not retry semantic non-recoverable tool errors", async () => {
    let calls = 0;

    const result = await dispatchTool({
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

  it("converts raw handler exceptions into structured tool errors", async () => {
    const result = await dispatchTool({
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

  it("requires an idempotency key before non-idempotent tools can execute", async () => {
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

    const missingKey = await dispatchTool({
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

    const withKey = await dispatchTool({
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

  it("runs the wait tool through the injected sleeper", async () => {
    const sleeps: number[] = [];

    const result = await dispatchTool({
      tool: "wait",
      args: { delayMs: "61000" },
      maxRetries: 0,
      sleep: async (durationMs) => {
        sleeps.push(durationMs);
      }
    });

    expect(sleeps).toEqual([61_000]);
    expect(result).toMatchObject({
      ok: true,
      data: {
        waitedMs: 61_000
      },
      retry: {
        attempts: 1,
        recovered: false,
        errors: []
      }
    });
  });
});
