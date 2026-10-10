import { Injectable } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
export { wrapToWidth } from "../common/pdf/document-writer";
import { SAPLING_WORDMARK_PNG } from "../common/pdf/brand-logo";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import type { ReportAssets, ReportData, ReportProof } from "./report-data";
import { caseColour, type Disposition } from "../verification/dispositions";
import { COLOUR_NAMES } from "../verification/colour-matrix";
import {
  reportDate,
  reportItems,
  roman,
  type AnnexureBlock,
  type ReportItem,
} from "./report-annexures";
import { PALETTE, ReportLayout, type Cell, type RGB } from "./report-layout";

/**
 * Severity colours (Green / Yellow / Orange / Red / Blue); "Insufficient / Interim"
 * (client review) carries no colour.
 */
export const STATUS_FILL: Record<Disposition, RGB> = {
  GREEN: [0.12, 0.56, 0.24],
  YELLOW: [0.96, 0.76, 0.05],
  AMBER: [0.96, 0.49, 0.0],
  RED: [0.83, 0.18, 0.18],
  BLUE: [0.12, 0.39, 0.78],
  CLIENT_REVIEW: [1, 1, 1],
};
/** Yellow and "no colour" carry dark text; every other status colour carries white. */
const STATUS_TEXT = (colour: Disposition): RGB =>
  colour === "YELLOW" || colour === "CLIENT_REVIEW"
    ? PALETTE.ink
    : PALETTE.white;
/** Colour names printed in the report. */
const COLOUR_LABEL: Record<Disposition, string> = {
  ...COLOUR_NAMES,
  CLIENT_REVIEW: "No colour",
};

/** Severity legend printed on the executive summary, in the client's order. */
const SEVERITY_LEGEND: Array<[Disposition, string, string]> = [
  [
    "GREEN",
    "Green / Clear",
    "Where there is no disparity between the stated and verified antecedents, or the difference is considered non-significant and treated as clear.",
  ],
  [
    "YELLOW",
    "Minor Discrepant",
    "Where the verification response reports a mismatch and the mismatch is of a lesser degree / lower impact than discrepant.",
  ],
  [
    "AMBER",
    "Unable to Verify / Amber / Orange",
    "Where the verification source (viz. previous employer or education institution) is unable to share a response due to lack of data / data accessibility, or refuses to give a complete response.",
  ],
  [
    "CLIENT_REVIEW",
    "Insufficient / Interim – No Colour",
    "Where verification could not be completed due to the absence of mandatory data or documents.",
  ],
  [
    "RED",
    "Red / Major Discrepant",
    "Where the verification source (viz. previous employer, education institution or address) is fake or suspect, or the verification response reports a mismatch with the stated antecedents.",
  ],
  [
    "BLUE",
    "Verbal",
    "Where a written response could not be obtained from the verification source and the verification was completed verbally.",
  ],
];

const DISCLAIMER =
  "This report contains information that is confidential and proprietary in nature, and may also be attorney-client privileged and/or work-product privileged. It is for the exclusive use of the intended recipient(s). If you are not the intended recipient or the person responsible for delivering it to the intended recipient, any dissemination, distribution or copying of this report is strictly prohibited and may be unlawful. If you have received this report in error, please notify the sender immediately and delete the original. The findings describe the verified scope and the sources consulted; they are not an automated hiring or character decision.";

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "07 Oct 2026, 5:30 pm IST"; plain dates (YYYY-MM-DD) stay as dates. */
export function istDate(value: Date | string | null | undefined) {
  if (!value) return "Not recorded";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1, day)).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      },
    );
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime())
    ? `${IST.format(date)} IST`
    : String(value);
}

/** Report date in IST as "10 Oct 2026". */
const dayOf = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);

const statusCell = (colour: Disposition | null, fallback: string): Cell =>
  colour
    ? {
        text: COLOUR_LABEL[colour],
        fill: STATUS_FILL[colour],
        colour: STATUS_TEXT(colour),
        bold: true,
        align: "center",
      }
    : { text: fallback, colour: PALETTE.muted, align: "center" };

const MAX_PDF_PAGES = 10;

/**
 * Background verification report in the Sample Report format: executive summary with
 * header and colour-coded checks table, annexure index, one detailed annexure per
 * check (stated vs verified), the verifier's proof (screenshots, written replies, lab
 * reports) as figures, end-of-report marker and confidentiality notice.
 */
