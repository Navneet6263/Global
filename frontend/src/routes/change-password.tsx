import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordCard } from "@/features/auth/components/reset-password-card";
import { requirePasswordChangeSession } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  beforeLoad: () => requirePasswordChangeSession(),
  head: () => ({ meta: [{ title: "Change password — Sapling Global" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <ResetPasswordCard />
      </div>
    </main>
  );
}
