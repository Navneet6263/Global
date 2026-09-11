import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  AlertTriangle,
  ShieldCheck,
  Building2,
  LogOut,
  Gauge,
  ClipboardCheck,
  Wallet,
  MapPin,
  UserRoundCog,
  UsersRound,
  BellRing,
  Files,
} from "lucide-react";
import { toast } from "sonner";
import { SaplingSymbol } from "@/components/brand/sapling-symbol";
import { getSession } from "@/lib/api/auth";
import { endAuthenticatedSession } from "@/lib/auth/end-session";
import { canAccessWorkspace } from "@/lib/auth/workspace-access";

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  to?: string;
  href?: string;
  badge?: string;
};

const groups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Command",
    items: [
      { icon: LayoutDashboard, label: "Control Tower", to: "/" },
      { icon: Gauge, label: "Executive", to: "/admin/analytics" },
      { icon: Briefcase, label: "Sales & CRM", to: "/sales-crm" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { icon: ClipboardCheck, label: "Verifier Desk", to: "/verifier" },
      { icon: ShieldCheck, label: "QA Review", to: "/qa-review" },
      { icon: AlertTriangle, label: "Exceptions", to: "/operations/exceptions" },
      { icon: MapPin, label: "Field Executive", to: "/field-executive" },
    ],
  },
  {
    title: "Stakeholders",
    items: [
      { icon: Building2, label: "Client Portal", to: "/client-portal" },
      { icon: Wallet, label: "Finance & Billing", to: "/finance" },
      { icon: UsersRound, label: "Users & Settings", to: "/admin/settings" },
      { icon: UserRoundCog, label: "Account Security", to: "/change-password" },
    ],
  },
];

const clientGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Client workspace",
    items: [
      { icon: LayoutDashboard, label: "Portfolio overview", href: "/client-portal#overview" },
      { icon: BellRing, label: "Action required", href: "/client-portal#actions" },
      { icon: Files, label: "Verifications", href: "/client-portal#verifications" },
    ],
  },
  {
    title: "Account",
    items: [{ icon: UserRoundCog, label: "Security", to: "/change-password" }],
  },
];

export function Sidebar() {
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const currentHash = location.hash.replace(/^#/, "");
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
  const clientOnly = Boolean(
    session.data?.clientId &&
    session.data.roles.includes("CLIENT_ADMIN") &&
    !session.data.roles.includes("PLATFORM_ADMIN"),
  );
  const navigationGroups = clientOnly ? clientGroups : groups;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col overflow-hidden border-r border-[var(--hairline)] bg-white lg:flex">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff9f3] shadow-[var(--shadow-float)] ring-1 ring-primary/15">
          <SaplingSymbol className="size-9" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Sapling Global</p>
          <p className="text-[11px] text-muted-foreground">Verification Ops · v2</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.title}
            </p>
            {group.items
              .filter(
                (item) => !item.to || !session.data || canAccessWorkspace(session.data, item.to),
              )
              .map((item) => {
                const targetHash = item.href?.split("#")[1];
                const active = item.href
                  ? pathname === "/client-portal" &&
                    ((!currentHash && targetHash === "overview") || currentHash === targetHash)
                  : item.to
                    ? pathname === item.to
                    : false;
                const cls = `group relative flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? "accent-panel font-semibold shadow-[var(--shadow-glow-accent)]"
                    : "text-muted-foreground hover:translate-x-0.5 hover:bg-card hover:text-foreground hover:shadow-[var(--shadow-soft)]"
                }`;

                const inner = (
                  <>
                    <item.icon
                      className={`h-4 w-4 transition-transform duration-200 ${active ? "" : "group-hover:scale-110"}`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`num rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          active
                            ? "bg-accent-foreground/12 text-accent-foreground"
                            : "bg-secondary text-muted-foreground group-hover:bg-background"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                );

                return item.href ? (
                  <a key={item.label} href={item.href} className={cls}>
                    {inner}
                  </a>
                ) : item.to ? (
                  <Link key={item.label} to={item.to} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <button key={item.label} className={cls}>
                    {inner}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <footer className="shrink-0 border-t border-slate-100 bg-white p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-950 text-[10px] font-bold text-white">
            {(session.data?.displayName ?? "SG")
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {session.data?.displayName ?? "Signed-in user"}
            </p>
            <p className="truncate text-[10px] text-slate-500">{session.data?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          aria-busy={logoutMutation.isPending}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" /> {logoutMutation.isPending ? "Signing out…" : "Logout"}
        </button>
      </footer>
    </aside>
  );
}
