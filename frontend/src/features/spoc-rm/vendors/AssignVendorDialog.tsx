import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import { isValidVendorText, VENDOR_TEXT_MAX } from "./spoc-vendor-model";
import { useVendorOptions } from "./use-spoc-vendors";

export interface AssignVendorDialogProps {
  open: boolean;
  mode: "assign" | "reassign";
  documentLabel: string;
  rejection?: { vendor: string; reason: string | null } | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: { vendorId: string; text: string }) => void;
}

/** Assign (optional note) or re-assign (mandatory resolution note) one document to a vendor. */
export function AssignVendorDialog(props: AssignVendorDialogProps) {
  const vendors = useVendorOptions(props.open);
  const [vendorId, setVendorId] = useState("");
  const [text, setText] = useState("");
  const reassign = props.mode === "reassign";
  const textReady = reassign ? isValidVendorText(text) : text.trim().length <= VENDOR_TEXT_MAX;
  const ready = Boolean(vendorId) && textReady;
  const options = vendors.data?.items ?? [];

  useEffect(() => {
    if (props.open) return;
    setVendorId("");
    setText("");
  }, [props.open]);

  const placeholder = vendors.isError
    ? "Vendors could not be loaded"
    : !vendors.data
      ? "Loading vendors…"
      : options.length
        ? "Select a vendor"
        : "No active vendor IDs yet";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reassign ? "Re-assign to a vendor" : "Assign to a vendor"}</DialogTitle>
          <DialogDescription>
            {props.documentLabel}. The vendor is notified and sees only this document.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) props.onSubmit({ vendorId, text: text.trim() });
          }}
        >
          {reassign && props.rejection ? (
            <div className={cn("rounded-2xl border px-3 py-2 text-xs", TONE_BADGE.critical)}>
              <p className="font-semibold">Rejected by {props.rejection.vendor}</p>
              <p className="mt-0.5 break-words whitespace-pre-wrap">{props.rejection.reason}</p>
            </div>
          ) : null}
          <div>
            <Label className="mb-1.5 block text-xs">Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId} disabled={!options.length}>
              <SelectTrigger aria-label="Vendor">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name} · {vendor.pending} pending
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">
              {reassign
                ? "How was the issue resolved? (required)"
                : "Note for the vendor (optional)"}
            </Label>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={VENDOR_TEXT_MAX}
              rows={4}
              placeholder={
                reassign
                  ? "For example: the client uploaded a clear scan of the certificate"
                  : "Anything the vendor should check"
              }
            />
            {reassign && text && !isValidVendorText(text) ? (
              <p className="mt-1 text-[11px] text-critical-foreground">
                Write at least 5 characters.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || props.busy} loading={props.busy}>
              {reassign ? "Re-assign" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
