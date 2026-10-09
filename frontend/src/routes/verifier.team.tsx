import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { TeamQueue, type TeamSearch } from "@/features/workflow-ui/TeamQueue";

const VIEWS = ["review", "mine", "team", "all"] as const;

export const Route = createFileRoute("/verifier/team")({
  validateSearch: (input: Record<string, unknown>): TeamSearch => {
    const page = Number(input["page"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    const view = VIEWS.find((value) => value === input["view"]);
    return {
      view,
      q: q || undefined,
      page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Team queue — Sapling Global" }] }),
  component: TeamPage,
});

function TeamPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Team queue"
        description="Checks routed to your department. Take one yourself or assign it to your team."
      />
      <TeamQueue
        search={search}
        onChange={(patch) =>
          void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false })
        }
      />
    </div>
  );
}
