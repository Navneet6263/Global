"use client";

import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ForgotPasswordPanelProps {
  submitting: boolean;
  sent: boolean;
  onSubmit: (email: string) => void;
  onBack: () => void;
}

export function ForgotPasswordPanel({
  submitting,
  sent,
  onSubmit,
  onBack,
}: ForgotPasswordPanelProps) {
  const [email, setEmail] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email.trim());
      }}
    >
      <div className="rounded-2xl border border-border bg-muted/50 px-3.5 py-3 text-[12px] text-muted-foreground">
        Enter your work email and we will send a secure link to set a new password.
      </div>

      {sent ? (
        <div className="rounded-2xl border border-mint/40 bg-mint-soft/60 px-3.5 py-3 text-[12px] text-foreground">
          Reset link sent to <span className="font-medium">{email}</span>. Check your inbox.
        </div>
      ) : (
        <div>
          <Label htmlFor="reset-email" className="mb-1.5 block text-xs">
            Work email
          </Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@saplingglobal.in"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      )}

      {!sent ? (
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="size-4" aria-hidden />
          )}
          {submitting ? "Sending link…" : "Send reset link"}
        </Button>
      ) : null}

      <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onBack}>
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to sign in
      </Button>
    </form>
  );
}
