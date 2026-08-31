"use client";

import { BrandMark } from "@/components/shell/brand-mark";
import { PasswordPanel } from "./password-panel";
import { useAuthActions } from "../hooks/use-auth-actions";

export function LoginCard() {
  const auth = useAuthActions();

  return (
    <section className="w-full rounded-[2rem] border border-white/80 bg-card/85 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl sm:p-8">
      <BrandMark workspace="platform-admin" />

      <header className="mt-6">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-foreground">
          Sign in to your workspace
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Use the work email and password issued by your Platform Admin.
        </p>
      </header>

      <div className="mt-6">
        <PasswordPanel submitting={auth.busy} onSubmit={auth.signInWithPassword} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-muted/45 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Access is invitation-only. For a locked account or password reset, contact your Platform
          Admin; every credential reset is recorded in the audit trail.
        </p>
      </div>
    </section>
  );
}
