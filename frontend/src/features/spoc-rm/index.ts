/** Public surface of the SPOC-RM central monitoring feature (view-only). */
export { SpocAttentionQueue } from "./components/SpocAttentionQueue";
export { SpocCaseDrawer } from "./components/SpocCaseDrawer";
export { SpocClientTable } from "./components/SpocClientTable";
export { SpocExceptionsPanel } from "./components/SpocExceptionsPanel";
export { SpocFilterBar, type SpocScopeFilters } from "./components/SpocFilterBar";
export { SpocKpiStrip } from "./components/SpocKpiStrip";
export { SpocRecordsView } from "./components/SpocRecordsView";
export { SpocRoleMatrix } from "./components/SpocRoleMatrix";
export { SpocWorkflowStrip } from "./components/SpocWorkflowStrip";
export {
  spocClientsSearch,
  spocOverviewSearch,
  spocRecordsSearch,
  type SpocClientsSearch,
  type SpocOverviewSearch,
  type SpocRecordsSearch,
} from "./config/spoc-search";
export { useSpocOverview } from "./hooks/use-spoc";
