import { COMPANY_FOOTER } from "../company-details";

/**
 * Branded transactional emails sent through the company SMTP server: the Sapling Global
 * logo on top, one clear card, and the company footer of the report (name, registered
 * office, CIN, email, web). Every template also has a plain-text part with the footer.
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
  | "client-mis"
  | "password-reset";

export type RenderedEmail = { subject: string; text: string; html: string };

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Content id of the logo; the mailer attaches the PNG inline under this id. */
export const EMAIL_LOGO_CID = "sapling-global-logo";

const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SIDES = "border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0";

const TONES = {
  action: { border: "#f59e0b", background: "#fffbeb", text: "#78350f" },
  success: { border: "#16a34a", background: "#f0fdf4", text: "#14532d" },
  info: { border: "#2563eb", background: "#eff6ff", text: "#1e3a8a" },
  alert: { border: "#dc2626", background: "#fef2f2", text: "#7f1d1d" },
} as const;

/** A highlighted box (the reason for an upload, an alert); `html` is already escaped. */
const callout = (html: string, tone: keyof typeof TONES = "info") => {
  const colours = TONES[tone];
  return `<div style="margin:6px 0 18px;padding:14px 16px;border-left:4px solid ${colours.border};background:${colours.background};border-radius:8px;font-size:14px;line-height:1.6;color:${colours.text}">${html}</div>`;
};

/** Company footer, as printed at the bottom of every report page. */
const FOOTER_TEXT = [
  "--",
  COMPANY_FOOTER.name,
  `Registered Office: ${COMPANY_FOOTER.office}`,
  `CIN: ${COMPANY_FOOTER.cin}`,
  `${COMPANY_FOOTER.email} | ${COMPANY_FOOTER.web}`,
  "This is an automated message from the Sapling Global verification portal; please do not reply.",
].join("\n");

function layout(
  title: string,
  paragraphs: string[],
  action?: { label: string; url: string },
  eyebrow?: string,
) {
  const body = paragraphs
    .map((line) =>
      line.startsWith("<div")
        ? line
        : `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155">${line}</p>`,
    )
    .join("");
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="border-radius:8px;background:#1f7a4d"><a href="${escape(action.url)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escape(action.label)} &rarr;</a></td></tr></table>
<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#64748b">If the button does not work, copy this link into your browser:<br><a href="${escape(action.url)}" style="color:#1d4ed8;word-break:break-all">${escape(action.url)}</a></p>`
    : "";
  const label = eyebrow
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1f7a4d">${escape(eyebrow)}</p>`
    : "";
  const link = (href: string, text: string) =>
    `<a href="${href}" style="color:#1d4ed8;text-decoration:underline">${escape(text)}</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="height:5px;line-height:5px;font-size:0;background:#1f7a4d;background-image:linear-gradient(90deg,#1f7a4d,#00b0f0);border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:22px 32px;border-bottom:1px solid #edf2f7;${SIDES}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><img src="cid:${EMAIL_LOGO_CID}" alt="Sapling Global" width="140" height="32" style="display:block;border:0;outline:none;height:32px;width:auto"></td>
<td align="right" style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Background verification</td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;padding:30px 32px 8px;${SIDES}">${label}<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a">${escape(title)}</h1>${body}${button}</td></tr>
<tr><td style="background:#ffffff;padding:18px 32px 28px;border-bottom:1px solid #e2e8f0;border-radius:0 0 12px 12px;${SIDES}"><p style="margin:0;font-size:14px;line-height:1.6;color:#475569">Regards,<br><strong style="color:#0f172a">Team Sapling Global</strong></p></td></tr>
<tr><td align="center" style="padding:24px 20px 6px;font-size:12px;line-height:1.75;color:#475569">
<div style="font-size:14px;font-weight:700;color:#00b0f0">${escape(COMPANY_FOOTER.name)}</div>
<div><strong style="color:#334155">Registered Office:</strong> ${escape(COMPANY_FOOTER.office)}</div>
<div>CIN: ${escape(COMPANY_FOOTER.cin)}</div>
<div><strong style="color:#334155">email-</strong>${link(`mailto:${COMPANY_FOOTER.email}`, COMPANY_FOOTER.email)} &nbsp;|&nbsp; <strong style="color:#334155">web:</strong> ${link(`https://${COMPANY_FOOTER.web}`, COMPANY_FOOTER.web)}</div>
<div style="margin-top:12px;font-size:11px;color:#94a3b8">This is an automated message from the Sapling Global verification portal. Please do not reply to this email.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

const code = (value: string) =>
  `<div style="margin:6px 0 18px"><span style="display:inline-block;font-family:Consolas,Menlo,monospace;font-size:28px;letter-spacing:8px;font-weight:700;color:#0f172a;background:#f1f5f9;border:1px dashed #94a3b8;border-radius:10px;padding:12px 20px">${escape(value)}</span></div>`;

const minutesLeft = (expiresAt: string) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60_000)) : 10;
};

