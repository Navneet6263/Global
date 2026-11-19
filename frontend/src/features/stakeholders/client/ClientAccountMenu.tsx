import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession } from "@/lib/api/auth";
import { endAuthenticatedSession } from "@/lib/auth/end-session";
import { initialsOf } from "@/lib/formatting";

export function ClientAccountMenu({
  roleLabel = "Client Admin",
  securityTo = "/change-password",
}: {
  roleLabel?: string;
  securityTo?: string;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const name = session.data?.displayName ?? "Your account";
  const signOut = async () => {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      await endAuthenticatedSession();
      queryClient.clear();
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out could not be completed");
      setSigningOut(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ml-0.5 flex min-h-10 items-center gap-2 border-l border-line pl-2.5 text-left disabled:cursor-wait disabled:opacity-60 lg:ml-1.5 lg:gap-2.5 lg:pl-3.5"
          aria-label={`Account menu for ${name}`}
          aria-busy={signingOut}
          disabled={signingOut}
        >
          <span
            className="grid size-[34px] shrink-0 place-items-center rounded-full border border-brand/20 bg-brand-soft text-xs font-bold text-brand"
            aria-hidden
          >
            {initialsOf(name)}
          </span>
          <span className="hidden min-w-0 lg:block">
            <strong className="block max-w-[100px] truncate text-[13px] leading-[18px] font-semibold text-ink 2xl:max-w-[118px]">
              {name}
            </strong>
            <small className="block text-[11.5px] leading-[15px] text-dim">
              {signingOut ? "Signing out…" : roleLabel}
            </small>
          </span>
          <ChevronDown className="hidden size-3 text-dim lg:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 max-w-[calc(100vw-24px)] rounded-xl p-2"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate">{name}</span>
          <span className="mt-1 block truncate text-xs font-normal text-dim">
            {session.data?.email}
          </span>
          <span className="mt-1 block text-xs font-normal text-dim">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10 rounded-md">
          <Link to={securityTo as "/change-password"}>
            <ShieldCheck aria-hidden />
            Account security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signingOut}
          className="min-h-10 rounded-md text-bad"
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
