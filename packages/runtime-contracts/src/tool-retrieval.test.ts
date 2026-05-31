import { describe, expect, it } from "vitest";

import type { ToolMetadata } from "./tool-metadata.js";
import { retrieveTools } from "./tool-retrieval.js";
import { TOOLS } from "./tool-registry.js";

function ids(tools: readonly ToolMetadata[]): string[] {
  return tools.map((tool) => tool.id);
}

describe("tool retrieval", () => {
  it("returns report, summarisation, and email tools for the report scenario", () => {
    const results = retrieveTools("Summarise the Q3 report and email it to Manny.", TOOLS);
    const resultIds = ids(results);

    expect(resultIds).toHaveLength(5);
    expect(resultIds.slice(0, 4)).toEqual([
      "summarise_text",
      "send_email",
      "fetch_doc",
      "search_docs"
    ]);
  });

  it("ranks weather above unrelated tools for the weather scenario", () => {
    const results = retrieveTools("What is the weather in Melbourne?", TOOLS, TOOLS.length);
    const resultIds = ids(results);

    expect(resultIds[0]).toBe("fetch_weather");
    expect(resultIds.indexOf("fetch_weather")).toBeLessThan(resultIds.indexOf("query_sql"));
    expect(resultIds.indexOf("fetch_weather")).toBeLessThan(
      resultIds.indexOf("create_calendar_event")
    );
  });

  it("respects the requested limit", () => {
    const results = retrieveTools("Search and summarise reports.", TOOLS, 3);

    expect(results).toHaveLength(3);
  });

  it("returns every registry tool when the limit exceeds registry size", () => {
    const results = retrieveTools("Search and summarise reports.", TOOLS, TOOLS.length + 5);

    expect(results).toHaveLength(TOOLS.length);
  });

  it("returns stable results for the same goal and registry", () => {
    const goal = "Translate the report summary and email it.";

    const first = ids(retrieveTools(goal, TOOLS));
    const second = ids(retrieveTools(goal, TOOLS));
    const third = ids(retrieveTools(goal, TOOLS));

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("uses alphabetical tool name ordering for equal scores", () => {
    const registry: readonly ToolMetadata[] = [
      {
        id: "zeta_tool",
        name: "Zeta Tool",
        description: "Handle alpha tasks.",
        keywords: ["alpha"],
        idempotent: true,
        parallelSafe: true
      },
      {
        id: "alpha_tool",
        name: "Alpha Tool",
        description: "Handle alpha tasks.",
        keywords: ["alpha"],
        idempotent: true,
        parallelSafe: true
      }
    ];

    expect(ids(retrieveTools("alpha", registry, 2))).toEqual(["alpha_tool", "zeta_tool"]);
  });

  it("does not award phrase bonus for tool names embedded inside unrelated words", () => {
    const registry: readonly ToolMetadata[] = [
      {
        id: "sql",
        name: "SQL",
        description: "Run structured queries.",
        keywords: [],
        idempotent: true,
        parallelSafe: true
      },
      {
        id: "web_search",
        name: "Web Search",
        description: "Search the web.",
        keywords: ["nosql"],
        idempotent: true,
        parallelSafe: true
      }
    ];

    const results = retrieveTools("Find NoSQL documentation", registry, 2);

    expect(results[0]?.id).toBe("web_search");
  });

  it("does not mutate the registry or clone tool objects", () => {
    const registry = [...TOOLS];
    const originalOrder = ids(registry);

    const results = retrieveTools("Weather in Melbourne", registry);

    expect(ids(registry)).toEqual(originalOrder);
    expect(results[0]).toBe(TOOLS.find((tool) => tool.id === "fetch_weather"));
  });

  it("returns an empty list for a zero limit", () => {
    expect(retrieveTools("Search docs", TOOLS, 0)).toEqual([]);
  });
});
