"use client";

import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PasswordPanel } from "./password-panel";
import { useAuthActions } from "../hooks/use-auth-actions";

export function LoginCard() {
  const auth = useAuthActions();

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card-top">
        <span className="auth-card-badge">
          <ShieldCheck aria-hidden /> Secure sign-in
        </span>
      </div>

      <header className="auth-card-head">
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to your Sapling Global workspace with your work email.</p>
      </header>

      <div className="auth-form">
        <PasswordPanel submitting={auth.busy} onSubmit={auth.signInWithPassword} />
      </div>

      <div className="auth-divider">New here?</div>
      <Link to="/signup" className="auth-alt">
        <div>
          <strong>Create a company account</strong>
          <span>Register your company and start onboarding today.</span>
        </div>
        <ArrowRight aria-hidden />
      </Link>

      <p className="auth-footnote">
        Locked out or forgot your password? Contact your administrator or RM. Every sign-in is
        recorded in the audit trail.
      </p>
    </section>
  );
}
