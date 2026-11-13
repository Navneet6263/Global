"use client";

import { ArrowLeft, Rocket, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { VendorChallenge } from "../api/vendor-onboarding-api";

export function VendorSignupOtpStep({
  challenge,
  companyName,
  otp,
  setOtp,
  busy,
  wait,
  onConfirm,
  onChangeDetails,
  onResend,
}: {
  challenge: VendorChallenge;
  companyName: string;
  otp: string;
  setOtp: (val: string) => void;
  busy: boolean;
  wait: number;
  onConfirm: (code?: string) => void;
  onChangeDetails: () => void;
  onResend: () => void;
}) {
  return (
    <>
      <header className="auth-card-head">
        <h1 id="vendor-signup-title">Check your email</h1>
        <p>
          Enter the 6-digit code to create {companyName.trim() || "your vendor"}&apos;s workspace.
        </p>
      </header>
      <div className="auth-otp-mail">
        <span className="auth-otp-mail-icon">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <strong>{challenge.email}</strong>
          <span>The code expires in 10 minutes. Check spam if you don&apos;t see it.</span>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onConfirm();
        }}
      >
        <div className="auth-otp">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(value) => {
              const digits = value.replace(/\D/g, "");
              setOtp(digits);
              if (digits.length === 6) void onConfirm(digits);
            }}
            aria-label="6-digit email code"
            autoFocus
            disabled={busy}
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-14 w-12 rounded-xl border text-xl font-bold first:rounded-xl last:rounded-xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          type="submit"
          className="auth-submit mt-6 w-full"
          disabled={otp.length !== 6 || busy}
          loading={busy}
        >
          <Rocket className="size-4" aria-hidden />
          Verify and create workspace
        </Button>
      </form>
      <div className="auth-otp-meta">
        <button type="button" className="auth-link-button" onClick={onChangeDetails}>
          <ArrowLeft className="mr-1 inline size-3.5" aria-hidden />
          Change details
        </button>
        <button
          type="button"
          className="auth-link-button"
          onClick={onResend}
          disabled={wait > 0}
        >
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </>
  );
}
