import { ShieldCheck, Sparkles, Activity, Users } from "lucide-react";
import { ORGANISATION } from "@/config/workspaces";

const HIGHLIGHTS = [
  {
    icon: Activity,
    title: "Live delivery control",
    copy: "SLA health, throughput and exceptions in one control tower.",
  },
  {
    icon: Users,
    title: "Role-scoped workspaces",
    copy: "Admin oversight, operations execution and sales pipeline stay separate.",
  },
  {
    icon: ShieldCheck,
    title: "Audit-ready access",
    copy: "Every sign-in, grant and case action is traceable.",
  },
];

export function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-[2rem] bg-mint-deep p-8 text-white shadow-[var(--shadow-float)] lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/15 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full bg-primary/25 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Verification operations
        </span>
        <h2 className="mt-7 text-[2rem] leading-tight font-semibold tracking-tight">
          {ORGANISATION.name}
          <span className="mt-1 block text-white/70">Background verification platform</span>
        </h2>
      </div>

      <ul className="relative mt-10 space-y-3">
        {HIGHLIGHTS.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{item.title}</span>
              <span className="block text-[12px] leading-relaxed text-white/70">{item.copy}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="relative mt-10 text-[11px] text-white/60">
        Access is issued by the platform team. All activity is logged in{" "}
        {ORGANISATION.timezoneLabel}.
      </p>
    </aside>
  );
}
