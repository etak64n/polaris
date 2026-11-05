// Picks the resources that the charts and the table of a page show, up to one per
// color. With none picked, the page shows every resource.

import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  /** The resources of the page, such as "Workers" or "databases". */
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
  const summary =
    onlyPicked === undefined ? `All ${plural}` : picked.length === 1 ? labelOf(onlyPicked) : `${picked.length} ${plural}`;

  function toggle(key: string) {
    onChange(picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="max-w-64 justify-between gap-2">
          <span className="truncate">{summary}</span>
          <ChevronsUpDown aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
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
