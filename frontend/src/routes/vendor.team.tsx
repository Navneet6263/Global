import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PauseCircle, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  OversightMetric,
  OversightPanel,
} from "@/features/admin-dashboard/components/oversight-ui";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import {
  useCreateTeamUser,
  useResetTeamPassword,
  useSetTeamUserStatus,
  useVendorTeam,
} from "@/features/vendor/team/use-vendor-team";
import { teamCapacity } from "@/features/vendor/team/vendor-team-model";
import { VendorTeamTable } from "@/features/vendor/team/VendorTeamTable";

export const Route = createFileRoute("/vendor/team")({
  head: () => ({ meta: [{ title: "Vendor team — Sapling Global" }] }),
  component: VendorTeamPage,
});

const VENDOR_ONLY = ["VENDOR"] as const;

function VendorTeamPage() {
  const team = useVendorTeam();
  const create = useCreateTeamUser();
  const setStatus = useSetTeamUserStatus();
  const reset = useResetTeamPassword();
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  const data = team.data;

  if (team.isError)
    return <ErrorState description={team.error.message} onRetry={() => void team.refetch()} />;
  if (!data) return <ListSkeleton rows={4} />;
  if (data.role === "MEMBER")
    return (
      <div className="space-y-6">
        <PageHeader title="Team" description="Your login is part of a vendor team." />
        <p className="surface rounded-3xl p-5 text-sm">
          Managed by <span className="font-semibold">{data.managedBy ?? "your main vendor"}</span>.
          Ask your main vendor for new team logins, password resets or other changes.
        </p>
      </div>
    );

  const capacity = teamCapacity(data);
  const suspended = data.members.filter((member) => member.status === "SUSPENDED").length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Create team user IDs within the limit set by the Platform Admin, then hand requests to them."
        actions={
          <Button size="sm" disabled={!capacity.canCreate} onClick={() => setOpen(true)}>
            <UserPlus className="size-3.5" aria-hidden /> Create user ID
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Team figures">
        <OversightMetric
          label="Active team users"
          value={data.active}
          detail={capacity.label}
          icon={UserCheck}
          tone="blue"
        />
        <OversightMetric
          label="Slots left"
          value={capacity.remaining}
          detail={capacity.canCreate ? "You can create more user IDs" : "No free slot"}
          icon={Users}
          tone={capacity.canCreate ? "mint" : "amber"}
        />
        <OversightMetric
          label="Suspended"
          value={suspended}
          detail="Do not count toward your limit"
          icon={PauseCircle}
          tone="neutral"
        />
      </section>
      <OversightPanel title="Team users" description={capacity.hint} count={data.members.length}>
        <VendorTeamTable
          team={data}
          busyId={setStatus.isPending ? (setStatus.variables?.id ?? null) : null}
          onSuspend={(member) =>
            setStatus.mutate({ id: member.id, status: "SUSPENDED", version: member.version })
          }
          onReactivate={(member) =>
            setStatus.mutate({ id: member.id, status: "ACTIVE", version: member.version })
          }
          onReset={(member) =>
            reset.mutate(member.id, {
              onSuccess: (result) =>
                setReceipt({
                  kind: "reset",
                  fullName: member.name,
                  email: member.email,
                  password: result.temporaryPassword,
                }),
              onError: (error: Error) =>
                toast.error("Password not reset", { description: error.message }),
            })
          }
        />
      </OversightPanel>
      <CreateUserDialog
        open={open}
        submitting={create.isPending}
        roles={VENDOR_ONLY}
        defaultRoles={VENDOR_ONLY}
        withSetup={false}
        branches={[]}
        clients={[]}
        onOpenChange={setOpen}
        onSubmit={(input) =>
          create.mutate(
            { fullName: input.fullName, email: input.email, mobile: input.mobile },
            {
              onSuccess: (result) => {
                setOpen(false);
                setReceipt({
                  kind: "created",
                  fullName: result.user.displayName,
                  email: result.user.email,
                  password: result.temporaryPassword,
                });
              },
              onError: (error: Error) =>
                toast.error("Team user not created", { description: error.message }),
            },
          )
        }
      />
      <TemporaryPasswordDialog
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          create.reset();
          reset.reset();
        }}
      />
    </div>
  );
}
