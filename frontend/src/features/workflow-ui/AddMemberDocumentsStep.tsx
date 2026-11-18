import { useRef } from "react";
import { Eye, FileText, Info, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/workspace/kit";
import { fileSize } from "@/features/onboarding/onboarding-format";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".doc", ".docx"];
const PREVIEWABLE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

export function AddMemberDocumentsStep({
  identityFiles,
  onIdentityChange,
  agreementFile,
  onAgreementChange,
}: {
  identityFiles: File[];
  onIdentityChange: (files: File[]) => void;
  agreementFile: File | null;
  onAgreementChange: (file: File | null) => void;
}) {
  const identityInputRef = useRef<HTMLInputElement>(null);
  const agreementInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(
        `"${file.name}" has an unsupported format. Allowed: PNG, JPG, JPEG, PDF, DOC, DOCX`,
      );
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`"${file.name}" exceeds the 10 MB limit`);
      return false;
    }
    return true;
  };

  const handleIdentitySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const availableSlots = 2 - identityFiles.length;
    if (selected.length > availableSlots) {
      toast.error(
        `You can only upload up to 2 identity documents (${availableSlots} slot remaining)`,
      );
    }

    const validNew = selected.slice(0, availableSlots).filter(validateFile);
    if (validNew.length) {
      onIdentityChange([...identityFiles, ...validNew]);
    }
    if (identityInputRef.current) identityInputRef.current.value = "";
  };

  const handleAgreementSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (validateFile(file)) {
      onAgreementChange(file);
    }
    if (agreementInputRef.current) agreementInputRef.current.value = "";
  };

  const previewLocalFile = (file: File) => {
    if (!PREVIEWABLE_TYPES.includes(file.type)) {
      toast.info("Browser preview is available for PDF and image files only.");
      return;
    }
    const url = URL.createObjectURL(file);
    const win = window.open(url, "_blank");
    if (!win) {
      toast.error("Allow pop-ups to preview this document.");
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
    <div className="grid gap-6">
      {/* 1. Identity Documents Section */}
      <section className="grid gap-3" aria-labelledby="identity-docs-heading">
        <div className="flex items-center justify-between">
          <div>
            <h3 id="identity-docs-heading" className="text-[13.5px] font-semibold text-slate-900">
              Identity documents <span className="text-red-500">*</span>
            </h3>
            <p className="text-[12px] text-slate-500">
              Upload 1 or 2 government ID proofs (e.g. Aadhaar, PAN, Passport).
            </p>
          </div>
          <span className="text-[12px] font-medium text-slate-500">
            {identityFiles.length} of 2 added
          </span>
        </div>

        {identityFiles.length > 0 ? (
          <ul className="grid gap-2" aria-label="Added identity documents">
            {identityFiles.map((file, idx) => (
              <li
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-slate-900">
                        {file.name}
                      </span>
                      {extBadge(file.name)}
                    </div>
                    <small className="block text-[11.5px] text-slate-400">
                      {fileSize(file.size)}
                    </small>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-slate-600"
                    onClick={() => previewLocalFile(file)}
                    title="Preview file"
                  >
                    <Eye className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onIdentityChange(identityFiles.filter((_, i) => i !== idx))}
                    title="Remove file"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {identityFiles.length < 2 ? (
          <>
            <input
              ref={identityInputRef}
              type="file"
              hidden
              multiple
              accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
              aria-label="Upload identity document"
              onChange={handleIdentitySelect}
            />
            <button
              type="button"
              onClick={() => identityInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center transition hover:border-blue-400 hover:bg-blue-50/30"
            >
              <Upload className="size-4 text-blue-600" aria-hidden />
              <span className="text-[12.5px] font-medium text-slate-700">
                Click to upload identity document
              </span>
              <span className="text-[11px] text-slate-400">
                PNG, JPG, JPEG, PDF, DOC, DOCX up to 10 MB
              </span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">
            <Info className="size-3.5 text-slate-400" aria-hidden />
            Maximum 2 identity documents reached. Remove one to replace it.
          </div>
        )}

        {identityFiles.length === 0 ? (
          <p className="text-[12px] font-medium text-amber-600">
            At least 1 Identity document is required to create a team member.
          </p>
        ) : null}
      </section>

      {/* 2. Agreement Section */}
      <section className="grid gap-3" aria-labelledby="agreement-heading">
        <div className="flex items-center justify-between">
          <div>
            <h3 id="agreement-heading" className="text-[13.5px] font-semibold text-slate-900">
              Agreement <span className="text-red-500">*</span>
            </h3>
            <p className="text-[12px] text-slate-500">
              Upload signed verifier code of conduct, employment contract, or NDA.
            </p>
          </div>
          <span className="text-[12px] font-medium text-slate-500">
            {agreementFile ? "1 of 1" : "0 of 1"} added
          </span>
        </div>

        {agreementFile ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileText className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-slate-900">
                    {agreementFile.name}
                  </span>
                  {extBadge(agreementFile.name)}
                </div>
                <small className="block text-[11.5px] text-slate-400">
                  {fileSize(agreementFile.size)}
                </small>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-600"
                onClick={() => previewLocalFile(agreementFile)}
                title="Preview agreement"
              >
                <Eye className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onAgreementChange(null)}
                title="Remove agreement"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={agreementInputRef}
              type="file"
              hidden
              accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
              aria-label="Upload agreement document"
              onChange={handleAgreementSelect}
            />
            <button
              type="button"
              onClick={() => agreementInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center transition hover:border-blue-400 hover:bg-blue-50/30"
            >
              <Upload className="size-4 text-blue-600" aria-hidden />
              <span className="text-[12.5px] font-medium text-slate-700">
                Click to upload agreement document
              </span>
              <span className="text-[11px] text-slate-400">
                PNG, JPG, JPEG, PDF, DOC, DOCX up to 10 MB
              </span>
            </button>
            <p className="text-[12px] font-medium text-amber-600">
              1 Agreement document is required to create a team member.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
