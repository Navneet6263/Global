import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BranchesPanel,
  OrganisationPanel,
  PackagesPanel,
  PolicyPanel,
  RetentionPanel,
  SlaDefaultsPanel,
} from "@/features/settings/components/settings-panels";
import type { PolicyToggle } from "@/lib/contracts/settings";
import { createBranch, createServicePackage, updateFieldPolicy } from "@/lib/backend-api/settings";
import {
  AddBranchDialog,
  AddPackageDialog,
} from "@/features/settings/components/settings-create-dialogs";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Sapling Global" },
      {
        name: "description",
        content:
          "Review the workspace identity and configure branches, service packages, verification policy, turnaround and retention.",
      },
      { property: "og:title", content: "Platform Settings — Sapling Global" },
      {
        property: "og:description",
        content: "Workspace identity, branches, packages, policy, turnaround and retention.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [branchOpen, setBranchOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => api.settings.get(),
    staleTime: 120_000,
  });

  const policyMutation = useMutation({
    mutationFn: async (policy: PolicyToggle) => {
      if (!data) throw new Error("Settings are still loading");
      const current = data.fieldPolicyConfig;
      const base = {
        defaultRadiusMeters: current.defaultRadiusMeters,
        maxAccuracyMeters: current.maxAccuracyMeters,
        minimumPhotos: current.minimumPhotos,
        retentionDays: current.retentionDays,
        requireCheckout: current.requireCheckout,
        outsideGeofencePolicy: current.outsideGeofencePolicy,
        version: current.version,
      };
      if (policy.id === "checkout") base.requireCheckout = !policy.enabled;
      if (policy.id === "geofence") {
        base.outsideGeofencePolicy = policy.enabled ? "SUPERVISOR_APPROVAL" : "BLOCK";
      }
      return updateFieldPolicy(base);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success("Policy updated", { description: "The API recorded the audited change." });
    },
    onError: (error: Error) => toast.error("Policy update failed", { description: error.message }),
  });
  const branchMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      setBranchOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success("Branch added");
    },
    onError: (error: Error) =>
      toast.error("Branch could not be added", { description: error.message }),
  });
  const packageMutation = useMutation({
    mutationFn: createServicePackage,
    onSuccess: () => {
      setPackageOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success("Service package added");
    },
    onError: (error: Error) =>
      toast.error("Package could not be added", { description: error.message }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Configuration that governs delivery: locations, packages, verification policy, turnaround and retention."
        meta="Configuration changes are attributed in the audit trail"
      />

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
      {isPending ? <ListSkeleton rows={5} /> : null}

      {data ? (
        <Tabs defaultValue="organisation">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="organisation" className="text-xs">
              Workspace
            </TabsTrigger>
            <TabsTrigger value="catalogue" className="text-xs">
              Delivery setup
            </TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">
              SLA & retention
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organisation" className="space-y-6 pt-4">
            <OrganisationPanel settings={data} />
          </TabsContent>

          <TabsContent value="catalogue" className="space-y-6 pt-4">
            <BranchesPanel settings={data} onAdd={() => setBranchOpen(true)} />
            <PackagesPanel settings={data} onAdd={() => setPackageOpen(true)} />
            <PolicyPanel
              title="Field visit rules"
              description="Completion gates applied to every newly assigned physical visit."
              policies={data.fieldPolicy}
              busy={policyMutation.isPending}
              onToggle={(policy) => policyMutation.mutate(policy)}
            />
          </TabsContent>

          <TabsContent value="sla" className="space-y-6 pt-4">
            <SlaDefaultsPanel settings={data} />
            <RetentionPanel settings={data} />
          </TabsContent>
        </Tabs>
      ) : null}
      <AddBranchDialog
        open={branchOpen}
        submitting={branchMutation.isPending}
        onOpenChange={setBranchOpen}
        onSubmit={(draft) => branchMutation.mutate(draft)}
      />
      <AddPackageDialog
        open={packageOpen}
        submitting={packageMutation.isPending}
        onOpenChange={setPackageOpen}
        onSubmit={(draft) => packageMutation.mutate(draft)}
      />
    </div>
  );
}