export function renderEmail(
  template: EmailTemplate,
  variables: Record<string, unknown>,
): RenderedEmail {
  const email = renderBody(template, variables);
  return { ...email, text: `${email.text}\n\n${FOOTER_TEXT}` };
}

function renderBody(
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
        html: layout(
          "Confirm your email",
          [
            `Hello ${escape(v("name"))},`,
            `Use this code to finish creating the <strong>${escape(v("companyName"))}</strong> workspace:`,
            code(v("otp")),
            `The code expires in ${minutes} minutes. If you did not sign up, you can ignore this email.`,
          ],
          undefined,
          "Security code",
        ),
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
          "Security code",
        ),
      };
    }
    case "password-reset":
      return {
        subject: "Your Sapling Global password was reset",
        text: `Hello ${v("name")},\n\nYour password was reset by ${v("resetBy") || "your administrator"}.\nTemporary password: ${v("temporaryPassword")}\nSign in: ${v("signInUrl")}\n\nYou will be asked to set your own password when you sign in. If you did not expect this, tell your administrator.`,
        html: layout(
          "Your password was reset",
          [
            `Hello ${escape(v("name"))},`,
            `Your password was reset by ${escape(v("resetBy") || "your administrator")}. Sign in with this temporary password:`,
            `<div style="margin:6px 0 18px"><span style="display:inline-block;font-family:Consolas,Menlo,monospace;font-size:18px;font-weight:700;color:#0f172a;background:#f1f5f9;border:1px dashed #94a3b8;border-radius:10px;padding:10px 16px">${escape(v("temporaryPassword"))}</span></div>`,
            "You will be asked to set your own password as soon as you sign in. If you did not expect this, tell your administrator.",
          ],
          { label: "Sign in", url: v("signInUrl") },
          "Account security",
        ),
      };
    case "candidate-access":
      // With a reason, the team needs something again: this is a fresh link.
      return v("reason")
        ? {
            subject: "Please upload a document again",
            text: `Please upload again — ${v("reason").replace(/\.+$/, "")}. Use this new secure link: ${v("portalUrl")}`,
            html: layout(
              "Please upload a document again",
              [
                "The verification team needs one more thing from you:",
                callout(`<strong>${escape(v("reason"))}</strong>`, "action"),
                "Use this new secure link. Your consent is already recorded, so you only need to upload. Do not forward this email.",
              ],
              { label: "Upload now", url: v("portalUrl") },
              "Action needed",
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
              "Background verification",
            ),
          };
    case "onboarding-activated":
      return {
        subject: `${v("companyName") || "Your company"} is now active on Sapling Global`,
        text: `Your onboarding is approved. You can now create verification cases: ${v("url") || ""}`,
        html: layout(
          "Your workspace is active",
          [
            callout(
              `Onboarding for <strong>${escape(v("companyName"))}</strong> is approved.`,
              "success",
            ),
            "You can now create verification cases and invite candidates.",
          ],
          v("url")
            ? { label: "Open your workspace", url: v("url") }
            : undefined,
          "Welcome",
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
            callout(
              `<strong>${escape(v("subject"))}</strong><br>${escape(v("message"))}`,
              "action",
            ),
            "The candidate has been sent a secure link to upload it. You can also respond from your portal.",
          ],
          { label: "Open your portal", url: v("url") },
          "Action needed",
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
            callout(
              `Case <strong>${escape(v("caseNumber"))}</strong> has been ${escape(v("stage"))} for <strong>${escape(v("hours"))} working hours</strong>.`,
              "alert",
            ),
            hod
              ? "This alert goes to the head of department after 8 working hours."
              : "Please act now or update the case. This alert goes out after 6 working hours.",
          ],
          { label: "Open the case", url: v("url") },
          hod ? "Escalation" : "Delay alert",
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
            callout(
              `Sapling ID: <strong>${escape(v("caseNumber"))}</strong>${code ? ` · Employee code: <strong>${escape(code)}</strong>` : ""}`,
              "success",
            ),
            "Sign in to your portal to download it. The download link expires after the agreed period.",
          ],
          { label: "Download the report", url: v("url") },
          "Report ready",
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
          "Scheduled report",
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
          "Onboarding",
        ),
      };
  }
}
