// A table that stays readable with any number of rows: it shows one page at a
// time, finds rows by name, and sorts by a column when its header is clicked.

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount } from "@/lib/format.ts";
import { cn } from "cn";

/** Rows on one page of a table. */
const PAGE_SIZE = 20;

export interface TableSelection<T> {
  /** Names the column of checkboxes for screen readers. */
  label: string;
  isSelected: (row: T) => boolean;
  /** Whether a row that is not selected can be, such as while there is room for more. */
  canSelect: (row: T) => boolean;
  toggle: (row: T) => void;
  /** Names the checkbox of a row for screen readers. */
  rowLabel: (row: T) => string;
}

export function DataTable<T>({
  caption,
  data,
  columns,
  searchText,
  initialSort,
  selection,
}: {
  /** Names the table for screen readers and the search box. */
  caption: string;
  data: T[];
  columns: ColumnDef<T>[];
  /** The text that the search box finds a row by, such as its name. */
  searchText: (row: T) => string;
  initialSort: SortingState;
  selection?: TableSelection<T>;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filter: string) => searchText(row.original).toLowerCase().includes(filter.trim().toLowerCase()),
    autoResetPageIndex: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const total = table.getFilteredRowModel().rows.length;
  const first = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const last = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="grid gap-3">
      <div className="relative max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          aria-label={`Search ${caption}`}
          className="pl-8 pointer-coarse:min-h-11"
        />
      </div>
      <Table className="min-w-[480px] table-fixed">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {selection !== undefined && (
                <TableHead className="w-9">
                  <span className="sr-only">{selection.label}</span>
                </TableHead>
              )}
              {group.headers.map((header, index) => {
                const sorted = header.column.getIsSorted();
                const alignRight = index > 0;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    // The name takes about a third, so that five columns of numbers keep their headers apart.
                    className={cn(index === 0 ? "w-[34%]" : "text-right")}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 font-semibold hover:text-strong",
                          alignRight && "flex-row-reverse",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {selection !== undefined && (
                <TableCell className="w-9">
                  <input
                    type="checkbox"
                    checked={selection.isSelected(row.original)}
                    disabled={!selection.isSelected(row.original) && !selection.canSelect(row.original)}
                    onChange={() => selection.toggle(row.original)}
                    aria-label={selection.rowLabel(row.original)}
                    className="size-3.5 cursor-pointer accent-primary disabled:cursor-default"
                  />
                </TableCell>
              )}
              {row.getVisibleCells().map((cell, index) => (
                <TableCell key={cell.id} className={cn(index === 0 ? "min-w-0 truncate" : "numeric text-right")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="numeric">
          {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
        </span>
        <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
