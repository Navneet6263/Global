import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateClientDialog } from "@/features/clients/components/create-client-dialog";
import { useCreateClient } from "@/features/clients/hooks/use-clients";
import type { ClientOrganisation } from "@/lib/contracts/client";

/**
 * Internal company set-up (no self sign-up) for Operations and Platform Admin. The new
 * company is active at once; the next steps are its RM and its Client Admin user ID.
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
                  "Next: assign its RM here, then create its Client Admin in User IDs & Access.",
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
