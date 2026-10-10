import type { ReportData, ReportProof } from "./report-data";
import {
  effectiveDisposition,
  type Disposition,
} from "../verification/dispositions";
import {
  DIRECTORSHIP_DATABASES,
  GLOBAL_SANCTIONS,
  INDIA_DATABASES,
  MEDIA_SEARCH_NOTE,
} from "../verification/check-sources";
import {
  DRUG_SUBSTANCES,
  REFERENCE_QUESTIONS,
  checkStatusLabel,
  verifiedFormFor,
} from "../verification/verified-fields";

type Check = ReportData["checks"][number];
type Entry = Record<string, string>;

/** Building blocks of an annexure page; the PDF layout draws each kind. */
export type AnnexureBlock =
  | { kind: "facts"; title?: string; rows: Array<[string, string]> }
  | {
      kind: "compare";
      title?: string;
      rows: Array<[string, string, string]>;
    }
  | {
      kind: "numbered";
      head?: [string, string];
      rows: Array<[string, string]>;
    }
  | {
      kind: "results";
      title?: string;
      head: [string, string, string?];
      note?: string;
      groups: Array<{
        heading?: string;
        rows: Array<{
          name: string;
          detail?: string;
          result: string;
          colour?: Disposition | null;
        }>;
      }>;
    }
  | { kind: "note"; title?: string; text: string };

/** One line of the executive summary and the annexure that details it. */
export interface ReportItem {
  /** Public id of the check this row comes from (rework and proof lookups). */
  checkId?: string;
  label: string;
  detail: string;
  status: string;
  disposition: Disposition | null;
  pending: boolean;
  /** Annexure number (I, II…) of this item and, when it has proof, of its proof. */
  annexure: number;
  proofAnnexure?: number;
  annexureTitle: string;
  blocks: AnnexureBlock[];
  /** Proof files go in their own annexure after the check's last item. */
  proofs: ReportProof[];
  proofTitle: string;
}

/** Sample Report order: address, education, employment, records, references, tests, databases. */
const ORDER = [
  "IDENTITY",
  "PAN_VALIDATION",
  "ADDRESS",
  "EDUCATION",
  "EMPLOYMENT",
  "COURT_RECORD",
  "CRIMINAL",
  "REFERENCE",
  "DRUG_TEST",
  "GLOBAL_DATABASE",
  "SANCTIONS",
  "DIRECTORSHIP",
  "ADVERSE_MEDIA",
];

/** Keys that stay inside Sapling: costs, approvals and payment references. */
export const INTERNAL_KEYS = new Set([
  "extraCost",
  "extraCostApproval",
  "challanReference",
]);

const ADDRESS_ORDER = ["Current", "Permanent", "Previous"];

export const roman = (value: number) => {
  const table: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = value;
  let out = "";
  for (const [size, letters] of table)
    while (rest >= size) {
      out += letters;
      rest -= size;
    }
  return out;
};

export const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/** "12 Aug 2024" for YYYY-MM-DD; other values pass through. */
export function reportDate(value: string | null | undefined) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Aadhaar numbers are printed masked (XXXX-XXXX-1234), as UIDAI requires. */
export function maskId(value: string | undefined, type?: string) {
  if (!value) return "";
  const digits = value.replace(/[\s-]/g, "");
  if (/^\d{12}$/.test(digits) || /aadhaar/i.test(type ?? ""))
    return digits.length >= 4 ? `XXXX-XXXX-${digits.slice(-4)}` : "XXXX";
  return value;
}

const NOT_GIVEN = "Not provided";
const NOT_DISCLOSED = "Not disclosed";
const given = (value: string | undefined) => value?.trim() || NOT_GIVEN;
const disclosed = (value: string | undefined) => value?.trim() || NOT_DISCLOSED;
const join = (...parts: Array<string | undefined>) =>
  parts.filter((part) => part?.trim()).join(", ");
const period = (from?: string, to?: string) =>
  from || to ? `${reportDate(from) || "?"} to ${reportDate(to) || "?"}` : "";

