"use client";

import { useMemo, useState } from "react";
import type { CaseQuery } from "@/lib/contracts/case";
import type { CaseColumnId } from "../config/table";
import { DEFAULT_VISIBLE_COLUMNS, SAVED_VIEWS } from "../config/table";
import { CASE_COLUMNS } from "../config/table";

const PAGE_SIZE = 12;

export interface CaseRegisterInitialFilters {
  search?: string;
  stage?: CaseQuery["stage"];
}

/** Owns register state: query, saved view, column visibility and row selection. */
export function useCaseRegister(initial: CaseRegisterInitialFilters) {
  const [query, setQuery] = useState<CaseQuery>({
    search: initial.search ?? "",
    stage: initial.stage ?? "all",
    clientId: "all",
    priority: "all",
    sla: "all",
    sortBy: "updatedAt",
    sortDir: "desc",
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [activeView, setActiveView] = useState("all");
  const [visibleColumns, setVisibleColumns] =
    useState<readonly CaseColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const actions = useMemo(
    () => ({
      patchQuery(patch: Partial<CaseQuery>) {
        setSelected([]);
        setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
      },
      setPage(page: number) {
        setSelected([]);
        setQuery((current) => ({ ...current, page }));
      },
      sortBy(sortBy: NonNullable<CaseQuery["sortBy"]>) {
        setSelected([]);
        setQuery((current) => ({
          ...current,
          sortBy,
          sortDir: current.sortBy === sortBy && current.sortDir === "asc" ? "desc" : "asc",
          page: 1,
        }));
      },
      applyView(viewId: string) {
        const view = SAVED_VIEWS.find((entry) => entry.id === viewId);
        if (!view) return;
        setSelected([]);
        setActiveView(viewId);
        setQuery((current) => ({
          ...current,
          stage: "all",
          priority: "all",
          sla: "all",
          ...view.query,
          page: 1,
        }));
      },
      reset() {
        setSelected([]);
        setActiveView("all");
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
        setQuery({
          search: "",
          stage: "all",
          clientId: "all",
          priority: "all",
          sla: "all",
          sortBy: "updatedAt",
          sortDir: "desc",
          page: 1,
          pageSize: PAGE_SIZE,
        });
      },
      toggleColumn(id: CaseColumnId) {
        const column = CASE_COLUMNS.find((entry) => entry.id === id);
        if (column?.alwaysVisible) return;
        setVisibleColumns((current) =>
          current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
        );
      },
      toggleRow(id: string) {
        setSelected((current) =>
          current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
        );
      },
      selectMany(ids: readonly string[], allSelected: boolean) {
        setSelected(allSelected ? [] : [...ids]);
      },
      clearSelection() {
        setSelected([]);
      },
    }),
    [],
  );

  return { query, activeView, visibleColumns, selected, actions, pageSize: PAGE_SIZE };
}
