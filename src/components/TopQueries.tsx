// The D1 queries that read or wrote the most rows, across every database of the account.

import { useEffect, useState } from "react";
import type { QueryOrder, TopQueriesResponse } from "../../shared/api.ts";
import { fetchTopQueries } from "@/api.ts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount } from "@/lib/format.ts";
import type { Series } from "@/lib/series.ts";

const ORDERS: { value: QueryOrder; label: string }[] = [
  { value: "rowsRead", label: "Rows read" },
  { value: "rowsWritten", label: "Rows written" },
];
const PERIODS = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 days" },
];

export function TopQueries({ databaseName, seriesOf }: { databaseName: (id: string) => string; seriesOf: (key: string) => Series }) {
  const [order, setOrder] = useState<QueryOrder>("rowsRead");
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<TopQueriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(null);
    fetchTopQueries(days, order, controller.signal)
      .then(setResult)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [days, order]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Sort queries by"
            value={order}
            onValueChange={(value) => {
              if (value === "rowsRead" || value === "rowsWritten") setOrder(value);
            }}
          >
            {ORDERS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Queries of"
            value={String(days)}
            onValueChange={(value) => {
              if (value !== "") setDays(Number(value));
            }}
          >
            {PERIODS.map((option) => (
              <ToggleGroupItem key={option.value} value={String(option.value)}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      {error !== null && <p className="error-box">{error}</p>}
      {error === null && result === null && <Skeleton className="h-32" />}
      {result !== null && result.queries.length > 0 && (
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Query</TableHead>
              <TableHead>Database</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="text-right">Rows read</TableHead>
              <TableHead className="text-right">Rows written</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.queries.map((query) => (
              <TableRow key={`${query.databaseId}/${query.query}`} className="align-top">
                <TableCell className="max-w-0 whitespace-normal">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <code tabIndex={0} className="line-clamp-2 font-mono text-xs break-all text-heading">{query.query}</code>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xl font-mono text-xs break-all whitespace-pre-wrap">{query.query}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: seriesOf(query.databaseId).color }} />
                    {databaseName(query.databaseId)}
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
