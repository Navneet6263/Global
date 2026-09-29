/**
 * Public surface of the SPOC-RM central monitoring feature. Everything is view-only
 * except the Vendors capability (assign / re-assign documents to vendors).
 */
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
  spocVendorsSearch,
  type SpocClientsSearch,
  type SpocOverviewSearch,
  type SpocRecordsSearch,
  type SpocVendorsSearch,
} from "./config/spoc-search";
export { useSpocOverview } from "./hooks/use-spoc";
export { SpocVendorClients } from "./vendors/SpocVendorClients";
export { SpocVendorDocumentDrawer } from "./vendors/SpocVendorDocumentDrawer";
export { SpocVendorDocuments } from "./vendors/SpocVendorDocuments";
