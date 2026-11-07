// A request that failed: what Cloudflare or the Worker answered, and a button that asks
// again, since most failures, such as a slow answer of the analytics, pass.

import { Button } from "@/components/ui/button";

export function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="error-box flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="min-w-0 break-words">{message}</p>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
