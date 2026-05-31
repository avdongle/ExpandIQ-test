import type { ToolMetadata } from "./tool-metadata.js";

export const TOOLS = [
  {
    id: "search_docs",
    name: "Search Docs",
    description: "Search indexed documents for relevant matching content.",
    keywords: ["search", "docs", "documents", "knowledge"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "fetch_doc",
    name: "Fetch Doc",
    description: "Fetch a single document by identifier.",
    keywords: ["fetch", "doc", "document", "retrieve"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "send_email",
    name: "Send Email",
    description: "Send an email message to one or more recipients.",
    keywords: ["send", "email", "message", "mail"],
    idempotent: false,
    parallelSafe: false
  },
  {
    id: "create_calendar_event",
    name: "Create Calendar Event",
    description: "Create a calendar event for a scheduled time.",
    keywords: ["create", "calendar", "event", "schedule"],
    idempotent: false,
    parallelSafe: false
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
    keywords: ["summarise", "summary", "text", "condense"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "translate",
    name: "Translate",
    description: "Translate provided text from one language to another.",
    keywords: ["translate", "translation", "language", "localize"],
    idempotent: true,
    parallelSafe: true
  },
  {
    id: "fetch_weather",
    name: "Fetch Weather",
    description: "Fetch weather information for a requested location.",
    keywords: ["fetch", "weather", "forecast", "location"],
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
    id: "web_search",
    name: "Web Search",
    description: "Search the web for public information.",
    keywords: ["web", "search", "internet", "public"],
    idempotent: true,
    parallelSafe: true
  }
] as const satisfies readonly ToolMetadata[];

export function getAllTools(): readonly ToolMetadata[] {
  return TOOLS;
}

export function getToolById(id: string): ToolMetadata | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
