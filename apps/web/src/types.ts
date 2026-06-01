export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

export type RunStatus = "running" | "finished";

export type TerminalReason =
  | "step_cap"
  | "cost_cap"
  | "stuck"
  | "timeout"
  | "error"
  | "succeeded"
  | (string & {});

export type RunSummary = {
  id: string;
  goal: string;
  status: RunStatus;
  reason: TerminalReason | null;
  total_cost: number;
  final_answer: string | null;
  started_at: string;
  finished_at: string | null;
};

export type RunStep = {
  id: string;
  run_id: string;
  step_number: number;
  kind: string;
  cost: number;
  args: JSONValue;
  result: JSONValue;
  started_at: string;
  finished_at: string | null;
};

export type RunDetail = {
  run: RunSummary;
  steps: RunStep[];
};

export type RunsResponse = {
  runs: RunSummary[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
  };
};

export type CreateRunResponse = {
  run_id: string;
  run?: RunSummary;
};
