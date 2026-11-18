import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import {
  createTeamMemberWithDocuments,
  type TeamMembersOverview,
} from "@/lib/backend-api/team-members";
import type { TemporaryPasswordReceipt } from "@/features/users/components/temporary-password-dialog";
import { AddMemberAccessStep } from "./AddMemberAccessStep";
import { AddMemberDocumentsStep } from "./AddMemberDocumentsStep";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Team & access", "Review", "Agreement & documents"] as const;

export function AddMemberDialog({
  data,
  onClose,
  onCreated,
}: {
  data: TeamMembersOverview;
  onClose: () => void;
  onCreated: (receipt: TemporaryPasswordReceipt) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? "");
  const [fullAccess, setFullAccess] = useState(true);
  const [ticked, setTicked] = useState<string[]>([]);
  const [password, setPassword] = useState(() => temporaryPassword());

  const [identityFiles, setIdentityFiles] = useState<File[]>([]);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);

  const team = data.teams.find((t) => t.id === teamId);
  const role = data.roles.find((r) => r.code === team?.memberRole);
  const allPermissions = role?.permissions ?? [];
  const chosen = fullAccess ? allPermissions : ticked;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneOk = !phone.trim() || /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ""));
  const detailsOk = name.trim().length >= 2 && emailOk && phoneOk;
  const accessOk = Boolean(team) && (fullAccess || ticked.length > 0);
  const docsOk = identityFiles.length >= 1 && Boolean(agreementFile);

  const canNext =
    step === 0 ? detailsOk : step === 1 ? accessOk : step === 2 ? true : docsOk;

  const create = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("displayName", name.trim());
      formData.append("email", email.trim());
      if (phone.trim()) formData.append("phone", phone.trim());
      formData.append("departmentId", teamId);
      formData.append("temporaryPassword", password);
      if (!fullAccess) {
        formData.append("permissions", JSON.stringify(ticked));
      }
      identityFiles.forEach((file) => {
        formData.append("identity", file);
      });
      if (agreementFile) {
        formData.append("agreement", agreementFile);
      }
      return createTeamMemberWithDocuments(formData);
    },
    onSuccess: (created) => {
      toast.success(`${created.displayName} added to ${team?.name}`);
      onCreated({ kind: "created", fullName: created.displayName, email: created.email, password });
    },
    onError: (error: Error) => toast.error("Not created", { description: error.message }),
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !create.isPending ? onClose() : undefined)}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-blue-600" aria-hidden /> Add team member
          </DialogTitle>
          <DialogDescription>
            They get a {role?.name ?? "team"} login in your team and change the password at first sign-in.
          </DialogDescription>
          <ol className="mt-3 flex items-center gap-2" aria-label="Steps">
            {STEPS.map((label, index) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                    index < step
                      ? "bg-emerald-500 text-white"
                      : index === step
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-semibold",
                    index === step ? "text-slate-900" : "text-slate-500",
                  )}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="h-px w-4 bg-slate-200 sm:w-6" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" className="sm:col-span-2">
                <input
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asha Verma"
                />
              </Field>
              <Field label="Work email" error={email && !emailOk ? "Enter a valid email." : undefined}>
                <input
                  type="email"
                  value={email}
                  maxLength={200}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="asha@company.com"
                />
              </Field>
              <Field label="Mobile (optional)" error={!phoneOk ? "Enter a 10-digit Indian mobile." : undefined}>
                <input
                  value={phone}
                  maxLength={16}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                />
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <AddMemberAccessStep
              data={data}
              teamId={teamId}
              onTeamChange={setTeamId}
              fullAccess={fullAccess}
              onFullAccessChange={setFullAccess}
              ticked={ticked}
              onTickedChange={setTicked}
            />
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4">
              <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] sm:grid-cols-2">
                <Summary label="Name" value={name.trim()} />
                <Summary label="Email" value={email.trim()} />
                <Summary label="Mobile" value={phone.trim() || "—"} />
                <Summary label="Team" value={team?.name ?? "—"} />
                <Summary label="Login" value={role?.name ?? "—"} />
                <Summary
                  label="Access"
                  value={
                    fullAccess
                      ? "Full access"
                      : `Custom · ${chosen.length} of ${allPermissions.length} permissions`
                  }
                />
              </dl>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <KeyRound className="size-4 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1 text-[12.5px] text-amber-900">
                  A temporary password is ready. You will see it once after creating, to share privately.
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPassword(temporaryPassword())}
                >
                  <RefreshCw aria-hidden /> New password
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <AddMemberDocumentsStep
              identityFiles={identityFiles}
              onIdentityChange={setIdentityFiles}
              agreementFile={agreementFile}
              onAgreementChange={setAgreementFile}
            />
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={create.isPending}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? (
              <>
                <ChevronLeft aria-hidden /> Back
              </>
            ) : (
              "Cancel"
            )}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              loading={create.isPending}
              disabled={!docsOk}
              onClick={() => create.mutate()}
            >
              <UserPlus aria-hidden /> Create login
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-[13px] [&_input]:h-10 [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:outline-none [&_input:focus]:border-blue-300 [&_input:focus]:ring-4 [&_input:focus]:ring-blue-100",
        className,
      )}
    >
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error ? <small className="text-red-600">{error}</small> : null}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}
