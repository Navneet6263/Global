import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateClientDialog } from "@/features/clients/components/create-client-dialog";
import { useCreateClient } from "@/features/clients/hooks/use-clients";
import type { ClientOrganisation } from "@/lib/contracts/client";

/**
 * Internal company set-up for Operations and Platform Admin. The new company starts in
 * onboarding, like a self sign-up: documents, packages and RM, then approval.
 */
export function AddCompanyButton({
  onCreated,
}: {
  onCreated: (client: ClientOrganisation) => void;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateClient();
  const queryClient = useQueryClient();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden />
        Add company
      </Button>
      <CreateClientDialog
        open={open}
        submitting={create.isPending}
        onOpenChange={setOpen}
        onSubmit={(draft) =>
          create.mutate(draft, {
            onSuccess: async (client) => {
              setOpen(false);
              toast.success(`${client.name} added`, {
                description:
                  "Next: add its documents, packages and RM here. It goes live once approved.",
              });
              await queryClient.invalidateQueries({ queryKey: ["workflow", "client-rms"] });
              onCreated(client);
            },
            onError: (error: Error) =>
              toast.error("Company not added", { description: error.message }),
          })
        }
      />
    </>
  );
}
