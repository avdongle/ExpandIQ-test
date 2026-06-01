import type { ToolError, ToolMetadata, ToolResult } from "@expandiq-agentkit/runtime-contracts";

import type { JSONValue } from "./sqlite-persistence.js";
import { TOOLS } from "./mock-tools.js";

export type ToolHandler = (
  args: Record<string, string>,
  context: { attempt: number }
) => ToolResult<JSONValue>;

export type ToolHandlerRegistry = Readonly<Partial<Record<string, ToolHandler>>>;

export type DispatchToolInput = {
  tool: string;
  args: Record<string, string>;
  maxRetries: number;
  handlers?: ToolHandlerRegistry;
  registry?: readonly ToolMetadata[];
};

export type DispatchToolResult = ToolResult<JSONValue> & {
  retry: {
    attempts: number;
    recovered: boolean;
    errors: {
      code: string;
      message: string;
      recoverable: boolean;
    }[];
  };
};

export function dispatchTool({
  tool,
  args,
  maxRetries,
  handlers = DEFAULT_TOOL_HANDLERS,
  registry = TOOLS
}: DispatchToolInput): DispatchToolResult {
  const errors: DispatchToolResult["retry"]["errors"] = [];
  const maxAttempts = maxRetries + 1;
  const toolMetadata = registry.find((candidate) => candidate.id === tool);

  if (toolMetadata === undefined) {
    return failureResult(unknownToolError(tool), 1, false, errors);
  }

  const handler = handlers[tool];

  if (handler === undefined) {
    return failureResult(unknownToolError(tool), 1, false, errors);
  }

  if (toolMetadata?.idempotent === false && args.idempotency_key === undefined) {
    return failureResult(
      {
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: `${tool} requires args.idempotency_key before execution.`,
        recoverable: false
      },
      1,
      false,
      errors
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = invokeHandler(handler, args, attempt);

    if (result.ok) {
      return {
        ...result,
        retry: {
          attempts: attempt,
          recovered: errors.length > 0,
          errors
        }
      };
    }

    errors.push(result.error);

    if (!result.error.recoverable || attempt === maxAttempts) {
      return {
        ...result,
        retry: {
          attempts: attempt,
          recovered: false,
          errors
        }
      };
    }
  }

  throw new Error("Tool dispatch exhausted attempts unexpectedly");
}

function invokeHandler(
  handler: ToolHandler,
  args: Record<string, string>,
  attempt: number
): ToolResult<JSONValue> {
  try {
    return handler(args, { attempt });
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: {
        code: "TOOL_EXCEPTION",
        message: error instanceof Error ? error.message : "Tool handler threw an unknown error.",
        recoverable: false
      }
    };
  }
}

function failureResult(
  error: ToolError,
  attempts: number,
  recovered: boolean,
  previousErrors: DispatchToolResult["retry"]["errors"]
): DispatchToolResult {
  const errors = [...previousErrors, error];

  return {
    ok: false,
    data: null,
    error,
    retry: {
      attempts,
      recovered,
      errors
    }
  };
}

function unknownToolError(tool: string): ToolError {
  return {
    code: "UNKNOWN_TOOL",
    message: `No tool handler is configured for ${tool}.`,
    recoverable: false
  };
}

const DEFAULT_TOOL_HANDLERS: ToolHandlerRegistry = {
  search_docs: (args) => ({
    ok: true,
    data: { docIds: ["report-doc-1"], query: args.query ?? null },
    error: null
  }),
  fetch_doc: (args) => ({
    ok: true,
    data: {
      docId: args.docId ?? null,
      content: `Contents for ${args.docId ?? "unknown-doc"}`
    },
    error: null
  }),
  summarise_text: (args) => ({
    ok: true,
    data: {
      summary: `Summary for ${args.text ?? "provided text"}`
    },
    error: null
  }),
  query_sql: (args) => ({
    ok: true,
    data: {
      rows: [{ accountId: "acct-1", activityCount: 12 }],
      sql: args.sql ?? null
    },
    error: null
  }),
  lookup_contact: (args, context) => {
    if (args.contactId === "transient-contact" && context.attempt === 1) {
      return {
        ok: false,
        data: null,
        error: {
          code: "TRANSIENT_LOOKUP",
          message: "Contact service returned a recoverable transient error.",
          recoverable: true
        }
      };
    }

    return {
      ok: true,
      data: {
        contactId: args.contactId ?? null,
        email: "casey@example.com"
      },
      error: null
    };
  },
  send_email: (args) => ({
    ok: true,
    data: {
      accepted: true,
      contactId: args.contactId ?? null,
      idempotencyKey: args.idempotency_key ?? null
    },
    error: null
  }),
  create_calendar_event: (args) => ({
    ok: true,
    data: {
      eventId: "event-1",
      title: args.title ?? "Untitled event",
      startsAt: args.startsAt ?? null,
      idempotencyKey: args.idempotency_key ?? null
    },
    error: null
  }),
  translate: (args) => ({
    ok: true,
    data: {
      sourceLanguage: args.sourceLanguage ?? "en",
      targetLanguage: args.targetLanguage ?? "es",
      translatedText: `Translated(${args.targetLanguage ?? "es"}): ${args.text ?? ""}`
    },
    error: null
  }),
  fetch_weather: (args) => ({
    ok: true,
    data: {
      location: args.location ?? "unknown",
      forecast: "Mild with light wind",
      temperatureC: 21
    },
    error: null
  }),
  web_search: (args) => ({
    ok: true,
    data: {
      query: args.query ?? null,
      results: [
        {
          title: "Deterministic web result",
          url: "https://example.com/deterministic-result"
        }
      ]
    },
    error: null
  })
};
