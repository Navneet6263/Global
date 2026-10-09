import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { LoginCard } from "@/features/auth/components/login-card";
import { cachedIdentity, landingPathForRoles, loadIdentity } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Sapling Global Verification Platform" },
      {
        name: "description",
        content: "Secure password sign-in for authorised Sapling Global verification workspaces.",
      },
      { property: "og:title", content: "Sign in — Sapling Global Verification Platform" },
      {
        property: "og:description",
        content:
          "Role-scoped access for platform, delivery, client, field, sales and finance teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const redirectIdentity = (identity: Awaited<ReturnType<typeof loadIdentity>>) => {
      if (!active || !identity) return;
      const destination = identity.mustChangePassword
        ? "/change-password"
        : landingPathForRoles(identity.roles);
      void navigate({ to: destination as "/admin", replace: true });
    };

    const cached = cachedIdentity();
    if (cached) redirectIdentity(cached);
    else void loadIdentity().then(redirectIdentity);
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <AuthLayout>
      <LoginCard />
    </AuthLayout>
  );
}
