import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DispatchAllocation, DispatchWorkload } from "./dispatch-allocation";
import { useDispatch } from "./use-dispatch";

export function DispatchDialog({
  caseIds,
  onClose,
  onOpenCase,
}: {
  caseIds: string[];
  onClose: () => void;
  onOpenCase: (id: string) => void;
}) {
  const model = useDispatch(caseIds);
  const { preview, busy, started, progress } = model;
  const successes = Object.values(progress).filter((state) => state.status === "success").length;
  const failures = Object.values(progress).filter((state) => state.status === "error").length;
  const blocked =
    (preview.data?.cases.filter(
      (record) => !record.ready && progress[record.id]?.status !== "success",
    ).length ?? 0) + (preview.data?.unavailableIds.length ?? 0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-[28px] p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 pr-12 sm:px-7">
          <DialogTitle className="text-xl">Start & assign verification</DialogTitle>
          <DialogDescription className="mt-2">
            Review readiness <ArrowRight className="inline size-3" /> choose verifiers{" "}
            <ArrowRight className="inline size-3" /> confirm. No work starts until you confirm.
          </DialogDescription>
        </DialogHeader>
        <div
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7"
          aria-busy={preview.isFetching}
        >
          {preview.isPending ? (
            <p role="status" className="py-10 text-center text-muted-foreground">
              Checking consent, reviewed documents and current assignments…
            </p>
          ) : null}
          {preview.isError ? (
            <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              <p>
                {preview.error instanceof Error
                  ? preview.error.message
                  : "Could not load readiness"}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                loading={preview.isFetching}
                onClick={() => void model.refresh()}
              >
                Retry readiness check
              </Button>
            </div>
          ) : null}
          {preview.data ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Ready cases",
                    value: model.ready.length,
                    colour: "bg-emerald-50 text-emerald-900",
                  },
                  { label: "Need attention", value: blocked, colour: "bg-amber-50 text-amber-900" },
                  { label: "Assigned", value: successes, colour: "bg-sky-50 text-sky-900" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl p-3 sm:p-4 ${item.colour}`}>
                    <p className="text-xs">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
              {blocked > 0 ? (
                <p className="text-sm text-amber-900">
                  {blocked} case(s) will not be submitted. Resolve their issues and check readiness
                  again.
                </p>
              ) : null}
              {preview.data.unavailableIds.length ? (
                <p role="alert" className="text-sm text-red-700">
                  Some selected cases are no longer available in your scope. Refresh the register.
                </p>
              ) : null}
              {preview.data.verifierLimitReached ? (
                <p className="text-sm text-amber-900">
                  Showing the first 250 eligible verifiers. For another verifier, use Assignment
                  Workbench.
                </p>
              ) : null}
              <DispatchAllocation
                cases={preview.data.cases}
                verifiers={preview.data.verifiers}
                allocations={model.allocations}
                onChange={model.setAllocations}
                disabled={busy || started || preview.isFetching}
                progress={progress}
                onOpenCase={(id) => {
                  if (!busy) {
                    onClose();
                    onOpenCase(id);
                  }
                }}
              />
              <DispatchWorkload
                cases={preview.data.cases}
                verifiers={preview.data.verifiers}
                allocations={model.allocations}
                progress={progress}
              />
              {!started ? (
                <label className="block space-y-2 text-sm font-medium">
                  Instructions for verifiers{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                  <textarea
                    value={model.instructions}
                    onChange={(event) => model.setInstructions(event.target.value)}
                    maxLength={1000}
                    disabled={busy}
                    rows={2}
                    placeholder="Anything the assigned verifiers should know"
                    className="w-full resize-y rounded-2xl border border-border bg-white px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              ) : null}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" />
                Consent, evidence and scope are rechecked when saving. Each case saves completely or
                stays unchanged; other successful cases remain assigned. Every assignment is
                audited.
              </p>
            </>
          ) : null}
          {model.error ? (
            <p role="alert" className="text-sm text-red-700">
              {model.error}
            </p>
          ) : null}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-5 py-4 sm:px-7">
          <p role="status" className="text-sm text-muted-foreground">
            {started
              ? `${successes} assigned · ${failures} failed${busy ? " · processing…" : ""}`
              : `${model.assignedCount}/${model.checkCount} checks allocated across ${model.ready.length} ready cases`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {started ? "Done" : "Cancel"}
            </Button>
            {!busy && started && failures > 0 ? (
              <Button type="button" variant="outline" onClick={model.retry}>
                Retry failed only
              </Button>
            ) : null}
            {!busy && (started || blocked > 0) ? (
              <Button
                type="button"
                variant="outline"
                loading={preview.isFetching}
                onClick={() => void model.refresh()}
              >
                Refresh readiness
              </Button>
            ) : null}
            {!started || busy ? (
              <Button
                type="button"
                loading={busy}
                disabled={
                  busy ||
                  preview.isFetching ||
                  preview.isError ||
                  !model.ready.length ||
                  model.assignedCount !== model.checkCount
                }
                onClick={model.submit}
              >
                Confirm start & assignment
              </Button>
            ) : null}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
