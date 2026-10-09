/**
 * Plain, branded transactional emails sent through the company SMTP server.
 * Every template has a text part; HTML is a simple single-column layout.
 */
export type EmailTemplate =
  | "signup-otp"
  | "consent-otp"
  | "candidate-access"
  | "onboarding-update"
  | "onboarding-activated"
  | "insufficiency"
  | "stage-alert"
  | "report-released"
  | "source-verification"
  | "client-mis";

export type RenderedEmail = { subject: string; text: string; html: string };

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function layout(
  title: string,
  paragraphs: string[],
  action?: { label: string; url: string },
) {
  const body = paragraphs
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#1f2a24">${line}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escape(action.url)}" style="background:#1f7a4d;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">${escape(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f7f5;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e3ebe6">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eef3f0"><strong style="font-size:18px;color:#1f7a4d;letter-spacing:.02em">SAPLING</strong> <span style="font-size:13px;color:#3b6fd8">Global</span></td></tr>
<tr><td style="padding:26px 28px"><h1 style="margin:0 0 16px;font-size:20px;color:#14211a">${escape(title)}</h1>${body}${button}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eef3f0;font-size:12px;color:#6b7c72">Sapling Global background verification. This is an automated message; please do not reply.</td></tr>
</table></td></tr></table></body></html>`;
}

const code = (value: string) =>
  `<span style="display:inline-block;font-size:26px;letter-spacing:8px;font-weight:700;color:#14211a;background:#f0f6f2;border-radius:10px;padding:10px 16px">${escape(value)}</span>`;

const minutesLeft = (expiresAt: string) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60_000)) : 10;
};

export function renderEmail(
  template: EmailTemplate,
  variables: Record<string, unknown>,
): RenderedEmail {
  const v = (key: string) => {
    const value = variables[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  };
  switch (template) {
    case "signup-otp": {
      const minutes = minutesLeft(v("expiresAt"));
      return {
        subject: `${v("otp")} is your Sapling Global verification code`,
        text: `Hello ${v("name") || ""},\n\nYour code to create the ${v("companyName") || ""} workspace is ${v("otp")}. It expires in ${minutes} minutes.\n\nIf you did not sign up, ignore this email.`,
        html: layout("Confirm your email", [
          `Hello ${escape(v("name"))},`,
          `Use this code to finish creating the <strong>${escape(v("companyName"))}</strong> workspace:`,
          code(v("otp")),
          `The code expires in ${minutes} minutes. If you did not sign up, you can ignore this email.`,
        ]),
      };
    }
    case "consent-otp": {
      const minutes = minutesLeft(v("expiresAt"));
      return {
        subject: "Your background verification consent code",
        text: `Your consent code is ${v("otp")}. It expires in ${minutes} minutes.\n${v("consentUrl") ? `Open: ${v("consentUrl")}` : "Enter it on your verification page."}`,
        html: layout(
          "Confirm your consent",
          [
            "Use this one-time code to confirm your background verification consent:",
            code(v("otp")),
            `The code expires in ${minutes} minutes.`,
            ...(v("consentUrl")
              ? []
              : [
                  "Enter it on the verification page you have open. If you did not ask for this code, ignore this email.",
                ]),
          ],
          v("consentUrl")
            ? { label: "Open consent page", url: v("consentUrl") }
            : undefined,
        ),
      };
    }
    case "candidate-access":
      // With a reason, the team needs something again: this is a fresh link.
      return v("reason")
        ? {
            subject: "Please upload a document again",
            text: `Please upload again — ${v("reason")}. Use this new secure link: ${v("portalUrl")}`,
            html: layout(
              "Please upload a document again",
              [
                "The verification team needs one more thing from you:",
                `<strong>${escape(v("reason"))}</strong>`,
                "Use this new secure link. Your consent is already recorded, so you only need to upload. Do not forward this email.",
              ],
              { label: "Upload now", url: v("portalUrl") },
            ),
          }
        : {
            subject: "Complete your background verification",
            text: `Please open your secure link to share your details and documents: ${v("portalUrl") || ""}`,
            html: layout(
              "Complete your background verification",
              [
                "Your employer has started a background verification with Sapling Global.",
                "Open your secure link, confirm your consent with a one-time code, then upload the requested documents. Do not forward this email.",
              ],
              { label: "Open secure link", url: v("portalUrl") || "" },
            ),
          };
    case "onboarding-activated":
      return {
        subject: `${v("companyName") || "Your company"} is now active on Sapling Global`,
        text: `Your onboarding is approved. You can now create verification cases: ${v("url") || ""}`,
        html: layout(
          "Your workspace is active",
          [
            `Onboarding for <strong>${escape(v("companyName"))}</strong> is approved.`,
            "You can now create verification cases and invite candidates.",
          ],
          v("url")
            ? { label: "Open your workspace", url: v("url") }
            : undefined,
        ),
      };
    case "insufficiency": {
      const reminder = Number(v("reminder")) || 0;
      const title = reminder
        ? `Reminder: information still needed for ${v("caseNumber")}`
        : `Information needed for ${v("caseNumber")}`;
      return {
        subject: title,
        text: `${title}
${v("candidateName")}: ${v("subject")}
${v("message")}
Open: ${v("url")}`,
        html: layout(
          title,
          [
            `The verification of <strong>${escape(v("candidateName"))}</strong> is waiting for missing information (${v("level") === "L2" ? "L2 insufficiency, raised during verification" : "L1 insufficiency"}).`,
            `<strong>${escape(v("subject"))}</strong>`,
            escape(v("message")),
            "The candidate has been sent a secure link to upload it. You can also respond from your portal.",
          ],
          { label: "Open your portal", url: v("url") },
        ),
      };
    }
    case "stage-alert": {
      const hod = v("level") === "HOD";
      const title = hod
        ? `Escalation: ${v("caseNumber")} delayed ${v("hours")} working hours`
        : `Red alert: ${v("caseNumber")} delayed ${v("hours")} working hours`;
      return {
        subject: title,
        text: `${title}
The case has been ${v("stage")}.
Open: ${v("url")}`,
        html: layout(
          title,
          [
            `Case <strong>${escape(v("caseNumber"))}</strong> has been ${escape(v("stage"))} for <strong>${escape(v("hours"))} working hours</strong>.`,
            hod
              ? "This alert goes to the head of department after 8 working hours."
              : "Please act now or update the case. This alert goes out after 6 working hours.",
          ],
          { label: "Open the case", url: v("url") },
        ),
      };
    }
    case "report-released": {
      const code = v("employeeCode");
      const title = `Report Submitted for ${v("candidateName")}, ${v("caseNumber")}${code ? `, ${code}` : ""}`;
      return {
        subject: title,
        text: `${title}
The verification report is ready to download.
Open: ${v("url")}`,
        html: layout(
          "Verification report submitted",
          [
            `The verification report for <strong>${escape(v("candidateName"))}</strong> is ready.`,
            `Sapling ID: <strong>${escape(v("caseNumber"))}</strong>${code ? ` · Employee code: <strong>${escape(code)}</strong>` : ""}`,
            "Sign in to your portal to download it. The download link expires after the agreed period.",
          ],
          { label: "Download the report", url: v("url") },
        ),
      };
    }
    case "client-mis": {
      const title = `${v("title")} MIS (${v("frequency")}) — ${v("companyName")}`;
      return {
        subject: title,
        text: `${title}
${v("rows")} rows. The CSV is attached.
Open: ${v("url")}`,
        html: layout(
          title,
          [
            `Your scheduled <strong>${escape(v("title"))}</strong> report is attached as a CSV (${escape(v("rows"))} rows).`,
            "Colour codes follow the report: clear, minor or major discrepancy, unable to verify, verified verbally or client review.",
            "You can change or stop this schedule from Reports in your portal.",
          ],
          { label: "Open reports", url: v("url") },
        ),
      };
    }
    case "source-verification": {
      const body = v("body")
        .split(/\n{2,}/)
        .map((part) => escape(part).replaceAll("\n", "<br>"));
      return {
        subject: v("subject"),
        text: v("body"),
        html: layout(v("subject"), body),
      };
    }
    case "onboarding-update":
      return {
        subject: `Onboarding update for ${v("companyName") || "your company"}`,
        text: `${v("message") || ""}\n\nOpen: ${v("url") || ""}`,
        html: layout(
          "Onboarding update",
          [escape(v("message"))],
          v("url") ? { label: "Open onboarding", url: v("url") } : undefined,
        ),
      };
  }
}
