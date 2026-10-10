import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { SaplingLogo } from "@/components/brand/sapling-logo";
import { GlassDashboard } from "@/features/public-site/GlassDashboard";

const SIGNUP_STEPS = ["Your account", "Verify email", "Onboarding", "Go live"];

const YEAR = new Date().getFullYear();

/**
 * Split-screen sign-in / sign-up: a clean form column and a product showcase with a glass
 * illustration of the portal. The showcase is hidden on small screens.
 */
export function AuthLayout({ children, step }: { children: ReactNode; step?: number }) {
  const signup = step !== undefined;
  return (
    <div className="auth-split">
      <div className="auth-split-form">
        <header className="auth-split-top">
          <Link to="/" aria-label="Sapling Global home">
            <SaplingLogo width={150} />
          </Link>
          <Link to="/" className="auth-back">
            <ArrowLeft aria-hidden /> Home
          </Link>
        </header>
        <main className="auth-split-main">{children}</main>
        <footer className="auth-split-foot">
          <span>© {YEAR} Sapling Global</span>
          <nav aria-label="Footer">
            <a href="/#security">Security</a>
            <a href="/#faq">Help</a>
            {signup ? <Link to="/auth">Sign in</Link> : <Link to="/signup">Create account</Link>}
          </nav>
        </footer>
      </div>

      <aside className="auth-showcase" aria-label="Sapling Global">
        <img className="auth-showcase-art" src="/landing/globe-dots.svg" alt="" />
        <div className="auth-showcase-copy">
          <span className="auth-eyebrow">
            <i aria-hidden />
            {signup ? "Company sign-up" : "Background verification platform"}
          </span>
          <h2 className="auth-headline">
            {signup ? (
              <>
                Start verifying <em>in days</em>, not weeks.
              </>
            ) : (
              <>
                Hiring decisions, <em>verified</em> with confidence.
              </>
            )}
          </h2>
          {signup ? (
            <ol className="auth-step-row" aria-label="Sign-up steps">
              {SIGNUP_STEPS.map((label, index) => (
                <li
                  key={label}
                  className={index < step ? "is-done" : index === step ? "is-current" : ""}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span>{index < step ? <Check aria-hidden /> : index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          ) : (
            <p className="auth-lede">
              Employment, education, address and identity checks — tracked live from intake to the
              final report, with a dedicated RM for your company.
            </p>
          )}
        </div>
        <div className="auth-showcase-shot">
          <GlassDashboard
            variant={signup ? "onboarding" : "operations"}
            label={
              signup
                ? "Guided onboarding checklist (illustration)"
                : "Operations dashboard (illustration)"
            }
            className="mx-6 mb-4"
          />
        </div>
        <div className="auth-trust">
          <span>
            <ShieldCheck aria-hidden /> Every action audited
          </span>
          <span>
            <LockKeyhole aria-hidden /> Encrypted candidate data
          </span>
          <span>
            <Check aria-hidden /> Consent-first checks
          </span>
        </div>
      </aside>
    </div>
  );
}
