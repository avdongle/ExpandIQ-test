export type ToolMetadata = {
  id: string;
  name: string;
  description: string;
  keywords: readonly string[];
  idempotent: boolean;
  parallelSafe: boolean;
};

export const TOOLS = [
  {
    id: "search_docs",
    name: "Search Docs",
    description: "Search indexed documents for relevant matching content.",
    keywords: ["search", "docs", "documents", "knowledge", "report"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "fetch_doc",
    name: "Fetch Doc",
    description: "Fetch a single document by identifier.",
    keywords: ["fetch", "doc", "document", "retrieve", "report"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "query_sql",
    name: "Query SQL",
    description: "Run a read-only SQL query against structured data.",
    keywords: ["query", "sql", "database", "data"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "summarise_text",
    name: "Summarise Text",
    description: "Summarise provided text into a shorter form.",
    keywords: ["summarise", "summary", "text", "condense", "report"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "lookup_contact",
    name: "Lookup Contact",
    description: "Look up contact details from a known contact source.",
    keywords: ["lookup", "contact", "person", "directory"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "send_email",
    name: "Send Email",
    description: "Send an email to a known contact using an idempotency key.",
    keywords: ["send", "email", "contact", "message"],
    idempotent: false,
    parallelSafe: false
  }
] as const satisfies readonly ToolMetadata[];
