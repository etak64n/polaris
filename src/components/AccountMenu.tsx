// The person who signed in, at the foot of the sidebar: their email with the Workers plan
// of the account under it, and a menu with how and when they signed in and the way to
// sign out.

import { LogOut, UserRound } from "lucide-react";
import type { Me } from "../../shared/api.ts";
import type { PlanType } from "../../shared/plan.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format.ts";

/** The names of the login methods of Cloudflare Access, by the type that Access reports. */
const LOGIN_METHOD_NAMES: Record<string, string> = {
  passkeys: "Passkey",
  onetimepin: "One-time PIN",
  github: "GitHub",
  google: "Google",
  "google-apps": "Google Workspace",
  azureAD: "Microsoft Entra ID",
  okta: "Okta",
  onelogin: "OneLogin",
  pingone: "PingOne",
  centrify: "Centrify",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  yandex: "Yandex",
  oidc: "OpenID Connect",
  saml: "SAML",
};

export interface Account {
  /** undefined while it loads, and null under `cf dev`, where nobody signs in. */
  me: Me | null | undefined;
  error: string | null;
}

export function AccountMenu({ account, plan }: { account: Account; plan: PlanType | null }) {
  const { me, error } = account;
  if (me === undefined && error === null) return <Skeleton className="h-8 w-full" />;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-(--ds-nav-item-height) w-full min-w-0 items-center gap-3 rounded-md px-2 py-1 text-left text-sm text-strong transition-colors duration-150 hover:bg-surface-hover aria-expanded:bg-surface-hover pointer-coarse:min-h-11"
        >
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-subdued text-xs font-semibold text-label">
            {me ? me.email.charAt(0).toUpperCase() : <UserRound className="size-3.5" />}
          </span>
          <span className="grid min-w-0">
            <span className="truncate">{me ? me.email : me === null ? "Local development" : "Account"}</span>
            {plan !== null && <span className="truncate text-xs text-subdued">{plan === "paid" ? "Workers Paid" : "Workers Free"}</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 gap-0 p-0">
        {error !== null ? (
          <p className="error-box m-2 break-words">{error}</p>
        ) : me ? (
          <>
            <p className="truncate border-b border-hairline px-3 py-2.5 text-sm font-semibold text-heading">{me.email}</p>
            <dl className="grid gap-2 border-b border-hairline px-3 py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label">Login method</dt>
                <dd className="text-strong">{LOGIN_METHOD_NAMES[me.method] ?? me.method}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label">Signed in</dt>
                <dd className="numeric text-strong">{formatDateTime(me.signedInAt)}</dd>
              </div>
            </dl>
            <div className="p-1">
              <a href={me.logoutUrl} className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-strong hover:bg-surface-hover [&_svg]:size-4">
                <LogOut />
                Log out
              </a>
            </div>
          </>
        ) : (
          <p className="px-3 py-2.5 text-sm text-label">Under cf dev, nobody signs in through Access.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
