import { PDFDocument, rgb } from "pdf-lib";
import { embedUnicodeFonts } from "../common/pdf/unicode-fonts";
import { ReportWriter } from "../common/pdf/document-writer";
import type { ProposalSnapshot } from "./crm-proposal.policy";

export async function proposalPdf(row: {
  publicId: string;
  revision: number;
  status: string;
  validUntil: Date;
  approvedAt: Date | null;
  snapshot: ProposalSnapshot;
}) {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedUnicodeFonts(pdf);
  const writer = new ReportWriter(pdf, regular, bold);
  const data = row.snapshot;
  writer.heading("SERVICE PROPOSAL", 20);
  writer.text(`Revision ${row.revision} · ${row.status} · ${row.publicId}`, 8);
  if (row.status === "DRAFT")
    writer.heading("DRAFT — NOT APPROVED FOR SENDING", 11);
  if (row.validUntil <= new Date())
    writer.heading("EXPIRED — NOT A CURRENT OFFER", 11);
  writer.text(`Prepared for: ${data.company}`);
  writer.text(`Contact: ${data.contact}`);
  writer.text(`Prepared by: ${data.preparedBy} · ${data.preparedAt}`);
  writer.text(`Valid until: ${row.validUntil.toISOString()}`);
  writer.space();
  for (const line of data.lines) {
    writer.heading(line.name);
    writer.text(
      `${line.serviceFamily} · ${line.quantity} verification(s) · indicative turnaround ${line.tatHours}h`,
    );
    writer.text(
      `Unit price INR ${line.unitPrice.toFixed(2)} · tax ${line.taxRate.toFixed(2)}%`,
    );
  }
  writer.space();
  const money = (value: string) =>
    (Number(value) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  writer.heading(`Total: INR ${money(data.totalPaise)}`, 14);
  writer.text(
    `Subtotal INR ${money(data.subtotalPaise)} · tax INR ${money(data.taxPaise)}`,
  );
  writer.heading("COMMERCIAL TERMS", 12);
  writer.text(data.terms);
  writer.space();
  writer.text(
    "This proposal is not an invoice, payment receipt or verification report. Acceptance is recorded from supplied evidence; no electronic signature is implied.",
    8,
  );
  writer.text(
    "Final service entitlements, contracted rates and turnaround commitments are configured at client onboarding. Prices on existing cases are not changed by this proposal.",
    8,
  );
  if (row.approvedAt)
    writer.text(`Internal approval: ${row.approvedAt.toISOString()}`, 8);
  for (const [index, page] of pdf.getPages().entries())
    page.drawText(
      `Sapling Global · Proposal r${row.revision} · Page ${index + 1} of ${pdf.getPageCount()}`,
      { x: 38, y: 32, size: 8, font: regular, color: rgb(0.35, 0.4, 0.38) },
    );
  pdf.setTitle(`Proposal r${row.revision} — ${data.company}`);
  return Buffer.from(await pdf.save());
}
