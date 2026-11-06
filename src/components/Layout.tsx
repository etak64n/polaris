// The blocks that pages are made of: sections with a heading, and the gray tray
// that holds the white cards of the charts.

import type { ReactNode } from "react";

/**
 * A part of a page under a heading, with its controls on the right of the heading.
 * A part inside a page has a 20px heading; `large` gives the 28px heading of a part
 * that is the page itself, as the sections of the home of the Stripe Dashboard.
 */
export function Section({ title, aside, large = false, children }: { title: string; aside?: ReactNode; large?: boolean; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <h2 className={large ? "text-display font-bold text-heading" : "text-figure font-bold text-strong"}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The gray tray that groups cards without shadows: two columns on wide screens. */
export function Tray({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 rounded-2xl bg-surface-subdued p-2 lg:grid-cols-2">{children}</div>;
}

/** A white card in the tray, with a heading and a short line under it. */
export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <article className="grid min-w-0 content-start gap-3 rounded-lg bg-card p-5">
      <header className="grid gap-0.5">
        <h2 className="text-sm font-semibold text-heading">{title}</h2>
        {description !== undefined && <p className="text-xs text-subdued">{description}</p>}
      </header>
      {children}
    </article>
  );
}
