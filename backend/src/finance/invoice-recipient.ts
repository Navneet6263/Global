import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface InvoiceRecipient {
  legalName: string;
  displayName: string;
  code: string;
  billingTerms: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
}

export function drawInvoiceRecipient(
  page: PDFPage,
  top: number,
  client: InvoiceRecipient,
  regular: PDFFont,
  bold: PDFFont,
): number {
  let y = top;
  const draw = (value: string, size: number, font = regular) => {
    for (const line of wrapInvoiceRecipient(value, font, size, 310)) {
      page.drawText(line, {
        x: 40,
        y,
        size,
        font,
        color: rgb(0.2, 0.23, 0.26),
      });
      y -= size + 4;
    }
  };
  draw("BILL TO", 8, bold);
  y -= 4;
  draw(client.legalName || client.displayName, 12, bold);
  draw(`Client code: ${client.code}`, 8.5);
  if (client.gstin) draw(`GSTIN: ${client.gstin}`, 8.5);
  if (client.billingAddress) draw(client.billingAddress, 8.5);
  if (client.billingTerms) draw(`Terms: ${client.billingTerms}`, 8.5);
  return y;
}

export function wrapInvoiceRecipient(
  value: string,
  font: Pick<PDFFont, "widthOfTextAtSize">,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const character of value.replace(/\s+/g, " ").trim()) {
    if (line && font.widthOfTextAtSize(line + character, size) > width) {
      lines.push(line.trimEnd());
      line = "";
    }
    line += character;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
