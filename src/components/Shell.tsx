// The frame of every page: the header on top, the page below it, and the menu that
// the button in the upper left corner opens over the page, as in albireo.

import { Cpu, Database, HardDrive, LayoutDashboard, Menu as MenuIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { PlanType } from "../../shared/plan.ts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "cn";
import { Link, ROUTE_PATHS, usePathname } from "@/router.tsx";

const PAGES = [
  { to: ROUTE_PATHS.overview, label: "Overview", icon: <LayoutDashboard /> },
  { to: ROUTE_PATHS.workers, label: "Workers", icon: <Cpu /> },
  { to: ROUTE_PATHS.d1, label: "D1", icon: <Database /> },
  { to: ROUTE_PATHS.r2, label: "R2", icon: <HardDrive /> },
];

export function Shell({ plan, children }: { plan: PlanType | null; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Opening a page closes the menu.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      {/* Keyboard users can jump past the header. The link shows only while it has focus. */}
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:px-3 focus:py-2 focus:text-[13px] focus:font-bold focus:shadow-card"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="flex h-14 items-center justify-between gap-3 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <Button variant="ghost" size="icon-lg" aria-label="Open the menu" onClick={() => setMenuOpen(true)}>
              <MenuIcon />
            </Button>
            <Brand />
          </div>
          {plan !== null && (
            <span className="shrink-0 text-xs font-bold text-muted-foreground">{plan === "paid" ? "Workers Paid" : "Workers Free"}</span>
          )}
        </div>
      </header>
      <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-full flex-col gap-4 overflow-y-auto px-2 pb-4 sm:px-3">
          {/* The same button and name as in the header, so the menu closes from where it opened. */}
          <div className="-mx-0.5 flex h-14 shrink-0 items-center gap-1.5 sm:-mx-1">
            <SheetClose asChild>
              <Button variant="ghost" size="icon-lg" aria-label="Close the menu">
                <MenuIcon />
              </Button>
            </SheetClose>
            <Brand />
          </div>
          <nav className="grid gap-0.5" aria-label="Pages">
            {PAGES.map((page) => (
              <MenuLink key={page.to} to={page.to} current={pathname === page.to} icon={page.icon}>
                {page.label}
              </MenuLink>
            ))}
          </nav>
        </div>
      </SheetContent>
      <main id="main" tabIndex={-1} className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 outline-none sm:px-6 lg:px-8">
        {children}
      </main>
    </Sheet>
  );
}

function Brand() {
  return (
    <Link to={ROUTE_PATHS.overview} className="flex min-w-0 items-center gap-2 px-1 py-1">
      <img src="/favicon.svg" alt="" className="size-7 shrink-0" />
      <span className="truncate text-lg font-bold tracking-tight text-heading">polestar</span>
    </Link>
  );
}

function MenuLink({ to, current, icon, children }: { to: string; current: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      current={current}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-[13px] font-bold transition duration-150 pointer-coarse:py-3 [&_svg]:size-[18px] [&_svg]:shrink-0",
        current ? "bg-muted text-heading [&_svg]:text-ring" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