/** Rows shared by every annexure: how and when it was verified, comments, findings. */
function closing(
  check: Check,
  rhs: Entry,
  proofNote: string,
  methodLabel = "Mode of verification",
): AnnexureBlock[] {
  const rows: Array<[string, string]> = [];
  if (rhs.method) rows.push([methodLabel, rhs.method]);
  if (rhs.verificationDate)
    rows.push(["Date of verification", reportDate(rhs.verificationDate)]);
  const comment = [check.sourceSummary?.trim(), proofNote]
    .filter(Boolean)
    .join(" ");
  rows.push(["Any other comments", comment || "None"]);
  for (const finding of check.findings)
    rows.push([
      `Finding: ${finding.title}`,
      join(
        finding.description,
        finding.source ? `Source: ${finding.source}` : "",
      ),
    ]);
  return [{ kind: "facts", rows }];
}

/** The best-known global lists, named in the database summary line. */
const GLOBAL_KEY_LISTS =
  "OFAC (USA), United Nations, European Union, UK HM Treasury, Interpol, World Bank";

const recordResult = (value: string | undefined, result: string | null) => {
  if (value === "No record found") return "No Record Found";
  if (value === "Record found") return "Record Found";
  if (value === "Not searched") return "Not Searched";
  return result === "CLEAR" ? "No Record Found" : "Refer to remarks";
};
const recordColour = (text: string): Disposition | null =>
  text === "No Record Found" ? "GREEN" : text === "Record Found" ? "RED" : null;

/** Green for the clear answer, red for the adverse one, nothing otherwise. */
const tone = (
  value: string | undefined,
  clear: string,
  adverse: string,
): Disposition | null =>
  value === clear ? "GREEN" : value === adverse ? "RED" : null;

type Layout = {
  label: (claimed: Entry, index: number, count: number) => string;
  detail: (claimed: Entry, rhs: Entry) => string;
  title: (label: string) => string;
  proofTitle: string;
  blocks: (
    claimed: Entry,
    rhs: Entry,
    check: Check,
    data: ReportData,
    proofNote: string,
  ) => AnnexureBlock[];
};

const numbered = (base: string) => (_: Entry, index: number, count: number) =>
  count > 1 ? `${base} ${roman(index + 1)}` : base;

