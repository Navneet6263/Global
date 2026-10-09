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

export function ClientAccountMenu({ roleLabel = "Client Admin" }: { roleLabel?: string }) {
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
          className="client-account-trigger"
          aria-label={`Account menu for ${name}`}
          aria-busy={signingOut}
          disabled={signingOut}
        >
          <span className="client-account-avatar" aria-hidden>
            {initialsOf(name)}
          </span>
          <span className="client-account-identity">
            <strong>{name}</strong>
            <small>{signingOut ? "Signing out…" : roleLabel}</small>
          </span>
          <ChevronDown className="client-account-chevron" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 max-w-[calc(100vw-24px)] rounded-xl p-2"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate">{name}</span>
          <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
            {session.data?.email}
          </span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10 rounded-md">
          <Link to="/change-password">
            <ShieldCheck aria-hidden />
            Account security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signingOut}
          className="min-h-10 rounded-md text-destructive"
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
