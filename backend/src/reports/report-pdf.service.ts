import { Injectable } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import { ReportWriter } from "../common/pdf/document-writer";
export { wrapToWidth } from "../common/pdf/document-writer";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import { serviceReportSections, type ReportData } from "./report-data";
import {
  groupedReportChecks,
  reportTemplateConfig,
} from "./report-template-config";

const muted = rgb(0.36, 0.4, 0.38);

@Injectable()
export class ReportPdfService {
  async render(data: ReportData): Promise<Buffer> {
    const document = await PDFDocument.create();
    const { regular, bold } = await embedUnicodeFonts(document);
    const writer = new ReportWriter(document, regular, bold);
    writer.heading("VERIFICATION REPORT", 18);
    writer.text(`Case: ${data.caseNumber}`);
    writer.text(`Requesting organisation: ${data.clientName}`);
    writer.text(`Subject: ${data.candidateName}`);
    for (const [label, value] of data.identityDetails ?? [])
      writer.text(`${label}: ${value}`);
    writer.text(`Reviewed risk: ${data.riskLevel ?? "Not classified"}`);
    writer.text(`Generated: ${data.generatedAt.toISOString()}`);
    writer.space();

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
        for (const check of group.items) this.renderCheck(writer, check);
      }
      if (!checks.length)
        writer.text("No check outcomes recorded in this service section.");
      writer.space();
    }

    writer.heading("EVIDENCE REGISTER", 12);
    for (const item of data.evidence ?? []) {
      writer.text(`${item.type.replaceAll("_", " ")} — ${item.name}`);
      writer.text(`SHA-256: ${item.sha256}`, 7.5);
    }
    if (!data.evidence?.length)
      writer.text(
        "No document attachments referenced in the approved snapshot.",
      );
    writer.space();
    writer.heading("REVIEW AND RECOMMENDATION", 12);
    writer.text(`QA reviewer: ${data.reviewerName ?? "Not recorded"}`);
    writer.text(`QA reviewed at: ${data.reviewedAt ?? "Not recorded"}`);
    writer.text(`Approving manager: ${data.managerName ?? "Not recorded"}`);
    writer.text(`Manager approved at: ${data.approvedAt ?? "Not recorded"}`);
    writer.text(
      data.recommendation ??
        "Use the recorded findings within the agreed verification scope.",
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
    document.setTitle(`Sapling Global report ${data.caseNumber}`);
    document.setSubject(
      `Approved ${services.join(", ")} verification findings`,
    );
    document.setCreationDate(data.generatedAt);
    return Buffer.from(await document.save());
  }

  private renderCheck(
    writer: ReportWriter,
    check: ReportData["checks"][number],
  ) {
    writer.heading(
      `${check.type.replaceAll("_", " ")} — ${check.result ?? "PENDING"}`,
      10,
    );
    writer.text(`Check risk: ${check.riskLevel ?? "Not classified"}`, 8);
    writer.text(check.sourceSummary ?? "No source summary supplied.");
    for (const method of check.methods ?? []) {
      writer.text(
        `${method.method}: ${method.result ?? "Pending"}; source: ${method.provider ?? "Manual review"}; reference: ${method.reference ?? "Not supplied"}`,
        8,
      );
      if (method.sourceContact)
        writer.text(`Source contact: ${method.sourceContact}`, 8);
      if (method.requestedAt)
        writer.text(
          `Requested: ${method.requestedAt} · Responded: ${method.respondedAt ?? "Not recorded"}`,
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
