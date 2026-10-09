import { useEffect, useState } from "react";

export interface ColumnOption<K extends string> {
  key: K;
  label: string;
}

/**
 * Remembered column choice for one table (per browser). Unknown saved keys are dropped and
 * the table order is always the definition order, so the layout never jumps around.
 */
export function useColumnChoice<K extends string>(
  storageKey: string,
  options: readonly ColumnOption<K>[],
  defaults: readonly K[],
) {
  const [columns, setColumns] = useState<K[]>([...defaults]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved))
        setColumns(options.filter((option) => saved.includes(option.key)).map((o) => o.key));
    } catch {
      /* Storage may be unavailable; keep defaults. */
    }
  }, [storageKey, options]);
  const update = (next: readonly K[]) => {
    const ordered = options.filter((option) => next.includes(option.key)).map((o) => o.key);
    setColumns(ordered);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ordered));
    } catch {
      /* Session-only preference. */
    }
  };
  return { columns, update, show: (key: K) => columns.includes(key) };
}
