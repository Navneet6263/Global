import {
  ArrowUpRight,
  CircleDot,
  Mail,
  MessageSquare,
  Phone,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { SalesActivity, SalesActivityType } from "../contracts/crm";
import { ACTIVITY_LABEL } from "../config/crm";
import { formatRelativeToNow } from "@/lib/formatting";

const ICONS: Record<SalesActivityType, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: MessageSquare,
  FOLLOW_UP: CircleDot,
  STAGE_CHANGE: ArrowUpRight,
  CREATED: CircleDot,
  WON: Trophy,
  LOST: XCircle,
};

interface CrmActivityFeedProps {
  activities: readonly SalesActivity[];
  limit?: number;
  showLink?: boolean;
}

export function CrmActivityFeed({ activities, limit = 7, showLink = true }: CrmActivityFeedProps) {
  const rows = activities.slice(0, limit);

  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
          Recent activity
        </h2>
        {showLink ? (
          <Link
            to="/sales-crm/activities"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-deep hover:underline"
          >
            All activity
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <ol className="relative space-y-3 pl-5">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-[9px] w-px"
          style={{ background: "oklch(0.9 0.01 150)" }}
        />
        {rows.map((row) => {
          const Icon = ICONS[row.type];
          return (
            <li key={row.id} className="relative">
              <span
                className="absolute top-0.5 -left-5 flex size-[19px] items-center justify-center rounded-full border border-white bg-mint-soft text-mint-deep"
                aria-hidden
              >
                <Icon className="size-3" />
              </span>
              <p className="text-[13px] leading-snug font-medium text-foreground">{row.summary}</p>
              <p className="text-[11px] text-muted-foreground">
                {ACTIVITY_LABEL[row.type]} · {row.company} · {row.actor} ·{" "}
                {formatRelativeToNow(row.occurredAt, new Date("2026-08-26T09:00:00.000Z"))}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
