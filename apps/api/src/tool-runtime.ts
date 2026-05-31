import type { JSONValue } from "./sqlite-persistence.js";

type ToolError = {
  code: string;
  message: string;
  recoverable: boolean;
};

type ToolResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ToolError };

export type DispatchToolInput = {
  tool: string;
  args: Record<string, string>;
  maxRetries: number;
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
  maxRetries
}: DispatchToolInput): DispatchToolResult {
  const errors: DispatchToolResult["retry"]["errors"] = [];
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = invokeTool(tool, args, attempt);

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

function invokeTool(
  tool: string,
  args: Record<string, string>,
  attempt: number
): ToolResult<JSONValue> {
  if (tool === "search_docs") {
    return {
      ok: true,
      data: { docIds: ["report-doc-1"], query: args.query },
      error: null
    };
  }

  if (tool === "fetch_doc") {
    return {
      ok: true,
      data: {
        docId: args.docId,
        content: `Contents for ${args.docId ?? "unknown-doc"}`
      },
      error: null
    };
  }

  if (tool === "summarise_text") {
    return {
      ok: true,
      data: {
        summary: `Summary for ${args.text ?? "provided text"}`
      },
      error: null
    };
  }

  if (tool === "query_sql") {
    return {
      ok: true,
      data: {
        rows: [{ accountId: "acct-1", activityCount: 12 }],
        sql: args.sql
      },
      error: null
    };
  }

  if (tool === "lookup_contact") {
    if (args.contactId === "transient-contact" && attempt === 1) {
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
        contactId: args.contactId,
        email: "casey@example.com"
      },
      error: null
    };
  }

  return {
    ok: false,
    data: null,
    error: {
      code: "UNKNOWN_TOOL",
      message: `No mock runtime is configured for ${tool}.`,
      recoverable: false
    }
  };
}
