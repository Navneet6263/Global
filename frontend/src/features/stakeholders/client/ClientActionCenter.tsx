import { useState } from "react";
import { ArrowRight, FileWarning, Hourglass, MessageSquareReply, Timer } from "lucide-react";
import { Button, Card, CardHeader, Chip, Segmented, SOFT, type Tone } from "@/kit";
import type { ExceptionsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime } from "./client-portal-utils";
import { ClientEmpty, ClientPager, ClientSearch, ClientSummary } from "./ClientPageParts";
import {
  ACTION_GUIDE,
  clientActionItems,
  filterClientActions,
  isLate,
  rankClientActions,
  type ClientActionItem,
} from "./client-action-model";
import type { CaseTabName } from "./client-queue-model";

const kinds: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "documents", label: "Documents" },
  { value: "response", label: "Questions" },
  { value: "overdue", label: "Past turnaround" },
  { value: "review", label: "Being checked" },
];
const ICON = {
  documents: FileWarning,
  response: MessageSquareReply,
  overdue: Timer,
  review: Hourglass,
} as const;
const TONE: Record<ClientActionItem["kind"], Tone> = {
  documents: "bad",
  response: "warn",
  overdue: "bad",
  review: "brand",
};
const DAY = 86_400_000;

function dueChip(item: ClientActionItem, now: Date) {
  if (!item.dueAt) return null;
  const days = Math.ceil((new Date(item.dueAt).getTime() - now.getTime()) / DAY);
  if (days < 0)
    return (
      <Chip tone="bad" dot>
        Late by {-days} {days === -1 ? "day" : "days"}
      </Chip>
    );
  if (days <= 2)
    return (
      <Chip tone="warn" dot>
        {days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`}
      </Chip>
    );
  return <Chip>Due {formatDate(item.dueAt)}</Chip>;
}

/** The client's to-do list: most urgent first, one click to the exact place to act. */
export function ClientActionCenter({
  data,
  onOpen,
}: {
  data: ExceptionsDashboard;
  onOpen: (caseId: string, tab?: CaseTabName) => void;
}) {
  const [kind, setKind] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const now = new Date();
  const items = rankClientActions(clientActionItems(data), now);
  const filtered = filterClientActions(items, kind, search);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  const yours = items.filter((item) => ACTION_GUIDE[item.kind].yours);
  const count = (value: string) =>
    value ? items.filter((item) => item.kind === value).length : items.length;
  const visible = filtered.slice((current - 1) * 8, current * 8);
  return (
    <>
      <ClientSummary
        items={[
          {
            label: "Needs you",
            value: yours.length,
            detail: "Documents and questions",
            tone: yours.length ? "amber" : "green",
          },
          {
            label: "Late",
            value: yours.filter((item) => isLate(item, now)).length,
            detail: "Past the date asked",
            tone: yours.some((item) => isLate(item, now)) ? "red" : "green",
          },
          {
            label: "Sapling is handling",
            value: items.length - yours.length,
            detail: "No action from you",
          },
          {
            label: "Last updated",
            value: relativeTime(data.generatedAt),
            detail: "Refresh from the top bar",
          },
        ]}
      />
      <Card label="Action centre">
        <CardHeader
          title="Your to-do"
          count={items.length}
          description="Most urgent first. Each button opens the exact place to act."
        />
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <Segmented
            label="Action type"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setPage(1);
            }}
            className="max-w-full overflow-x-auto"
            options={kinds.map((entry) => [
              entry.value,
              <span key={entry.value}>
                {entry.label} <span className="font-mono text-dim">{count(entry.value)}</span>
              </span>,
            ])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ClientSearch
              label="Search action items"
              placeholder="Candidate, case or request"
              value={input}
              onChange={setInput}
              onSubmit={() => {
                setSearch(input);
                setPage(1);
              }}
            />
            {search || kind ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setInput("");
                  setSearch("");
                  setKind("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-dim">
              {filtered.length} {filtered.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
        <ol className="divide-y divide-line">
          {visible.map((item, index) => {
            const guide = ACTION_GUIDE[item.kind];
            const Icon = ICON[item.kind];
            const teamStarts =
              !guide.yours && (index === 0 || ACTION_GUIDE[visible[index - 1]!.kind].yours);
            return (
              <li key={item.id}>
                {teamStarts ? (
                  <p className="bg-subtle/50 px-4 py-1.5 text-[11px] font-semibold tracking-wider text-dim uppercase">
                    Sapling is handling these
                  </p>
                ) : null}
                <article
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3.5",
                    guide.yours ? "hover:bg-subtle/40" : "opacity-90",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-lg",
                      SOFT[TONE[item.kind]],
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink">{guide.label}</span>
                      {dueChip(item, now)}
                    </div>
                    <h3 className="mt-0.5 text-sm text-ink">{item.title}</h3>
                    <p className="text-xs text-dim">{item.detail}</p>
                    <small className="mt-1 block text-xs text-dim">
                      <strong className="font-semibold text-ink">{item.candidate}</strong> ·{" "}
                      <span className="font-mono">{item.caseNumber}</span>
                    </small>
                  </div>
                  <Button
                    size="sm"
                    variant={guide.yours ? "primary" : "secondary"}
                    aria-label={`${guide.button}: ${item.candidate}`}
                    onClick={() => onOpen(item.caseId, guide.tab)}
                  >
                    {guide.button}
                    <ArrowRight aria-hidden />
                  </Button>
                </article>
              </li>
            );
          })}
        </ol>
        {!filtered.length ? (
          <ClientEmpty title={search || kind ? "No matching items" : "You're all caught up"}>
            {search || kind
              ? "Change the filters to see other requests."
              : "New requests appear here the moment your response is needed."}
          </ClientEmpty>
        ) : null}
        <ClientPager
          page={current}
          previous={current > 1}
          next={current < pages}
          onPrevious={() => setPage(current - 1)}
          onNext={() => setPage(current + 1)}
          detail="A case may have more than one item."
        />
      </Card>
    </>
  );
}
