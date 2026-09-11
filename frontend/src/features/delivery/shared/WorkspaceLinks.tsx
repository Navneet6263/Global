import { Link } from "@tanstack/react-router";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function WorkspaceLinks({
  items,
}: {
  items: Array<{
    title: string;
    detail: string;
    to: string;
    icon: LucideIcon;
    tone: "mint" | "amber" | "blue" | "violet";
  }>;
}) {
  const tones = {
    mint: "border-mint/20 bg-mint-soft/40 text-mint-deep",
    amber: "border-warning/20 bg-warning-soft/40 text-warning-foreground",
    blue: "border-info/20 bg-info-soft/40 text-info-foreground",
    violet: "border-review/20 bg-review-soft/40 text-review-foreground",
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ title, detail, to, icon: Icon, tone }) => (
        <Link
          key={to}
          to={to}
          className={`group rounded-3xl border p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tones[tone]}`}
        >
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-2xl bg-white/80">
              <Icon className="size-5" />
            </span>
            <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </Link>
      ))}
    </div>
  );
}
