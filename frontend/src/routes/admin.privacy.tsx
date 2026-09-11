import { createFileRoute } from "@tanstack/react-router";
import { PrivacyDesk } from "@/features/privacy/PrivacyDesk";

export const Route = createFileRoute("/admin/privacy")({
  head: () => ({ meta: [{ title: "Privacy desk — Sapling Global" }] }),
  component: PrivacyDesk,
});
