export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  idempotent: boolean;
  parallelSafe: boolean;
}
