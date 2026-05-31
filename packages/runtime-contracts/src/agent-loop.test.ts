import { describe, expect, it, vi } from "vitest";

import { runAgentLoopStep } from "./agent-loop.js";
import { TOOLS } from "./tool-registry.js";

describe("agent loop step", () => {
  it("passes retrieved candidate tools to the mock LLM", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ next_action: "done" });

    await runAgentLoopStep({
      goal: "What is the weather in Melbourne?",
      mockLlm,
      registry: TOOLS,
      topK: 3
    });

    expect(mockLlm).toHaveBeenCalledOnce();
    expect(mockLlm).toHaveBeenCalledWith({
      goal: "What is the weather in Melbourne?",
      past_steps: [],
      candidate_tools: expect.arrayContaining([
        expect.objectContaining({ id: "fetch_weather" })
      ])
    });
    expect(mockLlm.mock.calls[0]?.[0].candidate_tools).toHaveLength(3);
    expect(mockLlm.mock.calls[0]?.[0].candidate_tools).not.toBe(TOOLS);
  });
});
