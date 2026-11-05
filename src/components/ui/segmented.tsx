// A row of buttons that picks one of a few options, such as a time range.

import { cn } from "../../lib/utils.ts";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-ui border border-line bg-panel p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 cursor-pointer rounded-ui px-2.5 text-xs font-bold text-muted transition-colors hover:text-heading pointer-coarse:min-h-11",
            option.value === value && "bg-raised text-heading",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
