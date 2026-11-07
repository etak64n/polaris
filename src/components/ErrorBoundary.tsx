import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shows what failed, and a way to reload, in place of a part of the app that crashed. A
 * part of the app that fails to load after a new deployment is the usual cause, and a
 * reload fixes it. The "screen" boundary stands in for the whole app; the "page" boundary
 * stands in for one page and leaves the sidebar, so the other pages stay in reach.
 */
export class ErrorBoundary extends Component<{ area: "screen" | "page"; children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    const report = (
      <>
        <p className="error-box break-words">{this.state.error.message}</p>
        <Button className="w-fit" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </>
    );
    if (this.props.area === "page") return <div className="grid gap-4">{report}</div>;
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="grid gap-4">{report}</CardContent>
        </Card>
      </div>
    );
  }
}
