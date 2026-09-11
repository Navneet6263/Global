import { useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientCommercialPanel } from "@/features/clients/components/client-commercial-panel";

export function CrmClientCommercial({ clientId, company }: { clientId: string; company: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileCheck2 className="size-3.5" /> Client agreements & rates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company}: commercial onboarding</DialogTitle>
          <DialogDescription>
            Record billing details, package rates and agreement references. A Platform Admin can
            activate the new client from Client management after the checklist is complete.
          </DialogDescription>
        </DialogHeader>
        {open ? <ClientCommercialPanel clientId={clientId} /> : null}
      </DialogContent>
    </Dialog>
  );
}
