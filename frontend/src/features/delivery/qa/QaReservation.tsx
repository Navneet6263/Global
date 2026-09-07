import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QaReservation({
  minutes,
  onChange,
  disabled,
}: {
  minutes: number;
  onChange: (action: "renew" | "release") => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
      <Clock3 className="size-4 text-emerald-700" aria-hidden />
      <p className="mr-auto text-xs font-medium text-emerald-900">
        Reserved for you · {minutes} min remaining
      </p>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange("renew")}>
        Renew
      </Button>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("release")}>
        Release
      </Button>
    </div>
  );
}
