import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/features/public-site/LandingPage";
import { loadIdentity, landingPathForRoles } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sapling Global — Background verification, done right" },
      {
        name: "description",
        content:
          "Employment, education, address, identity and court checks in one secure portal with live SLA tracking, a dedicated RM and clear final reports.",
      },
      { property: "og:title", content: "Sapling Global — Background verification, done right" },
    ],
  }),
  // Signed-in users go straight to their workspace; visitors see the landing page.
  beforeLoad: async () => {
    const identity = await loadIdentity();
    if (identity) throw redirect({ to: landingPathForRoles(identity.roles) as "/admin" });
  },
  component: LandingPage,
});
