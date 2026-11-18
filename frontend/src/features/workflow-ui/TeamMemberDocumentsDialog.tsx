import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/workspace/kit";
import { fileSize } from "@/features/onboarding/onboarding-format";
import {
  downloadTeamMemberDocument,
  getTeamMemberDocuments,
  previewTeamMemberDocument,
  type TeamMember,
  type TeamMemberDocumentItem,
} from "@/lib/backend-api/team-members";
import { cn } from "@/lib/utils";

export function TeamMemberDocumentsDialog({
  member,
  onClose,
}: {
  member: TeamMember;
  onClose: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const {
    data: docs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["team-member-documents", member.id],
    queryFn: () => getTeamMemberDocuments(member.id),
  });

  const handleDownload = async (doc: TeamMemberDocumentItem) => {
    try {
      setDownloadingId(doc.id);
      await downloadTeamMemberDocument(member.id, doc.id, doc.fileName);
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Could not download document",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = (doc: TeamMemberDocumentItem) => {
    try {
      previewTeamMemberDocument(member.id, doc.id);
    } catch (err) {
      toast.error("Preview failed", {
        description: err instanceof Error ? err.message : "Could not preview document",
      });
    }
  };

  const extBadge = (fileName: string) => {
    const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toUpperCase();
    return (
      <Pill tone="info" dot={false} className="uppercase font-mono text-[10px]">
        {ext}
      </Pill>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-blue-600" aria-hidden /> Documents · {member.name}
          </DialogTitle>
          <DialogDescription>
            Identity and agreement documents uploaded for this team member.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-slate-500">
              <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden /> Loading
              documents...
            </div>
          ) : error ? (
            <div className="py-6 text-center text-[13px] text-red-600">
              Failed to load documents.
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[13px] text-slate-500">
              No documents uploaded for this team member.
            </div>
          ) : (
            <ul className="grid gap-3" aria-label="Team member documents">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "grid size-9 place-items-center rounded-lg",
                        doc.category === "AGREEMENT"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600",
                      )}
                    >
                      <FileText className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-slate-900">
                          {doc.fileName}
                        </span>
                        {extBadge(doc.fileName)}
                      </div>
                      <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
                        <span className="font-medium">
                          {doc.category === "AGREEMENT" ? "Agreement" : `Identity #${doc.slot}`}
                        </span>
                        <span>·</span>
                        <span>{fileSize(doc.fileSize)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-slate-700"
                      onClick={() => handlePreview(doc)}
                      title="Preview document"
                    >
                      <Eye className="size-3.5 mr-1" aria-hidden /> Preview
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-slate-700"
                      disabled={downloadingId === doc.id}
                      onClick={() => handleDownload(doc)}
                      title="Download file"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Download className="size-3.5 mr-1" aria-hidden />
                      )}
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