@Injectable()
export class ReportPdfService {
  async render(data: ReportData, assets: ReportAssets = {}): Promise<Buffer> {
    const document = await PDFDocument.create();
    const { regular, bold } = await embedUnicodeFonts(document);
    const logo = await document.embedPng(
      Buffer.from(SAPLING_WORDMARK_PNG, "base64"),
    );
    const internal = data.audience === "internal";
    const items = reportItems(data);
    const status = data.interim ? "Interim" : data.draft ? "Draft" : "Final";
    const watermark = data.interim
      ? "INTERIM"
      : data.draft
        ? internal
          ? "INTERNAL DRAFT"
          : "DRAFT"
        : internal
          ? "INTERNAL"
          : undefined;
    const layout = new ReportLayout(document, regular, bold, {
      logo,
      title: "Employee Background Screening Report",
      subtitle: `${data.candidateName} · Sapling ID ${data.caseNumber}`,
      watermark,
    });

    this.summary(layout, data, items, status);
    this.annexureIndex(layout, items);
    const counter = { figure: 0 };
    for (const item of items) {
      layout.newPage();
      this.annexure(layout, item);
      if (item.proofs.length && item.proofAnnexure) {
        const heading = `Annexure ${roman(item.proofAnnexure)}`;
        const title = item.proofTitle.replace(/^\w/, (letter) =>
          letter.toUpperCase(),
        );
        await this.proofs(document, layout, item.proofs, assets, counter, () =>
          layout.annexureBar(heading, title),
        );
      }
    }
    this.closing(layout, data, internal);

    layout.footers(
      internal
        ? `Internal working copy – not for client release · ${data.caseNumber}`
        : data.draft
          ? `Strictly confidential · Draft preview – not for release · ${data.caseNumber}`
          : `Strictly confidential · Authenticity code ${data.authenticityCode} · verify on the Sapling Global portal`,
      data.interim || data.draft
        ? "Work in progress – results may change before the final report."
        : undefined,
    );
    document.setTitle(
      `Sapling Global ${data.interim ? "interim " : data.draft ? "draft " : ""}report ${data.caseNumber}`,
    );
    const services = data.services?.length ? data.services : ["HIRECHECK"];
    document.setSubject(
      `${data.interim ? "Interim" : data.draft ? "Draft" : "Approved"} ${services.join(", ")} verification findings`,
    );
    document.setAuthor("Sapling Global Assurance Pvt. Ltd.");
    document.setCreator("Sapling Global");
    document.setCreationDate(data.generatedAt);
    return Buffer.from(await document.save());
  }

  private summary(
    layout: ReportLayout,
    data: ReportData,
    items: ReportItem[],
    status: string,
  ) {
    layout.titleBar("Executive Summary – Employee Background Screening");
    const overall = caseColour(data.checks);
    const pendingChecks = data.checks.some((check) => !check.result);
    const header = data.header ?? {};
    const label = (text: string): Cell => ({
      text,
      fill: PALETTE.label,
      bold: true,
    });
    layout.table(
      [{ width: 112 }, { width: 148 }, { width: 112 }, { width: 147 }],
      [
        [
          label("Report Status"),
          { text: status, bold: true },
          label("Report Disposition"),
          statusCell(
            data.interim && pendingChecks ? null : overall,
            pendingChecks ? "In progress" : "Not classified",
          ),
        ],
        [
          label("Employee Code"),
          header.employeeCode || "Not provided",
          label("Report Date"),
          dayOf(data.generatedAt),
        ],
        [
          label("Employee Name"),
          data.candidateName,
          label("Client / Process"),
          [data.clientName, header.clientProcess].filter(Boolean).join(" / "),
        ],
        [
          label("Date of Joining"),
          reportDate(header.joiningDate) || "Not provided",
          label("Sapling ID"),
          data.caseNumber,
        ],
      ],
      { size: 8.5, middle: true },
    );
    // Service declarations and identity details other than the employee code.
    const details = (data.identityDetails ?? []).filter(
      ([name]) => !/^employee (code|reference)$/i.test(name),
    );
    if (details.length) {
      layout.space(-4);
      layout.table(
        [{ width: 112 }, { width: 407 }],
        details.map(([name, value]) => [label(name), value]),
        { size: 8.5 },
      );
    }
    layout.space(4);
    layout.table(
      [
        { width: 36 },
        { width: 160 },
        { width: 158 },
        { width: 95 },
        { width: 70 },
      ],
      items.map((item, index) => [
        { text: `${index + 1}.`, align: "center" },
        { text: item.label, bold: true },
        item.detail,
        item.pending
          ? { text: item.status, colour: PALETTE.muted }
          : item.status,
        statusCell(item.disposition, item.pending ? "Pending" : "—"),
      ]),
      {
        middle: true,
        header: [
          { text: "S. No.", align: "center" },
          "Checks Undertaken",
          "Check Detail",
          "Status",
          { text: "Disposition", align: "center" },
        ],
        size: 8.5,
      },
    );
    if (!items.length)
      layout.paragraph("No checks are part of this report.", {
        colour: PALETTE.muted,
      });
    this.severityLegend(layout);
    if (data.interim)
      layout.paragraph(
        "Interim report: only checks already verified carry a result. Checks marked “In progress” are still being verified and the final report may differ.",
        { size: 8, colour: PALETTE.muted },
      );
    if (data.draft)
      layout.paragraph(
        "Draft preview: this is how the report will read once it is approved. It is not released to the client until the final approval.",
        { size: 8, colour: PALETTE.muted },
      );
    if (data.reviewerName || data.managerName) {
      const parts = [
        data.reviewerName
          ? `Quality checked by ${data.reviewerName}${data.reviewedAt ? ` on ${istDate(data.reviewedAt)}` : ""}`
          : "",
        data.managerName
          ? `approved by ${data.managerName}${data.approvedAt ? ` on ${istDate(data.approvedAt)}` : ""}`
          : "",
      ].filter(Boolean);
      layout.paragraph(
        `${parts.join("; ")}.`.replace(/^\w/, (c) => c.toUpperCase()),
        {
          size: 8,
          colour: PALETTE.muted,
        },
      );
    }
    if (data.recommendation)
      layout.paragraph(`Recommendation: ${data.recommendation}`, { size: 8.5 });
    layout.space(6);
    layout.paragraph("For Sapling Global Assurance Pvt. Ltd.", {
      size: 9.5,
      bold: true,
      colour: PALETTE.navy,
    });
    layout.paragraph(
      "(This is a computer-generated report and does not require a signature.)",
      { size: 8, colour: PALETTE.muted },
    );
  }

