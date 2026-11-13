import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { VendorSignupCard } from "@/features/vendor-onboarding/components/VendorSignupCard";

export const Route = createFileRoute("/vendor_/signup")({
  head: () => ({
    meta: [
      { title: "Sign up as a Vendor — Sapling Global" },
      {
        name: "description",
        content: "Register your vendor business for Sapling Global background verification.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorSignupPage,
});

function VendorSignupPage() {
  const [step, setStep] = useState(0);
  return (
    <AuthLayout step={step}>
      <VendorSignupCard onStep={setStep} />
    </AuthLayout>
  );
}
