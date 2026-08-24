import { Injectable } from "@nestjs/common";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

interface ReportData {
  caseNumber: string;
  generatedAt: Date;
  authenticityCode: string;
  clientName: string;
  candidateName: string;
  completedAt: Date | null;
  riskLevel: string | null;
  checks: Array<{
    type: string;
    result: string | null;
    riskLevel: string | null;
    sourceSummary: string | null;
    findings: Array<{ severity: string; title: string; description: string }>;
  }>;
}

@Injectable()
export class ReportPdfService {
  async render(data: ReportData): Promise<Buffer> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let page = document.addPage([595, 842]);
    let y = 790;

    page.drawRectangle({
      x: 0,
      y: 790,
      width: 595,
      height: 52,
      color: rgb(0.08, 0.09, 0.1),
    });
    page.drawText("Sapling Global", {
      x: 38,
      y: 813,
      size: 19,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("VERIFICATION REPORT", {
      x: 385,
      y: 816,
      size: 9,
      font: bold,
      color: rgb(0.7, 0.96, 0.24),
    });
    y = 755;

    const summary: Array<[string, string]> = [
      ["Case ID", data.caseNumber],
      ["Client", data.clientName],
      ["Candidate", data.candidateName],
      ["Completed", data.completedAt?.toISOString() ?? "Pending"],
      ["Overall risk", data.riskLevel ?? "Not classified"],
    ];
    summary.forEach(([label, value]) => {
      page.drawText(this.safe(label), {
        x: 38,
        y,
        size: 9,
        font: bold,
        color: rgb(0.38, 0.4, 0.43),
      });
      page.drawText(this.safe(value), {
        x: 145,
        y,
        size: 10,
        font: regular,
        color: rgb(0.08, 0.09, 0.1),
      });
      y -= 22;
    });

    y -= 8;
    page.drawText("CHECK OUTCOMES", {
      x: 38,
      y,
      size: 11,
      font: bold,
      color: rgb(0.08, 0.09, 0.1),
    });
    y -= 22;
    for (const check of data.checks) {
      if (y < 145) ({ page, y } = this.nextPage(document, bold));
      page.drawRectangle({
        x: 34,
        y: y - 10,
        width: 527,
        height: 26,
        color: rgb(0.95, 0.96, 0.97),
      });
      page.drawText(this.safe(check.type.replaceAll("_", " ")), {
        x: 42,
        y,
        size: 10,
        font: bold,
        color: rgb(0.08, 0.09, 0.1),
      });
      page.drawText(this.safe(check.result ?? "PENDING"), {
        x: 425,
        y,
        size: 9,
        font: bold,
        color: this.resultColor(check.result),
      });
      y -= 28;
      for (const line of this.wrap(
        check.sourceSummary ?? "No source summary supplied.",
        88,
      )) {
        page.drawText(this.safe(line), {
          x: 42,
          y,
          size: 8.5,
          font: regular,
          color: rgb(0.28, 0.3, 0.32),
        });
        y -= 12;
      }
      for (const finding of check.findings) {
        for (const line of this.wrap(
          `${finding.severity}: ${finding.title} — ${finding.description}`,
          82,
        )) {
          if (y < 80) ({ page, y } = this.nextPage(document, bold));
          page.drawText(this.safe(`• ${line}`), {
            x: 48,
            y,
            size: 8,
            font: regular,
            color: rgb(0.45, 0.18, 0.12),
          });
          y -= 11;
        }
      }
      y -= 12;
    }

    const pages = document.getPages();
    pages.forEach((item, index) => {
      item.drawLine({
        start: { x: 38, y: 48 },
        end: { x: 557, y: 48 },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.84),
      });
      item.drawText(`Authenticity: ${data.authenticityCode}`, {
        x: 38,
        y: 30,
        size: 7.5,
        font: regular,
        color: rgb(0.35, 0.37, 0.4),
      });
      item.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: 500,
        y: 30,
        size: 7.5,
        font: regular,
        color: rgb(0.35, 0.37, 0.4),
      });
    });
    document.setTitle(`Sapling Global report ${data.caseNumber}`);
    document.setCreationDate(data.generatedAt);
    return Buffer.from(await document.save());
  }

  private nextPage(
    document: PDFDocument,
    bold: PDFFont,
  ): { page: PDFPage; y: number } {
    const page = document.addPage([595, 842]);
    page.drawText("Sapling Global — verification report continued", {
      x: 38,
      y: 805,
      size: 9,
      font: bold,
      color: rgb(0.25, 0.27, 0.3),
    });
    return { page, y: 775 };
  }

  private wrap(value: string, width: number): string[] {
    const words = this.safe(value).split(/\s+/);
    const lines: string[] = [];
    for (const word of words) {
      const current = lines.at(-1);
      if (!current || current.length + word.length + 1 > width)
        lines.push(word);
      else lines[lines.length - 1] = `${current} ${word}`;
    }
    return lines;
  }

  private safe(value: string): string {
    return value.replace(/[^\x20-\x7E]/g, "?");
  }

  private resultColor(result: string | null) {
    if (result === "CLEAR") return rgb(0.08, 0.48, 0.27);
    if (result === "DISCREPANCY") return rgb(0.76, 0.16, 0.17);
    return rgb(0.48, 0.4, 0.1);
  }
}
