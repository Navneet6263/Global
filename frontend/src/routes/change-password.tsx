import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { changePassword } from "@/lib/api/auth";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: "Secure your account — Sapling Global" }] }),
});

function ChangePasswordPage() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const valid =
    newPassword.length >= 14 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword) &&
    newPassword === confirmation;
  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/login");
    },
  });
  return (
    <main className="canvas-mesh grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="surface-float w-full max-w-lg overflow-hidden rounded-[2rem]">
        <header className="ink-panel p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/10">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold">Sapling Global</p>
              <p className="text-xs opacity-60">Account security</p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-bold">Create your private password</h1>
          <p className="mt-2 text-sm opacity-65">
            A password change is required before workspace access is enabled.
          </p>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && currentPassword) mutation.mutate();
          }}
          className="space-y-4 p-7"
        >
          <PasswordField
            label="Temporary/current password"
            value={currentPassword}
            setValue={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            value={newPassword}
            setValue={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmation}
            setValue={setConfirmation}
            autoComplete="new-password"
          />
          <div className="grid grid-cols-2 gap-2">
            {[
              { text: "14+ characters", ok: newPassword.length >= 14 },
              {
                text: "Upper + lower case",
                ok: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
              },
              { text: "At least one number", ok: /\d/.test(newPassword) },
              { text: "At least one symbol", ok: /[^A-Za-z0-9]/.test(newPassword) },
            ].map((rule) => (
              <div
                key={rule.text}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${rule.ok ? "bg-accent/15 text-accent-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {rule.text}
              </div>
            ))}
          </div>
          {confirmation && newPassword !== confirmation ? (
            <p className="text-sm text-destructive">Passwords do not match.</p>
          ) : null}
          {mutation.isError ? (
            <p className="text-sm text-destructive">{mutation.error.message}</p>
          ) : null}
          <button
            disabled={!currentPassword || !valid || mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Change password and return to sign in
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  setValue,
  autoComplete,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring/25"
      />
    </label>
  );
}
