import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { Button, PageHeader, buttonClass } from "@/kit";
import { getSession } from "@/lib/api/auth";

const NewCaseDialog = lazy(() =>
  import("@/components/ops/NewCaseDialog").then((module) => ({ default: module.NewCaseDialog })),
);
const ClientBulkIntake = lazy(() =>
  import("./ClientBulkIntake").then((module) => ({ default: module.ClientBulkIntake })),
);

function useCanCreate() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canCreate = Boolean(
    session.data?.permissions.some((p) => p === "*" || p === "case:create"),
  );
  return { session, canCreate };
}

/** "New verification", as a full button or the header's short "Create" (Task style). */
export function ClientNewVerification({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { canCreate } = useCanCreate();
  if (!canCreate) return null;
  return (
    <Suspense
      fallback={
        <Button variant="primary" size={compact ? "sm" : "md"} loading disabled>
          {compact ? "Create" : "Loading new verification"}
        </Button>
      }
    >
      <NewCaseDialog
        trigger={
          <button
            type="button"
            className={buttonClass(
              "primary",
              compact ? "sm" : "md",
              [compact ? "h-[38px]" : "", className].filter(Boolean).join(" "),
            )}
            aria-label={compact ? "Create a new verification" : undefined}
          >
            <Plus aria-hidden />
            {compact ? "Create" : "New verification"}
          </button>
        }
      />
    </Suspense>
  );
}

/** Bulk upload and New verification, for companies allowed to start cases. */
export function ClientCreateActions() {
  const { canCreate } = useCanCreate();
  if (!canCreate) return null;
  return (
    <>
      <Suspense
        fallback={
          <Button loading disabled>
            Loading import
          </Button>
        }
      >
        <ClientBulkIntake />
      </Suspense>
      <ClientNewVerification />
    </>
  );
}

export function ClientWorkspaceHeader({
  title,
  description,
  allowCreate = false,
  actions,
}: {
  title: string;
  description: string;
  allowCreate?: boolean;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      subtitle={description}
      actions={
        actions || allowCreate ? (
          <>
            {actions}
            {allowCreate ? <ClientCreateActions /> : null}
          </>
        ) : undefined
      }
    />
  );
}