const LAYOUTS: Record<string, Layout> = {
  ADDRESS: {
    label: (claimed) =>
      `${ADDRESS_ORDER.includes(claimed.addressType ?? "") ? claimed.addressType : "Current"} Address Verification`,
    detail: (claimed) =>
      join(claimed.address, claimed.city, claimed.pincode) || "Address",
    title: (label) => `Detailed Check Report – ${label}`,
    proofTitle: "Photographs and proof for address verification",
    blocks: (claimed, rhs, check, data, proofNote) => [
      {
        kind: "facts",
        title: "Candidate Verification Details",
        rows: [
          ["Candidate name", data.candidateName],
          [
            "Candidate's address (complete address)",
            join(
              claimed.address,
              claimed.landmark,
              claimed.city,
              claimed.state,
              claimed.pincode,
            ) || NOT_GIVEN,
          ],
          [
            "Duration of stay (as per candidate)",
            disclosed(rhs.durationOfStay),
          ],
          [
            "Nature of residence (rented / own / hostel / PG / etc.)",
            disclosed(rhs.natureOfResidence),
          ],
          ["Residency proof (address / ID)", disclosed(rhs.residencyProof)],
          [
            "Residency proof number (address / ID)",
            disclosed(maskId(rhs.residencyProofNumber, rhs.residencyProof)),
          ],
          ["Address confirmed", disclosed(rhs.addressConfirmed)],
          ["Verifier's relationship", disclosed(rhs.relationship)],
          [
            "Verifier name and contact number",
            join(rhs.respondentName, rhs.respondentContact) || NOT_DISCLOSED,
          ],
          [
            "Address closure date and time",
            join(reportDate(rhs.verificationDate), rhs.closureTime) ||
              NOT_DISCLOSED,
          ],
          [
            "Remarks / longitude and latitude",
            join(rhs.remarks || rhs.method, rhs.latLong) || NOT_DISCLOSED,
          ],
          ...(rhs.geoTagged
            ? ([["Geo-tagged", rhs.geoTagged]] as Array<[string, string]>)
            : []),
          ...(rhs.respondentSignature
            ? ([
                ["Verifier signature obtained", rhs.respondentSignature],
              ] as Array<[string, string]>)
            : []),
        ],
      },
      ...closing(check, { ...rhs, verificationDate: "" }, proofNote),
    ],
  },
  EDUCATION: {
    label: numbered("Education"),
    detail: (claimed, rhs) =>
      join(
        rhs.degree || claimed.degree,
        rhs.university ||
          claimed.university ||
          rhs.institute ||
          claimed.institute,
      ) || "Education",
    title: () => "Detailed Check Report – Education",
    proofTitle: "Written response for education verification",
    blocks: (claimed, rhs, check, _data, proofNote) => [
      {
        kind: "compare",
        rows: [
          [
            "Institute / college name",
            given(claimed.institute),
            disclosed(rhs.institute),
          ],
          [
            "University / board name",
            given(claimed.university),
            disclosed(rhs.university),
          ],
          [
            "Course / degree pursued",
            given(claimed.degree),
            disclosed(rhs.degree),
          ],
          [
            "Year of passing",
            given(claimed.passingYear),
            disclosed(rhs.passingYear),
          ],
          [
            "Roll / registration number",
            given(claimed.rollNumber),
            disclosed(rhs.rollNumber),
          ],
          ["Result (passed / failed)", NOT_GIVEN, disclosed(rhs.resultStatus)],
        ],
      },
      {
        kind: "facts",
        rows: [
          ["Referee's comments", disclosed(rhs.refereeComments)],
          [
            "Referee name and designation",
            join(rhs.verifierName, rhs.verifierDesignation) || NOT_DISCLOSED,
          ],
        ],
      },
      ...closing(check, rhs, proofNote),
    ],
  },
  EMPLOYMENT: {
    label: numbered("Employment"),
    detail: (claimed, rhs) =>
      rhs.employerName || claimed.employerName || "Employment",
    title: () => "Detailed Check Report – Employment",
    proofTitle: "Email response for employment verification",
    blocks: (claimed, rhs, check, _data, proofNote) => [
      {
        kind: "facts",
        rows: [
          [
            "Company name and address",
            join(
              rhs.employerName || claimed.employerName,
              rhs.employerAddress,
            ) || NOT_GIVEN,
          ],
        ],
      },
      {
        kind: "compare",
        rows: [
          [
            "Period of employment",
            period(claimed.tenureFrom, claimed.tenureTo) || NOT_GIVEN,
            period(rhs.tenureFrom, rhs.tenureTo) || NOT_DISCLOSED,
          ],
          [
            "Designation",
            given(claimed.designation),
            disclosed(rhs.designation),
          ],
          ["CTC (in INR)", given(claimed.ctc), disclosed(rhs.ctc)],
          ["Employee code", given(claimed.empCode), disclosed(rhs.empCode)],
          ["Reason for leaving", NOT_GIVEN, disclosed(rhs.reasonForLeaving)],
          [
            "Reporting manager (name and designation)",
            NOT_GIVEN,
            disclosed(rhs.reportingManager),
          ],
        ],
      },
      {
        kind: "facts",
        rows: [
          [
            "Were there any disciplinary / integrity / performance issues?",
            disclosed(rhs.integrityIssues),
          ],
          ["Eligibility for rehire", disclosed(rhs.rehireEligible)],
          ...(rhs.uanStatus
            ? ([["UAN status", rhs.uanStatus]] as Array<[string, string]>)
            : []),
          ["Referee's comments", disclosed(rhs.refereeComments)],
          [
            "Referee contact details / email ID",
            join(
              rhs.verifierName,
              rhs.verifierDesignation,
              rhs.verifierContact,
            ) || NOT_DISCLOSED,
          ],
        ],
      },
      ...closing(check, rhs, proofNote),
    ],
  },
  REFERENCE: {
    label: (_, index) => `Reference Check ${roman(index + 1)}`,
    detail: (claimed, rhs) =>
      join(
        rhs.relationship || claimed.relationship,
        "reference verification",
      ) || "Reference verification",
    title: (label) => `Detailed Reference Check Report – ${label}`,
    proofTitle: "Supporting proof for reference verification",
    blocks: (claimed, rhs, check, _data, proofNote) => [
      {
        kind: "numbered",
        rows: [
          ["Name of referee", disclosed(rhs.refereeName || claimed.name)],
          ["Designation", disclosed(rhs.designation || claimed.relationship)],
          ["Organisation name and address", disclosed(rhs.organisation)],
          [
            "Contact details",
            disclosed(rhs.refereeContact || join(claimed.phone, claimed.email)),
          ],
        ],
      },
      {
        kind: "numbered",
        head: ["Particular", "Remark"],
        rows: [
          ...REFERENCE_QUESTIONS.map((question): [string, string] => [
            question.label,
            disclosed(rhs[question.key]),
          ]),
          ["Remark", disclosed(rhs.feedback)],
        ],
      },
      ...closing(check, rhs, proofNote),
    ],
  },
  COURT_RECORD: {
    label: numbered("Criminal Court Record Verification"),
    detail: (claimed, rhs) =>
      join(
        claimed.addressBasis ? `${claimed.addressBasis} address` : "",
        rhs.years || claimed.years ? `${rhs.years || claimed.years} years` : "",
      ) || "Criminal court record verification",
    title: (label) => `Detailed Check Report – ${label}`,
    proofTitle: "Supporting proof for court record verification",
    blocks: (claimed, rhs, check, data, proofNote) => {
      const courts = [
        ["districtCourt", "District court"],
        ["sessionCourt", "Session court"],
        ["magistrateCourt", "Magistrate court"],
        ["highCourt", "High court"],
        ["supremeCourt", "Supreme court"],
      ] as const;
      const rows = courts
        .filter(([key]) => rhs[`${key}Status`] || rhs[`${key}Name`])
        .map(([key, label]) => {
          const status = rhs[`${key}Status`] ?? "";
          const result =
            status === "No records found"
              ? "No Record Found"
              : status === "Record found"
                ? "Record Found"
                : status || "Not searched";
          return {
            name: label,
            detail: rhs[`${key}Name`],
            result,
            colour: recordColour(result),
          };
        });
      return [
        {
          kind: "facts",
          rows: [
            ["Candidate name", data.candidateName],
            ["Address searched", given(claimed.addressBasis)],
            [
              "Duration of records check",
              rhs.years || claimed.years
                ? `${rhs.years || claimed.years} years`
                : NOT_DISCLOSED,
            ],
          ],
        },
        ...(rows.length
          ? [
              {
                kind: "results" as const,
                head: ["Court", "Result", "Status"] as [string, string, string],
                groups: [{ rows }],
              },
            ]
          : []),
        ...closing(check, rhs, proofNote),
      ];
    },
  },
  CRIMINAL: {
    label: numbered("Criminal Record Verification (Police)"),
    detail: (claimed, rhs) =>
      rhs.policeStation ||
      (claimed.addressBasis ? `${claimed.addressBasis} address` : "") ||
      "Police record verification",
    title: (label) => `Detailed Check Report – ${label}`,
    proofTitle: "Supporting proof for police verification",
    blocks: (claimed, rhs, check, data, proofNote) => [
      {
        kind: "facts",
        rows: [
          ["Candidate name", data.candidateName],
          ["Address searched", given(claimed.addressBasis)],
          ["Police station", disclosed(rhs.policeStation)],
          [
            "Respondent name and designation",
            join(rhs.respondentName, rhs.respondentDesignation) ||
              NOT_DISCLOSED,
          ],
          [
            "Duration of records check",
            rhs.years || claimed.years
              ? `${rhs.years || claimed.years} years`
              : NOT_DISCLOSED,
          ],
        ],
      },
      ...closing(check, rhs, proofNote),
    ],
  },
  DRUG_TEST: {
    label: () => "Drug Test Verification",
    detail: (claimed, rhs) =>
      `${rhs.panel || claimed.panel || ""} Panel Drug Test`.trim(),
    title: (label) => `Detailed Check Report – ${label}`,
    proofTitle: "Report for drug test verification",
    blocks: (claimed, rhs, check, _data, proofNote) => {
      const panel = rhs.panel || claimed.panel;
      const rows = DRUG_SUBSTANCES.flatMap((substance) => {
        const value = rhs[`substance_${substance.key}`];
        if (!value || value === "Not tested") return [];
        return [
          {
            name: substance.label,
            result: value,
            colour: tone(value, "Negative", "Positive"),
          },
        ];
      });
      return [
        {
          kind: "facts",
          rows: [
            ["Panel", panel ? `${panel} panel` : NOT_DISCLOSED],
            [
              "Collection method",
              disclosed(rhs.collection || claimed.collection),
            ],
            ["Laboratory", disclosed(rhs.labName)],
          ],
        },
        rows.length
          ? {
              kind: "results",
              head: [
                `${panel ? `${panel} Panel ` : ""}Drug Test`,
                "Result",
                "Status",
              ],
              groups: [{ rows }],
            }
          : {
              kind: "note",
              text: "Panel-wise results were not recorded; refer to the laboratory report.",
            },
        ...closing(check, rhs, proofNote),
      ];
    },
  },
  GLOBAL_DATABASE: {
    label: () => "India Specific and Global Database Check Including OFAC",
    detail: () => "India Specific and Global Database Check Including OFAC",
    title: () =>
      "Detailed Check Report – India Specific and Global Database Check Including OFAC",
    proofTitle: "Supporting proof for database check",
    blocks: (_claimed, rhs, check, _data, proofNote) => {
      const india = recordResult(rhs.indiaDatabases, check.result);
      const global = recordResult(rhs.globalSanctions, check.result);
      const row = (name: string, result: string) => ({
        name,
        result,
        colour: recordColour(result),
      });
      return [
        {
          kind: "results",
          title: "Global Standard Database Check Report",
          head: ["Indian Specific Database Searches", "Result"],
          groups: [{ rows: INDIA_DATABASES.map((name) => row(name, india)) }],
        },
        ...(rhs.databases
          ? ([
              {
                kind: "facts",
                rows: [["Other databases searched", rhs.databases]],
              },
            ] as AnnexureBlock[])
          : []),
        // One summary line instead of every list: the client sees which global lists
        // were searched without pages of country names.
        {
          kind: "results",
          head: [
            "Global Sanctions Check (Regulatory and Compliance)",
            "Result",
          ],
          groups: [
            {
              rows: [
                {
                  ...row(
                    "International sanctions and regulatory lists",
                    global,
                  ),
                  detail: `${GLOBAL_KEY_LISTS} and regulators in ${GLOBAL_SANCTIONS.length - 1} other countries — ${GLOBAL_SANCTIONS.reduce((sum, group) => sum + group.sources.length, 0)} lists searched.`,
                },
              ],
            },
          ],
        },
        ...(rhs.matchDetails
          ? ([
              { kind: "note", title: "Record details", text: rhs.matchDetails },
            ] as AnnexureBlock[])
          : []),
        ...closing(check, rhs, proofNote),
      ];
    },
  },
  DIRECTORSHIP: {
    label: () => "Directorship Check",
    detail: () => "Directorship Check",
    title: () => "Detailed Check Report – Directorship Check",
    proofTitle: "Supporting proof for directorship check",
    blocks: (_claimed, rhs, check, _data, proofNote) => [
      {
        kind: "results",
        head: ["Database", "Result"],
        groups: [
          {
            rows: DIRECTORSHIP_DATABASES.map((database) => {
              const result = recordResult(rhs[database.key], check.result);
              return {
                name: database.name,
                detail: database.detail,
                result,
                colour: recordColour(result),
              };
            }),
          },
        ],
      },
      ...(rhs.matchDetails
        ? ([
            { kind: "note", title: "Record details", text: rhs.matchDetails },
          ] as AnnexureBlock[])
        : []),
      ...closing(check, rhs, proofNote),
    ],
  },
  ADVERSE_MEDIA: {
    label: () => "Media Check",
    detail: () => "Media Check",
    title: () => "Detailed Check Report – Media Check",
    proofTitle: "Supporting proof for media check",
    blocks: (_claimed, rhs, check, _data, proofNote) => {
      const socials = [
        ["facebook", "Facebook"],
        ["instagram", "Instagram"],
        ["linkedin", "LinkedIn"],
        ["xtwitter", "X (Twitter)"],
        ["snapchat", "Snapchat"],
        ["wechat", "WeChat"],
      ] as const;
      const internet = recordResult(rhs.internetSearches, check.result);
      const media = recordResult(rhs.mediaSearches, check.result);
      return [
        {
          kind: "results",
          title: "Web and Media Searches Global",
          note: MEDIA_SEARCH_NOTE,
          head: ["Search", "Result"],
          groups: [
            {
              rows: [
                {
                  name: "Internet Searches",
                  result: internet,
                  colour: recordColour(internet),
                },
                {
                  name: "Media Searches",
                  result: media,
                  colour: recordColour(media),
                },
                ...socials
                  .filter(([key]) => rhs[key])
                  .map(([key, label]) => ({
                    name: label,
                    result: rhs[key]!,
                    colour: tone(
                      rhs[key],
                      "No adverse content",
                      "Adverse content",
                    ),
                  })),
              ],
            },
          ],
        },
        ...(rhs.matchDetails
          ? ([
              {
                kind: "note",
                title: "Adverse content details",
                text: rhs.matchDetails,
              },
            ] as AnnexureBlock[])
          : []),
        ...closing(check, rhs, proofNote),
      ];
    },
  },
  IDENTITY: {
    label: numbered("Identity Verification"),
    detail: (claimed, rhs) =>
      join(
        rhs.idType || claimed.idType,
        maskId(rhs.idNumber || claimed.idNumber, rhs.idType || claimed.idType),
      ) || "Identity verification",
    title: () => "Detailed Check Report – Identity Verification",
    proofTitle: "Supporting proof for identity verification",
    blocks: (claimed, rhs, check, _data, proofNote) => [
      {
        kind: "compare",
        rows: [
          ["ID type", given(claimed.idType), disclosed(rhs.idType)],
          [
            "ID number",
            given(maskId(claimed.idNumber, claimed.idType)),
            disclosed(maskId(rhs.idNumber, rhs.idType)),
          ],
          ["Name matches", NOT_GIVEN, disclosed(rhs.nameMatch)],
        ],
      },
      ...closing(check, rhs, proofNote),
    ],
  },
};
LAYOUTS.SANCTIONS = LAYOUTS.GLOBAL_DATABASE!;
LAYOUTS.PAN_VALIDATION = {
  ...LAYOUTS.IDENTITY!,
  label: () => "PAN Verification",
  detail: (claimed, rhs) => rhs.idNumber || claimed.idNumber || "PAN",
  title: () => "Detailed Check Report – PAN Verification",
};

