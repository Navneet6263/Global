import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { changePassword } from "@/lib/api/auth";
import { getPasswordRequirements } from "@/lib/password-policy";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: "Secure your account — Sapling Global" }] }),
});

function ChangePasswordPage() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const rules = getPasswordRequirements(newPassword);
  const valid = rules.every((rule) => rule.ok) && newPassword === confirmation;
  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/login");
    },
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-7 text-[#211d1a] sm:px-7 sm:py-10 lg:px-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[#f56a22]" />
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0df] text-[#d84e0f]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold">Sapling Global</p>
              <p className="text-xs text-[#766d66]">Verification intelligence</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#e9e1da] bg-white px-4 py-2 text-xs font-semibold text-[#6e655e] sm:inline-flex">
            Required security step
          </span>
        </header>

        <section className="grid overflow-hidden rounded-[1.75rem] border border-[#e7dfd7] bg-white shadow-[0_18px_55px_-40px_rgba(67,48,35,.38)] lg:grid-cols-[.82fr_1.18fr]">
          <aside className="border-b border-[#eadfd4] bg-[#fff8ef] p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#ffe8ce] text-[#d95314]">
              <KeyRound className="h-6 w-6" />
            </span>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#c75018]">
              Account security
            </p>
            <h1 className="mt-3 max-w-sm text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl">
              Create your private password
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#716861]">
              Your temporary password has done its job. Choose a private password before entering
              your workspace.
            </p>

            <div className="mt-9 space-y-3">
              <SecurityNote
                icon={<LockKeyhole className="h-4 w-4" />}
                title="Encrypted and private"
                text="Your password is securely hashed and never displayed to administrators."
              />
              <SecurityNote
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Existing sessions protected"
                text="The temporary sign-in is retired as soon as this change succeeds."
              />
            </div>
          </aside>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (valid && currentPassword) mutation.mutate();
            }}
            className="p-7 sm:p-10 lg:p-12"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-[-0.025em]">Change password</h2>
              <p className="mt-2 text-sm text-[#776e67]">
                Enter the temporary password you received, then create a new one.
              </p>
            </div>

            <div className="space-y-5">
              <PasswordField
                label="Temporary password"
                hint="The password issued when your account was created"
                value={currentPassword}
                setValue={setCurrentPassword}
                autoComplete="current-password"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <PasswordField
                  label="New password"
                  value={newPassword}
                  setValue={setNewPassword}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm password"
                  value={confirmation}
                  setValue={setConfirmation}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#ebe3dc] bg-[#faf9f7] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6e655e]">
                Password requirements
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {rules.map((rule) => (
                  <div key={rule.text} className="flex items-center gap-2.5 text-xs text-[#655d57]">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                        rule.ok
                          ? "border-[#f56a22] bg-[#f56a22] text-white"
                          : "border-[#dcd3cb] bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    {rule.text}
                  </div>
                ))}
              </div>
            </div>

            {confirmation && newPassword !== confirmation ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                The two new passwords do not match.
              </p>
            ) : null}
            {mutation.isError ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {mutation.error.message}
              </p>
            ) : null}

            <button
              disabled={!currentPassword || !valid || mutation.isPending}
              className="mt-7 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#f56a22] px-5 text-sm font-bold text-white shadow-[0_10px_24px_-16px_rgba(245,106,34,.8)] transition hover:bg-[#df5818] disabled:bg-[#d9d3cd] disabled:shadow-none"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Save password and continue
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-[#8a817a]">
              After saving, sign in again with your new password.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function SecurityNote({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#eadfd3] bg-white/75 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0df] text-[#d95314]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#796f67]">{text}</p>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  hint,
  value,
  setValue,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  setValue: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-sm font-bold">
      {label}
      <span className="relative mt-2 block">
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-14 w-full rounded-2xl border border-[#e3dbd4] bg-white px-4 pr-12 text-sm font-medium outline-none transition placeholder:text-[#aaa29b] focus:border-[#f6a16f] focus:ring-4 focus:ring-[#fff0e7]"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-xl text-[#827970] transition hover:bg-[#faf5ef] hover:text-[#3c342e]"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {hint ? <span className="mt-2 block text-xs font-normal text-[#8a817a]">{hint}</span> : null}
    </label>
  );
}
