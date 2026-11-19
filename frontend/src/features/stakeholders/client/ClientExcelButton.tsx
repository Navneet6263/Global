import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/kit";
import { listCases, type CaseListItem } from "@/lib/api/cases";
import { casePackageName } from "@/lib/backend-api/case-services";
import { downloadExcel, type ExcelSheet, type ExcelTone } from "@/lib/excel-export";
import { clientStatus, statusKind } from "./client-portal-utils";
import { PIPELINE_COLUMNS, pipelineColumn, waitingDays } from "./pipeline-model";

const PAGE = 100;
const MAX_PAGES = 50;
const TONE: Record<string, ExcelTone> = {
  good: "ok",
  bad: "danger",
  warn: "warn",
  note: "info",
  brand: "info",
};

async function allCases(filters: { q?: string; status?: string }) {
  const rows: CaseListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listCases({
      search: filters.q,
      status: filters.status,
      page,
      pageSize: PAGE,
      limit: PAGE,
      sortBy: "updatedAt",
      sortDir: "desc",
    });
    rows.push(...result.items);
    if (rows.length >= result.total || result.items.length < PAGE) break;
  }
  return rows;
}

/** Downloads every matching case as a styled Excel sheet (client-safe fields only). */
export function ClientExcelButton({
  filters = {},
  label = "Download Excel",
}: {
  filters?: { q?: string; status?: string };
  label?: string;
}) {
  const download = useMutation({
    mutationFn: async () => {
      const rows = await allCases(filters);
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);
      await downloadExcel({
        fileName: `sapling-verifications-${stamp}`,
        title: "Verification register",
        lines: [
          `${rows.length} cases`,
          filters.status || filters.q ? "Filtered as on screen" : "All cases",
        ],
        sheets: [
          {
            name: "Verifications",
            columns: [
              { label: "Case number", value: (row) => row.caseNumber, width: 22 },
              { label: "Candidate", value: (row) => row.subject.fullName, width: 26 },
              {
                label: "Status",
                value: (row) => clientStatus(row).label,
                width: 30,
                tone: (row) => TONE[statusKind(row.status)] ?? null,
              },
              {
                label: "Stage",
                value: (row) =>
                  PIPELINE_COLUMNS.find((column) => column.key === pipelineColumn(row))?.label ??
                  "Closed",
                width: 20,
              },
              {
                label: "Checks done",
                value: (row) => row.checks.filter((check) => check.status === "COMPLETED").length,
                type: "number",
              },
              { label: "Checks", value: (row) => row.checks.length, type: "number" },
              {
                label: "Turnaround (working days)",
                value: (row) => row.tatWorkingDays ?? null,
                type: "number",
              },
              { label: "Package", value: (row) => casePackageName(row) || "", width: 24 },
              { label: "Priority", value: (row) => row.priority },
              { label: "Branch", value: (row) => row.branch?.name ?? "" },
              { label: "Created", value: (row) => row.createdAt, type: "date" },
              { label: "Last updated", value: (row) => row.updatedAt, type: "date" },
              {
                label: "Days since last update",
                value: (row) => waitingDays(row, now),
                type: "number",
                tone: (row) =>
                  pipelineColumn(row) !== "done" && waitingDays(row, now) >= 5 ? "warn" : null,
              },
              {
                label: "Final report",
                value: (row) => (row.report ? "Released" : ""),
                tone: (row) => (row.report ? "ok" : null),
              },
            ],
            rows,
          } satisfies ExcelSheet<CaseListItem>,
        ],
      });
      return rows.length;
    },
    onSuccess: (count) => toast.success(`Excel ready: ${count} cases`),
    onError: (error: Error) => toast.error("Excel download failed", { description: error.message }),
  });
  return (
    <Button loading={download.isPending} onClick={() => download.mutate()}>
      <FileSpreadsheet aria-hidden />
      {download.isPending ? "Preparing Excel…" : label}
    </Button>
  );
}
