// Picks the resources that the charts and the table of a page show, up to one per
// color. With none picked, the page shows every resource.

import { useState } from "react";
import { PillButton } from "@/components/FilterPill.tsx";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_PICKED, OTHER_KEY, type ProductColors } from "@/lib/series.ts";

export function ResourcePicker({
  plural,
  colors,
  labelOf,
  picked,
  onChange,
}: {
  /** The resources of the page, such as "Workers" or "Databases". */
  plural: string;
  colors: ProductColors;
  labelOf: (key: string) => string;
  picked: string[];
  onChange: (picked: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  // A picked resource without usage in the range stays in the list, so it can be unpicked.
  const resources = [...colors.ranked, ...picked.filter((key) => !colors.ranked.includes(key))];
  const full = picked.length >= MAX_PICKED;
  const [onlyPicked] = picked;
  const summary = onlyPicked === undefined ? "All" : picked.length === 1 ? labelOf(onlyPicked) : `${picked.length} picked`;

  function toggle(key: string) {
    onChange(picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PillButton label={plural} value={summary} role="combobox" aria-expanded={open} className="max-w-72" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <Command>
          <CommandInput placeholder="Search" aria-label={`Search ${plural}`} />
          <CommandList>
            <CommandGroup>
              {resources.map((key) => {
                const checked = picked.includes(key);
                const series = colors.seriesOf(key);
                const color = series !== null && series.key !== OTHER_KEY ? series.color : "transparent";
                return (
                  <CommandItem
                    key={key}
                    value={`${labelOf(key)} ${key}`}
                    data-checked={checked}
                    disabled={!checked && full}
                    onSelect={() => toggle(key)}
                  >
                    <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate">{labelOf(key)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {picked.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value={`All ${plural}`} onSelect={() => onChange([])}>
                    All {plural}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
