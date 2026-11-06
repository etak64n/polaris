// The frame of every page: a sidebar of the
// pages on the left, and the page on the right. On narrow screens the sidebar
// hides, and the menu button in the bar on top slides it in from the left.

import { Cpu, Database, HardDrive, LayoutDashboard, Menu as MenuIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { PlanType } from "../../shared/plan.ts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
    <>
      {/* Keyboard users can jump past the sidebar. The link shows only while it has focus. */}
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-popover"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-(--ds-sidebar-width) border-r border-hairline bg-card lg:block">
        <Sidebar plan={plan} pathname={pathname} />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-hairline bg-card px-2 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <Button variant="ghost" size="icon" aria-label="Open the menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </Button>
          <SheetContent side="left" showCloseButton={false} className="gap-0 p-0 data-[side=left]:w-(--ds-sidebar-width)">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar plan={plan} pathname={pathname} />
          </SheetContent>
        </Sheet>
        <Brand plan={null} />
      </header>
      <div className="lg:pl-(--ds-sidebar-width)">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto grid max-w-[calc(var(--ds-content-max-width)+2*var(--ds-page-gutter))] gap-12 px-4 pt-6 pb-16 outline-none sm:px-6 lg:px-(--ds-page-gutter) lg:pt-8"
        >
          {children}
        </main>
      </div>
    </>
  );
}

function Sidebar({ plan, pathname }: { plan: PlanType | null; pathname: string }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 pb-6">
      <div className="flex h-16 shrink-0 items-center">
        <Brand plan={plan} />
      </div>
      <nav className="-mx-1 grid gap-0.5" aria-label="Pages">
        {PAGES.map((page) => (
          <NavLink key={page.to} to={page.to} current={pathname === page.to} icon={page.icon}>
            {page.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** The name of the app, with the plan of the account under it. */
function Brand({ plan }: { plan: PlanType | null }) {
  return (
    <Link to={ROUTE_PATHS.overview} className="flex min-w-0 items-center gap-2 rounded-md py-1">
      <img src="/favicon.svg" alt="" className="size-6 shrink-0" />
      <span className="grid min-w-0">
        <span className="truncate text-sm font-semibold text-heading">polaris</span>
        {plan !== null && <span className="truncate text-xs text-subdued">{plan === "paid" ? "Workers Paid" : "Workers Free"}</span>}
      </span>
    </Link>
  );
}

function NavLink({ to, current, icon, children }: { to: string; current: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      current={current}
      className={cn(
        "flex h-(--ds-nav-item-height) items-center gap-3 rounded-md px-2 text-sm transition-colors duration-150 hover:bg-surface-hover pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0",
        current ? "font-semibold text-primary" : "text-strong",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
