import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Save } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  getClientCommercial,
  updateClientCommercial,
  type AgreementDraft,
  type CommercialSettings,
} from "@/lib/backend-api/client-commercial";
import { CommercialRateEditor, commercialInput } from "./commercial-rate-editor";
import { AgreementFiles } from "./agreement-files";

export function ClientCommercialPanel({ clientId }: { clientId: string }) {
  const query = useQuery({
    queryKey: ["clients", clientId, "commercial"],
    queryFn: () => getClientCommercial(clientId),
  });
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError)
    return <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />;
  return (
    <div className="space-y-5">
      <CommercialForm key={`${clientId}-${query.data.version}`} settings={query.data} />
      <AgreementFiles clientId={clientId} agreements={query.data.agreements} />
    </div>
  );
}

function CommercialForm({ settings }: { settings: CommercialSettings }) {
  const cache = useQueryClient();
  const [gstin, setGstin] = useState(settings.gstin ?? "");
  const [billingAddress, setBillingAddress] = useState(settings.billingAddress ?? "");
  const [billingTerms, setBillingTerms] = useState(settings.billingTerms ?? "");
  const [rates, setRates] = useState(settings.packages);
  const [agreement, setAgreement] = useState<AgreementDraft>({ type: "AGREEMENT", reference: "" });
  const save = useMutation({
    mutationFn: () =>
      updateClientCommercial(settings.id, {
        version: settings.version,
        gstin,
        billingAddress,
        billingTerms,
        packages: rates.map(({ name: _name, tatHours, ...rate }) => ({
          ...rate,
          ...(tatHours === null ? {} : { tatHours }),
        })),
        agreements: agreement.reference.trim() ? [agreement] : [],
      }),
    onSuccess: (data) => {
      toast.success("Commercial settings saved");
      cache.setQueryData(["clients", settings.id, "commercial"], data);
      void cache.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-4"
    >
      <section className="space-y-3 rounded-2xl border border-info/20 bg-info-soft/20 p-4">
        <h3 className="text-sm font-semibold">Billing identity</h3>
        <label className="block space-y-1 text-xs">
          GSTIN
          <input
            value={gstin}
            maxLength={15}
            pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]"
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="15-character GSTIN (optional)"
            className={commercialInput}
          />
        </label>
        <label className="block space-y-1 text-xs">
          Billing address
          <textarea
            value={billingAddress}
            maxLength={500}
            onChange={(e) => setBillingAddress(e.target.value)}
            className={`${commercialInput} h-20 py-2`}
          />
        </label>
        <label className="block space-y-1 text-xs">
          Billing terms
          <input
            value={billingTerms}
            maxLength={200}
            onChange={(e) => setBillingTerms(e.target.value)}
            placeholder="e.g. Payment within 15 days"
            className={commercialInput}
          />
        </label>
      </section>
      <CommercialRateEditor rates={rates} catalog={settings.catalog} onChange={setRates} />
      <section className="space-y-3 rounded-2xl border border-review/20 bg-review-soft/20 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileCheck2 className="size-4" /> Agreement register
        </h3>
        <p className="text-xs text-muted-foreground">
          Save the agreement reference first, then upload the original in Contract files below. New
          onboarding requires an independent review of the signed agreement and DPA.
        </p>
        {settings.agreements.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3 text-xs">
            <p className="font-medium">
              {item.type} · {item.reference}
            </p>
            <p className="mt-1 text-muted-foreground">
              Signed:{" "}
              {item.signedAt ? new Date(item.signedAt).toLocaleDateString("en-IN") : "Not recorded"}{" "}
              · Expires:{" "}
              {item.expiresAt
                ? new Date(item.expiresAt).toLocaleDateString("en-IN")
                : "Not recorded"}
            </p>
          </div>
        ))}
        <select
          aria-label="Agreement type"
          value={agreement.type}
          onChange={(e) =>
            setAgreement({ ...agreement, type: e.target.value as AgreementDraft["type"] })
          }
          className={commercialInput}
        >
          <option value="AGREEMENT">Service agreement</option>
          <option value="DPA">Data processing agreement</option>
          <option value="CONFIDENTIALITY">Confidentiality agreement</option>
          <option value="PROPOSAL">Accepted proposal</option>
        </select>
        <input
          aria-label="New agreement reference"
          value={agreement.reference}
          maxLength={500}
          minLength={2}
          onChange={(e) => setAgreement({ ...agreement, reference: e.target.value })}
          placeholder="Add document reference / contract number"
          className={commercialInput}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs">
            Signed on
            <input
              type="date"
              value={agreement.signedAt ?? ""}
              onChange={(e) =>
                setAgreement({ ...agreement, signedAt: e.target.value || undefined })
              }
              className={commercialInput}
            />
          </label>
          <label className="space-y-1 text-xs">
            Expires on
            <input
              type="date"
              value={agreement.expiresAt ?? ""}
              onChange={(e) =>
                setAgreement({ ...agreement, expiresAt: e.target.value || undefined })
              }
              className={commercialInput}
            />
          </label>
        </div>
      </section>
      <button
        disabled={save.isPending}
        aria-busy={save.isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Save className="size-4" />
        {save.isPending ? "Saving…" : "Save commercial settings"}
      </button>
    </form>
  );
}
