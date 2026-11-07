// The subscriptions of the account, as Cloudflare bills them: the plan of each product
// that the account signed up for, such as Workers Paid or R2 Paid, with its price and its
// current billing period. Products used for free without a plan, and the plans of the
// domains, are not subscriptions of the account.

import type { Subscription } from "../../shared/api.ts";
import { addDays } from "../../shared/dates.ts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format.ts";

const PER: Record<string, string> = { weekly: "week", monthly: "month", quarterly: "quarter", yearly: "year" };

export function Subscriptions({ subscriptions }: { subscriptions: Subscription[] }) {
  if (subscriptions.length === 0) return null;
  return (
    <Table className="table-fixed min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="w-36 text-right">Price</TableHead>
          <TableHead className="w-56 text-right">Billing period</TableHead>
          <TableHead className="w-36">State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((subscription, index) => (
          <TableRow key={`${subscription.product}/${index}`}>
            <TableCell className="font-semibold">{subscription.product}</TableCell>
            <TableCell className="numeric text-right">{formatPrice(subscription)}</TableCell>
            <TableCell className="numeric text-right">{formatPeriod(subscription)}</TableCell>
            <TableCell>{subscription.state}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatPrice({ price, currency, frequency }: Subscription): string {
  const amount = currency === "USD" ? formatMoney(price) : `${price.toFixed(2)} ${currency}`;
  const per = PER[frequency];
  return per === undefined ? amount : `${amount} / ${per}`;
}

/** The period from its first day to its last, in UTC. Cloudflare gives the moment that ends it. */
function formatPeriod({ periodStart, periodEnd }: Subscription): string {
  if (periodStart === null || periodEnd === null) return "—";
  return `${formatDate(periodStart.slice(0, 10))} – ${formatDate(addDays(periodEnd.slice(0, 10), -1))}`;
}
