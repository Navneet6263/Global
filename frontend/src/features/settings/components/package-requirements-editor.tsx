import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listServicePackages, updatePackageRequirements } from "@/lib/backend-api/settings";
import { RequiredDocumentFields } from "./service-policy-fields";

export function PackageRequirementsEditor({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings", "package-requirements"],
    queryFn: listServicePackages,
    enabled: open,
  });
  const pkg = query.data?.items.find((item) => item.id === id);
  const mutation = useMutation({
    mutationFn: () =>
      updatePackageRequirements(id, {
        updatedAt: pkg!.updatedAt,
        requiredDocuments: draft ?? pkg!.requiredDocuments,
      }),
    onSuccess: () => {
      toast.success("Requirements saved for future cases");
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["settings"] });
      void client.invalidateQueries({ queryKey: ["case-catalog"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(null);
          setOpen(true);
        }}
      >
        <FileCheck2 className="size-3.5" /> Requirements
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pkg?.name ?? "Package requirements"}</DialogTitle>
            <DialogDescription>
              New cases save their own requirement snapshot. Existing case scope is preserved.
            </DialogDescription>
          </DialogHeader>
          {query.isLoading && (
            <p className="text-sm text-muted-foreground">Loading requirements…</p>
          )}
          {query.isError && (
            <p role="alert" className="text-sm text-destructive">
              {query.error.message}
            </p>
          )}
          {pkg && (
            <RequiredDocumentFields value={draft ?? pkg.requiredDocuments} onChange={setDraft} />
          )}
          <Button
            disabled={!pkg || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save requirements"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
