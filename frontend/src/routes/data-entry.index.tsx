import { InternalBulkIntake } from "@/features/stakeholders/client/ClientBulkIntake";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  DataEntryWorkspace,
  type DataEntrySearch,
} from "@/features/workflow-ui/DataEntryWorkspace";
import type { DataEntryQueueFilter } from "@/lib/backend-api/data-entry-queue";

const FILTER_VALUES: readonly DataEntryQueueFilter[] = [
  "all",
  "to_review",
  "correction",
  "l2_reentry",
];
const UUID_OR_ID = /^[A-Za-z0-9-]{1,64}$/;

export const Route = createFileRoute("/data-entry/")({
  validateSearch: (input: Record<string, unknown>): DataEntrySearch => {
    const page = Number(input["page"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    const rawFilter = input["filter"];
    const filter =
      typeof rawFilter === "string" && FILTER_VALUES.includes(rawFilter as DataEntryQueueFilter)
        ? (rawFilter as DataEntryQueueFilter)
        : undefined;
    return {
      view: input["view"] === "team" ? "team" : input["view"] === "mine" ? "mine" : undefined,
      filter,
      q: q || undefined,
      page: Number.isSafeInteger(page) && page >= 1 && page <= 100_000 ? page : undefined,
      caseId:
        typeof input["caseId"] === "string" && UUID_OR_ID.test(input["caseId"])
          ? input["caseId"]
          : undefined,
      clarificationId:
        typeof input["clarificationId"] === "string" && UUID_OR_ID.test(input["clarificationId"])
          ? input["clarificationId"]
          : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Intake queue — Sapling Global Data Entry" }] }),
  component: DataEntryPage,
});

function DataEntryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Intake queue</h1>
          <p>
            Accept candidate documents, complete check-wise initiation, and handle L2 re-entry
            before work goes to verification.
          </p>
        </div>
        <div className="client-heading-actions flex flex-wrap items-center gap-2">
          <InternalBulkIntake />
        </div>
      </header>
      <DataEntryWorkspace
        search={search}
        onChange={(patch, replace) =>
          void navigate({
            search: (current) => ({ ...current, ...patch }),
            replace,
            resetScroll: false,
          })
        }
      />
    </>
  );
}
