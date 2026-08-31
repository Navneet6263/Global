import { LockKeyhole, RefreshCw } from "lucide-react";

export function PublicLoading({ label = "Loading secure workspace" }: { label?: string }) {
  return (
    <div className="surface-float overflow-hidden rounded-[1.75rem]" aria-live="polite">
      <div className="h-40 animate-pulse bg-mint-soft/70" />
      <div className="space-y-3 p-6 sm:p-8">
        <div className="h-5 w-2/5 animate-pulse rounded-full bg-secondary" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-secondary" />
        <div className="h-28 animate-pulse rounded-[1.25rem] bg-secondary/70" />
        <p className="sr-only">{label}</p>
      </div>
    </div>
  );
}

export function PublicUnavailable({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section className="surface-float rounded-[1.75rem] p-7 text-center sm:p-9">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-critical-soft text-critical">
        <LockKeyhole className="size-6" />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground"
        >
          <RefreshCw className="size-3.5" /> Try again
        </button>
      ) : null}
    </section>
  );
}
