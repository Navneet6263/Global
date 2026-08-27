"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OtpChannel = "email" | "mobile";

interface OtpPanelProps {
  channel: OtpChannel;
  submitting: boolean;
  sentTo: string | null;
  onSend: (identifier: string) => void;
  onVerify: (code: string) => void;
  onReset: () => void;
}

const COPY: Record<OtpChannel, { label: string; placeholder: string; hint: string; type: string }> =
  {
    email: {
      label: "Work email",
      placeholder: "you@saplingglobal.in",
      hint: "We send a 6-digit code to your registered work email.",
      type: "email",
    },
    mobile: {
      label: "Registered mobile",
      placeholder: "9876543210",
      hint: "We send a 6-digit code by SMS to your registered +91 mobile number.",
      type: "tel",
    },
  };

export function OtpPanel({
  channel,
  submitting,
  sentTo,
  onSend,
  onVerify,
  onReset,
}: OtpPanelProps) {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const copy = COPY[channel];

  if (sentTo) {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onVerify(code.trim());
        }}
      >
        <div className="rounded-2xl border border-mint/40 bg-mint-soft/60 px-3.5 py-3 text-[12px] text-foreground">
          Code sent to <span className="font-medium">{sentTo}</span>. It expires in 10 minutes.
        </div>
        <div>
          <Label htmlFor="otp-code" className="mb-1.5 block text-xs">
            6-digit code
          </Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting || code.length < 6}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
          {submitting ? "Verifying…" : "Verify & sign in"}
        </Button>
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <ArrowLeft className="size-3.5" aria-hidden />
            Change {channel === "email" ? "email" : "number"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onSend(identifier || sentTo)}
          >
            Resend code
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSend(identifier.trim());
      }}
    >
      <div>
        <Label htmlFor="otp-identifier" className="mb-1.5 block text-xs">
          {copy.label}
        </Label>
        <Input
          id="otp-identifier"
          type={copy.type}
          inputMode={channel === "mobile" ? "numeric" : "email"}
          placeholder={copy.placeholder}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{copy.hint}</p>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" aria-hidden />
        )}
        {submitting ? "Sending code…" : "Send code"}
      </Button>
    </form>
  );
}
