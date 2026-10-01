import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMySupportRequests, useRaiseSupportRequest } from "../hooks/use-support";
import { RaiseSupportRequestForm } from "./RaiseSupportRequestForm";
import { SupportRequestHistory } from "./SupportRequestHistory";

/** Client Admin navbar: raise a support request and follow its status and reply. */
export function ClientSupportLauncher({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mine = useMySupportRequests(1, open);
  const raise = useRaiseSupportRequest();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant={label ? "outline" : "ghost"}
              size={label ? "default" : "icon"}
              aria-label={label ?? "Support"}
              className={className}
            >
              <LifeBuoy className="size-4" aria-hidden />
              {label}
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Support</TooltipContent>
      </Tooltip>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[450px]">
        <SheetHeader className="border-b px-5 pt-6 pb-4 text-left">
          <SheetTitle>Raise a support request</SheetTitle>
          <SheetDescription>
            The support team answers here and in your notifications.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 p-5">
          <RaiseSupportRequestForm
            withCaseNumber
            busy={raise.isPending}
            onSubmit={(input, reset) => raise.mutate(input, { onSuccess: reset })}
          />
          <section>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Your requests
            </h3>
            <SupportRequestHistory
              requests={mine.data?.items}
              loading={mine.isLoading}
              error={mine.error?.message ?? null}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
