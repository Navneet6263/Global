import type { Prisma } from "../generated/prisma/client";
import { INVOICE_SELLER } from "../common/company-details";

/** GST state codes (first two characters of a GSTIN) and their state names. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

/**
 * The buyer's state from its GSTIN. Without a GSTIN the supply is treated as within the
 * seller's state (CGST + SGST), as for an unregistered buyer billed from Noida.
 */
export function buyerState(gstin: string | null | undefined) {
  const code = gstin?.trim().slice(0, 2) ?? "";
  const name = GST_STATES[code];
  return name
    ? { code, name, intraState: code === INVOICE_SELLER.stateCode }
    : {
        code: INVOICE_SELLER.stateCode,
        name: INVOICE_SELLER.stateName,
        intraState: true,
      };
}

/** Splits tax (in paise) into CGST + SGST halves within the state, else all IGST. */
export function splitTax(taxPaise: number, intraState: boolean) {
  if (!intraState) return { cgst: 0, sgst: 0, igst: taxPaise };
  const cgst = Math.round(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst, igst: 0 };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowHundred(value: number) {
  return value < 20
    ? ONES[value]!
    : `${TENS[Math.floor(value / 10)]} ${ONES[value % 10]}`.trim();
}

function belowThousand(value: number) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [
    hundreds ? `${ONES[hundreds]} Hundred` : "",
    rest ? belowHundred(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Whole rupees in the Indian system: crore, lakh, thousand. */
function rupeeWords(value: number): string {
  if (value === 0) return "Zero";
  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1000);
  const rest = value % 1000;
  return [
    crore ? `${rupeeWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** "INR One Lakh Twenty Three Thousand Six Hundred Seventy Eight Only", paise included. */
export function amountInWords(paise: number) {
  const rupees = Math.floor(Math.abs(paise) / 100);
  const rest = Math.abs(paise) % 100;
  return `INR ${rupeeWords(rupees)}${rest ? ` and ${belowHundred(rest)} paise` : ""} Only`;
}

/** Indian financial year of a date (April to March), e.g. "26-27". */
export function financialYear(date: Date) {
  const ist = new Date(date.getTime() + 330 * 60_000);
  const start =
    ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * The next tax invoice number of the financial year: "SG/26-27/0001", "SG/26-27/0002"…
 * One series per year, as GST requires (unique, sequential, at most 16 characters).
 */
export async function nextInvoiceNumber(
  tx: Pick<Prisma.TransactionClient, "invoice">,
  tenantId: bigint,
  date = new Date(),
) {
  const prefix = `SG/${financialYear(date)}/`;
  const last = await tx.invoice.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const next = (Number(last?.invoiceNumber.slice(prefix.length)) || 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** "Oct-26" for a date in India. */
export function periodLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  })
    .format(date)
    .replace(" ", "-");
}
