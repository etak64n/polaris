// The estimated bill of the current billing cycle: the total so far, the
// projection to the end of the cycle, and one line per priced item.

import type { CostEstimate, CostLine } from "../../shared/cost.ts";
import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS, GB } from "../../shared/pricing.ts";
import { formatCount, formatDate, formatDuration, formatMoney } from "../lib/format.ts";

export function CostSummary({ estimate, paidEstimate }: { estimate: CostEstimate; paidEstimate: CostEstimate | null }) {
  const { period } = estimate;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <Tile label="This cycle so far" value={formatMoney(estimate.total)} />
        <Tile label="Projected" value={estimate.projectedTotal === null ? "—" : formatMoney(estimate.projectedTotal)} />
        {paidEstimate !== null && (
          <Tile label="On Workers Paid" value={formatMoney(paidEstimate.projectedTotal ?? paidEstimate.total)} muted />
        )}
        <div className="ml-auto self-end text-xs text-muted">
          {formatDate(period.start)} – {formatDate(period.end)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 pr-3 font-bold">Product</th>
              <th scope="col" className="py-1.5 pr-3 font-bold">Item</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-bold">Used</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-bold">Included</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-bold">Cost</th>
              <th scope="col" className="py-1.5 text-right font-bold">Projected</th>
            </tr>
          </thead>
          <tbody>
            {estimate.subscription > 0 && (
              <tr className="border-b border-line/70">
                <td className="py-1.5 pr-3 font-bold text-heading">Workers</td>
                <td className="py-1.5 pr-3">Paid plan</td>
                <td className="py-1.5 pr-3" />
                <td className="py-1.5 pr-3" />
                <td className="numeric py-1.5 pr-3 text-right">{formatMoney(estimate.subscription)}</td>
                <td className="numeric py-1.5 text-right">{formatMoney(estimate.subscription)}</td>
              </tr>
            )}
            {estimate.lines.map((line) => (
              <tr key={`${line.product}/${line.item}`} className="border-b border-line/70 last:border-0">
                <td className="py-1.5 pr-3 font-bold text-heading">{line.product}</td>
                <td className="py-1.5 pr-3">{line.item}</td>
                <td className="numeric py-1.5 pr-3 text-right">{formatUsed(line)}</td>
                <td className="numeric py-1.5 pr-3 text-right text-muted">{formatIncluded(line)}</td>
                <td className="numeric py-1.5 pr-3 text-right font-bold text-heading">{formatMoney(line.cost)}</td>
                <td className="numeric py-1.5 text-right">{line.projectedCost === null ? "—" : formatMoney(line.projectedCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid min-w-36 gap-0.5 rounded-ui border border-line px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className={`numeric text-xl font-bold ${muted ? "text-muted" : "text-heading"}`}>{value}</span>
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

function formatUsed(line: CostLine): string {
  return formatAmount(line, line.used);
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
