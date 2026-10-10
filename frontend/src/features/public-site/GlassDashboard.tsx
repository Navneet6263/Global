import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  LayoutDashboard,
  Rocket,
  Search,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassVariant = "operations" | "client" | "rm" | "onboarding";

/** Design size of the illustration; it is scaled to fit its container like an image. */
const W = 720;
const H = 450;

/**
 * A stylised, glass-like product illustration (not a screenshot): a frosted window with
 * sample cards, a smooth chart and floating chips over soft colour glows. Decorative,
 * with an accessible label.
 */
export function GlassDashboard({
  variant = "operations",
  label,
  className,
}: {
  variant?: GlassVariant;
  label: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const fit = () => setScale(element.clientWidth / W);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className={cn("relative w-full select-none", className)}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      {/* Soft colour glows behind the glass. */}
      <span className="pointer-events-none absolute -left-[6%] top-[8%] size-[46%] rounded-full bg-blue-400/35 blur-3xl" />
      <span className="pointer-events-none absolute -right-[4%] bottom-[2%] size-[42%] rounded-full bg-emerald-300/40 blur-3xl" />
      <span className="pointer-events-none absolute right-[22%] -top-[6%] size-[30%] rounded-full bg-violet-300/35 blur-3xl" />
      <div
        aria-hidden
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: W, height: H, transform: `scale(${scale})` }}
      >
        <Window variant={variant} />
        <Floating variant={variant} />
      </div>
    </div>
  );
}

const glass =
  "border border-white/70 bg-white/55 shadow-[0_24px_60px_-24px_rgba(30,64,175,0.35)] backdrop-blur-xl";
const tile = "rounded-2xl border border-white/80 bg-white/70 shadow-sm";

const NAV: Record<GlassVariant, Array<{ icon: typeof LayoutDashboard; label: string }>> = {
  operations: [
    { icon: LayoutDashboard, label: "Overview" },
    { icon: ClipboardList, label: "Cases" },
    { icon: Users, label: "RM & workload" },
    { icon: Timer, label: "SLA" },
    { icon: FileCheck2, label: "Reports & MIS" },
  ],
  client: [
    { icon: LayoutDashboard, label: "Overview" },
    { icon: ClipboardList, label: "Verifications" },
    { icon: FileCheck2, label: "Reports" },
    { icon: Building2, label: "Invoices" },
    { icon: ShieldCheck, label: "Support" },
  ],
  rm: [
    { icon: LayoutDashboard, label: "My work" },
    { icon: ClipboardList, label: "Final reviews" },
    { icon: Building2, label: "My clients" },
    { icon: FileCheck2, label: "Company MIS" },
    { icon: Users, label: "Vendors" },
  ],
  onboarding: [
    { icon: Rocket, label: "Onboarding" },
    { icon: Building2, label: "Company" },
    { icon: FileCheck2, label: "Agreements" },
    { icon: ShieldCheck, label: "KYC" },
    { icon: Users, label: "Your RM" },
  ],
};

const TITLE: Record<GlassVariant, [string, string]> = {
  operations: ["Operations overview", "Cases, owners and next actions"],
  client: ["Your verifications", "Track every candidate in one place"],
  rm: ["My work overview", "Cases grouped by the next step"],
  onboarding: ["Go-live checklist", "Three steps left to start verifying"],
};

