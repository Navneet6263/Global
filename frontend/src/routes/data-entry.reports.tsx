import { createFileRoute } from "@tanstack/react-router";
import { DataEntryReports } from "@/features/workflow-ui/DataEntryInsights";

export const Route = createFileRoute("/data-entry/reports")({
  head: () => ({ meta: [{ title: "My reports — Sapling Global Data Entry" }] }),
  component: DataEntryReportsPage,
});

function DataEntryReportsPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>My reports</h1>
          <p>Your Data Entry work for any period, with the columns you choose.</p>
        </div>
      </header>
      <DataEntryReports />
    </>
  );
}
