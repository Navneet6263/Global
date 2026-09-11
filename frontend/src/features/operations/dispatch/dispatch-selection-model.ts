import type { OpsCase } from "../contracts/case";

export const DISPATCH_LIMIT = 25;
export function canSelectForDispatch(row: OpsCase) {
  return ["intake", "consent", "documents", "verification", "assignment"].includes(row.stage);
}
export type DispatchSelectionProps = {
  selected: string[];
  onToggle: (id: string) => void;
  onTogglePage: () => void;
};