  /** Severity legend: colour name, colour and what it means, side by side. */
  private severityLegend(layout: ReportLayout) {
    const widths = [86, 86, 88, 87, 86, 86];
    layout.space(2);
    layout.table(
      [{ width: 519 }],
      [
        [
          {
            text: "Severity Legend",
            fill: PALETTE.navy,
            colour: PALETTE.white,
            bold: true,
            align: "center",
            size: 9.5,
          },
        ],
      ],
    );
    layout.space(-8);
    layout.table(
      widths.map((width) => ({ width })),
      [
        SEVERITY_LEGEND.map(([, name]) => ({
          text: name,
          bold: true,
          align: "center" as const,
          size: 7.5,
          fill: PALETTE.label,
        })),
        SEVERITY_LEGEND.map(([colour]) => ({
          text: " ",
          fill: STATUS_FILL[colour],
        })),
        SEVERITY_LEGEND.map(([, , meaning]) => ({
          text: meaning,
          align: "center" as const,
          size: 6.8,
          colour: PALETTE.ink,
        })),
      ],
      { middle: true },
    );
  }

  private annexureIndex(layout: ReportLayout, items: ReportItem[]) {
    if (!items.length) return;
    layout.space(8);
    layout.sectionLabel("Annexure Details");
    const rows: Cell[][] = [];
    for (const item of items) {
      rows.push([
        { text: item.label, bold: true },
        { text: `Annexure ${roman(item.annexure)}`, align: "center" },
        item.annexureTitle,
      ]);
      if (item.proofs.length && item.proofAnnexure)
        rows.push([
          " ",
          { text: `Annexure ${roman(item.proofAnnexure)}`, align: "center" },
          item.proofTitle.replace(/^\w/, (letter) => letter.toUpperCase()),
        ]);
    }
    layout.table([{ width: 175 }, { width: 84 }, { width: 260 }], rows, {
      header: ["Check", { text: "Annexure", align: "center" }, "Description"],
      size: 8.5,
      middle: true,
    });
  }

  private annexure(layout: ReportLayout, item: ReportItem) {
    layout.annexureBar(
      `Annexure ${roman(item.annexure)}`,
      item.annexureTitle,
      item.disposition
        ? {
            text: `${COLOUR_LABEL[item.disposition]} · ${item.status}`,
            fill: STATUS_FILL[item.disposition],
            colour: STATUS_TEXT(item.disposition),
          }
        : item.pending
          ? { text: "In progress", fill: PALETTE.grid, colour: PALETTE.ink }
          : undefined,
    );
    for (const block of item.blocks) this.block(layout, block);
  }

