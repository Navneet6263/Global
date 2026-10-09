import { BellRing, Briefcase, FileCheck2, GraduationCap, House, IdCard } from "lucide-react";

const CHECKS = [
  { icon: Briefcase, label: "Employment", chip: "Clear", tone: "is-green" },
  { icon: GraduationCap, label: "Education", chip: "Verified verbally", tone: "is-blue" },
  { icon: House, label: "Address", chip: "In progress", tone: "is-progress" },
  { icon: IdCard, label: "Identity", chip: "Minor discrepancy", tone: "is-yellow" },
];
const STEPS = ["Intake", "Docs", "Verify", "QC", "Report"];

/** Illustrative case card (sample data) for the landing hero and sign-in panel. */
export function ProductPreview({ floating = true }: { floating?: boolean }) {
  return (
    <div className="preview-card" aria-hidden>
      <span className="preview-sample">Sample case</span>
      <div className="preview-top">
        <span className="preview-avatar">AR</span>
        <div className="min-w-0">
          <strong>Ananya Rao</strong>
          <small>SG-20261006-4F2A · Senior Analyst</small>
        </div>
        <span className="preview-badge">Verification</span>
      </div>
      <div className="preview-steps">
        {STEPS.map((step, index) => (
          <i key={step} className={index < 2 ? "is-done" : index === 2 ? "is-now" : ""} />
        ))}
      </div>
      <div className="preview-step-labels">
        {STEPS.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
      <div className="preview-checks">
        {CHECKS.map((check) => (
          <div key={check.label} className="preview-check">
            <span className="preview-check-icon">
              <check.icon />
            </span>
            <strong>{check.label}</strong>
            <span className={`preview-chip ${check.tone}`}>
              <i />
              {check.chip}
            </span>
          </div>
        ))}
      </div>
      <div className="preview-foot">
        <span>
          RM <b>Arjun Nair</b>
        </span>
        <span>
          Due in <b>2 days</b>
        </span>
      </div>
      {floating ? (
        <>
          <div className="preview-float is-report">
            <span className="preview-float-icon">
              <FileCheck2 />
            </span>
            <div>
              <strong>Report released</strong>
              <small>Final PDF ready</small>
            </div>
          </div>
          <div className="preview-float is-alert">
            <span className="preview-float-icon">
              <BellRing />
            </span>
            <div>
              <strong>6h working-hour alert</strong>
              <small>Sent to RM & Operations</small>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
