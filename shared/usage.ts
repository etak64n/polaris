// Usage of one UTC day, by resource. polaris keeps days in this shape in the
// history bucket and sends them to the browser in the same shape.

export interface WorkerUsage {
  scriptName: string;
  requests: number;
  /** CPU time of all invocations, in milliseconds. */
  cpuTimeMs: number;
}

export interface D1Usage {
  databaseId: string;
  rowsRead: number;
  rowsWritten: number;
  /** The largest size of the database during the day, in bytes. */
  storageBytes: number;
}

export interface R2Usage {
  bucketName: string;
  classA: number;
  classB: number;
  /** The largest size of the objects and their metadata during the day, in bytes. */
  storageBytes: number;
}

export interface DailyUsage {
  date: string;
  workers: WorkerUsage[];
  d1: D1Usage[];
  r2: R2Usage[];
}

export function emptyDay(date: string): DailyUsage {
  return { date, workers: [], d1: [], r2: [] };
}

/** The usage of every resource of a day, added up per metric. */
export interface UsageTotals {
  workerRequests: number;
  workerCpuMs: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  d1StorageBytes: number;
  r2ClassA: number;
  r2ClassB: number;
  r2StorageBytes: number;
}

export type Metric = keyof UsageTotals;

export function totalsOf(day: DailyUsage): UsageTotals {
  const sum = <T>(items: T[], value: (item: T) => number): number => items.reduce((total, item) => total + value(item), 0);
  return {
    workerRequests: sum(day.workers, (item) => item.requests),
    workerCpuMs: sum(day.workers, (item) => item.cpuTimeMs),
    d1RowsRead: sum(day.d1, (item) => item.rowsRead),
    d1RowsWritten: sum(day.d1, (item) => item.rowsWritten),
    d1StorageBytes: sum(day.d1, (item) => item.storageBytes),
    r2ClassA: sum(day.r2, (item) => item.classA),
    r2ClassB: sum(day.r2, (item) => item.classB),
    r2StorageBytes: sum(day.r2, (item) => item.storageBytes),
  };
}
