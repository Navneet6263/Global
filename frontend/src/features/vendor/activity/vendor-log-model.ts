/** One Vendor Logs row, exactly as the server allowlists it (no audit JSON, IPs or keys). */
export interface VendorLogItem {
  id: string;
  action: string;
  createdAt: string;
  actorName: string;
  /** True when the Main Vendor or one of its team users did it; false for SPOC-RM/Admin. */
  byVendorTeam: boolean;
  request: { id: string; caseNumber: string | null; documentType: string | null } | null;
  teamUser: string | null;
}

export interface VendorLogPage {
  items: VendorLogItem[];
  nextCursor: string | null;
}

export type VendorLogTone = "mint" | "amber" | "rose" | "blue" | "violet" | "neutral";

const LABELS: Record<string, { label: string; tone: VendorLogTone }> = {
  "vendor_assignment.assigned": { label: "Request received", tone: "blue" },
  "vendor_assignment.reassigned": { label: "Request received again", tone: "blue" },
  "vendor_assignment.delegated": { label: "Handler changed", tone: "violet" },
  "vendor_assignment.reminded": { label: "Reminder sent", tone: "amber" },
  "vendor_assignment.approved": { label: "Approved", tone: "mint" },
  "vendor_assignment.rejected": { label: "Rejected", tone: "rose" },
  "vendor_assignment.report-uploaded": { label: "Report uploaded", tone: "mint" },
  "vendor_assignment.report-previewed": { label: "Report previewed", tone: "neutral" },
  "vendor_assignment.report-downloaded": { label: "Report downloaded", tone: "neutral" },
  "document.previewed": { label: "Document previewed", tone: "neutral" },
  "document.reupload-requested": {
    label: "Sent back to the candidate for re-upload",
    tone: "amber",
  },
  "user.created": { label: "Team user created", tone: "blue" },
  "user.updated": { label: "Team user status changed", tone: "violet" },
  "user.password.reset": { label: "Team user password reset", tone: "violet" },
};

/**
 * What a row says. A report download is only "received" when SPOC-RM downloads it:
 * the upload itself logs "Report uploaded" and only notifies SPOC-RM.
 */
export function vendorLogLabel(item: Pick<VendorLogItem, "action" | "byVendorTeam">) {
  if (item.action === "vendor_assignment.report-downloaded" && !item.byVendorTeam)
    return { label: "Report downloaded by SPOC-RM", tone: "mint" as VendorLogTone };
  return (
    LABELS[item.action] ?? {
      label: item.action
        .replace(/^[a-z_]+\./, "")
        .replace(/[._-]+/g, " ")
        .replace(/^\w/, (letter) => letter.toUpperCase()),
      tone: "neutral" as VendorLogTone,
    }
  );
}
