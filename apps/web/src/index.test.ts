import { describe, expect, it } from "vitest";

import { getWebMetadata } from "./index";

describe("web metadata", () => {
  it("returns app metadata", () => {
    expect(getWebMetadata()).toEqual({
      name: "ExpandIQ AgentKit",
      app: "web"
    });
  });
});
