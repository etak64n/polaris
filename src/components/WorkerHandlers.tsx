// The handlers of the Workers with the most CPU time, in the picked Workers, or across
// every Worker of the account when none is picked. A handler is the entry of a Worker
// for one kind of invocation, such as the fetch handler for HTTP requests or the
// scheduled handler for Cron Triggers. The Free plan limits the CPU time of each HTTP
// request and each Cron Trigger, so their rows show that limit.

import { useEffect, useState } from "react";
import type { WorkerHandlersResponse } from "../../shared/api.ts";
import { FREE_CPU_MS_PER_INVOCATION } from "../../shared/limits.ts";
import { fetchWorkerHandlers } from "@/api.ts";
import { SelectPill } from "@/components/FilterPill.tsx";
import { WithHelp } from "@/components/HelpTip.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatDuration } from "@/lib/format.ts";

const PERIODS: readonly { value: "1" | "7"; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
];

/** The handlers by the names that Cloudflare analytics give them. Other names show as they come. */
const HANDLER_LABELS: Record<string, string> = {
  fetch: "HTTP",
  cron: "Cron",
  queue: "Queue",
  alarm: "Alarm",
  email: "Email",
  rpc: "RPC",
  tail: "Tail",
  unknown: "Unknown",
};

/** The handlers whose every invocation the Free plan limits to FREE_CPU_MS_PER_INVOCATION of CPU time. */
const LIMITED_HANDLERS = new Set(["fetch", "cron"]);

export function WorkerHandlers({
  colorOf,
  scriptNames,
  refreshCount,
}: {
  /** The color of a Worker in the charts, or null when the charts show it in no color of its own. */
  colorOf: (scriptName: string) => string | null;
  scriptNames: string[];
  /** The handlers load again when this grows, as the auto refresh of the page does. */
  refreshCount: number;
}) {
  const [days, setDays] = useState(1);
  const [result, setResult] = useState<WorkerHandlersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A refresh keeps the shown handlers until the new ones arrive; other changes clear them first.
  useEffect(() => {
    setResult(null);
  }, [days, scriptNames]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetchWorkerHandlers(days, scriptNames, controller.signal)
      .then(setResult)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [days, scriptNames, refreshCount]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SelectPill label="Date range" value={days === 1 ? "1" : "7"} options={PERIODS} onChange={(value) => setDays(Number(value))} />
      </div>
      {error !== null && <p className="error-box">{error}</p>}
      {error === null && result === null && <Skeleton className="h-32" />}
      {result !== null && result.handlers.length > 0 && (
        <Table className="min-w-[760px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="w-24">
                <WithHelp label="Handler" help="The kind of invocation that the Worker handled: HTTP for requests, Cron for Cron Triggers, Queue for the messages of a queue, and so on." />
              </TableHead>
              <TableHead className="w-28 text-right">Invocations</TableHead>
              <TableHead className="w-28 text-right">CPU time</TableHead>
              <TableHead className="w-24 text-right">
                <WithHelp label="p50" help="Half of the invocations used less CPU time than this." />
              </TableHead>
              <TableHead className="w-24 text-right">
                <WithHelp label="p99" help="99 in 100 invocations used less CPU time than this." />
              </TableHead>
              <TableHead className="w-28 text-right">
                <WithHelp
                  label="Free limit"
                  help="The CPU time that the Free plan allows each HTTP request and each Cron Trigger. A Worker may go past it now and then, but one that goes past it again and again is stopped."
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.handlers.map((row) => {
              const limit = LIMITED_HANDLERS.has(row.handler) ? FREE_CPU_MS_PER_INVOCATION : null;
              return (
                <TableRow key={`${row.scriptName}/${row.handler}`}>
                  <TableCell>
                    <ResourceName color={colorOf(row.scriptName)} label={row.scriptName} title={row.scriptName} />
                  </TableCell>
                  <TableCell>{HANDLER_LABELS[row.handler] ?? row.handler}</TableCell>
                  <TableCell className="numeric text-right">{formatCount(row.invocations)}</TableCell>
                  <TableCell className="numeric text-right">{formatDuration(row.cpuTimeMs)}</TableCell>
                  <PerInvocationCell value={row.cpuTimeP50Ms} limit={limit} />
                  <PerInvocationCell value={row.cpuTimeP99Ms} limit={limit} />
                  <TableCell className="numeric text-right text-subdued">{limit === null ? "—" : formatDuration(limit)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** The CPU time of one invocation, in amber past the limit of the Free plan. */
function PerInvocationCell({ value, limit }: { value: number; limit: number | null }) {
  const over = limit !== null && value > limit;
  return <TableCell className={`numeric text-right ${over ? "font-semibold text-warning" : ""}`}>{formatDuration(value)}</TableCell>;
}
