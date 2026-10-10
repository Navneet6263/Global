import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Briefcase,
  Building2,
  ChartNoAxesCombined,
  CircleCheck,
  ClipboardCheck,
  FileCheck2,
  Fingerprint,
  Gavel,
  GraduationCap,
  House,
  IdCard,
  KeyRound,
  LockKeyhole,
  MessagesSquare,
  Plus,
  Rocket,
  ScanSearch,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { GlassDashboard } from "./GlassDashboard";
import { ProductPreview } from "./ProductPreview";
import { ProductTour } from "./ProductTour";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

const SERVICES = [
  {
    icon: Briefcase,
    title: "Employment verification",
    copy: "Tenure, designation and exit details confirmed with past employers, with written or verbal proof.",
  },
  {
    icon: GraduationCap,
    title: "Education verification",
    copy: "Degrees and marks confirmed with universities and boards, including the original certificate trail.",
  },
  {
    icon: House,
    title: "Address verification",
    copy: "Current and permanent address checks, digitally or by field visit, with evidence on record.",
  },
  {
    icon: IdCard,
    title: "Identity & KYC",
    copy: "Government ID documents reviewed for authenticity and consistency with the candidate profile.",
  },
  {
    icon: Gavel,
    title: "Criminal & court records",
    copy: "Court and police record searches to surface material risks before an offer is final.",
  },
  {
    icon: UsersRound,
    title: "Reference checks",
    copy: "Structured conversations with referees, summarised so hiring managers can act quickly.",
  },
];
const MORE = [
  "Global database",
  "Adverse media",
  "Drug test",
  "Resume consistency",
  "Conflict of interest",
  "Anti-bribery",
  "Misconduct",
];

const STEPS = [
  {
    title: "Create your account",
    copy: "Register your company in minutes and verify your email.",
  },
  {
    title: "Complete onboarding",
    copy: "Upload KYC and agreements. Your dedicated RM guides you.",
  },
  {
    title: "Start verifications",
    copy: "Add candidates one by one or in bulk. They consent and upload securely.",
  },
  {
    title: "Get clear reports",
    copy: "Track every check live and download clear final reports.",
  },
];

const FEATURES = [
  {
    icon: Workflow,
    title: "One clear flow",
    copy: "RM → Data Entry → specialist teams → QC → final approval. Everyone sees exactly where a case is.",
  },
  {
    icon: BellRing,
    title: "Working-hour SLA alerts",
    copy: "Red alerts at 6 working hours and escalation at 8, so nothing waits silently.",
  },
  {
    icon: FileCheck2,
    title: "A clear outcome for every check",
    copy: "Clear, minor or major discrepancy, verbal or unable to verify — rolled up to the case and the final PDF.",
  },
  {
    icon: UserRoundCheck,
    title: "Candidate self-service",
    copy: "Candidates give consent with a one-time code and upload documents from any phone.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Dashboards & Excel MIS",
    copy: "Live dashboards plus custom Excel and CSV exports, column by column.",
  },
  {
    icon: MessagesSquare,
    title: "Dedicated RM",
    copy: "A named relationship manager for your company, from onboarding to every escalation.",
  },
];

const FAQ = [
  {
    q: "How do we get started?",
    a: "Create a company account, verify your email and complete the onboarding checklist — company details, agreements and KYC documents. Our Operations team reviews them and activates your workspace; then you can start verifications.",
  },
  {
    q: "Can we use the portal before approval?",
    a: "Yes. You can sign in straight away, fill in details, upload documents and talk to your RM. Creating verification cases opens once your company is approved.",
  },
  {
    q: "How do candidates take part?",
    a: "Each candidate receives a secure link. They give consent with a one-time code and upload their documents. Nothing is verified without consent.",
  },
  {
    q: "What does a report contain?",
    a: "Every check with its result, the overall case outcome and the verification trail. Reports are released as a PDF that can be authenticity-checked.",
  },
  {
    q: "Who can see our data?",
    a: "Only your company's users and the Sapling team members working on your cases. Access is role-based, and every view, change and download is recorded.",
  },
];

