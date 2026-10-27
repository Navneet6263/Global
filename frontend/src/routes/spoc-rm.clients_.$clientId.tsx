import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientProfilePage } from "@/features/spoc-rm/client-profile/ClientProfilePage";
import { PROFILE_TABS, type ProfileTab } from "@/features/spoc-rm/client-profile/profile-tabs";

export const Route = createFileRoute("/spoc-rm/clients_/$clientId")({
  validateSearch: (input: Record<string, unknown>): { tab?: ProfileTab } => {
    const tab = PROFILE_TABS.find((item) => item.id === input["tab"])?.id;
    return tab && tab !== "overview" ? { tab } : {};
  },
  head: () => ({ meta: [{ title: "Client profile — Sapling Global" }] }),
  component: ClientProfileRoute,
});

function ClientProfileRoute() {
  const { clientId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <ClientProfilePage
      key={clientId}
      clientId={clientId}
      tab={search.tab ?? "overview"}
      onTab={(tab) =>
        void navigate({
          search: tab === "overview" ? {} : { tab },
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
