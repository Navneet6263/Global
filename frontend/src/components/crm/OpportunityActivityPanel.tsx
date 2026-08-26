import { useState } from "react";

import type { OpportunityDetail } from "@/lib/api/crm";
import { humanize } from "./crm-utils";

type ActivityInput = {
  type: "CALL" | "EMAIL" | "MEETING" | "NOTE" | "FOLLOW_UP";
  summary: string;
  nextFollowUpAt?: string;
};

export function OpportunityActivityPanel({
  item,
  saving,
  onAdd,
}: {
  item: OpportunityDetail;
  saving: boolean;
  onAdd: (input: ActivityInput) => void;
}) {
  const [type, setType] = useState<ActivityInput["type"]>("CALL");
  const [summary, setSummary] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (summary.trim().length < 2) return;
          onAdd({
            type,
            summary: summary.trim(),
            ...(nextFollowUpAt ? { nextFollowUpAt: new Date(nextFollowUpAt).toISOString() } : {}),
          });
          setSummary("");
          setNextFollowUpAt("");
        }}
        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-semibold">
            Activity type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ActivityInput["type"])}
              className={control}
            >
              {["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold">
            Next follow-up
            <input
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              className={control}
            />
          </label>
        </div>
        <label className="mt-3 block text-[10px] font-semibold">
          Outcome / note
          <textarea
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What happened and what is the next action?"
            className={`${control} h-auto py-3`}
          />
        </label>
        <button
          disabled={summary.trim().length < 2 || saving}
          className="mt-3 h-10 w-full rounded-xl bg-orange-600 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Recording…" : "Record activity"}
        </button>
      </form>
      <section className="rounded-2xl border border-slate-200">
        <header className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-xs font-semibold">Activity history</h3>
          <p className="text-[10px] text-slate-500">Calls, meetings, notes and follow-ups</p>
        </header>
        <div className="divide-y divide-slate-100">
          {item.activities.map((activity) => (
            <article key={activity.id} className="flex gap-3 px-4 py-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold">{humanize(activity.type)}</p>
                  <time className="shrink-0 text-[9px] text-slate-400">
                    {formatDate(activity.occurredAt)}
                  </time>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">{activity.summary}</p>
                <p className="mt-1 text-[9px] text-slate-400">{activity.actor.displayName}</p>
              </div>
            </article>
          ))}
          {!item.activities.length ? (
            <p className="py-10 text-center text-xs text-slate-500">No activity recorded yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const control =
  "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-orange-300";
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
