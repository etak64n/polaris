// The frame of every page: a sidebar of the
// pages on the left, and the page on the right. On narrow screens the sidebar
// hides, and the menu button in the bar on top slides it in from the left.

import { AppWindow, Boxes, Cpu, Database, HardDrive, KeyRound, LayoutDashboard, ListOrdered, Menu as MenuIcon, Sparkles, Workflow, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Me } from "../../shared/api.ts";
import type { MetricProduct } from "../../shared/metrics.ts";
import type { PlanType } from "../../shared/plan.ts";
import { PRODUCT_NAMES } from "@/lib/products.ts";
import { fetchMe } from "@/api.ts";
import { AccountMenu, type Account } from "@/components/AccountMenu.tsx";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "cn";
import { Link, ROUTE_PATHS, usePathname } from "@/router.tsx";

const ICONS: Record<MetricProduct, ReactNode> = {
  workers: <Cpu />,
  durableObjects: <Boxes />,
  queues: <ListOrdered />,
  workflows: <Workflow />,
  browserRun: <AppWindow />,
  d1: <Database />,
  r2: <HardDrive />,
  kv: <KeyRound />,
  hyperdrive: <Zap />,
  workersAi: <Sparkles />,
};

/** The products in groups, as the Cloudflare dashboard groups them. */
const GROUPS: { label: string; products: MetricProduct[] }[] = [
  { label: "Compute", products: ["workers", "durableObjects", "queues", "workflows", "browserRun"] },
  { label: "Storage & databases", products: ["d1", "r2", "kv", "hyperdrive"] },
  { label: "AI", products: ["workersAi"] },
];

export function Shell({ plan, children }: { plan: PlanType | null; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  // Who signed in, for the foot of the sidebar. The shell stays while pages change, so it asks once.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [meError, setMeError] = useState<string | null>(null);
  const account: Account = { me, error: meError };

  // Opening a page closes the menu.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal)
      .then((body) => setMe(body.me))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setMeError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, []);

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
        <Sidebar plan={plan} pathname={pathname} account={account} />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-hairline bg-card px-2 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <Button variant="ghost" size="icon" aria-label="Open the menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </Button>
          <SheetContent side="left" showCloseButton={false} className="gap-0 p-0 data-[side=left]:w-(--ds-sidebar-width)">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar plan={plan} pathname={pathname} account={account} />
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

function Sidebar({ plan, pathname, account }: { plan: PlanType | null; pathname: string; account: Account }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 pb-6">
      <div className="flex h-16 shrink-0 items-center">
        <Brand plan={plan} />
      </div>
      <nav className="grid gap-6" aria-label="Pages">
        <div className="-mx-1 grid gap-0.5">
          <NavLink to={ROUTE_PATHS.overview} current={pathname === ROUTE_PATHS.overview} icon={<LayoutDashboard />}>
            Overview
          </NavLink>
        </div>
        {GROUPS.map((group) => (
          <div key={group.label} className="grid gap-1">
            <h2 className="text-xs text-subdued">{group.label}</h2>
            <div className="-mx-1 grid gap-0.5">
              {group.products.map((product) => (
                <NavLink key={product} to={ROUTE_PATHS[product]} current={pathname === ROUTE_PATHS[product]} icon={ICONS[product]}>
                  {PRODUCT_NAMES[product]}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="-mx-1 mt-auto pt-4">
        <AccountMenu account={account} />
      </div>
    </div>
  );
}

/** The name of the app, with the plan of the account under it. */
function Brand({ plan }: { plan: PlanType | null }) {
  return (
    <Link to={ROUTE_PATHS.overview} className="flex min-w-0 items-center gap-2 rounded-md py-1">
      <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="size-6 shrink-0" />
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
