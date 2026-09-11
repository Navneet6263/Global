import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { NewCaseDialog } from "@/components/ops/NewCaseDialog";
import { getSession } from "@/lib/api/auth";
import { StakeholderHeader } from "../StakeholderShell";
import { PortfolioTrustNote } from "./ClientOverview";
import { ClientBulkIntake } from "./ClientBulkIntake";

export function ClientWorkspaceHeader({
  title,
  description,
  allowCreate = false,
}: {
  title: string;
  description: string;
  allowCreate?: boolean;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canCreate =
    allowCreate &&
    Boolean(
      session.data?.permissions.includes("*") || session.data?.permissions.includes("case:create"),
    );

  return (
    <StakeholderHeader
      eyebrow={`${session.data?.clientName ?? "Client workspace"} · Secure portfolio`}
      title={title}
      description={description}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <PortfolioTrustNote />
          {canCreate ? <ClientBulkIntake /> : null}
          {canCreate ? (
            <NewCaseDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:shadow-[var(--shadow-raise)]"
                >
                  <Plus className="size-3.5" aria-hidden /> New verification
                </button>
              }
            />
          ) : null}
        </div>
      }
    />
  );
}
