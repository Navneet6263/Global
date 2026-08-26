import { LockKeyhole, ShieldCheck } from "lucide-react";

import { humanize } from "./candidate-utils";

export function CandidateBrand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2.5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div>
        <p className="font-bold">Sapling Global</p>
        <p className="text-xs text-muted-foreground">Secure candidate workspace</p>
      </div>
    </div>
  );
}

export function CandidateUnavailable({ message }: { message: string }) {
  return (
    <div className="surface rounded-[2rem] p-8 text-center">
      <LockKeyhole className="mx-auto h-7 w-7 text-destructive" />
      <h1 className="mt-4 text-xl font-bold">Candidate link is unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function CandidateStatus({ value }: { value: string }) {
  const complete = ["COMPLETED", "CLOSED", "ACCEPTED", "AVAILABLE", "RESOLVED"].includes(value);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {humanize(value)}
    </span>
  );
}
