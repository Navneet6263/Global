"use client";

import { useState } from "react";
import { AtSign, KeyRound, Smartphone } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { cn } from "@/lib/utils";
import { PasswordPanel } from "./password-panel";
import { OtpPanel, type OtpChannel } from "./otp-panel";
import { ForgotPasswordPanel } from "./forgot-password-panel";
import { useAuthActions } from "../hooks/use-auth-actions";

type Mode = "password" | "email-otp" | "mobile-otp" | "forgot";

const TABS: readonly { id: Mode; label: string; icon: typeof KeyRound }[] = [
  { id: "password", label: "Password", icon: KeyRound },
  { id: "email-otp", label: "Email OTP", icon: AtSign },
  { id: "mobile-otp", label: "Mobile OTP", icon: Smartphone },
];

export function LoginCard() {
  const [mode, setMode] = useState<Mode>("password");
  const auth = useAuthActions();

  const switchMode = (next: Mode) => {
    auth.reset();
    setMode(next);
  };

  return (
    <section className="w-full rounded-[2rem] border border-white/80 bg-card/85 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl sm:p-8">
      <BrandMark workspace="platform-admin" />

      <header className="mt-6">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-foreground">
          {mode === "forgot" ? "Reset your password" : "Sign in to your workspace"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {mode === "forgot"
            ? "We will email you a secure link."
            : "Use your Sapling Global credentials or a one-time code."}
        </p>
      </header>

      {mode !== "forgot" ? (
        <div
          role="tablist"
          aria-label="Sign-in method"
          className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/60 p-1"
        >
          {TABS.map((tab) => {
            const active = tab.id === mode;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => switchMode(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-medium transition-all",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-3.5" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5">
        {mode === "password" ? (
          <PasswordPanel
            submitting={auth.busy}
            onSubmit={auth.signInWithPassword}
            onForgot={() => switchMode("forgot")}
          />
        ) : null}

        {mode === "email-otp" || mode === "mobile-otp" ? (
          <OtpPanel
            channel={(mode === "email-otp" ? "email" : "mobile") as OtpChannel}
            submitting={auth.busy}
            sentTo={auth.otpSentTo}
            onSend={(value) =>
              mode === "email-otp" ? auth.sendEmailOtp(value) : auth.sendMobileOtp(value)
            }
            onVerify={auth.verifyOtp}
            onReset={auth.reset}
          />
        ) : null}

        {mode === "forgot" ? (
          <ForgotPasswordPanel
            submitting={auth.busy}
            sent={auth.resetLinkSent}
            onSubmit={auth.sendPasswordReset}
            onBack={() => switchMode("password")}
          />
        ) : null}
      </div>

      <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Access is issued by the platform team — self sign-up is disabled. Contact your Platform
        Admin if you need an ID.
      </p>
    </section>
  );
}
