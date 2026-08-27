"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { login } from "@/lib/backend-api/auth";
import { loadIdentity, landingPathForRoles } from "@/lib/auth/platform-session";

type PendingOtp = { channel: "email" | "mobile"; value: string } | null;

function messageOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message) || fallback;
  }
  return fallback;
}

export function useAuthActions() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingOtp>(null);
  const [resetLinkSent, setResetLinkSent] = useState(false);

  const signInWithPassword = async (email: string, password: string) => {
    setBusy(true);
    try {
      const tenantCode = import.meta.env["VITE_TENANT_CODE"] ?? "SAPLING";
      const result = await login({ tenantCode, email, password });
      const identity = await loadIdentity();
      if (!identity) throw new Error("The secure session could not be loaded.");
      toast.success("Signed in");
      const destination = result.session.mustChangePassword
        ? "/change-password"
        : landingPathForRoles(identity.roles);
      await navigate({ to: destination as "/admin", replace: true });
    } catch (error) {
      toast.error(messageOf(error, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  const unavailable = async (_value: string) => {
    toast.error("OTP sign-in is not enabled for this workspace yet.");
  };

  const sendPasswordReset = async (_email: string) => {
    toast.error("Contact your Platform Admin to reset your password securely.");
  };

  const reset = () => {
    setPending(null);
    setResetLinkSent(false);
  };

  return {
    busy,
    otpSentTo: pending?.value ?? null,
    resetLinkSent,
    signInWithPassword,
    sendEmailOtp: unavailable,
    sendMobileOtp: unavailable,
    verifyOtp: unavailable,
    sendPasswordReset,
    reset,
  };
}
