// The Free plan limits in one table per kind of limit, so that every column holds one
// value and the heading of the table says which usage it compares: the daily limits
// with today, the sizes and counts with now, and the free amounts of R2 with the
// projection for the cycle. Each table puts the limit with the least left first.

import { USAGE_DAYS } from "../../shared/api.ts";
import type { FreeLimit, FreeLimits as Limits } from "../../shared/limits.ts";
import { Figure, Section } from "@/components/Layout.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatCompact, formatCount } from "@/lib/format.ts";

/** The share left under which a limit needs attention. */
const LOW = 0.2;

// Every column has a width, so that a narrow screen scrolls the table sideways rather than
// squeezing the gauge of the Left column: the gauge keeps at least 96px.
export function FreeLimits({ limits }: { limits: Limits }) {
  return (
    <div className="grid gap-8">
      <Figure
        label="Workers requests stopped by a limit"
        value={formatCount(limits.stopped)}
        note={`Last ${USAGE_DAYS} days`}
        tone={limits.stopped > 0 ? "critical" : "default"}
      />
      <Section title="Per day" aside={<Note>Resets at 00:00 UTC</Note>}>
        <Table className="table-fixed min-w-[704px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Product</TableHead>
              <TableHead className="w-40">Item</TableHead>
              <TableHead className="w-28 text-right">Free limit</TableHead>
              <TableHead className="w-28 text-right">Used today</TableHead>
              <TableHead className="w-44 text-right">Left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limits.daily.map((limit) => (
              <TableRow key={limit.id}>
                <TableCell className="font-semibold">{limit.product}</TableCell>
                <TableCell>{limit.item}</TableCell>
                <TableCell className="numeric text-right text-subdued">{formatAmount(limit, limit.limit)}</TableCell>
                <TableCell className="numeric text-right">{formatAmount(limit, limit.used)}</TableCell>
                <LeftCell limit={limit} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section title="Size and count">
        <Table className="table-fixed min-w-[704px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Product</TableHead>
              <TableHead className="w-40">Item</TableHead>
              <TableHead className="w-28 text-right">Free limit</TableHead>
              <TableHead className="w-28 text-right">Now</TableHead>
              <TableHead className="w-44 text-right">Left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limits.sizes.map((limit) => (
              <TableRow key={limit.id}>
                <TableCell className="font-semibold">{limit.product}</TableCell>
                <TableCell>{limit.item}</TableCell>
                <TableCell className="numeric text-right text-subdued">{formatAmount(limit, limit.limit)}</TableCell>
                <TableCell className="numeric text-right">{formatAmount(limit, limit.used)}</TableCell>
                <LeftCell limit={limit} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      {limits.monthly.length > 0 && (
        <Section title="Per month" aside={<Note>Billed past the free amount</Note>}>
          <Table className="table-fixed min-w-[704px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Product</TableHead>
                <TableHead className="w-40">Item</TableHead>
                <TableHead className="w-28 text-right">Free amount</TableHead>
                <TableHead className="w-28 text-right">Projected</TableHead>
                <TableHead className="w-44 text-right">Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.monthly.map((limit) => (
                <TableRow key={limit.id}>
                  <TableCell className="font-semibold">{limit.product}</TableCell>
                  <TableCell>{limit.item}</TableCell>
                  <TableCell className="numeric text-right text-subdued">{formatAmount(limit, limit.limit)}</TableCell>
                  <TableCell className="numeric text-right">{formatAmount(limit, limit.used)}</TableCell>
                  <LeftCell limit={limit} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}
    </div>
  );
}

function Note({ children }: { children: string }) {
  return <span className="text-xs text-subdued">{children}</span>;
}

/**
 * The share left, as a gauge and its percentage. The gauge empties as the usage nears
 * the limit, like a fuel gauge. Little left turns it amber, and a reached limit leaves
 * it empty with the percentage in red.
 */
function LeftCell({ limit }: { limit: FreeLimit }) {
  const percent = Math.floor(Math.min(1, Math.max(0, limit.left)) * 100);
  const reached = limit.left <= 0;
  const low = !reached && limit.left < LOW;
  const text = reached ? "text-destructive" : low ? "text-warning" : "text-strong";
  return (
    <TableCell>
      <div className="flex items-center justify-end gap-3">
        <div
          role="meter"
          aria-label={`${limit.product} ${limit.item} left`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full min-w-24 max-w-32 overflow-hidden rounded-sm bg-hairline"
        >
          <div className={`h-full ${low ? "bg-warning" : "bg-[var(--ds-series-muted)]"}`} style={{ width: `${percent}%` }} />
        </div>
        <span className={`numeric w-11 shrink-0 text-right font-semibold ${text}`}>{`${percent}%`}</span>
      </div>
    </TableCell>
  );
}

function formatAmount(limit: FreeLimit, value: number): string {
  switch (limit.unit) {
    case "bytes":
      return formatBytes(value);
    case "GB-month":
      return `${Number.isInteger(value) ? value : value.toFixed(2)} GB-mo`;
    case "GB-s":
      return `${formatCompact(Math.round(value))} GB-s`;
    case "minutes":
      return `${Number.isInteger(value) ? value : value.toFixed(1)} min`;
    case "count":
      return formatCompact(Math.round(value));
  }
}
