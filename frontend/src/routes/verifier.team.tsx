import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { TeamQueue, type TeamSearch } from "@/features/workflow-ui/TeamQueue";
import { listDepartments } from "@/lib/backend-api/workflow";

const VIEWS = ["review", "mine", "team", "all"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/verifier/team")({
  validateSearch: (input: Record<string, unknown>): TeamSearch => {
    const page = Number(input["page"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    const view = VIEWS.find((value) => value === input["view"]);
    const department = typeof input["department"] === "string" ? input["department"] : "";
    return {
      view,
      department: UUID.test(department) ? department : undefined,
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
  const departments = useQuery({
    queryKey: ["workflow", "departments"],
    queryFn: listDepartments,
    enabled: Boolean(search.department),
    staleTime: 60_000,
    retry: false,
  });
  const team = departments.data?.items.find((item) => item.id === search.department);
  return (
    <div className="grid gap-5">
      <PageHeader
        title={team ? `Team queue · ${team.name}` : "Team queue"}
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
