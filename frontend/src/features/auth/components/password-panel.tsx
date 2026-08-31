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
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email.trim(), password);
      }}
    >
      <div>
        <Label htmlFor="login-email" className="mb-1.5 block text-xs">
          Work email
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@saplingglobal.in"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="login-password" className="text-xs">
            Password
          </Label>
          <span className="text-[11px] text-muted-foreground">Secure password</span>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={7}
            required
          />
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {reveal ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !hydrated}>
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
