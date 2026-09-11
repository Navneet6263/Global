import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/backend-api/client";
import type { IntakeRow } from "./client-intake-csv";

export interface IntakeResult {
  input: IntakeRow;
  key: string;
  status: "ready" | "submitting" | "created" | "failed";
  caseNumber?: string;
  caseId?: string;
  error?: string;
}
export function useClientIntake() {
  const cache = useQueryClient();
  const [rows, setRows] = useState<IntakeResult[]>([]);
  const [running, setRunning] = useState(false);
  const locked = useRef(false);
  const setCandidates = (values: IntakeRow[]) =>
    setRows(values.map((input) => ({ input, key: crypto.randomUUID(), status: "ready" })));
  const update = (key: string, patch: Partial<IntakeResult>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const start = async (servicePackageId: string) => {
    if (locked.current || !servicePackageId) return;
    locked.current = true;
    setRunning(true);
    try {
      for (const row of rows) {
        if (row.status === "created") continue;
        update(row.key, { status: "submitting", error: undefined });
        try {
          const created = await apiRequest<{ id: string; caseNumber: string }>(
            "/client-intake/rows",
            {
              method: "POST",
              headers: { "idempotency-key": row.key },
              body: JSON.stringify({ ...row.input, servicePackageId }),
            },
          );
          update(row.key, {
            status: "created",
            caseNumber: created.caseNumber,
            caseId: created.id,
          });
        } catch (error) {
          update(row.key, {
            status: "failed",
            error: error instanceof Error ? error.message : "Request failed",
          });
        }
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["cases"] }),
        cache.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } finally {
      locked.current = false;
      setRunning(false);
    }
  };
  return { rows, setCandidates, running, start };
}
