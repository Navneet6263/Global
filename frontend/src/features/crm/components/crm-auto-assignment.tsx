import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/backend-api/client";
import { getCrmSequence } from "@/lib/backend-api/crm-proposals";

export function CrmAutoAssignment({ id }: { id: string }) {
  const cache = useQueryClient();
  const assign = useMutation({
    mutationFn: async () => {
      const row = await getCrmSequence(id);
      return apiRequest<{ ownerName: string }>(`/crm/opportunities/${id}/auto-assign`, {
        method: "POST",
        body: JSON.stringify({ version: row.version }),
      });
    },
    onSuccess: (data) => {
      toast.success(`Assigned to ${data.ownerName}`);
      void cache.invalidateQueries({ queryKey: ["crm"] });
      void cache.invalidateQueries({ queryKey: ["crm-sequence", id] });
      void cache.invalidateQueries({ queryKey: ["crm-proposals", id] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={assign.isPending}
      loading={assign.isPending}
      onClick={() => assign.mutate()}
    >
      <Users className="size-3.5" />
      {assign.isPending ? "Checking workload…" : "Assign least-loaded owner"}
    </Button>
  );
}
