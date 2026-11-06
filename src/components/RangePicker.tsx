import type { MetricRange } from "../../shared/metrics.ts";
import { SelectPill } from "@/components/FilterPill.tsx";

const RANGES: readonly { value: MetricRange; label: string }[] = [
  { value: "1h", label: "Last 1 hour" },
  { value: "3h", label: "Last 3 hours" },
  { value: "12h", label: "Last 12 hours" },
  { value: "1d", label: "Last 1 day" },
  { value: "3d", label: "Last 3 days" },
  { value: "1w", label: "Last 1 week" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/** Picks the time range of the charts and the tables. */
export function RangePicker({ range, onChange }: { range: MetricRange; onChange: (range: MetricRange) => void }) {
  return <SelectPill label="Date range" value={range} options={RANGES} onChange={onChange} />;
}
