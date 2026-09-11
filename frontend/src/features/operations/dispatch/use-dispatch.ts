import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import {
  buildDispatchBody,
  commitDispatch,
  previewDispatch,
  runDispatchBatch,
} from "./dispatch-api";
import type { DispatchBody, DispatchProgress } from "./dispatch-api";

type Job = { id: string; body: DispatchBody; key: string };

export function useDispatch(caseIds: string[]) {
  const client = useQueryClient();
  const preview = useQuery({
    queryKey: ["case-dispatch-preview", caseIds],
    queryFn: ({ signal }) => previewDispatch(caseIds, signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [progress, setProgress] = useState<Record<string, DispatchProgress>>({});
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string>();
  const jobs = useRef<Job[]>([]);
  const gate = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const ready =
    preview.data?.cases.filter(
      (record) => record.ready && progress[record.id]?.status !== "success",
    ) ?? [];
  const assignedCount = ready.reduce(
    (sum, record) =>
      sum +
      record.checks.filter((check) =>
        record.eligibleVerifierIds.includes(allocations[check.id] ?? ""),
      ).length,
    0,
  );
  const checkCount = ready.reduce((sum, record) => sum + record.checks.length, 0);

  const execute = async (batch: Job[]) => {
    if (gate.current || !batch.length) return;
    gate.current = true;
    setBusy(true);
    setStarted(true);
    setError(undefined);
    setProgress((current) => ({
      ...current,
      ...Object.fromEntries(batch.map((job) => [job.id, { status: "waiting" }])),
    }));
    try {
      await runDispatchBatch(
        batch,
        async (job) => {
          setProgress((current) => ({ ...current, [job.id]: { status: "saving" } }));
          try {
            const result = await commitDispatch(job.id, job.body, job.key);
            if (mounted.current)
              setProgress((current) => ({
                ...current,
                [job.id]: { status: "success", assigned: result.assigned },
              }));
          } catch (failure) {
            if (mounted.current)
              setProgress((current) => ({
                ...current,
                [job.id]: {
                  status: "error",
                  message:
                    failure instanceof Error ? failure.message : "Unable to confirm assignment",
                },
              }));
          }
        },
        () => mounted.current,
      );
    } finally {
      gate.current = false;
      if (mounted.current) setBusy(false);
      // Do not refetch the frozen allocation preview while displaying results.
      void client.invalidateQueries({ queryKey: ["case-dispatch-preview"], refetchType: "none" });
      void invalidateWorkflow(client);
    }
  };
  const submit = () => {
    if (gate.current || !ready.length || assignedCount !== checkCount) return;
    try {
      jobs.current = ready.map((record) => {
        const operationId = crypto.randomUUID();
        return {
          id: record.id,
          key: operationId,
          body: buildDispatchBody(record, allocations, operationId, instructions),
        };
      });
      void execute(jobs.current);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Review allocation");
    }
  };
  const retry = () => {
    void execute(jobs.current.filter((job) => progress[job.id]?.status === "error"));
  };
  const refresh = async () => {
    if (gate.current) return;
    setError(undefined);
    const result = await preview.refetch();
    if (result.error) return;
    setStarted(false);
    setAllocations({});
    jobs.current = [];
    setProgress((current) =>
      Object.fromEntries(Object.entries(current).filter(([, value]) => value.status === "success")),
    );
  };
  return {
    preview,
    allocations,
    setAllocations,
    instructions,
    setInstructions,
    progress,
    busy,
    started,
    error,
    ready,
    assignedCount,
    checkCount,
    submit,
    retry,
    refresh,
  };
}
