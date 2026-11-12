import { Injectable } from "@nestjs/common";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { INVOICE_SELLER } from "../common/company-details";
import { SAPLING_WORDMARK_PNG } from "../common/pdf/brand-logo";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import { wrapInvoiceRecipient } from "./invoice-recipient";
import {
  rupees,
  taxInvoiceModel,
  type TaxInvoice,
  type TaxInvoiceRow,
  type TaxInvoiceSource,
} from "./tax-invoice-model";

/** What the renderer needs; the other invoice fields may be passed and are ignored. */
export type InvoicePdfData = TaxInvoiceSource & {
  currency?: string;
  dueAt?: Date | null;
  paidAmount?: unknown;
  creditedAmount?: unknown;
  notes?: string | null;
  client: TaxInvoiceSource["client"] & {
    code?: string;
    billingTerms?: string | null;
  };
  lines: Array<
    TaxInvoiceSource["lines"][number] & {
      lineTotal?: unknown;
      case?: { caseNumber: string } | null;
    }
  >;
  payments?: unknown[];
  creditNotes?: unknown[];
};

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.3, 0.3, 0.3);
const LEFT = 40;
const RIGHT = 555;
const MID = 310;
/** Columns of the particulars table: Particulars | HSN/SAC | Period | Quantity | Rate | Amount. */
const COLS = [LEFT, 268, 318, 366, 420, 470, RIGHT];
const TOP = 800;
/** Lowest point of the items area on the page that carries the totals. */
const ITEMS_FLOOR = 300;

type Fonts = { regular: PDFFont; bold: PDFFont };
const BOLD = new WeakSet<PDFFont>();

/**
 * Tax invoice in the company's format (Sample Invoice Format): seller and invoice details,
 * buyer, particulars with HSN/SAC and period, CGST/SGST or IGST, round-off, amount in
 * words, the tax summary, bank details and the authorised signatory.
 */
