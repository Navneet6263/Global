import type { NavWorkspace } from "./navigation";

export interface WorkspacePresentation {
  label: string;
  heading: string;
  home: string;
  security: string;
  search?: { route: string; placeholder: string };
  quickCreate: boolean;
}

export const WORKSPACE_PRESENTATION: Record<NavWorkspace, WorkspacePresentation> = {
  "platform-admin": {
    label: "Platform Admin",
    heading: "Sapling Global — Verification Operations",
    home: "/admin",
    security: "/admin/security",
    search: { route: "/admin/cases", placeholder: "Search candidate, case number or client…" },
    quickCreate: true,
  },
  operations: {
    label: "Operations Manager",
    heading: "Sapling Global — Delivery Operations",
    home: "/operations",
    security: "/change-password",
    quickCreate: false,
  },
  "sales-crm": {
    label: "Sales & CRM",
    heading: "Sapling Global — Revenue Operations",
    home: "/sales-crm",
    security: "/change-password",
    quickCreate: false,
  },
  "client-admin": {
    label: "Client Admin",
    heading: "Sapling Global — Client Verification Portal",
    home: "/client-portal",
    search: {
      route: "/client-portal/verifications",
      placeholder: "Search candidate or case number",
    },
    security: "/change-password",
    quickCreate: false,
  },
  verifier: {
    label: "Verifier",
    heading: "Sapling Global — Verification Workbench",
    home: "/verifier",
    security: "/change-password",
    quickCreate: false,
  },
  "qa-reviewer": {
    label: "QA Reviewer",
    heading: "Sapling Global — Independent QA",
    home: "/qa-review",
    security: "/change-password",
    quickCreate: false,
  },
  "field-executive": {
    label: "Field Executive",
    heading: "Sapling Global — Field Verification",
    home: "/field-executive",
    security: "/change-password",
    quickCreate: false,
  },
  finance: {
    label: "Finance Manager",
    heading: "Sapling Global — Revenue Control",
    home: "/finance",
    security: "/change-password",
    quickCreate: false,
  },
  "data-entry": {
    label: "Data Entry",
    heading: "Sapling Global — Intake Review",
    home: "/data-entry",
    security: "/change-password",
    quickCreate: false,
  },
  "spoc-rm": {
    label: "RM / SPOC",
    heading: "Sapling Global — Client Delivery",
    home: "/spoc-rm",
    security: "/change-password",
    quickCreate: false,
  },
  vendor: {
    label: "Vendor",
    heading: "Sapling Global — Vendor Reviews",
    home: "/vendor",
    security: "/change-password",
    quickCreate: false,
  },
  support: {
    label: "Support Agent",
    heading: "Sapling Global — Support Desk",
    home: "/support",
    security: "/change-password",
    quickCreate: false,
  },
};
