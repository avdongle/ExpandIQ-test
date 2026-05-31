export const TERMINAL_REASONS = [
  "step_cap",
  "cost_cap",
  "stuck",
  "timeout",
  "error",
  "succeeded"
] as const;

export type TerminalReason = (typeof TERMINAL_REASONS)[number];
