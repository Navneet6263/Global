import { createFileRoute } from "@tanstack/react-router";
import { RmPayments } from "@/features/workflow-ui/RmPayments";

export const Route = createFileRoute("/spoc-rm/payments")({
  head: () => ({ meta: [{ title: "Payments — Sapling Global" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Payments</h1>
          <p>What each of your companies owes, and a payment reminder when the month closes.</p>
        </div>
      </header>
      <RmPayments />
    </>
  );
}
