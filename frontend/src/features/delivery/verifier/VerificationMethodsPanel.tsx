import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Globe2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listVerificationMethods, type MethodName } from "@/lib/backend-api/verification-methods";
import { MethodHistory } from "./MethodHistory";
import { MethodSourceForm } from "./MethodSourceForm";

const methods = [
  {
    id: "MANUAL",
    label: "Manual review",
    detail: "Review documents and authorised sources",
    icon: ClipboardCheck,
    tone: "bg-mint-soft text-mint-deep",
  },
  {
    id: "DIGITAL",
    label: "Digital source",
    detail: "Record a provider result with evidence",
    icon: Globe2,
    tone: "bg-blue-50 text-blue-700",
  },
  {
    id: "THIRD_PARTY",
    label: "Third-party source",
    detail: "Track employer, institute or reference",
    icon: Building2,
    tone: "bg-violet-50 text-violet-700",
  },
] as const;

export function VerificationMethodsPanel({
  checkId,
  caseId,
  readOnly = false,
}: {
  checkId: string;
  caseId: string;
  readOnly?: boolean;
}) {
  const client = useQueryClient();
  const [method, setMethod] = useState<MethodName>("MANUAL");
  const query = useQuery({
    queryKey: ["verification-methods", checkId],
    queryFn: () => listVerificationMethods(checkId),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["verification-methods", checkId] });
    void client.invalidateQueries({ queryKey: ["case", caseId] });
    void client.invalidateQueries({ queryKey: ["tasks"] });
  };
  const locked = readOnly || query.isError || query.data?.caseStatus !== "IN_PROGRESS";
  const active = query.data?.items.filter((run) => run.status !== "SUPERSEDED") ?? [];
  const items = query.data?.items ?? [];
  return (
    <section className="space-y-4 rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)]">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="size-5 text-mint-deep" />
          Verification methods
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Use one or more methods as the check requires. Responses and their evidence stay in the
          audit history.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={method === item.id}
            onClick={() => setMethod(item.id)}
            className={`rounded-2xl border p-3 text-left transition ${item.tone} ${method === item.id ? "border-current ring-1 ring-current" : "border-transparent"}`}
          >
            <item.icon className="mb-2 size-4" />
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="mt-1 block text-[11px] opacity-75">{item.detail}</span>
          </button>
        ))}
      </div>
      {method === "DIGITAL" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
          <span className="font-semibold text-blue-800">
            Live provider verification · Coming soon
          </span>
          <p className="mt-1 text-muted-foreground">
            Automatic provider lookup and OCR are not connected yet. You can record an independently
            obtained provider response below, with reviewed evidence.
          </p>
        </div>
      )}
      {!locked && (
        <MethodSourceForm
          key={`${checkId}-${method}`}
          checkId={checkId}
          method={method}
          alreadyTracked={active.some((run) => run.method === method)}
          onSaved={refresh}
        />
      )}
      {query.isError && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{query.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Retry source history
          </Button>
        </div>
      )}
      {query.isLoading && <p className="text-sm text-muted-foreground">Loading source history…</p>}
      {!query.isLoading && !query.isError && !items.length && (
        <p className="rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground">
          No separate source requests yet. The existing manual check workflow remains available.
        </p>
      )}
      <MethodHistory
        key={checkId}
        checkId={checkId}
        items={items}
        documents={query.data?.evidenceDocuments ?? []}
        locked={locked}
        onSaved={refresh}
      />
    </section>
  );
}
