export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  keywords: readonly string[];
  idempotent: boolean;
  parallelSafe: boolean;
}