function Window({ variant }: { variant: GlassVariant }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden rounded-[28px]", glass)}>
      {/* Top bar */}
      <div className="flex h-12 items-center gap-3 border-b border-white/70 px-4">
        <span className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-rose-300" />
          <i className="size-2.5 rounded-full bg-amber-300" />
          <i className="size-2.5 rounded-full bg-emerald-300" />
        </span>
        <span className="ml-24 flex h-7 w-60 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 text-[10px] text-slate-400">
          <Search className="size-3" /> Search cases, candidates…
        </span>
        <span className="ml-auto grid size-7 place-items-center rounded-full bg-white/70 text-slate-500">
          <Bell className="size-3.5" />
        </span>
        <span className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400" />
      </div>
      <div className="flex h-[calc(100%-48px)]">
        {/* Sidebar */}
        <div className="w-[150px] shrink-0 border-r border-white/70 px-3 py-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-blue-500 text-white">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-[12px] font-bold text-slate-800">Sapling</span>
          </div>
          {NAV[variant].map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10.5px]",
                index === 0 ? "bg-blue-600/10 font-semibold text-blue-700" : "text-slate-500",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </div>
          ))}
          <div className={cn("mt-6 p-2.5", tile)}>
            <p className="text-[9px] font-semibold text-slate-500">This month</p>
            <p className="text-[15px] font-bold text-slate-800">1,284</p>
            <p className="text-[9px] text-emerald-600">▲ 12% verified</p>
          </div>
        </div>
        {/* Main */}
        <div className="min-w-0 flex-1 px-5 py-4">
          <p className="text-[15px] font-bold tracking-tight text-slate-900">{TITLE[variant][0]}</p>
          <p className="mb-3 text-[10px] text-slate-500">{TITLE[variant][1]}</p>
          {variant === "operations" ? <Operations /> : null}
          {variant === "client" ? <Client /> : null}
          {variant === "rm" ? <Rm /> : null}
          {variant === "onboarding" ? <Onboarding /> : null}
        </div>
      </div>
    </div>
  );
}

function Kpis({ items }: { items: Array<[string, string, string]> }) {
  return (
    <div className="mb-3 grid grid-cols-4 gap-2.5">
      {items.map(([name, value, tone]) => (
        <div key={name} className={cn("p-2.5", tile)}>
          <p className="text-[9px] font-medium text-slate-500">{name}</p>
          <p className={cn("text-[18px] font-bold leading-tight", tone)}>{value}</p>
          <Spark className={tone} />
        </div>
      ))}
    </div>
  );
}

function Spark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 18" className={cn("mt-1 h-3.5 w-full", className)}>
      <path
        d="M0 14 C10 12 14 6 22 8 S36 15 44 10 S58 2 66 5 S76 8 80 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

