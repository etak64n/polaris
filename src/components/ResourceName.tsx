/** The name of a resource in a table, after its color in the charts when it has one. */
export function ResourceName({ color, label, title }: { color: string | null; label: string; title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={title}>
      <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: color ?? "transparent" }} />
      <span className="truncate text-heading">{label}</span>
    </span>
  );
}
