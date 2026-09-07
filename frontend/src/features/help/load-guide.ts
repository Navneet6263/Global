import type { HelpWorkspace, PageGuide } from "./help-types";

export async function loadPageGuide(
  workspace: HelpWorkspace,
  path: string,
  title: string,
  purpose: string,
): Promise<PageGuide> {
  const catalogue =
    workspace === "candidate"
      ? (await import("./catalogues/public")).default
      : workspace === "platform-admin"
        ? (await import("./catalogues/admin")).default
        : ["operations", "verifier", "qa-reviewer", "field-executive"].includes(workspace)
          ? (await import("./catalogues/delivery")).default
          : (await import("./catalogues/stakeholders")).default;
  const pages: Record<string, PageGuide> = catalogue;
  if (workspace === "candidate")
    return pages[
      path.startsWith("/consent")
        ? "consent"
        : path.startsWith("/clarification")
          ? "clarification"
          : path.startsWith("/reports/verify")
            ? "report"
            : "candidate"
    ]!;
  if (pages[path]) return pages[path]!;
  if (path.endsWith("/security") || path === "/change-password") {
    return {
      title: "Account security",
      purpose: "Manage your password, active sessions and recorded sign-in events.",
      steps: [
        "Review sessions and recent security events.",
        "Revoke a session you do not recognise.",
        "Change your password privately if you suspect exposure.",
      ],
      guardrail:
        "Signing out or revoking a session does not delete audit history. Never share passwords or OTPs through Help.",
      questions: [],
    };
  }
  return {
    title,
    purpose,
    steps: [
      "Check the current scope and filters.",
      "Select the relevant record to review its current details.",
      "Use only the actions available for your role; check the saved result before leaving.",
    ],
    guardrail:
      workspace === "platform-admin"
        ? "This is an oversight workspace. Use the appropriate employee role for delivery execution. Counts are not proof that an individual task has been completed."
        : "A hidden or disabled action may require a different role, ownership or prior workflow step. Do not bypass the prerequisite; review the record or contact your administrator.",
    questions: [],
  };
}
