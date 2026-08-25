import { Link } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";

import type { Session } from "@/lib/api/auth";
import { StakeholderPanel } from "../StakeholderShell";

export function SecurityProfile({ profile }: { profile: Session | undefined }) {
  return (
    <StakeholderPanel
      title="Identity boundary"
      detail="The account currently controlling this session"
    >
      <div className="p-5">
        <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-orange-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {profile?.displayName ?? "Loading account"}
            </p>
            <p className="truncate text-xs text-slate-500">{profile?.email}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Organisation
            </dt>
            <dd className="mt-1 text-sm font-semibold">{profile?.tenantName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Authorised roles
            </dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {profile?.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                >
                  {humanize(role)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <Link
          to="/change-password"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white"
        >
          <KeyRound className="h-4 w-4" /> Change password
        </Link>
        <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">
          Changing your password rotates authentication credentials without exposing the current
          password.
        </p>
      </div>
    </StakeholderPanel>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
