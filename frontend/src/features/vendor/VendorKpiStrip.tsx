import { Link } from "@tanstack/react-router";
import { CheckCircle2, Hourglass, Layers, XCircle } from "lucide-react";
import { OversightMetric } from "@/features/admin-dashboard/components/oversight-ui";
import type { VendorRequestPage } from "./vendor-contracts";
import { vendorKpiCards } from "./vendor-request-model";

const ICONS = { PENDING: Hourglass, APPROVED: CheckCircle2, REJECTED: XCircle, ALL: Layers };

/** Headline counts of the caller's own requests; each card opens its sidebar view. */
export function VendorKpiStrip({ counts }: { counts: VendorRequestPage["counts"] | undefined }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Request counts">
      {vendorKpiCards(counts).map(({ view, to, ...card }) => (
        <Link
          key={view}
          to={to}
          className="rounded-[1.35rem] transition hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
        >
          <OversightMetric {...card} icon={ICONS[view]} />
        </Link>
      ))}
    </section>
  );
}
