import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const RANGES = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

/** Picks how many days the charts and the tables of a page cover. */
export function RangeToggle({ range, onChange }: { range: number; onChange: (range: number) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Range"
      value={String(range)}
      onValueChange={(value) => {
        if (value !== "") onChange(Number(value));
      }}
    >
      {RANGES.map((option) => (
        <ToggleGroupItem key={option.value} value={String(option.value)}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
