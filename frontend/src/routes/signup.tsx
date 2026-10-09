import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { SignupCard } from "@/features/auth/components/signup-card";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create a company account — Sapling Global" },
      {
        name: "description",
        content: "Register your company for Sapling Global background verification.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [step, setStep] = useState(0);
  return (
    <AuthLayout step={step}>
      <SignupCard onStep={setStep} />
    </AuthLayout>
  );
}
