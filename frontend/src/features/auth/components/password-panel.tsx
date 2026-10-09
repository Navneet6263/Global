"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordPanelProps {
  submitting: boolean;
  onSubmit: (email: string, password: string) => void;
}

export function PasswordPanel({ submitting, onSubmit }: PasswordPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email.trim(), password);
      }}
    >
      <div className="auth-field">
        <Label htmlFor="login-email">Work email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <Label htmlFor="login-password">Password</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            className="pr-11"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={7}
            required
          />
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {reveal ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="auth-submit w-full"
        disabled={submitting || !hydrated}
        loading={submitting}
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LogIn className="size-4" aria-hidden />
        )}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
