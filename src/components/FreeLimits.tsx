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

export function FreeLimits({ limits }: { limits: Limits }) {
  return (
    <div className="grid gap-8">
      <Figure
        label="Requests stopped by a limit"
        value={formatCount(limits.stopped)}
        note={`Last ${USAGE_DAYS} days`}
        tone={limits.stopped > 0 ? "critical" : "default"}
      />
      <Section title="Per day" aside={<Note>Resets at 00:00 UTC</Note>}>
        <Table className="table-fixed min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Product</TableHead>
              <TableHead className="w-48">Item</TableHead>
              <TableHead className="text-right">Free limit</TableHead>
              <TableHead className="text-right">Used today</TableHead>
              <TableHead className="text-right">Left</TableHead>
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
        <Table className="table-fixed min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Product</TableHead>
              <TableHead className="w-48">Item</TableHead>
              <TableHead className="text-right">Free limit</TableHead>
              <TableHead className="text-right">Now</TableHead>
              <TableHead className="text-right">Left</TableHead>
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
          <Table className="table-fixed min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Product</TableHead>
                <TableHead className="w-48">Item</TableHead>
                <TableHead className="text-right">Free amount</TableHead>
                <TableHead className="text-right">Projected</TableHead>
                <TableHead className="text-right">Left</TableHead>
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

/** The share left, red once the limit is reached and amber when little is left. */
function LeftCell({ limit }: { limit: FreeLimit }) {
  const color = limit.left <= 0 ? "text-destructive" : limit.left < LOW ? "text-warning" : "text-strong";
  return <TableCell className={`numeric text-right font-semibold ${color}`}>{`${Math.max(0, Math.floor(limit.left * 100))}%`}</TableCell>;
}

function formatAmount(limit: FreeLimit, value: number): string {
  if (limit.unit === "bytes") return formatBytes(value);
  if (limit.unit === "GB-month") return `${Number.isInteger(value) ? value : value.toFixed(2)} GB-mo`;
  return formatCompact(Math.round(value));
}
