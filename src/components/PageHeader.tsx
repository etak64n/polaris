import type { ReactNode } from "react";

/** The heading of a page, with its controls on the right, such as the range. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold text-heading">{title}</h1>
      {children !== undefined && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
