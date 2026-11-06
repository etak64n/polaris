import type { ReactNode } from "react";

/**
 * The top of a page: the title, then a row of filters on the left and actions on
 * the right, and a line under them.
 */
export function PageHeader({ title, filters, actions }: { title: string; filters?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="grid gap-4 border-b pb-4">
      <h1 className="text-display font-bold text-heading">{title}</h1>
      {(filters !== undefined || actions !== undefined) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
          {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}
