import type { ReactNode } from "react";
import { Check, Link2, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CandidateStep } from "@/features/cases/new-case/CandidateStep";
import { ChecksStep } from "@/features/cases/new-case/ChecksStep";
import { ReviewStep } from "@/features/cases/new-case/ReviewStep";
import { CaseAccessSuccess } from "@/features/cases/new-case/CaseAccessSuccess";
import { CasePriceSummary } from "@/features/cases/new-case/CasePriceSummary";
import { useCaseIntake } from "@/features/cases/new-case/use-case-intake";

const steps = ["Candidate", "Checks", "Review"];
export function NewCaseDialog({ trigger }: { trigger: ReactNode }) {
  const flow = useCaseIntake();
  const { step, draft, servicePackages, clients, fixedClient, completed } = flow;
  const packages = servicePackages.data?.items ?? [];
  return (
    <Dialog open={flow.open} onOpenChange={flow.changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="client-intake-panel flex max-h-[90%] w-[calc(100%-2rem)] max-w-[1060px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
        onEscapeKeyDown={(event) => {
          if (flow.pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (flow.pending) event.preventDefault();
        }}
      >
        {completed ? (
          <CaseAccessSuccess result={completed} onClose={() => flow.changeOpen(false)} />
        ) : (
          <>
            <header className="shrink-0 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3 pr-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    Initiate a verification case
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs text-slate-500">
                    Choose the right checks. Review the price. Share a secure link.
                  </DialogDescription>
                </div>
              </div>
              <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Verification steps">
                {steps.map((label, index) => (
                  <li
                    key={label}
                    aria-current={step === index ? "step" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${step === index ? "bg-blue-50 text-blue-700" : index < step ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full ${step === index ? "bg-blue-600 text-white" : "bg-white"}`}
                    >
                      {index < step ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_285px]">
                <div className="min-w-0 p-5 sm:p-6">
                  {step === 0 && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-base font-bold">Who are you verifying?</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Use the candidate’s details as shown on their documents.
                        </p>
                      </div>
                      <CandidateStep
                        draft={draft}
                        onChange={flow.update}
                        clients={clients.data ?? []}
                        clientsLoading={
                          !fixedClient && (flow.session.isLoading || clients.isLoading)
                        }
                        clientsError={!fixedClient ? clients.error?.message : undefined}
                        onRetryClients={() => void clients.refetch()}
                        {...(fixedClient ? { fixedClient } : {})}
                      />
                    </div>
                  )}
                  {step === 1 && (
                    <ChecksStep
                      draft={draft}
                      packages={packages}
                      loading={servicePackages.isLoading}
                      error={servicePackages.error?.message}
                      onChange={flow.update}
                    />
                  )}
                  {step === 2 && <ReviewStep draft={draft} packages={packages} />}
                  {servicePackages.isError && step > 0 && (
                    <div
                      role="alert"
                      className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800"
                    >
                      {servicePackages.error.message}
                      <button
                        type="button"
                        className="ml-2 font-semibold underline"
                        onClick={() => void servicePackages.refetch()}
                      >
                        Reload catalogue
                      </button>
                    </div>
                  )}
                  {step === 2 && (
                    <section className="mt-5 space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={flow.inviteCandidate}
                          onChange={(event) => flow.setInviteCandidate(event.target.checked)}
                          className="mt-0.5 size-4 accent-blue-600"
                        />
                        <Link2 className="mt-0.5 size-4 shrink-0 text-blue-600" />
                        <span>
                          <strong className="block text-xs">
                            Create secure document-upload link
                          </strong>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            Copy and share the link after creation. Email delivery is not needed.
                          </span>
                        </span>
                      </label>
                      {flow.inviteCandidate && (
                        <label className="flex cursor-pointer items-start gap-3 border-t border-blue-100 pt-3">
                          <input
                            type="checkbox"
                            checked={flow.sendNotification}
                            onChange={(event) => flow.setSendNotification(event.target.checked)}
                            className="mt-0.5 size-4 accent-blue-600"
                          />
                          <span>
                            <strong className="block text-xs">
                              Also queue email / SMS delivery
                            </strong>
                            <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                              Optional. Uses the configured delivery service; a queued message is
                              not confirmation of delivery.
                            </span>
                          </span>
                        </label>
                      )}
                      <p className="text-[11px] leading-5 text-slate-500">
                        Candidate consent uses a separate secure link and OTP. Its existing delivery
                        and expiry rules still apply.
                      </p>
                    </section>
                  )}
                </div>
                <aside
                  className="space-y-4 border-t border-slate-200 bg-slate-50/60 p-5 lg:border-l lg:border-t-0"
                  aria-label="Verification summary"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Request summary
                  </p>
                  <div>
                    <p className="break-words text-sm font-bold">
                      {draft.candidate || "New candidate"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {draft.client || "Select your organisation"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div>
                      <p className="text-[11px] text-slate-500">Selected checks</p>
                      <strong className="mt-1 block text-xl text-blue-700">
                        {draft.checks.length}
                      </strong>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Priority</p>
                      <strong className="mt-2 block text-xs">{draft.priority}</strong>
                    </div>
                  </div>
                  <CasePriceSummary draft={draft} packages={packages} />
                  <p className="text-[11px] leading-5 text-slate-500">
                    Your organisation is fixed to your account. Secure links are case-specific and
                    should only be shared with the candidate.
                  </p>
                </aside>
              </div>
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <p className="max-w-[50%] text-[11px] leading-4 text-slate-500">
                {step === 2
                  ? "Review before creating. No payment is collected here."
                  : `Step ${step + 1} of 3 · Your case is not created yet.`}
              </p>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button
                    variant="outline"
                    disabled={flow.pending}
                    className="rounded-lg"
                    onClick={() => flow.setStep(step - 1)}
                  >
                    Back
                  </Button>
                )}
                {step < 2 ? (
                  <Button
                    className="gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    disabled={!flow.canContinue}
                    onClick={() => flow.setStep(step + 1)}
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    loading={flow.pending}
                    disabled={
                      Boolean(flow.serviceError) ||
                      servicePackages.isError ||
                      !flow.session.isSuccess
                    }
                    onClick={flow.submit}
                  >
                    {flow.pending ? "Initiating…" : "Initiate case"}
                  </Button>
                )}
              </div>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
