import { Camera, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { OfflinePhoto } from "./types";

export function EvidencePreview({
  photo,
  onRemove,
}: {
  photo: OfflinePhoto;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(photo.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo.blob]);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white p-2">
      {url ? (
        <img
          src={url}
          alt="Pending field evidence preview"
          className="h-11 w-11 rounded-lg object-cover"
        />
      ) : (
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100">
          <Camera className="h-4 w-4 text-slate-400" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold">{photo.name}</p>
        <p className="text-[9px] text-slate-400">
          {Math.max(1, Math.round(photo.blob.size / 1024))} KB · pending sync
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${photo.name}`}
        className="rounded-md p-1.5 text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
