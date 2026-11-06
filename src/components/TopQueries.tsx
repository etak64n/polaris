// The D1 queries that read or wrote the most rows, in the picked databases, or across
// every database of the account when none is picked.

import { useEffect, useState } from "react";
import type { QueryOrder, TopQueriesResponse } from "../../shared/api.ts";
import { fetchTopQueries } from "@/api.ts";
import { SelectPill } from "@/components/FilterPill.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount } from "@/lib/format.ts";

const ORDERS: readonly { value: QueryOrder; label: string }[] = [
  { value: "rowsRead", label: "Rows read" },
  { value: "rowsWritten", label: "Rows written" },
];
const PERIODS: readonly { value: "1" | "7"; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
];

export function TopQueries({
  databaseName,
  colorOf,
  databaseIds,
  refreshCount,
}: {
  databaseName: (id: string) => string;
  /** The color of a database in the charts, or null when the charts show it in no color of its own. */
  colorOf: (id: string) => string | null;
  databaseIds: string[];
  /** The queries load again when this grows, as the auto refresh of the page does. */
  refreshCount: number;
}) {
  const [order, setOrder] = useState<QueryOrder>("rowsRead");
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<TopQueriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A refresh keeps the shown queries until the new ones arrive; other changes clear them first.
  useEffect(() => {
    setResult(null);
  }, [days, order, databaseIds]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetchTopQueries(days, order, databaseIds, controller.signal)
      .then(setResult)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [days, order, databaseIds, refreshCount]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SelectPill label="Sort by" value={order} options={ORDERS} onChange={setOrder} />
        <SelectPill label="Date range" value={days === 1 ? "1" : "7"} options={PERIODS} onChange={(value) => setDays(Number(value))} />
      </div>
      {error !== null && <p className="error-box">{error}</p>}
      {error === null && result === null && <Skeleton className="h-32" />}
      {result !== null && result.queries.length > 0 && (
        <Table className="min-w-[720px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Query</TableHead>
              <TableHead className="w-44">Database</TableHead>
              <TableHead className="w-20 text-right">Runs</TableHead>
              <TableHead className="w-32 text-right">Rows read</TableHead>
              <TableHead className="w-32 text-right">Rows written</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.queries.map((query) => (
              <TableRow key={`${query.databaseId}/${query.query}`} className="align-top">
                <TableCell className="whitespace-normal">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <code tabIndex={0} className="line-clamp-2 font-mono text-xs break-all text-heading">{query.query}</code>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xl font-mono text-xs break-all whitespace-pre-wrap">{query.query}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <span className="flex min-w-0 items-center gap-1.5" title={query.databaseId}>
                    <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: colorOf(query.databaseId) ?? "transparent" }} />
                    <span className="truncate">{databaseName(query.databaseId)}</span>
                  </span>
                </TableCell>
                <TableCell className="numeric text-right">{formatCount(query.runs)}</TableCell>
                <TableCell className="numeric text-right">{formatCount(query.rowsRead)}</TableCell>
                <TableCell className="numeric text-right">{formatCount(query.rowsWritten)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
