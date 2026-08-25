import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listClarifications, respondToClarificationAsClient } from "@/lib/api/clarifications";
import { getCase } from "@/lib/api/cases";
import { downloadReport, listReports } from "@/lib/api/reports";

export function ClientCaseDrawer({
  caseId,
  canRespond,
  onClose,
}: {
  caseId: string;
  canRespond: boolean;
  onClose: () => void;
}) {
  const detail = useQuery({ queryKey: ["cases", caseId], queryFn: () => getCase(caseId) });
  const reports = useQuery({ queryKey: ["reports", caseId], queryFn: () => listReports(caseId) });
  const clarifications = useQuery({
    queryKey: ["clarifications", caseId],
    queryFn: () => listClarifications(caseId),
  });
  const item = detail.data;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Case detail"
    >
      <button
        type="button"
        aria-label="Close case detail"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Case detail
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {item?.subject.fullName ?? "Loading case"}
            </h2>
            <p className="text-xs text-slate-500">{item?.caseNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {detail.isError || reports.isError || clarifications.isError ? (
          <p className="m-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {detail.error?.message ?? reports.error?.message ?? clarifications.error?.message}
          </p>
        ) : null}
        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <Fact label="Status" value={humanize(item?.status ?? "Loading")} />
            <Fact label="Priority" value={humanize(item?.priority ?? "—")} />
            <Fact label="Due date" value={item?.dueAt ? formatDate(item.dueAt) : "Not set"} />
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Verification checks" detail={`${item?.checks.length ?? 0} checks`} />
            <div className="divide-y divide-slate-100">
              {item?.checks.map((check) => (
                <div key={check.publicId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold">{humanize(check.type)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {check.result ? humanize(check.result) : "Result pending"}
                    </p>
                  </div>
                  <Status value={check.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Published reports" detail="Versioned and authenticity protected" />
            <div className="space-y-2 p-4">
              {reports.data?.items.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => void downloadReport(report.id, item?.caseNumber ?? "Report")}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <div>
                    <p className="text-xs font-semibold">Report version {report.currentVersion}</p>
                    <p className="text-[10px] text-slate-500">
                      {report.publishedAt
                        ? `Published ${formatDate(report.publishedAt)}`
                        : humanize(report.status)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 text-slate-500" />
                </button>
              ))}
              {!reports.data?.items.length ? (
                <Empty text="No published report is available yet." />
              ) : null}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Clarifications" detail="Questions and responses linked to this case" />
            <div className="space-y-3 p-4">
              {clarifications.data?.items.map((clarification) => (
                <ClarificationCard
                  key={clarification.id}
                  caseId={caseId}
                  item={clarification}
                  canRespond={canRespond}
                />
              ))}
              {!clarifications.data?.items.length ? (
                <Empty text="No clarification is pending." />
              ) : null}
            </div>
          </section>
          <a
            href={`/cases/${caseId}`}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Open complete Case 360 <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </aside>
    </div>
  );
}

function ClarificationCard({
  caseId,
  item,
  canRespond,
}: {
  caseId: string;
  item: Awaited<ReturnType<typeof listClarifications>>["items"][number];
  canRespond: boolean;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const respond = useMutation({
    mutationFn: () => respondToClarificationAsClient(caseId, item.id, message.trim()),
    onSuccess: async () => {
      toast.success("Response submitted");
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["cases", caseId] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">{item.subject}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {item.messages.length} messages ·{" "}
            {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date"}
          </p>
        </div>
        <Status value={item.status} />
      </div>
      {item.messages.slice(-2).map((message) => (
        <p
          key={`${message.createdAt}-${message.body}`}
          className="mt-2 rounded-lg bg-white p-2.5 text-[11px] leading-4 text-slate-600"
        >
          <span className="font-semibold">{humanize(message.senderType)}:</span> {message.body}
        </p>
      ))}
      {canRespond && item.status === "OPEN" ? (
        <div className="mt-3 flex gap-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the client response"
            className="min-h-20 flex-1 rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-orange-300"
          />
          <button
            type="button"
            onClick={() => respond.mutate()}
            disabled={message.trim().length < 2 || respond.isPending}
            className="grid w-11 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-40"
          >
            <MessageSquareText className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </article>
  );
}
function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="border-b border-slate-200 px-4 py-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-bold text-blue-700">
      {humanize(value)}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-slate-500">{text}</p>;
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
