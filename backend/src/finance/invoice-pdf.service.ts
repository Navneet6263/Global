import { Injectable } from "@nestjs/common";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  subtotal: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  creditedAmount: unknown;
  notes: string | null;
  createdAt: Date;
  client: {
    legalName: string;
    displayName: string;
    code: string;
    billingTerms: string | null;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: unknown;
    taxRate: unknown;
    lineTotal: unknown;
    case: { caseNumber: string } | null;
  }>;
  payments: Array<{ amount: unknown; method: string; receivedAt: Date }>;
  creditNotes: Array<{
    noteNumber: string;
    amount: unknown;
    reason: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class InvoicePdfService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let page = document.addPage([595, 842]);
    let y = this.header(page, bold, data);

    page.drawText("BILL TO", {
      x: 40,
      y,
      size: 8,
      font: bold,
      color: rgb(0.39, 0.42, 0.46),
    });
    page.drawText(this.safe(data.client.legalName || data.client.displayName), {
      x: 40,
      y: y - 19,
      size: 12,
      font: bold,
      color: rgb(0.08, 0.09, 0.1),
    });
    page.drawText(this.safe(`Client code: ${data.client.code}`), {
      x: 40,
      y: y - 36,
      size: 8.5,
      font: regular,
      color: rgb(0.35, 0.38, 0.42),
    });
    if (data.client.billingTerms) {
      page.drawText(this.safe(data.client.billingTerms), {
        x: 40,
        y: y - 52,
        size: 8.5,
        font: regular,
        color: rgb(0.35, 0.38, 0.42),
      });
    }

    const meta: Array<[string, string]> = [
      ["Issued", this.date(data.issuedAt ?? data.createdAt)],
      ["Due", this.date(data.dueAt)],
      ["Status", data.status.replaceAll("_", " ")],
    ];
    meta.forEach(([label, value], index) => {
      const rowY = y - index * 18;
      page.drawText(label, {
        x: 390,
        y: rowY,
        size: 8,
        font: bold,
        color: rgb(0.39, 0.42, 0.46),
      });
      page.drawText(this.safe(value), {
        x: 455,
        y: rowY,
        size: 8.5,
        font: regular,
        color: rgb(0.08, 0.09, 0.1),
      });
    });
    y -= 82;

    ({ page, y } = this.tableHeader(page, y, bold));
    for (const [index, line] of data.lines.entries()) {
      const description = [
        line.description,
        line.case?.caseNumber ? `Case: ${line.case.caseNumber}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const wrapped = this.wrap(description, 54);
      const rowHeight = Math.max(34, wrapped.length * 11 + 14);
      if (y - rowHeight < 150) {
        page = document.addPage([595, 842]);
        y = this.continuedHeader(page, bold, data.invoiceNumber);
        ({ page, y } = this.tableHeader(page, y, bold));
      }
      if (index % 2 === 1) {
        page.drawRectangle({
          x: 35,
          y: y - rowHeight + 8,
          width: 525,
          height: rowHeight,
          color: rgb(0.97, 0.975, 0.98),
        });
      }
      wrapped.forEach((text, textIndex) =>
        page.drawText(this.safe(text), {
          x: 42,
          y: y - textIndex * 11,
          size: 8.3,
          font: regular,
          color: rgb(0.12, 0.14, 0.16),
        }),
      );
      this.cell(page, String(line.quantity), 347, y, regular);
      this.cell(
        page,
        this.money(data.currency, line.unitPrice),
        388,
        y,
        regular,
      );
      this.cell(page, `${Number(line.taxRate).toFixed(2)}%`, 465, y, regular);
      this.cell(page, this.money(data.currency, line.lineTotal), 514, y, bold);
      y -= rowHeight;
    }

    if (y < 235) {
      page = document.addPage([595, 842]);
      y = this.continuedHeader(page, bold, data.invoiceNumber);
    }
    const balance =
      Number(data.totalAmount) -
      Number(data.paidAmount) -
      Number(data.creditedAmount);
    const totals: Array<[string, string, boolean?]> = [
      ["Subtotal", this.money(data.currency, data.subtotal)],
      ["Tax", this.money(data.currency, data.taxAmount)],
      ["Total", this.money(data.currency, data.totalAmount), true],
      ["Paid", this.money(data.currency, data.paidAmount)],
      ["Credits", this.money(data.currency, data.creditedAmount)],
      ["Balance due", this.money(data.currency, balance), true],
    ];
    y -= 10;
    totals.forEach(([label, value, strong]) => {
      page.drawText(label, {
        x: 390,
        y,
        size: strong ? 9.5 : 8.5,
        font: strong ? bold : regular,
        color: rgb(0.2, 0.23, 0.26),
      });
      page.drawText(this.safe(value), {
        x: 495,
        y,
        size: strong ? 9.5 : 8.5,
        font: strong ? bold : regular,
        color: strong ? rgb(0.08, 0.09, 0.1) : rgb(0.3, 0.33, 0.36),
      });
      y -= strong ? 21 : 17;
    });

    if (data.notes) {
      y -= 6;
      page.drawText("NOTES", {
        x: 40,
        y,
        size: 8,
        font: bold,
        color: rgb(0.39, 0.42, 0.46),
      });
      for (const line of this.wrap(data.notes, 78).slice(0, 6)) {
        y -= 12;
        page.drawText(this.safe(line), {
          x: 40,
          y,
          size: 8.3,
          font: regular,
          color: rgb(0.28, 0.31, 0.34),
        });
      }
    }

    const pages = document.getPages();
    pages.forEach((item, index) => {
      item.drawLine({
        start: { x: 40, y: 46 },
        end: { x: 555, y: 46 },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.84),
      });
      item.drawText("System-generated invoice | Sapling Global", {
        x: 40,
        y: 29,
        size: 7,
        font: regular,
        color: rgb(0.42, 0.45, 0.48),
      });
      item.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: 500,
        y: 29,
        size: 7,
        font: regular,
        color: rgb(0.42, 0.45, 0.48),
      });
    });
    document.setTitle(`Sapling Global invoice ${data.invoiceNumber}`);
    document.setCreationDate(new Date());
    return Buffer.from(await document.save());
  }

  private header(page: PDFPage, bold: PDFFont, data: InvoicePdfData): number {
    page.drawRectangle({
      x: 0,
      y: 760,
      width: 595,
      height: 82,
      color: rgb(0.07, 0.08, 0.09),
    });
    page.drawText("Sapling Global", {
      x: 40,
      y: 802,
      size: 21,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("VERIFICATION SERVICES", {
      x: 41,
      y: 785,
      size: 7.5,
      font: bold,
      color: rgb(0.7, 0.95, 0.25),
    });
    page.drawText("INVOICE", {
      x: 468,
      y: 805,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(this.safe(data.invoiceNumber), {
      x: 425,
      y: 784,
      size: 8.5,
      font: bold,
      color: rgb(0.75, 0.78, 0.8),
    });
    return 722;
  }

  private continuedHeader(
    page: PDFPage,
    bold: PDFFont,
    invoiceNumber: string,
  ): number {
    page.drawText("Sapling Global | Invoice continued", {
      x: 40,
      y: 803,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.12, 0.14),
    });
    page.drawText(this.safe(invoiceNumber), {
      x: 455,
      y: 803,
      size: 8,
      font: bold,
      color: rgb(0.4, 0.43, 0.46),
    });
    return 770;
  }

  private tableHeader(
    page: PDFPage,
    y: number,
    bold: PDFFont,
  ): { page: PDFPage; y: number } {
    page.drawRectangle({
      x: 35,
      y: y - 9,
      width: 525,
      height: 25,
      color: rgb(0.9, 0.93, 0.95),
    });
    [
      ["Description", 42],
      ["Qty", 347],
      ["Rate", 388],
      ["Tax", 465],
      ["Amount", 514],
    ].forEach(([label, x]) =>
      page.drawText(String(label), {
        x: Number(x),
        y,
        size: 7.5,
        font: bold,
        color: rgb(0.25, 0.28, 0.31),
      }),
    );
    return { page, y: y - 31 };
  }

  private cell(
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    font: PDFFont,
  ): void {
    page.drawText(this.safe(value), {
      x,
      y,
      size: 7.7,
      font,
      color: rgb(0.14, 0.16, 0.18),
    });
  }

  private money(currency: string, value: unknown): string {
    return `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private date(value: Date | null): string {
    return value
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(value)
      : "Not set";
  }

  private wrap(value: string, width: number): string[] {
    const lines: string[] = [];
    for (const word of this.safe(value).split(/\s+/)) {
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
}
