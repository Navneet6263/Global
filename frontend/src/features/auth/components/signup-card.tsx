"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Eye, EyeOff, MailCheck, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  resendSignupCode,
  startSignup,
  verifySignup,
  type SignupChallenge,
} from "@/lib/backend-api/auth";
import { cacheIdentityFromSession } from "@/lib/auth/platform-session";

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

/** Two steps: company + admin details, then the 6-digit email code. */
export function SignupCard({ onStep }: { onStep: (step: number) => void }) {
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
  const [challenge, setChallenge] = useState<SignupChallenge | null>(null);
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
      toast.error("Choose a stronger password");
      return;
    }
    setBusy(true);
    try {
      const result = await startSignup({
        fullName: form.fullName.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        acceptTerms: accept,
      });
      setChallenge(result);
      setOtp("");
      setWait(result.resendAfterSeconds);
      toast.success(`We sent a 6-digit code to ${result.email}`);
    } catch (error) {
      toast.error(messageOf(error, "Could not start sign-up"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (code = otp) => {
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    try {
      const result = await verifySignup({ signupId: challenge.signupId, otp: code });
      await cacheIdentityFromSession(result.session);
      onStep(2);
      toast.success("Your company workspace is ready");
      await navigate({ to: "/client-portal/onboarding" as "/admin", replace: true });
    } catch (error) {
      setOtp("");
      toast.error(messageOf(error, "Could not verify the code"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    try {
      const result = await resendSignupCode(challenge.signupId);
      setChallenge(result);
      setWait(result.resendAfterSeconds);
      toast.success("A new code is on its way");
    } catch (error) {
      toast.error(messageOf(error, "Could not send a new code"));
    }
  };

  return (
    <section className="auth-card" aria-labelledby="signup-title">
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
        <>
          <header className="auth-card-head">
            <h1 id="signup-title">Check your email</h1>
            <p>
              Enter the 6-digit code to create {form.companyName.trim() || "your company"}'s
              workspace.
            </p>
          </header>
          <div className="auth-otp-mail">
            <span className="auth-otp-mail-icon">
              <MailCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <strong>{challenge.email}</strong>
              <span>The code expires in 10 minutes. Check spam if you don't see it.</span>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <div className="auth-otp">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  const digits = value.replace(/\D/g, "");
                  setOtp(digits);
                  if (digits.length === 6) void confirm(digits);
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
            <button type="button" className="auth-link-button" onClick={() => setChallenge(null)}>
              <ArrowLeft className="mr-1 inline size-3.5" aria-hidden />
              Change details
            </button>
            <button
              type="button"
              className="auth-link-button"
              onClick={() => void resend()}
              disabled={wait > 0}
            >
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
          </div>
        </>
      ) : (
        <>
          <header className="auth-card-head">
            <h1 id="signup-title">Create your company account</h1>
            <p>You become the company admin. Explore right away; cases open after approval.</p>
          </header>
          <form className="auth-form" onSubmit={(event) => void submitDetails(event)}>
            <div className="auth-field">
              <Label htmlFor="signup-company">Company name</Label>
              <Input
                id="signup-company"
                autoComplete="organization"
                placeholder="Acme Technologies Pvt Ltd"
                value={form.companyName}
                onChange={set("companyName")}
                minLength={2}
                maxLength={180}
                required
              />
            </div>
            <div className="auth-form-row">
              <div className="auth-field">
                <Label htmlFor="signup-name">Your full name</Label>
                <Input
                  id="signup-name"
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
                <Label htmlFor="signup-phone">
                  Mobile <small>(optional)</small>
                </Label>
                <Input
                  id="signup-phone"
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
              <Label htmlFor="signup-email">Work email</Label>
              <Input
                id="signup-email"
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
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className="pr-11"
                  value={form.password}
                  onChange={set("password")}
                  maxLength={128}
                  required
                  aria-describedby="signup-password-rules"
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
              <div className="auth-rules" id="signup-password-rules">
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
                aria-label="I accept the terms"
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
              <MailCheck className="size-4" aria-hidden />
              Continue — email me a code
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
