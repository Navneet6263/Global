import type { FieldDraft, OfflinePhoto } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type PhotoMetadata = Omit<OfflinePhoto, "blob"> & { byteLength: number };
type DraftMetadata = Omit<FieldDraft, "photos"> & { photos: PhotoMetadata[] };

function writeUint32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value, false);
  return offset + 4;
}

function readUint32(view: DataView, offset: number): number {
  if (offset + 4 > view.byteLength) throw new Error("Offline field draft is truncated");
  return view.getUint32(offset, false);
}

export async function encodeFieldDraft(draft: FieldDraft): Promise<Uint8Array<ArrayBuffer>> {
  const photoBytes = await Promise.all(draft.photos.map((photo) => photo.blob.arrayBuffer()));
  const metadata: DraftMetadata = {
    ...draft,
    photos: draft.photos.map(({ blob, ...photo }, index) => ({
      ...photo,
      byteLength: photoBytes[index]?.byteLength ?? blob.size,
    })),
  };
  const metadataBytes = encoder.encode(JSON.stringify(metadata));
  const totalLength =
    4 + metadataBytes.byteLength + photoBytes.reduce((sum, item) => sum + 4 + item.byteLength, 0);
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  let offset = writeUint32(view, 0, metadataBytes.byteLength);
  output.set(metadataBytes, offset);
  offset += metadataBytes.byteLength;
  for (const bytes of photoBytes) {
    offset = writeUint32(view, offset, bytes.byteLength);
    output.set(new Uint8Array(bytes), offset);
    offset += bytes.byteLength;
  }
  return output;
}

export function decodeFieldDraft(payload: Uint8Array): FieldDraft {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const metadataLength = readUint32(view, 0);
  let offset = 4;
  if (metadataLength <= 0 || offset + metadataLength > payload.byteLength) {
    throw new Error("Offline field draft metadata is invalid");
  }
  const metadata = JSON.parse(
    decoder.decode(payload.subarray(offset, offset + metadataLength)),
  ) as DraftMetadata;
  offset += metadataLength;
  if (!metadata.visitId || !Array.isArray(metadata.photos))
    throw new Error("Offline field draft is invalid");

  const photos = metadata.photos.map(({ byteLength, ...photo }) => {
    const storedLength = readUint32(view, offset);
    offset += 4;
    if (storedLength !== byteLength || offset + storedLength > payload.byteLength) {
      throw new Error("Offline field photo is invalid");
    }
    const bytes = payload.slice(offset, offset + storedLength);
    offset += storedLength;
    return { ...photo, blob: new Blob([bytes], { type: photo.type }) };
  });
  if (offset !== payload.byteLength) throw new Error("Offline field draft contains trailing data");
  return { ...metadata, photos };
}
