import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  DataEntryWorkspace,
  type DataEntrySearch,
} from "@/features/workflow-ui/DataEntryWorkspace";

export const Route = createFileRoute("/data-entry/")({
  validateSearch: (input: Record<string, unknown>): DataEntrySearch => {
    const page = Number(input["page"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    return {
      view: input["view"] === "team" ? "team" : undefined,
      q: q || undefined,
      page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
      caseId:
        typeof input["caseId"] === "string" && /^[A-Za-z0-9-]{1,64}$/.test(input["caseId"])
          ? input["caseId"]
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
          <p>Check each case is complete and readable. Ready sends it back to the RM.</p>
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
