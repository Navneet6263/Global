import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { SaplingLogo } from "@/components/brand/sapling-logo";
import { GlassDashboard } from "@/features/public-site/GlassDashboard";
import { QueuePreview } from "@/features/public-site/VendorSection";

const SIGNUP_STEPS = ["Your account", "Verify email", "Onboarding", "Go live"];
const VENDOR_STEPS = ["Your account", "Verify email", "Business document", "Pick work"];

const YEAR = new Date().getFullYear();

/**
 * Split-screen sign-in / sign-up: a clean form column and a product showcase with a glass
 * illustration of the portal. The showcase is hidden on small screens.
 */
export function AuthLayout({
  children,
  step,
  audience = "company",
}: {
  children: ReactNode;
  step?: number;
  /** Vendor sign-up shows the vendor journey instead of the company one. */
  audience?: "company" | "vendor";
}) {
  const signup = step !== undefined;
  const vendor = audience === "vendor";
  const steps = vendor ? VENDOR_STEPS : SIGNUP_STEPS;
  return (
    // Sign-in fits one screen (no scroll); sign-up keeps its longer form scrollable.
    <div className={signup ? "auth-split" : "auth-split is-fit"}>
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
            {signup ? <Link to="/auth">Sign in</Link> : <Link to="/signup">Sign up</Link>}
          </nav>
        </footer>
      </div>

      <aside className="auth-showcase" aria-label="Sapling Global">
        <img className="auth-showcase-art" src="/landing/globe-dots.svg" alt="" />
        <div className="auth-showcase-copy">
          <span className="auth-eyebrow">
            <i aria-hidden />
            {signup
              ? vendor
                ? "Vendor sign-up"
                : "Company sign-up"
              : "Background verification platform"}
          </span>
          <h2 className="auth-headline">
            {signup && vendor ? (
              <>
                Verification work near you, <em>paid per check</em>.
              </>
            ) : signup ? (
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
              {steps.map((label, index) => (
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
          {vendor ? (
            <QueuePreview className="mb-4 w-[min(30rem,calc(100%-3rem))] text-left" />
          ) : (
            <GlassDashboard
              variant={signup ? "onboarding" : "operations"}
              label={
                signup
                  ? "Guided onboarding checklist (illustration)"
                  : "Operations dashboard (illustration)"
              }
              className="mx-6 mb-4"
            />
          )}
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
