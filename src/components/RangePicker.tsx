import { METRIC_RANGES, type MetricRange } from "../../shared/metrics.ts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Picks the time range of the charts and the tables, as in CloudWatch. */
export function RangePicker({ range, onChange }: { range: MetricRange; onChange: (range: MetricRange) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Time range"
      value={range}
      onValueChange={(value) => {
        const next = METRIC_RANGES.find((item) => item === value);
        if (next !== undefined) onChange(next);
      }}
    >
      {METRIC_RANGES.map((item) => (
        <ToggleGroupItem key={item} value={item} className="px-2.5">
          {item}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
