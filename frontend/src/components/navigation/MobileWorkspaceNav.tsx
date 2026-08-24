import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  LayoutDashboard,
  MapPinCheck,
  Menu,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { getSession } from "@/lib/api/auth";
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
  { label: "Executive", to: "/executive", icon: BarChart3 },
  { label: "Sales & CRM", to: "/sales-crm", icon: BriefcaseBusiness },
  { label: "Verifier Desk", to: "/verifier", icon: ClipboardCheck },
  { label: "QA Review", to: "/qa-review", icon: ShieldCheck },
  { label: "Exceptions", to: "/exceptions", icon: AlertTriangle },
  { label: "Client Portal", to: "/client-portal", icon: Building2 },
  { label: "Field Executive", to: "/field-executive", icon: MapPinCheck },
  { label: "Finance & Billing", to: "/finance", icon: CircleDollarSign },
  { label: "Users & Settings", to: "/settings", icon: UsersRound },
  { label: "Account Security", to: "/security", icon: UserRoundCog },
] as const;

export function MobileWorkspaceNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });

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
        className="w-[88vw] max-w-sm overflow-y-auto border-0 bg-background p-4"
      >
        <SheetHeader className="border-b border-border/60 px-1 pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Sapling Global
          </SheetTitle>
          <SheetDescription>Choose an authorized workspace</SheetDescription>
        </SheetHeader>

        <nav className="mt-4 space-y-1">
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

        <div className="mt-6 rounded-3xl bg-secondary/70 p-4">
          <p className="text-xs font-semibold">Secure operations</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Navigation is filtered by your signed-in role; every API action is checked again by the
            backend.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
