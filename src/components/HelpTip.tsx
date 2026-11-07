// An ⓘ after the name of a figure or a column that tells what it means: a small white
// frame with the name and a sentence or two. A mouse
// shows it on hover, and a tap or a click shows it on a touch screen too, which has no
// hover. The frame leaves out how to use the screen: it only says what a value means.
// It appears without motion.

import { useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // A mouse opens the frame on hover, so its click must not close the frame again.
  const openedByHover = useRef(false);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        openedByHover.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-subdued transition-colors duration-150 hover:text-label focus-visible:text-label focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ds-accent)]"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse" || open) return;
            openedByHover.current = true;
            setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && openedByHover.current) setOpen(false);
          }}
          onClick={(event) => {
            if (!openedByHover.current) return;
            // Keep the frame that the hover opened, and let it stay after the pointer leaves.
            openedByHover.current = false;
            event.preventDefault();
          }}
        >
          <Info aria-hidden="true" className="size-3" strokeWidth={2.25} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-64 gap-0 rounded-[var(--ds-radius-xs)] border-0 p-2 text-left shadow-[var(--ds-shadow-tooltip)] ring-0 data-open:animate-none data-closed:animate-none"
      >
        <p className="border-b border-hairline pb-1.5 text-sm font-semibold text-foreground">{title}</p>
        <p className="pt-1.5 text-xs leading-5 font-normal text-foreground">{children}</p>
      </PopoverContent>
    </Popover>
  );
}
