import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DISPATCH_LIMIT } from "./dispatch-selection-model";

export function DispatchSelectionBar({
  selected,
  onClear,
  onStart,
}: {
  selected: string[];
  onClear: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/70 to-white px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-800">
          <Layers3 className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Review once. Allocate together.</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Select up to {DISPATCH_LIMIT} cases, check readiness and assign their remaining checks.
          </p>
          {selected.length ? (
            <p role="status" className="mt-1 text-xs font-medium text-emerald-800">
              {selected.length} cases selected across pages
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/operations/assignments">Assignment Workbench</Link>
        </Button>
        {selected.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear selection
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!selected.length} onClick={onStart}>
          Start & assign <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
