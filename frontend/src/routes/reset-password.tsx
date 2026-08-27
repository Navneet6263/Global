import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordCard } from "@/features/auth/components/reset-password-card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Sapling Global" },
      {
        name: "description",
        content: "Choose a new password for your Sapling Global verification workspace account.",
      },
      { property: "og:title", content: "Set a new password — Sapling Global" },
      {
        property: "og:description",
        content: "Complete your password reset for the Sapling Global verification platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <ResetPasswordCard />
      </div>
    </main>
  );
}
