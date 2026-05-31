import { describe, expect, it } from "vitest";

import { getAllTools, getToolById, TOOLS } from "./tool-registry.js";

const assignmentToolIds = [
  "search_docs",
  "fetch_doc",
  "send_email",
  "create_calendar_event",
  "query_sql",
  "summarise_text",
  "translate",
  "fetch_weather",
  "lookup_contact",
  "web_search"
];

describe("tool registry", () => {
  it("contains exactly the starter assignment tools", () => {
    expect(TOOLS).toHaveLength(10);
    expect(TOOLS.map((tool) => tool.id).sort()).toEqual([...assignmentToolIds].sort());
  });

  it("has complete metadata with unique ids and names", () => {
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const tool of TOOLS) {
      expect(tool.id).toEqual(expect.any(String));
      expect(tool.name).toEqual(expect.any(String));
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.keywords.length).toBeGreaterThan(0);
      expect(typeof tool.idempotent).toBe("boolean");
      expect(typeof tool.parallelSafe).toBe("boolean");

      ids.add(tool.id);
      names.add(tool.name);
    }

    expect(ids.size).toBe(TOOLS.length);
    expect(names.size).toBe(TOOLS.length);
  });

  it("uses non-empty lowercase keywords", () => {
    for (const tool of TOOLS) {
      for (const keyword of tool.keywords) {
        expect(keyword.trim()).toBe(keyword);
        expect(keyword.length).toBeGreaterThan(0);
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
  });

  it("sets assignment safety flags explicitly", () => {
    expect(getToolById("send_email")).toMatchObject({
      idempotent: false,
      parallelSafe: false
    });
    expect(getToolById("create_calendar_event")).toMatchObject({
      idempotent: false,
      parallelSafe: false
    });

    for (const tool of TOOLS.filter(
      (tool) => !["send_email", "create_calendar_event"].includes(tool.id)
    )) {
      expect(tool.idempotent).toBe(true);
      expect(tool.parallelSafe).toBe(true);
    }
  });

  it("returns tools through deterministic lookup helpers", () => {
    expect(getAllTools()).toBe(TOOLS);
    expect(getToolById("fetch_doc")?.id).toBe("fetch_doc");
    expect(getToolById("missing_tool")).toBeUndefined();
  });
});
