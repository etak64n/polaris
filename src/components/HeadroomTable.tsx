// The headroom under each limit of the Free plan, the least first, so that the limit
// that decides whether to pay comes at the top. The bar fills as the usage nears the
// limit, and turns to the colors of attention and of a reached limit.

import type { Headroom } from "../../shared/headroom.ts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatCompact, formatCount, formatDate } from "@/lib/format.ts";
import { cn } from "cn";

/** Headroom under which a limit needs attention. */
const LOW = 0.2;

export function HeadroomTable({ items }: { items: Headroom[] }) {
  return (
    <Table className="min-w-[720px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[26%]">Limit</TableHead>
          <TableHead className="w-[20%] text-right">Usage</TableHead>
          <TableHead className="w-[16%] text-right">Free limit</TableHead>
          <TableHead>Headroom</TableHead>
          <TableHead className="w-32">Past the limit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const reached = item.headroom <= 0;
          const low = !reached && item.headroom < LOW;
          const share = Math.min(1, Math.max(0, 1 - item.headroom));
          const stops = item.unit === "stops";
          return (
            <TableRow key={item.id}>
              <TableCell>
                <span className="block text-xs font-normal text-subdued">{item.product}</span>
                <span className="font-semibold">{item.item}</span>
              </TableCell>
              <TableCell className="numeric text-right align-top">
                <span className="block">{formatAmount(item, item.used)}</span>
                {basisLabel(item).map((line) => (
                  <span key={line} className="block text-xs text-subdued">
                    {line}
                  </span>
                ))}
              </TableCell>
              <TableCell className="numeric text-right">
                {formatLimit(item).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </TableCell>
              <TableCell>
                {stops ? (
                  // Stopped requests have no share of a limit, only a count, so no bar.
                  <span className={cn("numeric font-semibold", reached ? "text-destructive" : "text-strong")}>
                    {item.used > 0 ? `${formatCount(item.used)} stopped` : "None stopped"}
                  </span>
                ) : (
                <div className="flex items-center gap-3">
                  <div
                    role="meter"
                    aria-label={`${item.product} ${item.item}`}
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={share}
                    className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-subdued"
                  >
                    <div
                      className={cn("h-full", reached ? "bg-destructive" : low ? "bg-warning" : "bg-[var(--ds-series-muted)]")}
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className={cn("numeric w-20 text-right font-semibold", reached ? "text-destructive" : low ? "text-warning" : "text-strong")}>
                    {reached ? "Reached" : `${Math.floor(item.headroom * 100)}% left`}
                  </span>
                </div>
                )}
              </TableCell>
              <TableCell className="text-label">{item.past === "stops" ? "Stops" : "Costs money"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function formatAmount(item: Headroom, value: number): string {
  if (item.unit === "bytes") return formatBytes(value);
  if (item.unit === "GB-month") return `${value.toFixed(2)} GB-mo`;
  return formatCount(Math.round(value));
}

/** The free limit, in lines: the limits per request take two. */
function formatLimit(item: Headroom): string[] {
  if (item.unit === "stops") return ["CPU 10 ms", "50 subrequests"];
  const per = item.basis === "busiest-day" ? " per day" : item.basis === "cycle" ? " per month" : "";
  if (item.unit === "bytes") return [formatBytes(item.limit)];
  if (item.unit === "GB-month") return [`${item.limit} GB-mo${per}`];
  return [`${formatCompact(item.limit)}${per}`];
}

/** The lines under the usage that say which usage it is, such as the busiest day and today. */
function basisLabel(item: Headroom): string[] {
  if (item.basis === "busiest-day") {
    if (item.date === null) return ["Last 31 days"];
    const busiest = `Busiest day ${formatDate(item.date)}`;
    return item.today === null ? [busiest] : [busiest, `Today ${formatCompact(item.today)}`];
  }
  if (item.basis === "cycle") return ["Projected for the cycle"];
  if (item.basis === "all-days") return ["Last 31 days"];
  return ["Now"];
}
