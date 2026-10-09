import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  confirmCandidateConsent,
  sendCandidateConsentCode,
  type CandidatePortalData,
} from "@/lib/api/candidate-portal";

const RESEND_SECONDS = 60;

/**
 * Step 1 inside the single candidate link: agree to the notice, get a one-time code by
 * email, enter it here. Once confirmed, the upload section opens on the same page.
 */
export function CandidateConsentStep({
  accessId,
  token,
  portal,
  onConfirmed,
}: {
  accessId: string;
  token: string;
  portal: CandidatePortalData;
  onConfirmed: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devCode, setDevCode] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const send = useMutation({
    mutationFn: () => sendCandidateConsentCode(accessId, token),
    onSuccess: (result) => {
      setSentTo(result.destination);
      setDevCode(result.developmentOtp ?? "");
      setOtp("");
      setError("");
      setWait(RESEND_SECONDS);
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const confirm = useMutation({
    mutationFn: (code: string) => confirmCandidateConsent(accessId, token, code),
    onSuccess: () => {
      toast.success("Consent recorded", { description: "You can upload your documents now." });
      onConfirmed();
    },
    onError: (failure: Error) => {
      setOtp("");
      setError(failure.message);
    },
  });

  return (
    <section className="cand-card cand-consent" aria-labelledby="cand-consent-title">
      <header className="cand-card-head">
        <h2 id="cand-consent-title">
          <ShieldCheck aria-hidden /> Give your consent
        </h2>
        <p>
          {portal.case.clientName} needs your permission before you share documents. You do this
          once — it stays recorded for this verification.
        </p>
      </header>
      <label className="cand-notice">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          disabled={Boolean(sentTo)}
        />
        <span>
          I have read the{" "}
          <button type="button" onClick={() => setShowNotice((value) => !value)}>
            privacy notice
          </button>{" "}
          and agree to a background verification and to share my documents for it.
        </span>
      </label>
      {showNotice ? (
        <div className="cand-notice-text">
          <p className="font-semibold text-slate-700">{portal.privacyNotice.title}</p>
          {portal.privacyNotice.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      <div className="cand-consent-body">
        {!sentTo ? (
          <Button
            className="cand-consent-send"
            disabled={!agreed}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            <MailCheck className="size-4" aria-hidden /> Email me a 6-digit code
          </Button>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (otp.length === 6) confirm.mutate(otp);
            }}
          >
            <p className="cand-consent-sent">
              We sent a code to <strong>{sentTo}</strong>. It is valid for 10 minutes.
            </p>
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                const digits = value.replace(/\D/g, "");
                setOtp(digits);
                setError("");
                if (digits.length === 6) confirm.mutate(digits);
              }}
              aria-label="6-digit consent code"
              autoFocus
              disabled={confirm.isPending}
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-11 rounded-xl border text-lg font-bold first:rounded-xl last:rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {devCode ? <p className="cand-consent-dev">Local testing code: {devCode}</p> : null}
            <div className="cand-consent-actions">
              <Button type="submit" disabled={otp.length !== 6} loading={confirm.isPending}>
                <ShieldCheck className="size-4" aria-hidden /> Confirm consent
              </Button>
              <button
                type="button"
                className="cand-consent-resend"
                disabled={wait > 0 || send.isPending}
                onClick={() => send.mutate()}
              >
                {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
        {error ? (
          <p className="cand-doc-reason" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
