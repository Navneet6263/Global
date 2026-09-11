import { Inbox, RotateCcw, UserRoundCheck } from "lucide-react";
import { WorkspaceLinks } from "../shared/WorkspaceLinks";

export function QaOverview() {
  return (
    <>
      <WorkspaceLinks
        items={[
          {
            title: "Pick your next review",
            detail: "Open the queue and use Available to claim to find unreserved cases.",
            to: "/qa-review",
            icon: Inbox,
            tone: "mint",
          },
          {
            title: "Continue my reviews",
            detail: "Resume cases reserved for you. Review evidence before making a decision.",
            to: "/qa-review/mine",
            icon: UserRoundCheck,
            tone: "violet",
          },
          {
            title: "Follow up corrections",
            detail: "See which returned cases are still awaiting verification rework.",
            to: "/qa-review/corrections",
            icon: RotateCcw,
            tone: "amber",
          },
        ]}
      />
      <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">Your review flow</h2>
        <ol className="mt-4 grid gap-4 text-xs text-muted-foreground sm:grid-cols-3">
          {[
            ["Claim a case", "Reserve it so another reviewer does not duplicate your work."],
            ["Review the evidence", "Check documents, source findings and the quality checklist."],
            [
              "Record a decision",
              "Approve or return selected checks with a clear reason. Report release has further workflow gates.",
            ],
          ].map(([title, detail], index) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint-soft font-semibold text-mint-deep">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-1 leading-relaxed">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
