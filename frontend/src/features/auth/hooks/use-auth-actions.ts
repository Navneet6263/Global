"use client";

import { ROLE_HOME, rememberedRole } from "@/lib/auth/role-home";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { login } from "@/lib/backend-api/auth";
import { cacheIdentityFromSession, landingPathForRoles } from "@/lib/auth/platform-session";

function messageOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message) || fallback;
  }
  return fallback;
}

export function useAuthActions() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const signInWithPassword = async (email: string, password: string) => {
    setBusy(true);
    try {
      const tenantCode = import.meta.env["VITE_TENANT_CODE"] ?? "SAPLING";
      const result = await login({ tenantCode, email, password });
      const identity = await cacheIdentityFromSession(result.session);
      if (result.session.passwordExpired)
        toast.info("Time for a new password", {
          description: "Passwords are changed every 90 days. Set a new one to continue.",
        });
      const lastRole = rememberedRole(identity.roles);
      const destination = result.session.mustChangePassword
        ? "/change-password"
        : lastRole
          ? ROLE_HOME[lastRole]!
          : landingPathForRoles(identity.roles);
      await navigate({ to: destination as "/admin", replace: true });
    } catch (error) {
      toast.error(messageOf(error, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  return { busy, signInWithPassword };
}