  private block(layout: ReportLayout, block: AnnexureBlock) {
    const banner = (text: string): Cell[] => [
      {
        text,
        fill: PALETTE.band,
        bold: true,
        align: "center",
        colour: PALETTE.navy,
      },
    ];
    switch (block.kind) {
      case "facts": {
        if (block.title) layout.table([{ width: 519 }], [banner(block.title)]);
        if (block.title) layout.space(-8);
        layout.table(
          [{ width: 200 }, { width: 319 }],
          block.rows.map(([name, value]) => [name, value]),
          { labelColumn: true },
        );
        return;
      }
      case "compare": {
        if (block.title) layout.sectionLabel(block.title);
        const plain = (value: string) => value.trim().toLowerCase();
        const placeholder = (value: string) =>
          ["not provided", "not disclosed", "—", ""].includes(plain(value));
        layout.table(
          [{ width: 175 }, { width: 172 }, { width: 172 }],
          block.rows.map(([name, stated, verified]) => {
            const differs =
              !placeholder(stated) &&
              !placeholder(verified) &&
              plain(stated) !== plain(verified);
            return [
              name,
              placeholder(stated)
                ? { text: stated, colour: PALETTE.muted }
                : stated,
              differs
                ? { text: verified, colour: PALETTE.red, bold: true }
                : placeholder(verified)
                  ? { text: verified, colour: PALETTE.muted }
                  : verified,
            ];
          }),
          {
            header: ["Criteria", "Details Stated", "Details Verified"],
            labelColumn: true,
          },
        );
        return;
      }
      case "numbered": {
        layout.table(
          [{ width: 40 }, { width: 250 }, { width: 229 }],
          block.rows.map(([name, value], index) => [
            { text: String(index + 1), align: "center" },
            { text: name, fill: PALETTE.label, bold: true },
            value,
          ]),
          block.head
            ? {
                header: [
                  { text: "S. No.", align: "center" },
                  block.head[0],
                  block.head[1],
                ],
              }
            : {},
        );
        return;
      }
      case "results": {
        if (block.title) layout.table([{ width: 519 }], [banner(block.title)]);
        if (block.title) layout.space(-8);
        const withStatus = Boolean(block.head[2]);
        const columns = withStatus
          ? [{ width: 279 }, { width: 150 }, { width: 90 }]
          : [{ width: 359 }, { width: 160 }];
        if (block.note) {
          layout.table(
            [{ width: 519 }],
            [[{ text: block.note, size: 8, colour: PALETTE.muted }]],
          );
          layout.space(-8);
        }
        const rows: Cell[][] = [];
        for (const group of block.groups) {
          if (group.heading)
            rows.push([
              { text: group.heading, bold: true, fill: PALETTE.label },
              { text: "", fill: PALETTE.label },
              ...(withStatus ? [{ text: "", fill: PALETTE.label }] : []),
            ]);
          for (const row of group.rows) {
            const result: Cell =
              row.colour === "RED" && !withStatus
                ? { text: row.result, colour: PALETTE.red, bold: true }
                : row.result;
            rows.push([
              row.detail
                ? { text: row.name, bold: true, sub: row.detail }
                : row.name,
              result,
              ...(withStatus ? [statusCell(row.colour ?? null, "—")] : []),
            ]);
          }
        }
        layout.table(columns, rows, {
          header: [
            block.head[0],
            block.head[1],
            ...(withStatus
              ? [{ text: block.head[2]!, align: "center" as const }]
              : []),
          ],
          size: 8,
        });
        return;
      }
      case "note": {
        if (block.title) layout.sectionLabel(block.title);
        layout.table([{ width: 519 }], [[block.text]]);
        return;
      }
    }
  }

