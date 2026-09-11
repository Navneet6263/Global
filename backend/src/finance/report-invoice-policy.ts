import { BadRequestException } from "@nestjs/common";
import { toPaise } from "./finance.shared";

export function assertReportInvoiceCharges(
  lines: Array<{ baseCents: number; taxCents: number }>,
  services: Array<{ unitPrice: unknown; taxRate: unknown }>,
) {
  const actualBase = lines.reduce((sum, line) => sum + line.baseCents, 0);
  const actualTax = lines.reduce((sum, line) => sum + line.taxCents, 0);
  if (actualBase + actualTax <= 0) {
    throw new BadRequestException(
      "A report invoice needs a positive payable amount; free-report release is not enabled",
    );
  }
  // Pre-upgrade cases do not have immutable commercial snapshots. Require an
  // explicit positive invoice, but never substitute subsequently edited rates.
  if (!services.length) return;
  const expectedBase = services.reduce(
    (sum, service) => sum + toPaise(service.unitPrice),
    0,
  );
  const expectedTax = services.reduce(
    (sum, service) =>
      sum +
      Math.round((toPaise(service.unitPrice) * Number(service.taxRate)) / 100),
    0,
  );
  if (expectedBase + expectedTax <= 0) {
    throw new BadRequestException(
      "This report has a zero-value commercial scope. Resolve its commercial terms before billing; free-report release is not enabled",
    );
  }
  if (actualBase !== expectedBase || actualTax !== expectedTax) {
    throw new BadRequestException(
      "Invoice every service in the report using its original case price and tax; report-linked charges cannot be overridden",
    );
  }
}
