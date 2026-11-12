import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_BULK_DATA_ENTRY } from "./rm-queue-model";

export function RmQueueBulkBar({
  count,
  onAssign,
  onClear,
}: {
  count: number;
  onAssign: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-t border-b border-blue-200 bg-blue-50/80 px-[18px] py-2.5 text-[13px]"
      role="region"
      aria-label="Bulk selection actions"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
        {count} {count === 1 ? "case" : "cases"} selected
        {count >= MAX_BULK_DATA_ENTRY ? (
          <small className="font-normal text-slate-600">(limit {MAX_BULK_DATA_ENTRY})</small>
        ) : null}
      </span>
      <Button type="button" size="sm" onClick={onAssign}>
        <Users className="mr-1.5 size-3.5" aria-hidden />
        Assign Data Entry
      </Button>
      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <X className="mr-1 size-3.5" aria-hidden />
        Clear selection
      </Button>
    </div>
  );
}