  /** Images as figures; PDF proofs page by page; anything unreadable is listed. */
  private async proofs(
    document: PDFDocument,
    layout: ReportLayout,
    proofs: ReportProof[],
    assets: ReportAssets,
    counter: { figure: number },
    heading: () => void,
  ) {
    const missing: ReportProof[] = [];
    // Each proof fills a page of its own: wide screenshots on a landscape page, tall
    // ones (and portrait PDF pages) on a portrait page. The first carries the heading.
    let placed = 0;
    const startFigure = (width: number, height: number) => {
      layout.newPage(width > height * 1.1 ? "landscape" : "portrait");
      if (placed === 0) heading();
      placed += 1;
    };
    for (const proof of proofs) {
      const bytes = assets.proofs?.get(proof.id);
      if (!bytes) {
        missing.push(proof);
        continue;
      }
      const title = proof.caption?.trim() || proof.name;
      const detail = `${proof.name} · SHA-256 ${proof.sha256.slice(0, 16)}…`;
      try {
        if (
          proof.contentType === "image/png" ||
          proof.contentType === "image/jpeg"
        ) {
          const image =
            proof.contentType === "image/png"
              ? await document.embedPng(bytes)
              : await document.embedJpg(bytes);
          counter.figure += 1;
          startFigure(image.width, image.height);
          layout.figure(
            { image },
            `Figure ${counter.figure} – ${title}`,
            detail,
            layout.remaining - 50,
          );
        } else if (proof.contentType === "application/pdf") {
          const source = await PDFDocument.load(bytes, {
            ignoreEncryption: true,
          });
          const count = Math.min(source.getPageCount(), MAX_PDF_PAGES);
          const pages = await document.embedPdf(
            source,
            Array.from({ length: count }, (_, index) => index),
          );
          counter.figure += 1;
          pages.forEach((page, index) => {
            startFigure(page.width, page.height);
            layout.figure(
              { page },
              `Figure ${counter.figure} – ${title}${count > 1 ? ` (page ${index + 1} of ${source.getPageCount()})` : ""}`,
              detail,
              layout.remaining - 50,
            );
          });
          if (source.getPageCount() > count)
            layout.paragraph(
              `Only the first ${count} of ${source.getPageCount()} pages are reproduced; the full file is available on the Sapling Global portal.`,
              { size: 8, colour: PALETTE.muted },
            );
        } else missing.push(proof);
      } catch {
        missing.push(proof);
      }
    }
    if (missing.length) {
      if (placed === 0) {
        layout.newPage();
        heading();
      }
      layout.sectionLabel("Proof held on the portal");
      layout.table(
        [{ width: 230 }, { width: 289 }],
        missing.map((proof) => [
          proof.caption?.trim() || proof.name,
          { text: `${proof.name}`, sub: `SHA-256 ${proof.sha256}` },
        ]),
        { header: ["Proof", "File"], size: 8 },
      );
    }
  }

  private closing(layout: ReportLayout, data: ReportData, internal: boolean) {
    if (data.evidence?.length) {
      layout.newPage();
      layout.annexureBar("Register", "Documents reviewed for this report");
      layout.table(
        [{ width: 140 }, { width: 379 }],
        data.evidence.map((item) => [
          item.type
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase()),
          { text: item.name, sub: `SHA-256 ${item.sha256}` },
        ]),
        { header: ["Document", "File"], size: 8, labelColumn: true },
      );
    }
    if (internal) this.internalLog(layout, data);
    layout.ensure(150);
    layout.space(16);
    layout.paragraph("-----End of report-----", {
      align: "center",
      bold: true,
      colour: PALETTE.navy,
    });
    layout.space(8);
    layout.paragraph(DISCLAIMER, { size: 7.5, colour: PALETTE.muted });
  }

  /** Internal copy only: who verified each check, the team, sources and costs. */
  private internalLog(layout: ReportLayout, data: ReportData) {
    layout.newPage();
    layout.annexureBar(
      "Internal",
      "Verification log – not part of the client report",
      {
        text: "Internal only",
        fill: PALETTE.navy,
        colour: PALETTE.white,
      },
    );
    const rows: Cell[][] = data.checks.map((check) => {
      const runs = (check.methods ?? [])
        .map(
          (run) =>
            `${run.method.replaceAll("_", " ").toLowerCase()}: ${run.result ? run.result.replaceAll("_", " ").toLowerCase() : "pending"}${run.provider ? ` · ${run.provider}` : ""}${run.reference ? ` · ref ${run.reference}` : ""}`,
        )
        .join("\n");
      const notes = (check.internal?.notes ?? [])
        .map(([name, value]) => `${name}: ${value}`)
        .join("\n");
      return [
        {
          text: check.type
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase()),
          bold: true,
          sub: check.internal?.team ?? undefined,
        },
        {
          text: check.internal?.verifiedBy || "Not recorded",
          sub: check.internal?.verifiedAt
            ? istDate(check.internal.verifiedAt)
            : undefined,
        },
        [runs, notes].filter(Boolean).join("\n") || "—",
      ];
    });
    layout.table([{ width: 150 }, { width: 140 }, { width: 229 }], rows, {
      header: ["Check / team", "Verified by", "Sources, costs and references"],
      size: 8,
    });
  }
}
