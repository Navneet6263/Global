import { Link } from "@tanstack/react-router";
import { FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { SaplingLogo } from "@/components/brand/sapling-logo";

const YEAR = new Date().getFullYear();

/** Full footer on the landing page; `compact` on sign-in and sign-up. */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <footer className="site-footer is-compact">
        <div className="site-wrap site-footer-bottom">
          <span>© {YEAR} Sapling Global. All rights reserved.</span>
          <nav aria-label="Footer">
            <Link to="/">Home</Link>
            <a href="/#services">Services</a>
            <a href="/#security">Security</a>
            <a href="/#faq">FAQ</a>
          </nav>
        </div>
      </footer>
    );
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-grid">
        <div>
          <SaplingLogo width={156} />
          <p>
            Background verification for growing teams — employment, education, address, identity and
            more, tracked end to end in one secure portal.
          </p>
          <div className="site-footer-badges">
            <span>
              <ShieldCheck aria-hidden /> Audit trail on every action
            </span>
            <span>
              <LockKeyhole aria-hidden /> Encrypted candidate data
            </span>
            <span>
              <FileCheck2 aria-hidden /> Consent-first checks
            </span>
          </div>
        </div>
        <div>
          <h4>Services</h4>
          <ul>
            <li>
              <a href="/#services">Employment verification</a>
            </li>
            <li>
              <a href="/#services">Education verification</a>
            </li>
            <li>
              <a href="/#services">Address verification</a>
            </li>
            <li>
              <a href="/#services">Identity & criminal checks</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Platform</h4>
          <ul>
            <li>
              <a href="/#how-it-works">How it works</a>
            </li>
            <li>
              <a href="/#platform">Live SLA & reports</a>
            </li>
            <li>
              <a href="/#security">Security & privacy</a>
            </li>
            <li>
              <a href="/#faq">FAQ</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Get started</h4>
          <ul>
            <li>
              <Link to="/signup">Create a company account</Link>
            </li>
            <li>
              <Link to="/auth">Sign in</Link>
            </li>
            <li>
              <a href="/#faq">Talk to your RM</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-wrap site-footer-bottom">
        <span>© {YEAR} Sapling Global. All rights reserved.</span>
        <nav aria-label="Footer">
          <a href="/#security">Privacy & data protection</a>
          <a href="/#faq">FAQ</a>
          <Link to="/auth">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
