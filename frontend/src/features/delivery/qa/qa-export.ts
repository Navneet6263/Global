import type { SheetColumn } from "@/components/workspace/export-sheet";
import { collectNumberedPages, humanizeCode, istText } from "@/components/workspace/format";
import {
  getQaHistory,
  getQaRegister,
  type QaDecisionRecord,
  type QaRegisterItem,
  type QaRegisterView,
} from "@/lib/backend-api/qa-register";

export const QA_REGISTER_COLUMNS: readonly SheetColumn<QaRegisterItem>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (c) => c.caseNumber },
  { key: "candidate", label: "Candidate", value: (c) => c.subject.fullName },
  { key: "company", label: "Company", value: (c) => c.client.displayName },
  { key: "status", label: "Status", value: (c) => humanizeCode(c.status) },
  { key: "priority", label: "Priority", value: (c) => humanizeCode(c.priority) },
  {
    key: "checks",
    label: "Checks complete",
    value: (c) => `${c.completedCheckCount}/${c.checkCount}`,
  },
  { key: "documents", label: "Documents", value: (c) => c.documentCount },
  { key: "risk", label: "Highest risk", value: (c) => humanizeCode(c.highestRisk) },
  { key: "reviewer", label: "Claimed by", value: (c) => c.qaReviewer?.displayName },
  { key: "dueAt", label: "Due", value: (c) => istText(c.dueAt) },
  { key: "createdAt", label: "Created", value: (c) => istText(c.createdAt) },
  { key: "correction", label: "Correction reason", value: (c) => c.correctionReason },
];
export const QA_REGISTER_DEFAULTS = [
  "caseNumber",
  "candidate",
  "company",
  "status",
  "checks",
  "risk",
  "dueAt",
];

export const QA_HISTORY_COLUMNS: readonly SheetColumn<QaDecisionRecord>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (d) => d.case.caseNumber },
  { key: "candidate", label: "Candidate", value: (d) => d.case.subject.fullName },
  { key: "company", label: "Company", value: (d) => d.case.client.displayName },
  { key: "decision", label: "Decision", value: (d) => humanizeCode(d.decision) },
  { key: "decidedAt", label: "Decided", value: (d) => istText(d.createdAt) },
  { key: "caseStatus", label: "Case status now", value: (d) => humanizeCode(d.case.status) },
  {
    key: "report",
    label: "Report",
    value: (d) =>
      d.case.reports[0]
        ? `${humanizeCode(d.case.reports[0].status)} v${d.case.reports[0].currentVersion}`
        : "",
  },
  { key: "notes", label: "Notes", value: (d) => d.notes },
];
export const QA_HISTORY_DEFAULTS = [
  "caseNumber",
  "candidate",
  "company",
  "decision",
  "decidedAt",
  "caseStatus",
];

export const loadQaRegister = (view: QaRegisterView, search?: string) =>
  collectNumberedPages((page) => getQaRegister({ view, search, page, limit: 100 }));

export const loadQaHistory = (search?: string) =>
  collectNumberedPages((page) => getQaHistory({ search, page, limit: 100 }));
