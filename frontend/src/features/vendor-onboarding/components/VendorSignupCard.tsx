"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resendVendorOtp,
  startVendorSignup,
  verifyVendorOtp,
  type VendorChallenge,
} from "../api/vendor-onboarding-api";
import { cacheIdentityFromSession } from "@/lib/auth/platform-session";
import { VendorSignupOtpStep } from "./VendorSignupOtpStep";

const RULES = [
  { label: "7+ characters", test: (value: string) => value.length >= 7 },
  {
    label: "Upper & lower case",
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A symbol", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function VendorSignupCard({ onStep }: { onStep: (step: number) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [accept, setAccept] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<VendorChallenge | null>(null);
  const [otp, setOtp] = useState("");
  const [wait, setWait] = useState(0);

  const passed = useMemo(
    () => RULES.filter((rule) => rule.test(form.password)).length,
    [form.password],
  );
  const strongEnough = passed === RULES.length;

  useEffect(() => onStep(challenge ? 1 : 0), [challenge, onStep]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submitDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!strongEnough) {
      toast.error("Choose a stronger password meeting all requirements");
      return;
    }
    if (!accept) {
      toast.error("Please accept the authorization and service terms");
      return;
    }
    setBusy(true);
    try {
      const result = await startVendorSignup({
        fullName: form.fullName.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        isAuthorisedSignatory: true,
        acceptTerms: true,
      });
      setChallenge(result);
      setOtp("");
      setWait(result.resendAfterSeconds);
      toast.success(`We sent a 6-digit code to ${result.email}`);
    } catch (error) {
      toast.error(messageOf(error, "Could not start vendor sign-up"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (code = otp) => {
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    try {
      const result = await verifyVendorOtp(challenge.signupId, code);
      await cacheIdentityFromSession(result.session);
      onStep(2);
      toast.success("Vendor account created! Proceeding to document verification.");
      void navigate({ to: "/vendor/onboarding", replace: true });
    } catch (error) {
      setOtp("");
      toast.error(messageOf(error, "Could not verify code"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    try {
      const result = await resendVendorOtp(challenge.signupId);
      setChallenge(result);
      setWait(result.resendAfterSeconds);
      toast.success("A new code is on its way");
    } catch (error) {
      toast.error(messageOf(error, "Could not send a new code"));
    }
  };

  return (
    <section className="auth-card" aria-labelledby="vendor-signup-title">
      <div className="auth-card-top">
        <span className="auth-card-badge">
          <ShieldCheck aria-hidden /> Free to register
        </span>
      </div>
      <div className="auth-mobile-steps" aria-hidden>
        <i className="is-on" />
        <i className={challenge ? "is-on" : ""} />
        <i />
        <i />
      </div>

      {challenge ? (
        <VendorSignupOtpStep
          challenge={challenge}
          companyName={form.companyName}
          otp={otp}
          setOtp={setOtp}
          busy={busy}
          wait={wait}
          onConfirm={confirm}
          onChangeDetails={() => setChallenge(null)}
          onResend={() => void resend()}
        />
      ) : (
        <>
          <header className="auth-card-head">
            <h1 id="vendor-signup-title">Vendor Sign up</h1>
            <p>You become the company admin. Explore right away; cases open after approval.</p>
          </header>
          <form className="auth-form" onSubmit={(event) => void submitDetails(event)}>
            <div className="auth-field">
              <Label htmlFor="vendor-signup-company">Vendor name</Label>
              <Input
                id="vendor-signup-company"
                autoComplete="organization"
                placeholder="Acme Verifications Pvt Ltd"
                value={form.companyName}
                onChange={set("companyName")}
                minLength={2}
                maxLength={180}
                required
              />
            </div>
            <div className="auth-form-row">
              <div className="auth-field">
                <Label htmlFor="vendor-signup-name">Your full name</Label>
                <Input
                  id="vendor-signup-name"
                  autoComplete="name"
                  placeholder="Riya Mehta"
                  value={form.fullName}
                  onChange={set("fullName")}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </div>
              <div className="auth-field">
                <Label htmlFor="vendor-signup-phone">
                  Mobile <small>(optional)</small>
                </Label>
                <Input
                  id="vendor-signup-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={set("phone")}
                  pattern="[+0-9 ()\-]{7,24}"
                />
              </div>
            </div>
            <div className="auth-field">
              <Label htmlFor="vendor-signup-email">Work email</Label>
              <Input
                id="vendor-signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set("email")}
                maxLength={254}
                required
              />
              <p className="auth-field-hint">Use your company email — approval is faster.</p>
            </div>
            <div className="auth-field">
              <Label htmlFor="vendor-signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="vendor-signup-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className="pr-11"
                  value={form.password}
                  onChange={set("password")}
                  maxLength={128}
                  required
                  aria-describedby="vendor-signup-password-rules"
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
              <div className={`auth-strength is-${passed}`} aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="auth-rules" id="vendor-signup-password-rules">
                {RULES.map((rule) => {
                  const ok = rule.test(form.password);
                  return (
                    <span key={rule.label} className={ok ? "is-ok" : ""}>
                      <Check aria-hidden /> {rule.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <label className="auth-check">
              <Checkbox
                checked={accept}
                onCheckedChange={(value) => setAccept(value === true)}
                aria-label="I am authorised to register this company and accept the service terms and privacy notice."
                className="mt-0.5"
              />
              <span>
                I am authorised to register this company and accept the service terms and privacy
                notice.
              </span>
            </label>
            <Button
              type="submit"
              className="auth-submit w-full"
              disabled={busy || !accept || !strongEnough}
              loading={busy}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
          <p className="auth-footnote">
            Already have an account? <Link to="/auth">Sign in</Link>
          </p>
        </>
      )}
    </section>
  );
}