/** Any other check: every recorded verified detail, in form order. */
function genericLayout(type: string): Layout {
  const name = readable(type);
  return {
    label: numbered(name),
    detail: () => name,
    title: (label) => `Detailed Check Report – ${label}`,
    proofTitle: `Supporting proof for ${name.toLowerCase()}`,
    blocks: (_claimed, rhs, check, _data, proofNote) => {
      const rows = verifiedFormFor(type)
        .fields.filter(
          (field) =>
            rhs[field.key] &&
            !INTERNAL_KEYS.has(field.key) &&
            !["method", "verificationDate"].includes(field.key),
        )
        .map((field): [string, string] => [
          field.label.replace(/ \(confirmed\)$/, ""),
          field.kind === "date" ? reportDate(rhs[field.key]) : rhs[field.key]!,
        ]);
      return [
        ...(rows.length ? ([{ kind: "facts", rows }] as AnnexureBlock[]) : []),
        ...closing(check, rhs, proofNote),
      ];
    },
  };
}

export function statusText(check: Check, interim?: boolean) {
  if (!check.result) return interim ? "In progress" : "Pending";
  const label = checkStatusLabel(
    check.type,
    check.result,
    effectiveDisposition(check),
  );
  // Summary table wording follows the Sample Report: "Verified", "No Record Found"…
  return label === "Verified — no records found" ? "Verified" : label;
}

