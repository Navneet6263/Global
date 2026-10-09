import { Injectable } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import { ReportWriter, type Colour } from "../common/pdf/document-writer";
export { wrapToWidth } from "../common/pdf/document-writer";
import { SAPLING_WORDMARK_PNG } from "../common/pdf/brand-logo";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import { serviceReportSections, type ReportData } from "./report-data";
import {
  DispositionLabels,
  caseColour,
  effectiveDisposition,
  type Disposition,
} from "../verification/dispositions";
import {
  checkStatusLabel,
  verifiedFormFor,
} from "../verification/verified-fields";
import { INITIATION_FORMS } from "../workflow/initiation-fields";
import {
  groupedReportChecks,
  reportTemplateConfig,
} from "./report-template-config";

const muted = rgb(0.36, 0.4, 0.38);

/** Report colours for each disposition (band colour in the PDF). */
const COLOURS: Record<Disposition, Colour> = {
  GREEN: [0.09, 0.5, 0.24],
  RED: [0.72, 0.11, 0.11],
  YELLOW: [0.79, 0.62, 0.02],
  AMBER: [0.85, 0.47, 0.02],
  BLUE: [0.11, 0.3, 0.85],
  CLIENT_REVIEW: [0.42, 0.45, 0.5],
};

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

const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

