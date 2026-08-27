import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordCard } from "@/features/auth/components/reset-password-card";

export const Route = createFileRoute("/change-password")({
  ssr: false,
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
