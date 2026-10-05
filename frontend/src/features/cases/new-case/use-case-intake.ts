import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSession } from "@/lib/api/auth";
import { createCase, listAllClients, listCaseServicePackages } from "@/lib/api/cases";
import { issueCandidateAccess } from "@/lib/api/candidate-portal";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { candidateSchema, createEmptyCaseDraft, type CaseDraft } from "./model";
import { updateCaseDraft } from "./case-draft-policy";
import { serviceSelectionError } from "./service-selection";
import type { CreatedCaseAccess } from "./CaseAccessSuccess";

export function useCaseIntake() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CaseDraft>(createEmptyCaseDraft);
  const [inviteCandidate, setInviteCandidate] = useState(true);
  const [sendNotification, setSendNotification] = useState(false);
  const [completed, setCompleted] = useState<CreatedCaseAccess>();
  const issuingForCase = useRef<string | undefined>(undefined);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const fixedClient = useMemo(
    () =>
      session.data?.clientId
        ? {
            publicId: session.data.clientId,
            displayName: session.data.clientName ?? "Assigned client workspace",
          }
        : undefined,
    [session.data?.clientId, session.data?.clientName],
  );
  const clients = useQuery({
    queryKey: ["clients", "case-options"],
    queryFn: () => listAllClients(),
    enabled: open && session.isSuccess && !fixedClient,
    staleTime: 300_000,
  });
  const clientId = fixedClient?.publicId ?? draft.clientId;
  const servicePackages = useQuery({
    queryKey: ["case-service-packages", clientId],
    queryFn: () => listCaseServicePackages(clientId),
    enabled: open && session.isSuccess && Boolean(clientId),
    staleTime: 300_000,
  });
  useEffect(() => {
    if (open && fixedClient)
      setDraft((current) =>
        current.clientId === fixedClient.publicId && current.client === fixedClient.displayName
          ? current
          : updateCaseDraft(current, {
              clientId: fixedClient.publicId,
              client: fixedClient.displayName,
            }),
      );
  }, [fixedClient, open]);
  const createMutation = useMutation({
    mutationFn: ({ caseDraft }: { caseDraft: CaseDraft; invite: boolean; notify: boolean }) => {
      const fingerprint = JSON.stringify(caseDraft);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      return createCase(caseDraft, attempt.current.key);
    },
    onSuccess: (created, variables) => {
      attempt.current = undefined;
      issuingForCase.current = variables.invite ? created.id : undefined;
      setCompleted({
        caseId: created.id,
        caseNumber: created.caseNumber,
        consentUrl: `${window.location.origin}/consent/${created.consentDelivery.consentId}`,
        consentExpiresAt: created.consentDelivery.expiresAt,
        developmentOtp: created.consentDelivery.developmentOtp,
        candidate: { status: variables.invite ? "issuing" : "skipped" },
      });
      void invalidateWorkflow(queryClient);
      if (!variables.invite) return;
      void issueCandidateAccess(created.id, variables.notify)
        .then((access) => {
          if (issuingForCase.current !== created.id) return;
          const url = `${window.location.origin}/candidate/${access.id}#token=${encodeURIComponent(access.token)}`;
          setCompleted((current) =>
            current?.caseId === created.id
              ? { ...current, candidate: { status: "ready", access, url } }
              : current,
          );
        })
        .catch((error: unknown) => {
          if (issuingForCase.current !== created.id) return;
          setCompleted((current) =>
            current?.caseId === created.id
              ? {
                  ...current,
                  candidate: {
                    status: "failed",
                    error: error instanceof Error ? error.message : "Issue it from Case 360.",
                  },
                }
              : current,
          );
        });
    },
    onError: (error) =>
      toast.error("Case submission needs attention", {
        description:
          error.name === "TimeoutError" || error instanceof TypeError
            ? "The result was not confirmed. Keep this form unchanged and retry to safely check the saved result."
            : error.message,
      }),
  });
  const changeOpen = (value: boolean) => {
    if (createMutation.isPending) return;
    setOpen(value);
    if (!value) {
      issuingForCase.current = undefined;
      setStep(0);
      setDraft(createEmptyCaseDraft());
      setInviteCandidate(true);
      setSendNotification(false);
      setCompleted(undefined);
    }
  };
  const candidateValid = candidateSchema.safeParse(draft).success;
  const serviceError = serviceSelectionError(draft, servicePackages.data?.items ?? []);
  const submit = () => {
    if (!candidateValid || serviceError || servicePackages.isError || createMutation.isPending) {
      toast.error(
        servicePackages.error?.message ?? serviceError ?? "Complete the required case information",
      );
      return;
    }
    createMutation.mutate({ caseDraft: draft, invite: inviteCandidate, notify: sendNotification });
  };
  return {
    open,
    changeOpen,
    step,
    setStep,
    draft,
    update: (patch: Partial<CaseDraft>) => setDraft((current) => updateCaseDraft(current, patch)),
    inviteCandidate,
    setInviteCandidate,
    sendNotification,
    setSendNotification,
    completed,
    session,
    fixedClient,
    clients,
    servicePackages,
    serviceError,
    pending: createMutation.isPending,
    canContinue: step === 0 ? candidateValid : !serviceError && !servicePackages.isError,
    submit,
  };
}
