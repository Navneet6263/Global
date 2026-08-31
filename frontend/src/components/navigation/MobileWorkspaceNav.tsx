import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MapPinCheck,
  Menu,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/api/auth";
import { endAuthenticatedSession } from "@/lib/auth/end-session";
import { canAccessWorkspace } from "@/lib/auth/workspace-access";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const items = [
  { label: "Control Tower", to: "/", icon: LayoutDashboard },
  { label: "Executive", to: "/admin/analytics", icon: BarChart3 },
  { label: "Sales & CRM", to: "/sales-crm", icon: BriefcaseBusiness },
  { label: "Verifier Desk", to: "/verifier", icon: ClipboardCheck },
  { label: "QA Review", to: "/qa-review", icon: ShieldCheck },
  { label: "Exceptions", to: "/operations/exceptions", icon: AlertTriangle },
  { label: "Client Portal", to: "/client-portal", icon: Building2 },
  { label: "Field Executive", to: "/field-executive", icon: MapPinCheck },
  { label: "Finance & Billing", to: "/finance", icon: CircleDollarSign },
  { label: "Users & Settings", to: "/admin/settings", icon: UsersRound },
  { label: "Account Security", to: "/change-password", icon: UserRoundCog },
] as const;

export function MobileWorkspaceNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const logoutMutation = useMutation({
    mutationFn: endAuthenticatedSession,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/auth");
    },
    onError: (error: Error) => toast.error("Sign out failed", { description: error.message }),
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open workspace navigation"
          className="surface grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex h-full w-[88vw] max-w-sm flex-col overflow-hidden border-0 bg-background p-4"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-1 pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Sapling Global
          </SheetTitle>
          <SheetDescription>Choose an authorized workspace</SheetDescription>
        </SheetHeader>

        <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {items
            .filter((item) => !session.data || canAccessWorkspace(session.data, item.to))
            .map((item) => {
              const active = pathname === item.to;
              return (
                <SheetClose key={item.to} asChild>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition-colors ${
                      active
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
        </nav>

        <div className="mt-4 shrink-0 rounded-2xl bg-secondary/70 p-3">
          <p className="text-xs font-semibold">Secure operations</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Navigation is filtered by your signed-in role; every API action is checked again by the
            backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mt-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" /> {logoutMutation.isPending ? "Signing out…" : "Logout"}
        </button>
      </SheetContent>
    </Sheet>
  );
}
