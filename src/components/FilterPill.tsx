// The filters of a page, in the shape of the Stripe Dashboard: a pill that shows
// "Name | value" and opens a menu of the values when pressed.

import { ChevronDown, CirclePlus, RefreshCw } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "cn";

const PILL =
  "inline-flex h-6 max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-card py-[3px] pr-2 pl-1.5 text-xs font-semibold whitespace-nowrap outline-none transition-colors duration-150 hover:bg-surface-subdued focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3 [&_svg]:shrink-0";

/** The inside of a pill: the name, then a divider and the value in the accent color. */
function PillContent({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <>
      <span className="text-label">{label}</span>
      {value !== undefined && (
        <>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <span className="min-w-0 truncate text-primary">{value}</span>
        </>
      )}
    </>
  );
}

/** A pill that opens a popover, such as the picker of resources. */
export function PillButton({
  label,
  value,
  className,
  ...props
}: ComponentProps<"button"> & { label: string; value: ReactNode }) {
  return (
    <button type="button" className={cn(PILL, className)} {...props}>
      <PillContent label={label} value={value} />
      <ChevronDown aria-hidden="true" className="text-primary" />
    </button>
  );
}

/** A pill that picks one value from a menu, such as the time range. */
export function SelectPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next);
        if (option !== undefined) onChange(option.value);
      }}
    >
      <SelectPrimitive.Trigger className={PILL}>
        <PillContent label={label} value={current?.label} />
        <ChevronDown aria-hidden="true" className="text-primary" />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper" align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}

/**
 * The pill of the auto refresh. Off, it has a dashed outline, as a filter that is
 * not set; on, it shows how often the page loads again, and its icon turns while
 * the page loads.
 */
export function AutoRefreshPill({
  on,
  onChange,
  interval,
  loading,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  /** How often the page loads again, such as "Every 1 min". */
  interval: string;
  loading: boolean;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={cn(PILL, !on && "border-dashed")}>
      {on ? (
        <RefreshCw aria-hidden="true" className={cn("text-primary", loading && "motion-safe:animate-spin")} />
      ) : (
        <CirclePlus aria-hidden="true" className="text-label" />
      )}
      <PillContent label="Auto refresh" value={on ? interval : undefined} />
    </button>
  );
}
