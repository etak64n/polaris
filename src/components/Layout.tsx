// The blocks that pages are made of: sections with a heading, figures, and the gray
// tray that holds the white cards of the charts.

import type { ReactNode } from "react";
import { HelpTip } from "@/components/HelpTip.tsx";

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

/**
 * A white card in the tray, in the manner of the metrics of the Stripe Dashboard:
 * the name, the figure large under it, a note such as the time of the figure, and
 * the chart.
 */
export function Card({
  title,
  help,
  figure,
  note,
  children,
}: {
  title: string;
  /** What the card shows, behind an ⓘ after the title. */
  help?: ReactNode;
  figure?: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  return (
    <article className="grid min-w-0 content-start gap-3 rounded-lg bg-card p-5">
      <header className="grid gap-0.5">
        <h2 className="flex items-center gap-1 text-sm font-semibold text-heading">
          {title}
          {help !== undefined && <HelpTip title={title}>{help}</HelpTip>}
        </h2>
        {figure !== undefined && <div className="numeric flex flex-wrap items-baseline gap-x-2 text-figure font-bold text-foreground">{figure}</div>}
        {note !== undefined && <p className="text-xs text-subdued">{note}</p>}
      </header>
      {children}
    </article>
  );
}

/**
 * A figure in the manner of the Stripe Dashboard: the name, the value large under it,
 * and a note such as the span of the figure. "muted" is a figure to compare with, and
 * "critical" a figure that needs action.
 */
export function Figure({
  label,
  value,
  note,
  help,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  /** What the value means, behind an ⓘ after the label. */
  help?: ReactNode;
  tone?: "default" | "muted" | "critical";
}) {
  const color = tone === "muted" ? "text-subdued" : tone === "critical" ? "text-destructive" : "text-foreground";
  return (
    <div className="grid gap-0.5">
      <span className="flex items-center gap-1 text-sm font-semibold text-heading">
        {label}
        {help !== undefined && <HelpTip title={label}>{help}</HelpTip>}
      </span>
      {/* Plain strings: cn would drop text-figure, which it takes for a color, next to the text color. */}
      <span className={`numeric text-figure font-bold ${color}`}>{value}</span>
      {note !== undefined && <span className="text-xs text-subdued">{note}</span>}
    </div>
  );
}
