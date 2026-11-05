// The estimated bill of the current billing cycle: the total so far, the
// projection to the end of the cycle, and one line per priced item.

import type { CostEstimate, CostLine } from "../../shared/cost.ts";
import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS, GB } from "../../shared/pricing.ts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatDate, formatDuration, formatMoney } from "@/lib/format.ts";
import { cn } from "cn";

export function CostSummary({ estimate, paidEstimate }: { estimate: CostEstimate; paidEstimate: CostEstimate | null }) {
  const { period } = estimate;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tile label="This cycle so far" value={formatMoney(estimate.total)} />
        <Tile label="Projected" value={estimate.projectedTotal === null ? "—" : formatMoney(estimate.projectedTotal)} />
        {paidEstimate !== null && (
          <Tile label="On Workers Paid" value={formatMoney(paidEstimate.projectedTotal ?? paidEstimate.total)} muted />
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {formatDate(period.start)} – {formatDate(period.end)}
        </div>
      </div>
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Used</TableHead>
            <TableHead className="text-right">Included</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Projected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimate.subscription > 0 && (
            <TableRow>
              <TableCell className="font-bold text-heading">Workers</TableCell>
              <TableCell>Paid plan</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="numeric text-right font-bold text-heading">{formatMoney(estimate.subscription)}</TableCell>
              <TableCell className="numeric text-right">{formatMoney(estimate.subscription)}</TableCell>
            </TableRow>
          )}
          {estimate.lines.map((line) => (
            <TableRow key={`${line.product}/${line.item}`}>
              <TableCell className="font-bold text-heading">{line.product}</TableCell>
              <TableCell>{line.item}</TableCell>
              <TableCell className="numeric text-right">{formatAmount(line, line.used)}</TableCell>
              <TableCell className="numeric text-right text-muted-foreground">{formatIncluded(line)}</TableCell>
              <TableCell className="numeric text-right font-bold text-heading">{formatMoney(line.cost)}</TableCell>
              <TableCell className="numeric text-right">{line.projectedCost === null ? "—" : formatMoney(line.projectedCost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Tile({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid min-w-36 gap-0.5 border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("numeric text-xl font-bold", muted ? "text-muted-foreground" : "text-heading")}>{value}</span>
    </div>
  );
}

function formatAmount(line: CostLine, amount: number): string {
  switch (line.unit) {
    case "ms":
      return formatDuration(amount);
    case "GB-month":
      return `${amount.toFixed(2)} GB-mo`;
    default:
      return formatCount(amount);
  }
}

// On the Free plan, Workers and D1 have daily limits instead of included usage.
function formatIncluded(line: CostLine): string {
  if (line.included !== null) return line.unit === "GB-month" ? `${line.included} GB-mo` : formatAmount(line, line.included);
  if (line.product === "Workers" && line.item === "Requests") return `${formatCount(FREE_DAILY_LIMITS.workerRequests)}/day`;
  if (line.product === "D1" && line.item === "Rows read") return `${formatCount(FREE_DAILY_LIMITS.d1RowsRead)}/day`;
  if (line.product === "D1" && line.item === "Rows written") return `${formatCount(FREE_DAILY_LIMITS.d1RowsWritten)}/day`;
  if (line.product === "D1" && line.item === "Storage") return `${FREE_D1_STORAGE_BYTES / GB} GB`;
  return "—";
}
