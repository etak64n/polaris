import { RefreshCw } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

/** Turns the auto refresh of the dashboards on and off. The icon turns while metrics load. */
export function AutoRefreshToggle({ on, onChange, loading }: { on: boolean; onChange: (on: boolean) => void; loading: boolean }) {
  return (
    <Toggle variant="outline" size="sm" pressed={on} onPressedChange={onChange} className="gap-1.5 px-2.5">
      <RefreshCw aria-hidden="true" className={loading ? "motion-safe:animate-spin" : undefined} />
      Auto refresh
    </Toggle>
  );
}
