import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePageHelp } from "./help-state";

export function NavigationHint({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactElement;
}) {
  const help = usePageHelp();
  if (!help?.enabled) return children;
  return (
    <Tooltip delayDuration={450}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="max-w-64 rounded-xl border bg-card p-3 text-foreground shadow-lg"
      >
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        <p className="mt-2 text-[10px] text-emerald-700">
          Open the page, then Help for next steps.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
