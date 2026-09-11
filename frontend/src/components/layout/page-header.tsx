import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, meta, actions, className }: PageHeaderProps) {
  const descriptionId = useId();
  return (
    <header
      data-workspace-heading
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1
          aria-describedby={description ? descriptionId : undefined}
          className="break-words text-lg font-semibold leading-7 tracking-[-0.02em] text-foreground sm:text-xl"
        >
          {title}
        </h1>
        {description ? (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="border-l border-border pl-3 text-xs text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