/** Public landing page at "/" for signed-out visitors. */
export function LandingPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="site-hero" aria-labelledby="hero-title">
          <img className="site-art is-backdrop" src="/landing/hero-backdrop.svg" alt="" />
          <div className="site-wrap site-hero-grid">
            <div>
              <span className="site-eyebrow">
                <b>New</b> Self sign-up for companies is now open
              </span>
              <h1 id="hero-title" className="site-h1">
                Hire with confidence.{" "}
                <span className="site-gradient-text">Verify every candidate.</span>
              </h1>
              <p className="site-lede">
                Sapling Global runs employment, education, address, identity and court checks from
                one secure portal — with live SLA tracking, a dedicated RM and clear final reports
                your team can act on.
              </p>
              <div className="site-cta-row">
                <Link to="/signup" className="site-btn is-primary is-lg">
                  Create company account <ArrowRight aria-hidden />
                </Link>
                <Link to="/auth" className="site-btn is-outline is-lg">
                  Sign in
                </Link>
              </div>
              <div className="site-ticks">
                <span>
                  <CircleCheck aria-hidden /> Consent-first
                </span>
                <span>
                  <CircleCheck aria-hidden /> Dedicated RM
                </span>
                <span>
                  <CircleCheck aria-hidden /> Every action audited
                </span>
              </div>
            </div>
            <div className="site-preview is-shot">
              <img className="site-art is-globe" src="/landing/globe-dots.svg" alt="" />
              <GlassDashboard
                variant="operations"
                label="Sapling Global operations dashboard (illustration)"
                className="hero-frame"
              />
              <div className="hero-card">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        <section className="site-strip" aria-label="Platform at a glance">
          <div className="site-wrap site-strip-grid">
            <div>
              <strong className="site-gradient-text">13+</strong>
              <span>check types</span>
            </div>
            <div>
              <strong className="site-gradient-text">6</strong>
              <span>clear outcome types</span>
            </div>
            <div>
              <strong className="site-gradient-text">6h</strong>
              <span>working-hour SLA alerts</span>
            </div>
            <div>
              <strong className="site-gradient-text">100%</strong>
              <span>actions audit-logged</span>
            </div>
          </div>
        </section>

        <section id="tour" className="site-section" aria-labelledby="tour-title">
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">Product tour</span>
              <h2 id="tour-title" className="site-h2">
                See the portal your team will use
              </h2>
              <p>A look at the portal your team will use, shown with sample data.</p>
            </div>
            <ProductTour />
          </div>
        </section>

        <section id="services" className="site-section" aria-labelledby="services-title">
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">Services</span>
              <h2 id="services-title" className="site-h2">
                Every check your hiring needs
              </h2>
              <p>Pick a package or combine checks per role. Each one is tracked separately.</p>
            </div>
            <div className="site-services">
              {SERVICES.map((service) => (
                <article key={service.title} className="site-service">
                  <span className="site-service-icon">
                    <service.icon aria-hidden />
                  </span>
                  <h3>{service.title}</h3>
                  <p>{service.copy}</p>
                </article>
              ))}
            </div>
            <div className="site-more" aria-label="More checks">
              {MORE.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="site-section is-tint" aria-labelledby="how-title">
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">How it works</span>
              <h2 id="how-title" className="site-h2">
                From sign-up to first report
              </h2>
              <p>Four simple steps. Your RM is with you the whole way.</p>
            </div>
            <ol className="site-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="site-step">
                  <span className="site-step-num">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="platform" className="site-section site-dark" aria-labelledby="platform-title">
          <img className="site-art is-globe" src="/landing/globe-dots.svg" alt="" />
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">Platform</span>
              <h2 id="platform-title" className="site-h2">
                Built for speed, clarity and control
              </h2>
              <p>The same workflow your verification team uses — visible to you in real time.</p>
            </div>
            <div className="site-features">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="site-feature">
                  <span className="site-feature-icon">
                    <feature.icon aria-hidden />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="roles-title">
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">Made for every team</span>
              <h2 id="roles-title" className="site-h2">
                One portal, the right view for each person
              </h2>
            </div>
            <div className="site-roles">
              <article className="site-role">
                <span className="site-role-tag" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                  <Building2 aria-hidden /> HR & hiring teams
                </span>
                <h3>Start and track checks</h3>
                <ul>
                  <li>
                    <BadgeCheck aria-hidden /> Bulk upload candidates in one go
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Know what needs your action, today
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Download reports and invoices
                  </li>
                </ul>
              </article>
              <article className="site-role">
                <span className="site-role-tag" style={{ background: "#ecfdf5", color: "#15803d" }}>
                  <UserRoundCheck aria-hidden /> Candidates
                </span>
                <h3>Simple, secure and mobile</h3>
                <ul>
                  <li>
                    <BadgeCheck aria-hidden /> Consent with a one-time code
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Upload documents from any phone
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Answer queries in one place
                  </li>
                </ul>
              </article>
              <article className="site-role">
                <span className="site-role-tag" style={{ background: "#f5f3ff", color: "#6d28d9" }}>
                  <ClipboardCheck aria-hidden /> Verification team
                </span>
                <h3>Fast, controlled delivery</h3>
                <ul>
                  <li>
                    <BadgeCheck aria-hidden /> RM, Data Entry, teams and QC in one flow
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Live SLA and escalation alerts
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /> Final approval before every release
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="security" className="site-section is-tint" aria-labelledby="security-title">
          <div className="site-wrap site-split">
            <div className="site-illustration">
              <img src="/landing/verify-illustration.svg" alt="" />
            </div>
            <div>
              <span className="site-kicker">Security & privacy</span>
              <h2 id="security-title" className="site-h2">
                Candidate data, protected at every step
              </h2>
              <p className="site-lede">
                Verification handles sensitive personal data. The platform is designed so only the
                right people see it — and every access leaves a trace.
              </p>
              <div className="site-security-list mt-6">
                <div className="site-security-item">
                  <span className="site-service-icon">
                    <LockKeyhole aria-hidden />
                  </span>
                  <div>
                    <strong>Encrypted personal data</strong>
                    <span>
                      Candidate contact details and documents are stored encrypted and privately.
                    </span>
                  </div>
                </div>
                <div className="site-security-item">
                  <span className="site-service-icon">
                    <KeyRound aria-hidden />
                  </span>
                  <div>
                    <strong>Role-based access</strong>
                    <span>
                      Each person sees only their own work; your data never mixes with another
                      company's.
                    </span>
                  </div>
                </div>
                <div className="site-security-item">
                  <span className="site-service-icon">
                    <Fingerprint aria-hidden />
                  </span>
                  <div>
                    <strong>Consent and full audit trail</strong>
                    <span>
                      No check starts without consent, and every view, change and download is
                      logged.
                    </span>
                  </div>
                </div>
                <div className="site-security-item">
                  <span className="site-service-icon">
                    <ScanSearch aria-hidden />
                  </span>
                  <div>
                    <strong>Verifiable reports</strong>
                    <span>
                      Released reports carry an authenticity code anyone can check online.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="site-section" aria-labelledby="faq-title">
          <div className="site-wrap">
            <div className="site-section-head">
              <span className="site-kicker">FAQ</span>
              <h2 id="faq-title" className="site-h2">
                Questions, answered
              </h2>
            </div>
            <div className="site-faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <Plus aria-hidden />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20" aria-labelledby="cta-title">
          <div className="site-wrap">
            <div className="site-cta">
              <ShieldCheck className="mx-auto mb-3 size-9 text-emerald-200" aria-hidden />
              <h2 id="cta-title">Ready to verify with confidence?</h2>
              <p>
                Create your company account today. Explore the portal right away — your RM helps you
                go live.
              </p>
              <div className="site-cta-row">
                <Link to="/signup" className="site-btn is-light is-lg">
                  <Rocket aria-hidden /> Create company account
                </Link>
                <Link to="/auth" className="site-btn is-outline is-lg">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
