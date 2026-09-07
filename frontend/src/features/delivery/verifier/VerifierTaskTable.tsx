import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Inbox,
} from "lucide-react";

import type { VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { formatDate, humanize } from "../utils";
import { Status } from "./VerifierQueue";

export function VerifierTaskTable({
  title,
  detail,
  items,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  title: string;
  detail: string;
  items: VerificationTask[];
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-white/85 bg-card/90 shadow-[var(--shadow-float)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h2>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">{detail}</p>
        </div>
        <span className="num rounded-full bg-mint-soft px-3 py-1.5 text-[10px] font-semibold text-mint-deep">
          {items.length} shown
        </span>
      </header>
      <div className="hidden grid-cols-[minmax(13rem,1.25fr)_minmax(10rem,0.8fr)_minmax(8rem,0.6fr)_minmax(9rem,0.65fr)_2.5rem] gap-3 border-b border-border/60 bg-background/35 px-5 py-3 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
        <span>Candidate / case</span>
        <span>Check / client</span>
        <span>Status</span>
        <span>Commitment</span>
        <span />
      </div>
      <div className="divide-y divide-border/60">
        {items.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {!items.length ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <Inbox className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-[12px] font-semibold">Nothing in this view</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                The queue will update as assigned checks move through delivery.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-border/60 bg-background/30 px-5 py-3">
        <p className="text-[9.5px] text-muted-foreground">
          Cursor pagination keeps large workloads responsive.
        </p>
        <div className="flex gap-1.5">
          <PageButton label="Previous page" disabled={!hasPrevious} onClick={onPrevious}>
            <ChevronLeft className="size-3.5" />
          </PageButton>
          <PageButton label="Next page" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="size-3.5" />
          </PageButton>
        </div>
      </footer>
    </section>
  );
}

function TaskRow({ task }: { task: VerificationTask }) {
  const overdue = Boolean(
    task.dueAt && new Date(task.dueAt).getTime() < Date.now() && task.status !== "COMPLETED",
  );
  const done = task.status === "COMPLETED";
  return (
    <Link
      to="/verifier/queue"
      search={{ taskId: task.id, status: done ? "COMPLETED" : undefined }}
      className="group grid gap-3 px-5 py-4 transition hover:bg-mint-soft/30 md:grid-cols-[minmax(13rem,1.25fr)_minmax(10rem,0.8fr)_minmax(8rem,0.6fr)_minmax(9rem,0.65fr)_2.5rem] md:items-center"
    >
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold">{task.check.case.subject.fullName}</p>
        <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
          {task.check.case.caseNumber} · {humanize(task.check.case.priority)}
        </p>
        {task.blockerReason ? (
          <p className="mt-1.5 line-clamp-1 text-[9px] text-critical">{task.blockerReason}</p>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{humanize(task.check.type)}</p>
        <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
          {task.check.case.client.displayName}
        </p>
      </div>
      <Status status={task.status} />
      <div
        className={cn(
          "flex items-center gap-2 text-[10px]",
          overdue ? "font-semibold text-critical" : "text-muted-foreground",
        )}
      >
        {done ? (
          <CheckCircle2 className="size-3.5 text-success" />
        ) : overdue ? (
          <CircleAlert className="size-3.5" />
        ) : (
          <Clock3 className="size-3.5" />
        )}
        <span>
          {done
            ? task.completedAt
              ? formatDate(task.completedAt)
              : "Completed"
            : task.dueAt
              ? formatDate(task.dueAt)
              : "No due time"}
        </span>
      </div>
      <span className="grid size-8 place-items-center rounded-full border border-border bg-white/70 text-muted-foreground transition group-hover:border-mint/30 group-hover:bg-mint-soft group-hover:text-mint-deep">
        <ArrowUpRight className="size-3.5" />
      </span>
    </Link>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full border border-border bg-white/80 transition hover:bg-mint-soft disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
