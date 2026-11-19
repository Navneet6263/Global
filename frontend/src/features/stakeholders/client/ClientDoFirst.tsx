import { Link } from "@tanstack/react-router";
import { ArrowRight, Zap } from "lucide-react";
import { Button, Chip } from "@/kit";
import type { ExceptionsDashboard } from "@/lib/api/dashboards";
import { formatDate } from "./client-portal-utils";
import { ACTION_GUIDE, clientActionItems, isLate, rankClientActions } from "./client-action-model";
import type { CaseTabName } from "./client-queue-model";

/** Top of the overview: the client's most urgent work, each one click from done. */
export function ClientDoFirst({
  data,
  onOpen,
}: {
  data?: ExceptionsDashboard;
  onOpen: (caseId: string, tab: CaseTabName) => void;
}) {
  if (!data) return null;
  const now = new Date();
  const yours = rankClientActions(clientActionItems(data), now).filter(
    (item) => ACTION_GUIDE[item.kind].yours,
  );
  if (!yours.length) return null;
  return (
    <section
      aria-label="Do this first"
      className="rounded-xl border border-warn/30 bg-surface shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-warn-soft text-warn">
            <Zap className="size-4" aria-hidden />
          </span>
          Do this first
          <span className="font-mono text-xs font-medium text-dim">{yours.length}</span>
        </h2>
        <Link
          to="/client-portal/actions"
          className="text-xs font-semibold text-brand hover:underline"
        >
          See your full to-do →
        </Link>
      </div>
      <ol className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {yours.slice(0, 3).map((item, index) => {
          const guide = ACTION_GUIDE[item.kind];
          return (
            <li key={item.id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-dim">{index + 1}</span>
                <span className="text-sm font-bold text-ink">{guide.label}</span>
                {isLate(item, now) ? (
                  <Chip tone="bad" dot>
                    Late
                  </Chip>
                ) : item.dueAt ? (
                  <Chip tone="warn">Due {formatDate(item.dueAt)}</Chip>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-ink">{item.title}</p>
              <p className="text-xs text-dim">
                <strong className="font-semibold text-ink">{item.candidate}</strong> ·{" "}
                <span className="font-mono">{item.caseNumber}</span>
              </p>
              <Button
                size="sm"
                variant="primary"
                className="mt-auto self-start"
                aria-label={`${guide.button}: ${item.candidate}`}
                onClick={() => onOpen(item.caseId, guide.tab)}
              >
                {guide.button}
                <ArrowRight aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
