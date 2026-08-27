"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { sessionForNav } from "@/lib/auth/session";
import type { NavWorkspace } from "@/config/navigation";
import { ROLE_DEFINITIONS } from "@/config/roles";
import { initialsOf } from "@/lib/formatting";
import { logout } from "@/lib/backend-api/auth";
import { clearIdentity } from "@/lib/auth/platform-session";
import { Button } from "@/components/ui/button";

export function AccountFooter({ workspace = "platform-admin" }: { workspace?: NavWorkspace }) {
  const session = sessionForNav(workspace);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const roleLabel = session.roles.map((role) => ROLE_DEFINITIONS[role].label).join(", ");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    clearIdentity();
    await navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-2.5 border-t border-white/70 px-3 py-3">
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-card/80 px-2.5 py-2 shadow-[var(--shadow-card)]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
          {initialsOf(session.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {session.fullName}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="flex-1 justify-start">
          <Link to="/admin/security">
            <ShieldCheck className="size-3.5" aria-hidden />
            Security
          </Link>
        </Button>
        <Button variant="ghost" size="sm" aria-label="Sign out" onClick={() => void signOut()}>
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  );
}
