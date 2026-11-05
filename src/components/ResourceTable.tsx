// The resources of one product with their usage over the selected range, the
// largest first. It also gives the numbers of the charts as a table.

import type { ReactNode } from "react";
import type { Series } from "../lib/series.ts";

export interface ResourceColumn<T> {
  label: string;
  value: (row: T) => number;
  format: (value: number) => string;
}

export function ResourceTable<T>({
  caption,
  rows,
  name,
  seriesOf,
  columns,
}: {
  caption: string;
  rows: T[];
  name: (row: T) => { key: string; label: ReactNode; title: string };
  seriesOf: (key: string) => Series;
  columns: ResourceColumn<T>[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-1.5 pr-3 font-bold">{caption}</th>
            {columns.map((column) => (
              <th key={column.label} scope="col" className="py-1.5 pl-3 text-right font-bold">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { key, label, title } = name(row);
            return (
              <tr key={key} className="border-b border-line/70 last:border-0">
                <th scope="row" className="max-w-0 py-1.5 pr-3 font-normal">
                  <span className="flex min-w-0 items-center gap-1.5" title={title}>
                    <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: seriesOf(key).color }} />
                    <span className="truncate text-heading">{label}</span>
                  </span>
                </th>
                {columns.map((column) => (
                  <td key={column.label} className="numeric py-1.5 pl-3 text-right">{column.format(column.value(row))}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