@Injectable()
export class InvoicePdfService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    const model = taxInvoiceModel(data);
    const document = await PDFDocument.create();
    const fonts = await embedUnicodeFonts(document);
    BOLD.add(fonts.bold);
    const logo = await document.embedPng(
      Buffer.from(SAPLING_WORDMARK_PNG, "base64"),
    );

    // Item rows and the tax lines under them, page by page.
    const items: Array<{
      height: number;
      draw: (page: PDFPage, y: number) => void;
    }> = [
      ...model.rows.map((row) => this.itemRow(row, fonts)),
      ...model.taxRows.map((row) => this.taxRow(row, fonts)),
      ...(model.roundOff ? [this.roundOffRow(model.roundOff, fonts)] : []),
    ];
    let page = this.frame(document, model, fonts, logo, true);
    // Top of the items area: under the table header (first page 590, later pages 760).
    let tableTop = 568;
    let y = tableTop - 13;
    for (const item of items) {
      if (y - item.height < ITEMS_FLOOR) {
        this.columns(page, tableTop, 62);
        this.text(
          page,
          "Continued on the next page",
          LEFT + 6,
          66,
          7,
          fonts.regular,
          MUTED,
        );
        page = this.frame(document, model, fonts, logo, false);
        tableTop = 738;
        y = tableTop - 13;
      }
      item.draw(page, y);
      y -= item.height;
    }
    this.totals(page, model, fonts, tableTop);

    document.setTitle(`Sapling Global invoice ${model.invoiceNumber}`);
    document.setCreationDate(new Date());
    return Buffer.from(await document.save());
  }

  /** Title, outer box and, on the first page, the seller, invoice and buyer blocks. */
  private frame(
    document: PDFDocument,
    model: TaxInvoice,
    { regular, bold }: Fonts,
    logo: PDFImage,
    first: boolean,
  ) {
    const page = document.addPage([595, 842]);
    this.center(page, model.title, 812, 12, bold);
    if (model.note) this.center(page, model.note, 803, 7, regular, MUTED);
    page.drawRectangle({
      x: LEFT,
      y: 62,
      width: RIGHT - LEFT,
      height: TOP - 62,
      borderColor: INK,
      borderWidth: 0.8,
    });
    this.center(page, "This is a Computer Generated Invoice", 48, 8, regular);
    if (!first) {
      this.text(
        page,
        `${model.invoiceNumber} (continued)`,
        LEFT + 6,
        TOP - 16,
        9,
        bold,
      );
      this.tableHeader(page, 760, { regular, bold });
      return page;
    }

    // Seller (left) and invoice details (right).
    page.drawImage(logo, { x: LEFT + 5, y: TOP - 24, width: 66, height: 15.2 });
    let y = TOP - 12;
    const seller: Array<[string, PDFFont, number]> = [
      [INVOICE_SELLER.name, bold, 8],
      ...INVOICE_SELLER.address.map((line): [string, PDFFont, number] => [
        line,
        regular,
        8,
      ]),
      [`GSTIN/UIN: ${INVOICE_SELLER.gstin}`, regular, 8],
      [
        `State Name : ${INVOICE_SELLER.stateName}, Code : ${INVOICE_SELLER.stateCode}`,
        regular,
        8,
      ],
      [`E-Mail : ${INVOICE_SELLER.email}`, regular, 8],
    ];
    for (const [value, font, size] of seller) {
      this.text(page, value, 116, y, size, font);
      y -= 10.5;
    }
    this.line(page, LEFT, 690, MID, 690);
    this.line(page, MID, TOP, MID, 590);
    const cells: Array<[string, string, string, string]> = [
      ["Invoice No.", model.invoiceNumber, "Dated", model.dated],
      ["Reference No. & Date.", "", "Other References", ""],
      ["Buyer's Order No.", "", "Dated", ""],
    ];
    cells.forEach(([label, value, label2, value2], index) => {
      const top = TOP - index * 36.7;
      this.line(page, MID, top - 36.7, RIGHT, top - 36.7);
      this.text(page, label, MID + 4, top - 10, 7.5, regular);
      this.text(page, value, MID + 4, top - 22, 9, bold);
      this.text(page, label2, 440 + 4, top - 10, 7.5, regular);
      this.text(page, value2, 440 + 4, top - 22, 9, bold);
    });
    this.line(page, 440, TOP, 440, TOP - 110);

    // Buyer (Bill to).
    y = 680;
    this.text(page, "Buyer (Bill to)", LEFT + 4, y, 7.5, regular);
    y -= 12;
    this.text(page, model.buyer.name.toUpperCase(), LEFT + 4, y, 9, bold);
    y -= 11;
    for (const line of wrapInvoiceRecipient(
      model.buyer.address,
      regular,
      8,
      262,
    ).slice(0, 3)) {
      this.text(page, line, LEFT + 4, y, 8, regular);
      y -= 10;
    }
    const facts: Array<[string, string]> = [
      ["GSTIN/UIN", model.buyer.gstin],
      [
        "State Name",
        `${model.buyer.stateName}, Code : ${model.buyer.stateCode}`,
      ],
      ["Place of Supply", model.buyer.stateName],
    ];
    for (const [label, value] of facts) {
      this.text(page, label, LEFT + 4, y, 8, regular);
      this.text(page, `: ${value}`, LEFT + 74, y, 8, regular);
      y -= 10;
    }
    this.tableHeader(page, 590, { regular, bold });
    return page;
  }

  private tableHeader(page: PDFPage, top: number, { regular }: Fonts) {
    this.line(page, LEFT, top, RIGHT, top);
    this.line(page, LEFT, top - 22, RIGHT, top - 22);
    const heads = [
      "Particulars",
      "HSN/SAC",
      "Period",
      "Quantity /",
      "Rate",
      "Amount",
    ];
    heads.forEach((head, index) => {
      const from = COLS[index]!;
      const to = COLS[index + 1]!;
      this.center(page, head, top - 10, 7.5, regular, INK, (from + to) / 2);
    });
    this.center(
      page,
      "Cases",
      top - 19,
      7.5,
      regular,
      INK,
      (COLS[3]! + COLS[4]!) / 2,
    );
  }

  /** Vertical lines of the particulars table between two heights. */
  private columns(page: PDFPage, top: number, bottom: number) {
    for (const x of COLS.slice(1, -1)) this.line(page, x, top, x, bottom);
  }

  private itemRow(row: TaxInvoiceRow, { regular, bold }: Fonts) {
    const lines = wrapInvoiceRecipient(row.particulars, bold, 8.5, 205);
    const height = lines.length * 11 + 14;
    return {
      height,
      draw: (page: PDFPage, y: number) => {
        lines.forEach((text, index) =>
          this.text(page, text, LEFT + 30, y - index * 11, 8.5, bold),
        );
        this.text(
          page,
          row.detail,
          LEFT + 30,
          y - lines.length * 11,
          7.5,
          regular,
          MUTED,
        );
        this.text(page, row.sac, COLS[1]! + 4, y, 8, regular);
        this.center(
          page,
          row.period,
          y,
          8,
          bold,
          INK,
          (COLS[2]! + COLS[3]!) / 2,
        );
        this.center(
          page,
          String(row.quantity),
          y,
          8.5,
          bold,
          INK,
          (COLS[3]! + COLS[4]!) / 2,
        );
        this.right(page, rupees(row.rate), COLS[5]! - 4, y, 8, regular);
        this.right(page, rupees(row.amount), RIGHT - 4, y, 8.5, bold);
      },
    };
  }

  private taxRow(
    row: { label: string; rate: string; amount: number },
    { bold }: Fonts,
  ) {
    return {
      height: 12,
      draw: (page: PDFPage, y: number) => {
        this.right(page, row.label, COLS[1]! - 4, y, 8.5, bold);
        this.center(
          page,
          row.rate,
          y,
          8.5,
          bold,
          INK,
          (COLS[4]! + COLS[5]!) / 2,
        );
        this.right(page, rupees(row.amount), RIGHT - 4, y, 8.5, bold);
      },
    };
  }

  private roundOffRow(paise: number, { regular, bold }: Fonts) {
    return {
      height: 12,
      draw: (page: PDFPage, y: number) => {
        this.text(
          page,
          paise < 0 ? "Less :" : "Add :",
          LEFT + 4,
          y,
          7.5,
          regular,
        );
        this.text(page, "SHORT & EXCESS", LEFT + 30, y, 8.5, bold);
        const value = rupees(Math.abs(paise));
        this.right(
          page,
          paise < 0 ? `(-)${value}` : value,
          RIGHT - 4,
          y,
          8.5,
          bold,
        );
      },
    };
  }

  /** Total, amount in words, tax summary, bank details and the signatory. */
  private totals(
    page: PDFPage,
    model: TaxInvoice,
    fonts: Fonts,
    tableTop: number,
  ) {
    const { regular, bold } = fonts;
    const totalTop = 284;
    this.columns(page, tableTop, totalTop - 16);
    this.line(page, LEFT, totalTop, RIGHT, totalTop);
    this.line(page, LEFT, totalTop - 16, RIGHT, totalTop - 16);
    this.right(page, "Total", COLS[4]! - 4, totalTop - 11, 8.5, regular);
    this.right(
      page,
      `₹ ${rupees(model.total)}`,
      RIGHT - 4,
      totalTop - 11,
      10,
      bold,
    );

    let y = totalTop - 26;
    this.text(page, "Amount Chargeable (in words)", LEFT + 4, y, 7.5, regular);
    this.right(page, "E. & O.E", RIGHT - 4, y, 7.5, regular);
    y -= 12;
    this.text(page, model.words, LEFT + 4, y, 9, bold);

    // Tax summary: Taxable Value | CGST | SGST/UTGST | Total, or IGST between states.
    y -= 8;
    const head = y;
    const intra = model.intraState;
    const xs = intra
      ? [LEFT, 300, 362, 386, 440, 464, 505, RIGHT]
      : [LEFT, 340, 400, 430, 490, RIGHT];
    this.line(page, LEFT, head, RIGHT, head);
    const groups = intra
      ? [
          ["CGST", xs[2]!, xs[4]!],
          ["SGST/UTGST", xs[4]!, xs[6]!],
        ]
      : [["IGST", xs[2]!, xs[4]!]];
    this.center(
      page,
      "Taxable",
      head - 9,
      7.5,
      regular,
      INK,
      (xs[1]! + xs[2]!) / 2,
    );
    this.center(
      page,
      "Value",
      head - 19,
      7.5,
      regular,
      INK,
      (xs[1]! + xs[2]!) / 2,
    );
    for (const [label, from, to] of groups) {
      this.center(
        page,
        String(label),
        head - 9,
        7.5,
        regular,
        INK,
        (Number(from) + Number(to)) / 2,
      );
      this.line(page, Number(from), head - 12, Number(to), head - 12);
    }
    const subHeads = intra
      ? ["Rate", "Amount", "Rate", "Amount"]
      : ["Rate", "Amount"];
    subHeads.forEach((label, index) =>
      this.center(
        page,
        label,
        head - 19,
        7.5,
        regular,
        INK,
        (xs[index + 2]! + xs[index + 3]!) / 2,
      ),
    );
    const last = xs.length - 2;
    this.center(
      page,
      "Total",
      head - 9,
      7.5,
      regular,
      INK,
      (xs[last]! + xs[last + 1]!) / 2,
    );
    this.center(
      page,
      "Tax Amount",
      head - 19,
      7.5,
      regular,
      INK,
      (xs[last]! + xs[last + 1]!) / 2,
    );
    y = head - 22;
    this.line(page, LEFT, y, RIGHT, y);
    const rows = [
      ...model.summary.map((row) => ({ label: "", ...row })),
      {
        label: "Total:",
        taxable: model.taxable,
        rate: -1,
        ...model.totals,
      },
    ];
    for (const row of rows) {
      y -= 10;
      const strong = row.label ? bold : regular;
      if (row.label) this.right(page, row.label, xs[1]! - 4, y, 8, bold);
      this.right(page, rupees(row.taxable), xs[2]! - 3, y, 8, strong);
      const rate = row.rate < 0 ? "" : `${intra ? row.rate / 2 : row.rate}%`;
      const cells = intra
        ? [
            rate,
            rupees(row.cgst),
            rate,
            rupees(row.sgst),
            rupees(row.cgst + row.sgst),
          ]
        : [rate, rupees(row.igst), rupees(row.igst)];
      cells.forEach((value, index) => {
        const xRight = xs[index + 3]! - 3;
        if (value.endsWith("%"))
          this.center(
            page,
            value,
            y,
            8,
            strong,
            INK,
            (xs[index + 2]! + xs[index + 3]!) / 2,
          );
        else this.right(page, value, xRight, y, 8, strong);
      });
      y -= 3;
      this.line(page, LEFT, y, RIGHT, y);
    }
    // Rate | Amount dividers start under their group title (CGST, SGST/UTGST, IGST).
    const inside = intra ? [xs[3], xs[5]] : [xs[3]];
    for (const x of xs.slice(1, -1))
      this.line(page, x, inside.includes(x) ? head - 12 : head, x, y);

    y -= 13;
    this.text(page, "Tax Amount (in words) :", LEFT + 4, y, 8, regular);
    this.text(page, model.taxWords, LEFT + 100, y, 8.5, bold);
    y -= 12;
    this.text(page, "Company's Bank Details", LEFT + 4, y, 8, regular);
    const bank: Array<[string, string]> = [
      ["Bank Name", INVOICE_SELLER.bank.name],
      ["A/c No.", INVOICE_SELLER.bank.account],
      ["Branch & IFS Code", INVOICE_SELLER.bank.branchAndIfsc],
    ];
    for (const [label, value] of bank) {
      y -= 10;
      this.text(page, label, LEFT + 4, y, 8, regular);
      this.text(page, `: ${value}`, LEFT + 82, y, 8, bold);
    }
    y -= 8;
    this.line(page, LEFT, y, RIGHT, y);
    this.right(page, `for ${INVOICE_SELLER.name}`, RIGHT - 4, y - 11, 8, bold);
    this.right(page, "Authorised Signatory", RIGHT - 4, 68, 8, regular);
  }

  private text(
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color = INK,
  ) {
    page.drawText(value, { x, y, size, font, color });
    // The font has one weight; bold is drawn twice, a fraction of a point apart.
    if (BOLD.has(font))
      page.drawText(value, { x: x + 0.3, y, size, font, color });
  }

  private right(
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
  ) {
    this.text(
      page,
      value,
      x - font.widthOfTextAtSize(value, size),
      y,
      size,
      font,
    );
  }

  private center(
    page: PDFPage,
    value: string,
    y: number,
    size: number,
    font: PDFFont,
    color = INK,
    middle = 297.5,
  ) {
    this.text(
      page,
      value,
      middle - font.widthOfTextAtSize(value, size) / 2,
      y,
      size,
      font,
      color,
    );
  }

  private line(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.6,
      color: INK,
    });
  }
}
