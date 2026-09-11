import { apiDownload, apiRequest, saveBlob } from "./client";
import { fileSha256 } from "./file-digest";
export interface AgreementFile {
  id: string;
  revision: number;
  version: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  isUploader: boolean;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}
const base = (client: string, agreement: string) =>
  `/clients/${client}/agreements/${agreement}/files`;
export function listAgreementFiles(client: string, agreement: string) {
  return apiRequest<{ items: AgreementFile[] }>(base(client, agreement));
}
export async function uploadAgreementFile(client: string, agreement: string, file: File) {
  const body = new FormData();
  body.append("file", file, file.name);
  const digest = await fileSha256(file);
  return apiRequest(base(client, agreement), {
    method: "POST",
    headers: { "x-content-sha256": digest },
    body,
  });
}
export function reviewAgreementFile(
  client: string,
  agreement: string,
  file: AgreementFile,
  input: { status: string; notes: string; signaturesChecked: boolean },
) {
  return apiRequest(`${base(client, agreement)}/${file.id}`, {
    method: "PATCH",
    body: JSON.stringify({ version: file.version, ...input }),
  });
}
export async function downloadAgreementFile(
  client: string,
  agreement: string,
  file: AgreementFile,
) {
  saveBlob(await apiDownload(`${base(client, agreement)}/${file.id}/content`), file.originalName);
}
