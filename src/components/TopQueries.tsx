// The D1 queries that read or wrote the most rows, across every database of the account.

import { useEffect, useState } from "react";
import type { QueryOrder, TopQueriesResponse } from "../../shared/api.ts";
import { fetchTopQueries } from "../api.ts";
import { formatCount } from "../lib/format.ts";
import type { Series } from "../lib/series.ts";
import { Segmented } from "./ui/segmented.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

const ORDERS = [
  { value: "rowsRead" as const, label: "Rows read" },
  { value: "rowsWritten" as const, label: "Rows written" },
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-heading">Top queries</h3>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Sort queries by" options={ORDERS} value={order} onChange={setOrder} />
          <Segmented label="Queries of" options={PERIODS} value={days} onChange={setDays} />
        </div>
      </div>
      {error !== null && <p className="error-box">{error}</p>}
      {error === null && result === null && <Skeleton className="h-32 rounded-ui" />}
      {result !== null && result.queries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-3 font-bold">Query</th>
                <th scope="col" className="py-1.5 pr-3 font-bold">Database</th>
                <th scope="col" className="py-1.5 pl-3 text-right font-bold">Runs</th>
                <th scope="col" className="py-1.5 pl-3 text-right font-bold">Rows read</th>
                <th scope="col" className="py-1.5 pl-3 text-right font-bold">Rows written</th>
              </tr>
            </thead>
            <tbody>
              {result.queries.map((query) => (
                <tr key={`${query.databaseId}/${query.query}`} className="border-b border-line/70 align-top last:border-0">
                  <td className="max-w-0 py-1.5 pr-3">
                    <code className="line-clamp-2 font-mono text-xs break-all text-heading" title={query.query}>{query.query}</code>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: seriesOf(query.databaseId).color }} />
                      {databaseName(query.databaseId)}
                    </span>
                  </td>
                  <td className="numeric py-1.5 pl-3 text-right">{formatCount(query.runs)}</td>
                  <td className="numeric py-1.5 pl-3 text-right">{formatCount(query.rowsRead)}</td>
                  <td className="numeric py-1.5 pl-3 text-right">{formatCount(query.rowsWritten)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
