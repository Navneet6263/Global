import { createFileRoute } from "@tanstack/react-router";
import { DataEntryDashboard } from "@/features/workflow-ui/DataEntryInsights";

export const Route = createFileRoute("/data-entry/overview")({
  head: () => ({ meta: [{ title: "Dashboard — Sapling Global Data Entry" }] }),
  component: DataEntryOverviewPage,
});

function DataEntryOverviewPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Dashboard</h1>
          <p>What is waiting for you, and what you finished lately.</p>
        </div>
      </header>
      <DataEntryDashboard />
    </>
  );
}
