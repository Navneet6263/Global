import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthBrandPanel } from "@/features/auth/components/auth-brand-panel";
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
    <main className="relative flex min-h-screen items-center overflow-hidden bg-canvas px-4 py-8 sm:px-6 lg:px-10">
      <div
        className="pointer-events-none absolute -left-32 top-[-10rem] size-[26rem] rounded-full bg-mint-soft/70 blur-[90px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-[-12rem] size-[30rem] rounded-full bg-primary/10 blur-[110px]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
        <AuthBrandPanel />
        <div className="flex items-center justify-center">
          <LoginCard />
        </div>
      </div>
    </main>
  );
}
