/** The name of a resource in a table, after the color that the charts give it. */
export function ResourceName({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={title}>
      <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate text-heading">{label}</span>
    </span>
  );
}
