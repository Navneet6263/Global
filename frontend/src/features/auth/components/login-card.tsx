"use client";

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, ShieldCheck, Truck } from "lucide-react";
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
      {/* Two ways in, side by side: a company that needs verifications, a vendor that does them. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <SignupTile
          to="/signup"
          icon={<Building2 className="size-[18px]" aria-hidden />}
          title="Sign up your company"
          detail="Register your company and start getting employee verifications today."
          tone="bg-blue-50 text-blue-700"
        />
        <SignupTile
          to="/vendor/signup"
          icon={<Truck className="size-[18px]" aria-hidden />}
          title="Sign up as a Vendor"
          detail="Pick verification work near you and get paid for every check."
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>

      <p className="auth-footnote">
        Locked out or forgot your password? Contact your administrator or RM. Every sign-in is
        recorded in the audit trail.
      </p>
    </section>
  );
}

function SignupTile({
  to,
  icon,
  title,
  detail,
  tone,
}: {
  to: "/signup" | "/vendor/signup";
  icon: ReactNode;
  title: string;
  detail: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-left no-underline transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_10px_24px_-14px_rgb(29_78_216/0.45)]"
    >
      <span className="flex items-center justify-between">
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>{icon}</span>
        <ArrowRight
          className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700"
          aria-hidden
        />
      </span>
      <strong className="text-[14px] leading-5 font-semibold text-slate-900">{title}</strong>
      <span className="text-[12.5px] leading-[1.45] text-slate-500">{detail}</span>
    </Link>
  );
}
