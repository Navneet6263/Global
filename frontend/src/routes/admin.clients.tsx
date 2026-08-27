import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ClientQuery, ClientStatus } from "@/lib/contracts/client";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientCard } from "@/features/clients/components/client-card";
import { ClientDetailDrawer } from "@/features/clients/components/client-detail-drawer";
import { CreateClientDialog } from "@/features/clients/components/create-client-dialog";
import {
  useClients,
  useCreateClient,
  useSetClientStatus,
} from "@/features/clients/hooks/use-clients";

const STATUS_OPTIONS: { value: ClientStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "suspended", label: "Suspended" },
];

export const Route = createFileRoute("/admin/clients")({
  head: () => ({
    meta: [
      { title: "Client Management — Sapling Global" },
      {
        name: "description",
        content:
          "Manage enterprise client accounts, SLA commitments, package catalogues and portal users in one place.",
      },
      { property: "og:title", content: "Client Management — Sapling Global" },
      {
        property: "og:description",
        content: "Enterprise client accounts, SLA commitments and package catalogues.",
      },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [query, setQuery] = useState<ClientQuery>({
    search: "",
    status: "all",
    page: 1,
    pageSize: 9,
  });
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const { data, isPending, isError, isFetching, refetch } = useClients(query);
  const createClient = useCreateClient();
  const setStatus = useSetClientStatus();
  const clients = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client management"
        description="Every enterprise account with live volume, SLA attainment and commercial exposure."
        meta={data ? `${data.total} client accounts` : undefined}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            Onboard client
          </Button>
        }
      />

      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <Input
          value={query.search ?? ""}
          onChange={(event) => setQuery((c) => ({ ...c, search: event.target.value, page: 1 }))}
          placeholder="Search client, industry or city"
          aria-label="Search clients"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={query.status ?? "all"}
          onValueChange={(value) =>
            setQuery((c) => ({ ...c, status: value as ClientStatus | "all", page: 1 }))
          }
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}
      {isPending ? <CardGridSkeleton count={6} /> : null}

      {!isPending && clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients match this filter"
          description="Adjust the status filter or search for a different account name."
        />
      ) : null}

      {clients.length > 0 ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpen={setOpenId}
                onToggleStatus={(target) => {
                  const next = target.status === "suspended" ? "active" : "suspended";
                  setStatus.mutate(
                    { id: target.id, status: next },
                    {
                      onSuccess: () =>
                        toast.success(
                          `${target.name} ${next === "active" ? "reactivated" : "suspended"}`,
                        ),
                    },
                  );
                }}
              />
            ))}
          </div>
          <div className="surface overflow-hidden">
            <PaginationBar
              page={query.page ?? 1}
              pageSize={query.pageSize ?? 9}
              total={data?.total ?? 0}
              onPageChange={(page) => setQuery((c) => ({ ...c, page }))}
              label="clients"
            />
          </div>
        </>
      ) : null}

      <ClientDetailDrawer
        client={clients.find((client) => client.id === openId)}
        onClose={() => setOpenId(undefined)}
      />

      <CreateClientDialog
        open={creating}
        submitting={createClient.isPending}
        onOpenChange={setCreating}
        onSubmit={(draft) =>
          createClient.mutate(draft, {
            onSuccess: (client) => {
              setCreating(false);
              toast.success(`${client.name} onboarded`, {
                description: "Default package catalogue applied.",
              });
            },
          })
        }
      />
    </div>
  );
}
