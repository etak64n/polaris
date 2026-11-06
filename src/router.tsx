// A small router for the pages of polaris, built on the History API.

import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

export type Route = "overview" | "workers" | "d1" | "r2" | "not-found";

export const ROUTE_PATHS = { overview: "/", workers: "/workers", d1: "/d1", r2: "/r2" } as const satisfies Record<Exclude<Route, "not-found">, string>;

export function matchRoute(pathname: string): Route {
  const found = (Object.entries(ROUTE_PATHS) as [Exclude<Route, "not-found">, string][]).find(([, path]) => path === pathname);
  return found?.[0] ?? "not-found";
}

export function navigate(to: string): void {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/** The path of the page that is open, such as /workers. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function Link({ to, className, current = false, children }: { to: string; className?: string; current?: boolean; children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Let the browser open new tabs and windows as usual.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} onClick={handleClick} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}
