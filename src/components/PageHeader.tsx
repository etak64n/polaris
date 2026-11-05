import type { ReactNode } from "react";

/** The heading of a page, with a control on its right such as the range. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold text-heading">{title}</h1>
      {children}
    </div>
  );
}