function AreaChart() {
  const fill = `area-${useId().replace(/:/g, "")}`;
  return (
    <div className={cn("p-3", tile)}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold text-slate-700">Checks verified</p>
        <span className="flex gap-2 text-[8.5px] text-slate-500">
          <span className="flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-blue-500" /> Verified
          </span>
          <span className="flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-emerald-400" /> On time
          </span>
        </span>
      </div>
      <svg viewBox="0 0 300 92" className="h-[92px] w-full">
        <defs>
          <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 45, 70].map((y) => (
          <line
            key={y}
            x1="0"
            x2="300"
            y1={y}
            y2={y}
            stroke="#cbd5e1"
            strokeDasharray="3 4"
            strokeWidth="0.6"
          />
        ))}
        <path
          d="M0 70 C30 64 45 40 75 44 S120 66 150 48 S200 18 230 26 S275 34 300 12 L300 92 L0 92 Z"
          fill={`url(#${fill})`}
        />
        <path
          d="M0 70 C30 64 45 40 75 44 S120 66 150 48 S200 18 230 26 S275 34 300 12"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M0 80 C35 76 55 62 85 64 S130 74 160 60 S205 44 235 48 S280 50 300 36"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 0"
        />
        <circle cx="230" cy="26" r="4" fill="#2563eb" stroke="white" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Donut() {
  const parts: Array<[string, number]> = [
    ["#22c55e", 68],
    ["#facc15", 12],
    ["#fb923c", 9],
    ["#ef4444", 6],
    ["#3b82f6", 5],
  ];
  let offset = 0;
  return (
    <div className={cn("flex flex-col items-center p-3", tile)}>
      <p className="self-start text-[10.5px] font-semibold text-slate-700">Outcomes</p>
      <svg viewBox="0 0 42 42" className="mt-1 size-[88px] -rotate-90">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        {parts.map(([colour, value]) => {
          const dash = `${value} ${100 - value}`;
          const element = (
            <circle
              key={colour}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={colour}
              strokeWidth="5"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += value;
          return element;
        })}
      </svg>
      <p className="-mt-[58px] mb-[30px] text-[13px] font-bold text-slate-800">68%</p>
      <p className="text-[8.5px] text-slate-500">clear on first pass</p>
    </div>
  );
}

const Pill = ({ tone, children }: { tone: string; children: ReactNode }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[8.5px] font-semibold", tone)}>
    {children}
  </span>
);

function Rows({ rows }: { rows: Array<[string, string, ReactNode, string]> }) {
  return (
    <div className={cn("overflow-hidden", tile)}>
      {rows.map(([name, meta, status, when], index) => (
        <div
          key={name}
          className={cn(
            "flex items-center gap-3 px-3 py-[7px]",
            index > 0 && "border-t border-white/80",
          )}
        >
          <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-slate-100 to-blue-100 text-[8.5px] font-bold text-blue-700">
            {name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold text-slate-800">{name}</span>
            <span className="block text-[8.5px] text-slate-500">{meta}</span>
          </span>
          {status}
          <span className="w-14 text-right text-[8.5px] text-slate-500">{when}</span>
        </div>
      ))}
    </div>
  );
}

function Operations() {
  return (
    <>
      <Kpis
        items={[
          ["Active cases", "128", "text-blue-600"],
          ["Overdue", "3", "text-rose-500"],
          ["Completed today", "24", "text-emerald-600"],
          ["On time", "96%", "text-violet-600"],
        ]}
      />
      <div className="mb-3 grid grid-cols-[1fr_150px] gap-2.5">
        <AreaChart />
        <Donut />
      </div>
      <Rows
        rows={[
          [
            "Aarav Shah",
            "Horizon Tech · Employment",
            <Pill tone="bg-blue-100 text-blue-700">Verification</Pill>,
            "6h left",
          ],
          [
            "Ishita Verma",
            "Cedar Retail · Education",
            <Pill tone="bg-violet-100 text-violet-700">QA review</Pill>,
            "1d left",
          ],
        ]}
      />
    </>
  );
}

function Client() {
  return (
    <>
      <Kpis
        items={[
          ["In progress", "18", "text-blue-600"],
          ["Needs action", "2", "text-amber-500"],
          ["Completed", "64", "text-emerald-600"],
          ["Average TAT", "3.2d", "text-violet-600"],
        ]}
      />
      <div className="mb-3">
        <AreaChart />
      </div>
      <Rows
        rows={[
          [
            "Kunal Mehra",
            "Employment · Education · Identity",
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[8.5px] font-semibold text-emerald-700">
              <Download className="size-2.5" /> Report ready
            </span>,
            "Today",
          ],
          [
            "Sneha Iyer",
            "Address · Court record",
            <Pill tone="bg-blue-100 text-blue-700">In progress</Pill>,
            "2d left",
          ],
          [
            "Vikram Rao",
            "Employment",
            <Pill tone="bg-amber-100 text-amber-700">Documents</Pill>,
            "Action",
          ],
        ]}
      />
    </>
  );
}

function Rm() {
  const columns: Array<[string, string, string[]]> = [
    ["Assign Data Entry", "bg-sky-500", ["Pooja Nair", "Rahul Das"]],
    ["Ready to route", "bg-blue-600", ["Meera Iyer", "Arjun Rao", "Neha Jain"]],
    ["In verification", "bg-violet-500", ["Kabir Sethi", "Tara Kapoor"]],
    ["Final review", "bg-emerald-500", ["Dev Malhotra"]],
  ];
  return (
    <>
      <Kpis
        items={[
          ["My cases", "46", "text-blue-600"],
          ["Escalations", "1", "text-rose-500"],
          ["Final reviews", "4", "text-emerald-600"],
          ["Client NPS", "9.1", "text-violet-600"],
        ]}
      />
      <div className="grid grid-cols-4 gap-2.5">
        {columns.map(([name, dot, cards]) => (
          <div key={name} className={cn("p-2", tile)}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold text-slate-700">
              <i className={cn("size-1.5 rounded-full", dot)} />
              {name}
              <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[8px] text-slate-500">
                {cards.length}
              </span>
            </p>
            {cards.map((card) => (
              <div
                key={card}
                className="mb-1.5 rounded-xl border border-white/90 bg-white/80 p-2 shadow-sm"
              >
                <p className="text-[9.5px] font-semibold text-slate-800">{card}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", dot)}
                    style={{ width: `${40 + card.length * 4}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function Onboarding() {
  const ring = `ring-${useId().replace(/:/g, "")}`;
  const steps: Array<[string, boolean]> = [
    ["Company details", true],
    ["Agreement signed", true],
    ["KYC documents", true],
    ["Packages & pricing", false],
    ["Go live", false],
  ];
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3">
      <div className={cn("flex flex-col items-center p-4", tile)}>
        <svg viewBox="0 0 42 42" className="size-[110px] -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={`url(#${ring})`}
            strokeWidth="4"
            strokeDasharray="60 40"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id={ring} x1="0" x2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
        <p className="-mt-[72px] mb-[46px] text-[18px] font-bold text-slate-800">60%</p>
        <p className="text-[9.5px] font-semibold text-slate-700">Almost there</p>
        <p className="text-[8.5px] text-slate-500">Your RM reviews each step</p>
      </div>
      <div className={cn("p-3", tile)}>
        {steps.map(([name, done], index) => (
          <div
            key={name}
            className={cn(
              "flex items-center gap-2.5 py-2",
              index > 0 && "border-t border-white/80",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-[9px] font-bold",
                done
                  ? "bg-emerald-500 text-white"
                  : index === 3
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(
                "flex-1 text-[10.5px]",
                done
                  ? "text-slate-500 line-through decoration-slate-300"
                  : "font-semibold text-slate-800",
              )}
            >
              {name}
            </span>
            <span className="text-[8.5px] text-slate-400">
              {done ? "Done" : index === 3 ? "In progress" : "Next"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHIPS: Record<
  GlassVariant,
  Array<{ icon: typeof Check; title: string; sub: string; tone: string; position: string }>
> = {
  operations: [
    {
      icon: CheckCircle2,
      title: "Report released",
      sub: "SG-2041 · Green",
      tone: "bg-emerald-500",
      position: "-right-6 top-16",
    },
    {
      icon: Timer,
      title: "SLA on track",
      sub: "96% on time",
      tone: "bg-blue-600",
      position: "-left-8 bottom-10",
    },
  ],
  client: [
    {
      icon: Download,
      title: "Final report ready",
      sub: "Kunal Mehra",
      tone: "bg-emerald-500",
      position: "-right-6 top-20",
    },
    {
      icon: ShieldCheck,
      title: "Consent received",
      sub: "2 minutes ago",
      tone: "bg-violet-500",
      position: "-left-8 bottom-12",
    },
  ],
  rm: [
    {
      icon: CheckCircle2,
      title: "QC approved",
      sub: "Ready for your review",
      tone: "bg-emerald-500",
      position: "-right-6 top-14",
    },
    {
      icon: Users,
      title: "Routed to 3 teams",
      sub: "Employment · Education",
      tone: "bg-blue-600",
      position: "-left-8 bottom-10",
    },
  ],
  onboarding: [
    {
      icon: ShieldCheck,
      title: "KYC verified",
      sub: "PAN · GST · CIN",
      tone: "bg-emerald-500",
      position: "-right-6 top-16",
    },
    {
      icon: Users,
      title: "Your RM",
      sub: "Here to help you go live",
      tone: "bg-blue-600",
      position: "-left-8 bottom-12",
    },
  ],
};

function Floating({ variant }: { variant: GlassVariant }) {
  return (
    <>
      {CHIPS[variant].map((chip) => (
        <div
          key={chip.title}
          className={cn(
            "absolute flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5",
            glass,
            "bg-white/75",
            chip.position,
          )}
        >
          <span
            className={cn(
              "grid size-8 place-items-center rounded-xl text-white shadow-sm",
              chip.tone,
            )}
          >
            <chip.icon className="size-4" />
          </span>
          <span>
            <span className="block text-[11px] font-bold text-slate-800">{chip.title}</span>
            <span className="block text-[9.5px] text-slate-500">{chip.sub}</span>
          </span>
        </div>
      ))}
    </>
  );
}
