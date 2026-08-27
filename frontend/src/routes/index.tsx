import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadIdentity, landingPathForRoles } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await loadIdentity();
    if (!identity) throw redirect({ to: "/auth" });
    throw redirect({ to: landingPathForRoles(identity.roles) as "/admin" });
  },
  component: () => null,
});
