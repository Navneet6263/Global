import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  raiseCandidateSupportRequest,
  type CandidateSupportRequest,
} from "@/lib/api/candidate-portal";
import { RaiseSupportRequestForm } from "./RaiseSupportRequestForm";
import { SupportRequestHistory } from "./SupportRequestHistory";

/**
 * Candidate link navbar: raise a support request for this verification and read the
 * support team's replies. Authorised only by the link token; the server resolves the case.
 */
export function CandidateSupportSheet({
  accessId,
  token,
  requests,
}: {
  accessId: string;
  token: string;
  requests: readonly CandidateSupportRequest[];
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const raise = useMutation({
    mutationFn: (input: { subject: string; message: string }) =>
      raiseCandidateSupportRequest(accessId, token, input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
      toast.success("Support request sent", {
        description: `${result.requestNumber} is with the support team.`,
      });
    },
    onError: (error: Error) =>
      toast.error("The request was not sent", { description: error.message }),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-full" aria-label="Support">
          <LifeBuoy className="size-4" aria-hidden />
          <span className="hidden sm:inline">Support</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[450px]">
        <SheetHeader className="border-b px-5 pt-6 pb-4 text-left">
          <SheetTitle>Need help?</SheetTitle>
          <SheetDescription>
            Tell the support team what is wrong. Replies appear here on your link.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 p-5">
          <RaiseSupportRequestForm
            busy={raise.isPending}
            onSubmit={(input, reset) =>
              raise.mutate({ subject: input.subject, message: input.message }, { onSuccess: reset })
            }
          />
          <section>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Your requests
            </h3>
            <SupportRequestHistory requests={requests} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
