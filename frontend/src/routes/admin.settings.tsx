import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BranchesPanel,
  NotificationsPanel,
  OrganisationPanel,
  PackagesPanel,
  PolicyPanel,
  RetentionPanel,
  SlaDefaultsPanel,
} from "@/features/settings/components/settings-panels";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Sapling Global" },
      {
        name: "description",
        content:
          "Configure the organisation profile, branches, service packages, verification policy, SLA defaults and retention rules.",
      },
      { property: "og:title", content: "Platform Settings — Sapling Global" },
      {
        property: "og:description",
        content: "Organisation profile, branches, packages, policy, SLA defaults and retention.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => api.settings.get(),
    staleTime: 120_000,
  });

  const notice = (label: string) =>
    toast.success(`${label} updated`, { description: "Change written to the audit trail." });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Configuration that governs delivery: locations, packages, verification policy, SLA defaults and retention."
        meta="All changes are versioned and attributed in the audit trail"
      />

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
      {isPending ? <ListSkeleton rows={5} /> : null}

      {data ? (
        <Tabs defaultValue="organisation">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="organisation" className="text-xs">
              Organisation
            </TabsTrigger>
            <TabsTrigger value="catalogue" className="text-xs">
              Branches & packages
            </TabsTrigger>
            <TabsTrigger value="policy" className="text-xs">
              Verification policy
            </TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">
              SLA & retention
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organisation" className="space-y-6 pt-4">
            <OrganisationPanel settings={data} />
            <PolicyPanel
              title="Client administration"
              description="What client administrators can do inside their own workspace."
              policies={data.clientAdministration}
              onToggle={(policy) => notice(policy.label)}
            />
          </TabsContent>

          <TabsContent value="catalogue" className="space-y-6 pt-4">
            <BranchesPanel settings={data} />
            <PackagesPanel settings={data} />
          </TabsContent>

          <TabsContent value="policy" className="space-y-6 pt-4">
            <PolicyPanel
              title="Field verification policy"
              description="Controls for physical address and employer visits."
              policies={data.fieldPolicy}
              onToggle={(policy) => notice(policy.label)}
            />
            <PolicyPanel
              title="Evidence policy"
              description="Evidence quality gates enforced before QA sign-off."
              policies={data.evidencePolicy}
              onToggle={(policy) => notice(policy.label)}
            />
          </TabsContent>

          <TabsContent value="sla" className="space-y-6 pt-4">
            <SlaDefaultsPanel settings={data} />
            <RetentionPanel settings={data} />
          </TabsContent>

          <TabsContent value="notifications" className="pt-4">
            <NotificationsPanel
              settings={data}
              onToggle={() => notice("Notification preference")}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
