// The one legend of the resources on a page. Every chart of resources takes the
// same colors, so one legend explains them all: pressing a name hides or shows that
// resource in every chart, and pointing at it brings it out in every chart.

import type { Series } from "@/lib/series.ts";
import { cn } from "cn";

export function SeriesLegend({
  series,
  hidden,
  onToggle,
  onPoint,
}: {
  series: Series[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** The resource under the pointer, or null when the pointer leaves the legend. */
  onPoint: (key: string | null) => void;
}) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 py-1" aria-label="Resources in the charts">
      {series.map((item) => {
        const shown = !hidden.has(item.key);
        return (
          <li key={item.key} className="min-w-0">
            <button
              type="button"
              aria-pressed={shown}
              onClick={() => onToggle(item.key)}
              onMouseEnter={() => onPoint(shown ? item.key : null)}
              onMouseLeave={() => onPoint(null)}
              onFocus={() => onPoint(shown ? item.key : null)}
              onBlur={() => onPoint(null)}
              className={cn(
                "flex max-w-64 cursor-pointer items-center gap-1.5 rounded-sm text-xs text-label transition-opacity duration-150 hover:text-strong",
                !shown && "opacity-40",
              )}
            >
              <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
