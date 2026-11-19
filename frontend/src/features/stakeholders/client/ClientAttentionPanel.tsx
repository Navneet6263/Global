import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, ErrorText, Loading, Meter, SOFT, type Tone } from "@/kit";
import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";

function ActionRow({
  icon: Icon,
  tone,
  count,
  text,
  hint,
  to,
  search,
}: {
  icon: LucideIcon;
  tone: Tone;
  count: number | string;
  text: string;
  hint: string;
  to: "/client-portal/actions" | "/client-portal/verifications";
  search?: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-subtle"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", SOFT[tone])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          <span className="font-mono">{count}</span> {text}
        </span>
        <span className="block text-xs text-dim">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-dim" aria-hidden />
    </Link>
  );
}

const results: Array<{
  label: string;
  key: string;
  tone: "good" | "warn" | "note";
  icon: LucideIcon;
}> = [
  { label: "Clear", key: "CLEAR", tone: "good", icon: CircleCheck },
  { label: "Discrepancy", key: "DISCREPANCY", tone: "warn", icon: CircleAlert },
  { label: "Unable to verify", key: "UNABLE_TO_VERIFY", tone: "note", icon: CircleHelp },
];
const ICON = { good: "text-good", warn: "text-warn", note: "text-note" } as const;

/** Right-hand column of the overview: what needs the client, and recorded check results. */
export function ClientAttentionPanel({
  data,
  operations,
  loading,
  error,
  onRetry,
  retrying,
}: {
  data?: ExceptionsDashboard;
  operations?: OperationsDashboard;
  loading: boolean;
  error?: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const docs = data ? (data.summary.rejectedDocuments ?? data.rejectedDocuments.length) : 0;
  const open = data ? data.clarifications.filter((item) => item.status === "OPEN").length : 0;
  const total = results.reduce((sum, item) => sum + (operations?.outcomeMix[item.key] ?? 0), 0);
  return (
    <aside
      aria-label="Client actions and support"
      className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-[76px]"
    >
      <Card>
        <CardHeader title="Your attention needed" count={data?.summary.clientActions} />
        <div className="flex flex-col gap-0.5 p-2">
          {loading ? <Loading>Loading requests…</Loading> : null}
          {error ? (
            <ErrorText onRetry={onRetry} retrying={retrying}>
              {error}
            </ErrorText>
          ) : null}
          {data && !loading ? (
            <>
              <ActionRow
                icon={FileText}
                tone="warn"
                count={docs}
                text={docs === 1 ? "document replacement" : "document replacements"}
                hint="View requests"
                to="/client-portal/actions"
              />
              <ActionRow
                icon={CircleAlert}
                tone="brand"
                count={open}
                text={open === 1 ? "open detail request" : "open detail requests"}
                hint="Respond"
                to="/client-portal/actions"
              />
              <ActionRow
                icon={UserRound}
                tone="neutral"
                count={operations ? (operations.statusMix["CONSENT_PENDING"] ?? 0) : "—"}
                text="pending consent"
                hint="View cases"
                to="/client-portal/verifications"
                search={{ status: "CONSENT_PENDING" }}
              />
            </>
          ) : null}
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Check results"
          count={operations ? total : undefined}
          description="Recorded outcomes"
        />
        <div className="flex flex-col gap-3 px-4 py-3">
          {results.map(({ label, key, tone, icon: Icon }) => {
            const count = operations?.outcomeMix[key] ?? 0;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-ink">
                    <Icon className={cn("size-4", ICON[tone])} aria-hidden />
                    {label}
                  </span>
                  <strong className="font-mono text-ink">{operations ? count : "—"}</strong>
                </div>
                <Meter value={count} max={total} tone={tone} label={`${label} share`} />
              </div>
            );
          })}
          <p className="text-xs text-dim">
            {operations
              ? "Check outcomes are not a released final report."
              : "Result totals are currently unavailable."}
          </p>
          <Link
            to="/client-portal/analytics"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Open detailed insights →
          </Link>
        </div>
      </Card>
    </aside>
  );
}
