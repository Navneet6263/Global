import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { login } from "@/lib/api/auth";
import { homeForSession } from "@/lib/auth/workspace-access";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Sapling Global" }] }),
  component: LoginPage,
});

function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  useEffect(() => setHydrated(true), []);
  const mutation = useMutation({
    mutationFn: (credentials: typeof form) => login({ tenantCode: "SAPLING", ...credentials }),
    onSuccess: (result) => {
      queryClient.setQueryData(["session"], result.session);
      const target = result.session.mustChangePassword
        ? "/change-password"
        : homeForSession(result.session);
      void navigate({ to: target, replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#eef0f2] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#111214] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-12 h-[24rem] w-[24rem] rounded-full bg-[#a8ef39]/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#111214]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold">Sapling Global</p>
            <p className="text-xs text-white/55">Verification intelligence</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <span className="inline-flex rounded-full bg-[#a8ef39] px-3 py-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[#111214]">
            Consent-first operations
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-.04em]">
            Every verification, defensible from day one.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
            Coordinate consent, evidence, field visits, QA and tamper-checkable reports from one
            secure workspace.
          </p>
        </div>
        <p className="relative text-xs text-white/60">
          Protected by tenant isolation, least privilege and immutable audit events.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111214] text-[#a8ef39]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="font-semibold text-[#111214]">Sapling Global</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#5f646c]">
            Secure workspace
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] text-[#111214]">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-[#5f646c]">Sign in using your work email and password.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field id="work-email" label="Work email">
              <input
                id="work-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                placeholder="you@company.com"
                disabled={!hydrated}
                required
              />
            </Field>
            <Field id="password" label="Password">
              <span className="relative block">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="current-password"
                  className="pr-12"
                  disabled={!hydrated}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={!hydrated}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-xl text-[#777c84] hover:bg-black/5"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </Field>
            {mutation.isError && (
              <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {mutation.error.message}
              </div>
            )}
            <button
              type="submit"
              disabled={!hydrated || mutation.isPending}
              aria-busy={mutation.isPending}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111214] text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
            >
              {mutation.isPending ? "Signing in…" : "Enter workspace"}
              {!mutation.isPending && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#646a72]">
            <LockKeyhole className="h-3.5 w-3.5" /> HttpOnly session · encrypted transport
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="block text-xs font-medium text-[#4f545b]">
      <label htmlFor={id} className="mb-2 block">
        {label}
      </label>
      <span className="block [&_input]:h-12 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-black/10 [&_input]:bg-white [&_input]:px-4 [&_input]:text-base [&_input]:text-[#111214] [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-[#a1a5ab] [&_input]:focus:border-black/25 [&_input]:focus:ring-4 [&_input]:focus:ring-black/5 sm:[&_input]:text-sm">
        {children}
      </span>
    </div>
  );
}