/**
 * The executive-summary rows and annexures, in Sample Report order. A check with
 * several entries (current and permanent address, two employers, three referees)
 * becomes one row and one annexure per entry, all carrying the check's colour.
 */
export function reportItems(data: ReportData): ReportItem[] {
  const sorted = data.checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => {
      const rank = (type: string) => {
        const at = ORDER.indexOf(type.toUpperCase());
        return at === -1 ? ORDER.length : at;
      };
      return rank(a.check.type) - rank(b.check.type) || a.index - b.index;
    })
    .map(({ check }) => check);
  const items: ReportItem[] = [];
  const builders: Array<{
    check: Check;
    layout: Layout;
    entries: Array<{ claimed: Entry; verified: Entry }>;
    first: number;
    pending: boolean;
  }> = [];
  for (const check of sorted) {
    const type = check.type.toUpperCase();
    const layout = LAYOUTS[type] ?? genericLayout(type);
    const pending = !check.result;
    const claimed = check.claimed ?? [];
    const verified = check.verified ?? [];
    const count = Math.max(claimed.length, verified.length, 1);
    let entries = Array.from({ length: count }, (_, index) => ({
      claimed: claimed[index] ?? {},
      verified: verified[index] ?? {},
    }));
    if (type === "ADDRESS")
      entries = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const rank = (value?: string) => {
            const at = ADDRESS_ORDER.indexOf(value ?? "");
            return at === -1 ? ADDRESS_ORDER.length : at;
          };
          return (
            rank(a.entry.claimed.addressType) -
              rank(b.entry.claimed.addressType) || a.index - b.index
          );
        })
        .map(({ entry }) => entry);
    const disposition = pending ? null : effectiveDisposition(check);
    const status = statusText(check, data.interim);
    const proofs = pending ? [] : (check.proofs ?? []);
    const seen = new Map<string, number>();
    const first = items.length;
    entries.forEach((entry, index) => {
      let label = layout.label(entry.claimed, index, count);
      // Two "Current Address Verification" rows become "… I" and "… II".
      const repeat = (seen.get(label) ?? 0) + 1;
      seen.set(label, repeat);
      if (repeat > 1) label = `${label} ${roman(repeat)}`;
      const last = index === entries.length - 1;
      items.push({
        checkId: check.id,
        label,
        detail: layout.detail(entry.claimed, entry.verified),
        status,
        disposition,
        pending,
        annexure: 0,
        annexureTitle: layout.title(label),
        blocks: [],
        proofs: last ? proofs : [],
        proofTitle: layout.proofTitle,
      });
    });
    builders.push({ check, layout, entries, first, pending });
  }
  // Number the annexures (a check's proof gets the annexure after its last entry).
  let next = 0;
  for (const item of items) {
    item.annexure = ++next;
    if (item.proofs.length) item.proofAnnexure = ++next;
  }
  for (const { check, layout, entries, first, pending } of builders) {
    const proofAt = items[first + entries.length - 1]!.proofAnnexure;
    const proofNote = proofAt
      ? `Supporting proof is attached as Annexure ${roman(proofAt)}.`
      : "";
    entries.forEach((entry, index) => {
      items[first + index]!.blocks = pending
        ? [
            {
              kind: "note",
              text: "Verification is in progress for this check. Details will appear here once it is verified.",
            },
          ]
        : layout.blocks(entry.claimed, entry.verified, check, data, proofNote);
    });
  }
  return items;
}
