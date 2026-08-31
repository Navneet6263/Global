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
    <div className="flex items-center gap-3 rounded-[1rem] border border-white/80 bg-white/80 p-2 shadow-sm">
      {url ? (
        <img
          src={url}
          alt="Pending field evidence preview"
          className="size-12 rounded-xl object-cover"
        />
      ) : (
        <span className="grid size-12 place-items-center rounded-xl bg-secondary">
          <Camera className="size-4 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold">{photo.name}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {Math.max(1, Math.round(photo.blob.size / 1024))} KB · pending sync
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${photo.name}`}
        className="grid size-8 place-items-center rounded-full bg-critical-soft text-critical transition-colors hover:bg-critical/15"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
