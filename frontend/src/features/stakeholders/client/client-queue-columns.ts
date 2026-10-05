import { useEffect, useState } from "react";

export const queueColumns = [
  { key: "status", label: "Current status" },
  { key: "checks", label: "Checks" },
  { key: "due", label: "Expected by" },
  { key: "package", label: "Package" },
  { key: "priority", label: "Priority" },
  { key: "updated", label: "Last updated" },
  { key: "branch", label: "Branch" },
] as const;
export type QueueColumn = (typeof queueColumns)[number]["key"];
export const defaultQueueColumns: QueueColumn[] = ["status", "checks", "due"];
const storageKey = "sapling.client.queue-columns.v1";

export function useQueueColumns() {
  const [columns, setColumns] = useState<QueueColumn[]>(defaultQueueColumns);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved))
        setColumns(
          queueColumns.filter((column) => saved.includes(column.key)).map((column) => column.key),
        );
    } catch {
      /* Storage may be unavailable; keep defaults. */
    }
  }, []);
  const update = (next: QueueColumn[]) => {
    setColumns(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Session-only preference. */
    }
  };
  return { columns, update };
}
