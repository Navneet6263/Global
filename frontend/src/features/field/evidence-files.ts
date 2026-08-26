import type { OfflinePhoto } from "./types";

const maximumPendingPhotos = 12;
const maximumPhotoBytes = 10_485_760;

export function prepareEvidencePhotos(files: FileList, currentCount: number) {
  const errors: string[] = [];
  const accepted = Array.from(files).filter((file) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      errors.push(`${file.name} is not a supported image`);
      return false;
    }
    if (file.size > maximumPhotoBytes) {
      errors.push(`${file.name} exceeds the 10 MB evidence limit`);
      return false;
    }
    return true;
  });
  const available = Math.max(0, maximumPendingPhotos - currentCount);
  if (accepted.length > available) {
    errors.push(`A visit draft can hold up to ${maximumPendingPhotos} pending photos`);
  }
  const capturedAt = new Date().toISOString();
  const photos: OfflinePhoto[] = accepted.slice(0, available).map((file) => ({
    id: crypto.randomUUID(),
    blob: file,
    name: file.name || `field-evidence-${Date.now()}.jpg`,
    type: file.type,
    capturedAt,
  }));
  return { photos, errors };
}
