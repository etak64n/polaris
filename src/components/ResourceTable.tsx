// The resources of one product with their usage over the selected range, the
// largest first. It also gives the numbers of the charts as a table.

import type { ReactNode } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Series } from "@/lib/series.ts";

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
    <Table className="min-w-[480px]">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{caption}</TableHead>
          {columns.map((column) => (
            <TableHead key={column.label} className="text-right">{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { key, label, title } = name(row);
          return (
            <TableRow key={key}>
              <TableCell className="max-w-0">
                <span className="flex min-w-0 items-center gap-1.5" title={title}>
                  <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: seriesOf(key).color }} />
                  <span className="truncate text-heading">{label}</span>
                </span>
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.label} className="numeric text-right">{column.format(column.value(row))}</TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
