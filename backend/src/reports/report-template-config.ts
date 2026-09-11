import type { ReportData } from "./report-data";

export const reportTemplateConfig: Record<
  string,
  {
    color: [number, number, number];
    summary: string;
    groups: Array<{ heading: string; types: string[] }>;
  }
> = {
  HIRECHECK: {
    color: [0.08, 0.5, 0.38],
    summary: "Employment eligibility evidence",
    groups: [
      { heading: "Identity & address", types: ["IDENTITY", "ADDRESS"] },
      {
        heading: "Career & qualifications",
        types: ["EMPLOYMENT", "EDUCATION", "REFERENCE", "RESUME"],
      },
      { heading: "Background records", types: ["CRIMINAL", "COURT_RECORD"] },
    ],
  },
  INTEGRITYCHECK: {
    color: [0.51, 0.3, 0.7],
    summary: "Declarations & factual integrity review",
    groups: [
      {
        heading: "Declarations & conflicts",
        types: ["CONFLICT_OF_INTEREST", "INTEGRITY_DECLARATION"],
      },
      {
        heading: "Misconduct & public records",
        types: [
          "FRAUD_MISCONDUCT",
          "CRIMINAL",
          "COURT_RECORD",
          "ADVERSE_MEDIA",
        ],
      },
      {
        heading: "Integrity references",
        types: ["INTEGRITY_REFERENCE", "REFERENCE"],
      },
    ],
  },
  LEADERCHECK: {
    color: [0.15, 0.4, 0.72],
    summary: "Leadership interests & reputation due diligence",
    groups: [
      {
        heading: "Leadership & business interests",
        types: ["DIRECTORSHIP", "BUSINESS_INTEREST", "CONFLICT_OF_INTEREST"],
      },
      {
        heading: "Litigation, sanctions & watchlists",
        types: ["LITIGATION", "SANCTIONS", "WATCHLIST", "COURT_RECORD"],
      },
      {
        heading: "Media & leadership references",
        types: ["ADVERSE_MEDIA", "LEADERSHIP_REFERENCE", "REFERENCE"],
      },
    ],
  },
  VENDORCHECK: {
    color: [0.73, 0.4, 0.1],
    summary: "Business identity & vendor risk evidence",
    groups: [
      {
        heading: "Registration & tax identity",
        types: [
          "COMPANY_REGISTRATION",
          "GST",
          "PAN",
          "MCA",
          "GST_VERIFICATION",
          "PAN_VERIFICATION",
        ],
      },
      {
        heading: "Directors & promoters",
        types: ["DIRECTORSHIP", "DIRECTOR_PROMOTER"],
      },
      {
        heading: "Litigation & vendor risk",
        types: ["LITIGATION", "COURT_RECORD", "VENDOR_RISK", "SANCTIONS"],
      },
    ],
  },
};
export function groupedReportChecks(
  family: string,
  checks: ReportData["checks"],
) {
  const pending = new Set(checks);
  const groups = (reportTemplateConfig[family]?.groups ?? []).flatMap(
    (group) => {
      const items = checks.filter((check) => group.types.includes(check.type));
      items.forEach((item) => pending.delete(item));
      return items.length ? [{ heading: group.heading, items }] : [];
    },
  );
  if (pending.size)
    groups.push({ heading: "Additional approved checks", items: [...pending] });
  return groups;
}