@Injectable()
export class ReportPdfService {
  async render(data: ReportData): Promise<Buffer> {
    const document = await PDFDocument.create();
    const { regular, bold } = await embedUnicodeFonts(document);
    const logo = await document.embedPng(
      Buffer.from(SAPLING_WORDMARK_PNG, "base64"),
    );
    const writer = new ReportWriter(document, regular, bold, {
      logo,
      caption: data.interim
        ? "Interim verification report"
        : "Background verification report",
      watermark: data.interim ? "INTERIM" : undefined,
    });
    writer.heading(
      data.interim ? "INTERIM VERIFICATION REPORT" : "VERIFICATION REPORT",
      18,
    );
    if (data.interim)
      writer.text(
        "Work in progress. Only checks already verified are reported; final results may change.",
        8.5,
      );
    writer.space(4);

    writer.table(
      [
        { label: "Candidate & case", width: 175 },
        { label: "Detail", width: 350 },
      ],
      [
        ["Candidate", data.candidateName],
        ["Sapling case ID", data.caseNumber],
        ...(data.identityDetails ?? []).map(([label, value]) => [label, value]),
        ["Requesting organisation", data.clientName],
        ["Report generated", istDate(data.generatedAt)],
        [
          data.interim ? "Status" : "Completed",
          data.interim ? "Work in progress" : istDate(data.completedAt),
        ],
        [
          "Overall risk",
          data.riskLevel ? readable(data.riskLevel) : "Not classified",
        ],
      ],
    );

    const overall = data.interim ? null : caseColour(data.checks);
    if (overall)
      writer.section(
        `OVERALL STATUS: ${DispositionLabels[overall].toUpperCase()}`,
        "Taken from the most serious verified check in this report.",
        COLOURS[overall],
      );

    writer.heading("SUMMARY OF CHECKS", 12);
    writer.table(
      [
        { label: "#", width: 25 },
        { label: "Check", width: 130 },
        { label: "Status", width: 150 },
        { label: "Remarks", width: 220 },
      ],
      data.checks.map((check, index) => [
        String(index + 1),
        readable(check.type),
        this.status(check, data.interim),
        check.result
          ? (check.sourceSummary ?? "").slice(0, 140)
          : "Verification in progress",
      ]),
      {
        marks: {
          column: 2,
          colours: data.checks.map((check) => {
            const colour = effectiveDisposition(check);
            return colour ? COLOURS[colour] : null;
          }),
        },
      },
    );

    const services = data.services?.length ? data.services : ["HIRECHECK"];
    for (const family of services) {
      const template = serviceReportSections[family];
      const style = reportTemplateConfig[family];
      writer.section(
        template?.title ?? family,
        style?.summary ?? "Approved service evidence",
        style?.color ?? [0.08, 0.5, 0.38],
      );
      writer.text(
        template?.focus ??
          "Checks completed within the approved service scope.",
      );
      const checks = data.checks.filter(
        (check) => check.serviceFamily === family || !check.serviceFamily,
      );
      writer.text(
        `${checks.length} checks · ${checks.filter((check) => check.result === "CLEAR").length} clear · ${checks.filter((check) => check.result === "DISCREPANCY").length} discrepancy · ${checks.filter((check) => check.result === "UNABLE_TO_VERIFY").length} unable to verify`,
        8,
      );
      for (const group of groupedReportChecks(family, checks)) {
        writer.heading(group.heading.toUpperCase(), 10);
        for (const check of group.items)
          this.renderCheck(writer, check, data.interim);
      }
      if (!checks.length)
        writer.text("No check outcomes recorded in this service section.");
      writer.space();
    }

    writer.heading("EVIDENCE REGISTER", 12);
    if (data.evidence?.length)
      writer.table(
        [
          { label: "Document", width: 140 },
          { label: "File", width: 175 },
          { label: "SHA-256", width: 210 },
        ],
        data.evidence.map((item) => [
          readable(item.type),
          item.name,
          item.sha256,
        ]),
        { size: 7.5 },
      );
    else writer.text("No document attachments referenced in this report.");
    writer.space();
    writer.heading(data.interim ? "STATUS" : "REVIEW AND RECOMMENDATION", 12);
    if (!data.interim)
      writer.table(
        [
          { label: "Step", width: 175 },
          { label: "By", width: 175 },
          { label: "When", width: 175 },
        ],
        [
          [
            "Quality review (QC)",
            data.reviewerName ?? "Not recorded",
            istDate(data.reviewedAt),
          ],
          [
            "Final approval",
            data.managerName ?? "Not recorded",
            istDate(data.approvedAt),
          ],
        ],
      );
    writer.text(
      data.recommendation ??
        (data.interim
          ? "This interim report is shared for information while verification continues."
          : "Use the recorded findings within the agreed verification scope."),
    );
    writer.space();
    writer.text(
      "Findings describe the verified scope and sources. They are not an automated hiring or character decision.",
      8,
    );
    writer.text(
      "Report release and current authenticity status must be checked through the Sapling Global portal.",
      8,
    );

    document.getPages().forEach((page, index, pages) => {
      page.drawLine({
        start: { x: 38, y: 47 },
        end: { x: 557, y: 47 },
        thickness: 0.5,
        color: rgb(0.82, 0.86, 0.83),
      });
      page.drawText(`Authenticity: ${data.authenticityCode}`, {
        x: 38,
        y: 31,
        size: 7.5,
        font: regular,
        color: muted,
      });
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: 488,
        y: 31,
        size: 7.5,
        font: regular,
        color: muted,
      });
    });
    document.setTitle(
      `Sapling Global ${data.interim ? "interim " : ""}report ${data.caseNumber}`,
    );
    document.setSubject(
      `${data.interim ? "Interim" : "Approved"} ${services.join(", ")} verification findings`,
    );
    document.setCreationDate(data.generatedAt);
    return Buffer.from(await document.save());
  }

  private status(check: ReportData["checks"][number], interim?: boolean) {
    if (!check.result) return interim ? "In progress" : "Pending";
    return checkStatusLabel(
      check.type,
      check.result,
      effectiveDisposition(check),
    );
  }

  private renderCheck(
    writer: ReportWriter,
    check: ReportData["checks"][number],
    interim?: boolean,
  ) {
    writer.heading(
      `${readable(check.type)} — ${this.status(check, interim)}`,
      10.5,
    );
    if (!check.result) {
      writer.text("Verification is in progress for this check.", 8.5);
      writer.space(6);
      return;
    }
    const lhsForm = INITIATION_FORMS[check.type.toUpperCase()];
    const rhsForm = verifiedFormFor(check.type);
    const claimed = check.claimed ?? [];
    const verified = check.verified ?? [];
    const entries = Math.max(claimed.length, verified.length);
    for (let index = 0; index < entries; index += 1) {
      const lhs = claimed[index] ?? {};
      const rhs = verified[index] ?? {};
      const shared = (lhsForm?.fields ?? []).filter((field) =>
        rhsForm.fields.some((other) => other.key === field.key),
      );
      if (entries > 1) writer.text(`Entry ${index + 1}`, 8.5, true);
      if (shared.length)
        writer.table(
          [
            { label: "Detail", width: 155 },
            { label: "As provided", width: 185 },
            { label: "As verified", width: 185 },
          ],
          shared.map((field) => [
            field.label,
            lhs[field.key] ?? "",
            rhs[field.key] ?? "",
          ]),
          { size: 8 },
        );
      const sharedKeys = new Set(shared.map((field) => field.key));
      const details = rhsForm.fields
        .filter(
          (field) =>
            !sharedKeys.has(field.key) &&
            !field.key.startsWith("extraCost") &&
            rhs[field.key],
        )
        .map((field) => [
          field.label.replace(/ \(confirmed\)$/, ""),
          field.kind === "date" ? istDate(rhs[field.key]) : rhs[field.key]!,
        ]);
      if (details.length)
        writer.table(
          [
            { label: "Verification detail", width: 200 },
            { label: "Recorded", width: 325 },
          ],
          details,
          { size: 8 },
        );
    }
    if (check.riskLevel)
      writer.text(`Check risk: ${readable(check.riskLevel)}`, 8);
    writer.text(check.sourceSummary ?? "No source summary supplied.");
    for (const method of check.methods ?? []) {
      writer.text(
        `${readable(method.method)}: ${method.result ? readable(method.result) : "Pending"} · source: ${method.provider ?? "Manual review"} · reference: ${method.reference ?? "Not supplied"}`,
        8,
      );
      if (method.sourceContact)
        writer.text(`Source contact: ${method.sourceContact}`, 8);
      if (method.requestedAt)
        writer.text(
          `Requested: ${istDate(method.requestedAt)} · Responded: ${method.respondedAt ? istDate(method.respondedAt) : "Not recorded"}`,
          8,
        );
      if (method.summary)
        writer.text(`Response findings: ${method.summary}`, 8);
    }
    for (const finding of check.findings) {
      writer.text(
        `${finding.severity}: ${finding.title} — ${finding.description}`,
        8.5,
      );
      if (finding.source) writer.text(`Source: ${finding.source}`, 8);
    }
    writer.space(6);
  }
}
