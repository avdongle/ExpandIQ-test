import { describe, expect, it } from "vitest";

import { getApiStatus } from "./index.js";

describe("api status", () => {
  it("returns a ready status", () => {
    expect(getApiStatus()).toEqual({ service: "api", status: "ready" });
  });
});
