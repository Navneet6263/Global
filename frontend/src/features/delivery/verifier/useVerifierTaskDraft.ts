import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ALLOWED_BY_RESULT, type Disposition } from "@/features/workflow-ui/colour-codes";
import type { FindingInput } from "@/lib/api/tasks";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { getColourMatrix } from "@/lib/backend-api/workflow";
import { MIN_SUMMARY } from "./verification-readiness";
import {
  loadVerifierDraft,
  removeVerifierDraft,
  saveVerifierDraft,
  type VerifierResult,
} from "./verifier-draft";

/** Manages verifier outcome state and user-scoped encrypted local draft persistence. */
export function useVerifierTaskDraft(input: {
  taskId: string;
  checkType: string;
  inProgress: boolean;
}) {
  const { taskId, checkType, inProgress } = input;
  const draftKey = `verifier-draft:${taskId}`;
  const deviceDataScope = cachedIdentity()?.deviceDataScope;
  const [result, setResult] = useState<VerifierResult>("CLEAR");
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [scenarioId, setScenarioId] = useState("");
  const [sourceSummary, setSourceSummary] = useState("");
  const [findings, setFindings] = useState<FindingInput[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  const colourOptions = ALLOWED_BY_RESULT[result] ?? [];
  const chosenColour =
    disposition && colourOptions.includes(disposition) ? disposition : (colourOptions[0] ?? null);
  const matrix = useQuery({
    queryKey: ["workflow", "colour-matrix"],
    queryFn: getColourMatrix,
    staleTime: Infinity,
    enabled: inProgress,
  });
  const scenarios = matrix.data?.matrix[checkType.toUpperCase()] ?? [];
  const scenario = scenarios.find((item) => item.id === scenarioId);

  useEffect(() => {
    if (!deviceDataScope) {
      setDraftReady(true);
      return;
    }
    let active = true;
    void loadVerifierDraft(deviceDataScope, draftKey)
      .then((stored) => {
        if (!active) return;
        if (stored) {
          setResult(stored.result);
          setSourceSummary(stored.sourceSummary);
          setFindings(stored.findings);
        }
        setDraftReady(true);
      })
      .catch(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [deviceDataScope, draftKey]);

  useEffect(() => {
    if (!deviceDataScope || !draftReady || !inProgress) return;
    const timer = window.setTimeout(() => {
      void saveVerifierDraft(deviceDataScope, {
        key: draftKey,
        result,
        sourceSummary,
        findings,
        savedAt: new Date().toISOString(),
      }).catch(() => toast.error("Secure working draft could not be saved"));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [deviceDataScope, draftKey, draftReady, findings, inProgress, result, sourceSummary]);

  const findingsValid = findings.every(
    (item) =>
      item.title.trim().length >= 3 &&
      item.description.trim().length >= 3 &&
      (!item.source || item.source.trim().length >= 3),
  );
  const summaryDone = sourceSummary.trim().length >= MIN_SUMMARY;

  return {
    result,
    setResult,
    setDisposition,
    chosenColour,
    matrix,
    scenarios,
    scenarioId,
    setScenarioId,
    scenario,
    sourceSummary,
    setSourceSummary,
    findings,
    draftReady,
    summaryDone,
    outcomeDone: summaryDone && findingsValid,
    clearDraft: () => {
      if (deviceDataScope) void removeVerifierDraft(deviceDataScope, draftKey);
    },
  };
}
