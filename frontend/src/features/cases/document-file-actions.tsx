import { Download, Eye } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadDocument, previewDocument } from "@/lib/backend-api/documents";

type Action = "preview" | "download";

export function DocumentFileActions({
  documentId,
  filename,
  label,
  compact = true,
}: {
  documentId: string;
  filename: string;
  label: string;
  compact?: boolean;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const busy = useRef(false);

  async function run(action: Action) {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    try {
      // Call preview synchronously inside the click to preserve popup permission.
      if (action === "preview") await previewDocument(documentId);
      else await downloadDocument(documentId, filename);
    } catch (error) {
      toast.error(action === "preview" ? "Document preview unavailable" : "Download failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        disabled={pending !== null}
        loading={pending === "preview"}
        onClick={() => void run("preview")}
        aria-label={`Preview ${label} (opens in a new tab)`}
        title="Preview in a new tab"
      >
        <Eye className="size-3.5" aria-hidden />
        {!compact ? "Preview" : null}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        disabled={pending !== null}
        loading={pending === "download"}
        onClick={() => void run("download")}
        aria-label={`Download ${label}`}
        title="Download original"
      >
        <Download className="size-3.5" aria-hidden />
        {!compact ? "Download" : null}
      </Button>
    </div>
  );
}
