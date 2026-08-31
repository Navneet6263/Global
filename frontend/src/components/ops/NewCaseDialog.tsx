import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CandidateStep } from "@/features/cases/new-case/CandidateStep";
import { ChecksStep } from "@/features/cases/new-case/ChecksStep";
import { ReviewStep } from "@/features/cases/new-case/ReviewStep";
import {
  candidateSchema,
  createEmptyCaseDraft,
  type CaseDraft,
} from "@/features/cases/new-case/model";
import { getSession } from "@/lib/api/auth";
import { createCase, listAllClients, listCaseServicePackages } from "@/lib/api/cases";
import { issueCandidateAccess, type CandidateAccessResult } from "@/lib/api/candidate-portal";

const steps = ["Candidate", "Checks", "Review"];

export function NewCaseDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CaseDraft>(createEmptyCaseDraft);
  const [inviteCandidate, setInviteCandidate] = useState(true);
  const [completed, setCompleted] = useState<{
    caseNumber: string;
    url: string;
    access: CandidateAccessResult;
  }>();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
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
    staleTime: 5 * 60_000,
  });
  const servicePackages = useQuery({
    queryKey: ["case-service-packages"],
    queryFn: listCaseServicePackages,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!open || !fixedClient) return;
    setDraft((current) =>
      current.clientId === fixedClient.publicId && current.client === fixedClient.displayName
        ? current
        : {
            ...current,
            clientId: fixedClient.publicId,
            client: fixedClient.displayName,
          },
    );
  }, [fixedClient, open]);
  const createMutation = useMutation({
    mutationFn: createCase,
    onSuccess: async (created) => {
      let access: CandidateAccessResult | undefined;
      if (inviteCandidate) {
        try {
          access = await issueCandidateAccess(created.id);
        } catch (error) {
          toast.error("Case created, but candidate link could not be issued", {
            description:
              error instanceof Error ? error.message : "Issue it from Case 360 and try again.",
          });
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(`${created.caseNumber} initiated`, {
        description: created.consentDelivery.developmentOtp
          ? `Development consent OTP: ${created.consentDelivery.developmentOtp}`
          : "Consent OTP delivery is queued and the audit trail is active.",
      });
      if (access) {
        setCompleted({
          caseNumber: created.caseNumber,
          access,
          url:
            window.location.origin +
            "/candidate/" +
            access.id +
            "#token=" +
            encodeURIComponent(access.token),
        });
      } else {
        setOpen(false);
      }
      reset();
    },
    onError: (error) => toast.error("Case could not be initiated", { description: error.message }),
  });

  const reset = () => {
    setStep(0);
    setDraft(createEmptyCaseDraft());
    setInviteCandidate(true);
  };

  const update = (patch: Partial<CaseDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const candidateResult = candidateSchema.safeParse(draft);
  const canContinue =
    step === 0
      ? candidateResult.success
      : Boolean(draft.servicePackageId && draft.checks.length > 0);

  const submit = () => {
    if (!candidateResult.success || !draft.servicePackageId || draft.checks.length === 0) {
      toast.error("Complete the required case information");
      return;
    }
    createMutation.mutate(draft);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
          setCompleted(undefined);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden rounded-3xl border-0 bg-card p-0 shadow-xl">
        {completed ? (
          <CandidateInviteSuccess
            result={completed}
            onClose={() => {
              setCompleted(undefined);
              setOpen(false);
            }}
          />
        ) : (
          <>
            <div className="flex flex-col gap-1 px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold leading-tight">
                    Initiate a verification case
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Candidate details → check package → review and consent
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 sm:gap-2">
                {steps.map((label, index) => (
                  <div key={label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                    <span
                      className={`flex h-7 min-w-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-colors sm:px-3 sm:text-[11px] ${
                        index === step
                          ? "bg-accent text-accent-foreground"
                          : index < step
                            ? "bg-secondary text-foreground"
                            : "bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      {index < step ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                      <span className="truncate">{label}</span>
                    </span>
                    {index < steps.length - 1 && <span className="h-px min-w-2 flex-1 bg-border" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 max-h-[60vh] overflow-y-auto px-5 pb-2 sm:px-6">
              {step === 0 && (
                <CandidateStep
                  draft={draft}
                  onChange={update}
                  clients={clients.data ?? []}
                  clientsLoading={!fixedClient && (session.isLoading || clients.isLoading)}
                  clientsError={!fixedClient ? clients.error?.message : undefined}
                  onRetryClients={() => void clients.refetch()}
                  {...(fixedClient ? { fixedClient } : {})}
                />
              )}
              {step === 1 && (
                <ChecksStep
                  draft={draft}
                  packages={servicePackages.data?.items ?? []}
                  loading={servicePackages.isLoading}
                  error={servicePackages.error?.message}
                  onChange={update}
                />
              )}
              {step === 2 && <ReviewStep draft={draft} />}
              {step === 2 ? (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/15 bg-accent/35 p-4">
                  <input
                    type="checkbox"
                    checked={inviteCandidate}
                    onChange={(event) => setInviteCandidate(event.target.checked)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-xs font-semibold">
                      Send secure document-upload link to candidate
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                      A 14-day, case-scoped link will be queued to {draft.email || draft.phone} and
                      shown once for copying.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-3 bg-secondary/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[11px] text-muted-foreground">
                Case ID and audit entry are created only after backend acceptance.
              </p>
              <div className="flex justify-end gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((current) => current - 1)}
                    className="h-10 rounded-full bg-card px-4 text-sm font-medium text-muted-foreground shadow-sm hover:text-foreground"
                  >
                    Back
                  </button>
                )}
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setStep((current) => current + 1)}
                    className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={createMutation.isPending}
                    className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                  >
                    {createMutation.isPending ? "Initiating…" : "Initiate case"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CandidateInviteSuccess({
  result,
  onClose,
}: {
  result: { caseNumber: string; url: string; access: CandidateAccessResult };
  onClose: () => void;
}) {
  const delivery = result.access.delivery;
  const copy = () =>
    void navigator.clipboard
      .writeText(result.url)
      .then(() => toast.success("Candidate link copied"))
      .catch(() => toast.error("Copy failed; select and copy the link manually"));

  return (
    <div className="p-6 sm:p-8">
      <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success-foreground">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Verification initiated</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.caseNumber} is ready and its candidate workspace is secured.
      </p>
      <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="text-xs font-semibold">Candidate document-upload link</p>
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={result.url}
            aria-label="Candidate document-upload link"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs"
          />
          <button
            type="button"
            onClick={copy}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label="Copy candidate link"
          >
            <Copy className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {delivery.queued
            ? "Delivery queued by " + delivery.channel + " to " + delivery.destination + "."
            : "No candidate email or mobile was available; copy and share this link securely."}{" "}
          Expires {new Date(result.access.expiresAt).toLocaleString("en-IN")}.
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Done
        </button>
      </div>
    </div>
  );
}
