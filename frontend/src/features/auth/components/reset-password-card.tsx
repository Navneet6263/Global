"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/lib/backend-api/auth";
import { endAuthenticatedSession } from "@/lib/auth/end-session";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidUserPassword, PASSWORD_REQUIREMENTS } from "@/lib/password-policy";

export function ResetPasswordCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = async () => {
    if (!isValidUserPassword(password)) {
      toast.error(PASSWORD_REQUIREMENTS);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword: password });
      await queryClient.cancelQueries();
      await endAuthenticatedSession();
      queryClient.clear();
      toast.success("Password updated. Sign in again.");
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-white/80 bg-card/85 p-7 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <BrandMark workspace="platform-admin" />
      <h1 className="mt-6 text-[1.5rem] leading-tight font-semibold tracking-tight text-foreground">
        Set a new password
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Confirm your temporary or current password, then choose a new secure password.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <Label htmlFor="current-password" className="mb-1.5 block text-xs">
            Current password
          </Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="new-password" className="mb-1.5 block text-xs">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={7}
            required
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">{PASSWORD_REQUIREMENTS}.</p>
        </div>
        <div>
          <Label htmlFor="confirm-password" className="mb-1.5 block text-xs">
            Confirm password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={7}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
          {busy ? "Updating…" : "Update password"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                await queryClient.cancelQueries();
                await endAuthenticatedSession();
                queryClient.clear();
                await navigate({ to: "/auth", replace: true });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not sign out");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Sign out and return to sign in
        </Button>
      </form>
    </section>
  );
}
