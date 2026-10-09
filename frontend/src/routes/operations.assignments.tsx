import { createFileRoute } from "@tanstack/react-router";
import { OverrideAllocation } from "@/features/operations/allocation/OverrideAllocation";

export const Route = createFileRoute("/operations/assignments")({
  head: () => ({
    meta: [
      { title: "Override allocation — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Assign routed checks to a verifier when a team has no Team Leader or work is stuck.",
      },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Override allocation</h1>
          <p>Give routed checks to a verifier yourself, with live workload beside each name.</p>
        </div>
      </header>
      <OverrideAllocation />
    </>
  );
}
