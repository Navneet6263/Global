import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = "We couldn't load this data",
  description = "The request failed before it completed. Retry, or check the platform health panel for service status.",
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-critical/25 bg-critical-soft/60 px-5 py-5">
      <div className="flex items-center gap-2 text-critical-foreground">
        <AlertTriangle className="size-4" aria-hidden />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="max-w-2xl text-sm text-critical-foreground/85">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RotateCcw className="size-3.5" aria-hidden />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      ) : null}
    </div>
  );
}
