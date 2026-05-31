declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(location: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    all(...anonymousParameters: SQLiteValue[]): SQLiteRow[];
    get(...anonymousParameters: SQLiteValue[]): SQLiteRow | undefined;
    run(...anonymousParameters: SQLiteValue[]): void;
  }

  export type SQLiteValue = string | number | null;
  export type SQLiteRow = Record<string, SQLiteValue>;
}
