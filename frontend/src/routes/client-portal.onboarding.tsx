import { createFileRoute } from "@tanstack/react-router";
import { ClientOnboardingPage } from "@/features/onboarding/ClientOnboardingPage";

export const Route = createFileRoute("/client-portal/onboarding")({
  head: () => ({ meta: [{ title: "Get started — Sapling Global" }] }),
  component: ClientOnboardingPage,
});
