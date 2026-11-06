import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** A white panel with a heading, the block that every page is made of. */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  /** A short line under the heading, such as the statistic and the period of a chart. */
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 shadow-card">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="grid gap-0.5">
          <h2 className="text-lg font-bold text-heading">{title}</h2>
          {description !== undefined && <p className="text-xs font-normal text-muted-foreground">{description}</p>}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">{children}</CardContent>
    </Card>
  );
}
