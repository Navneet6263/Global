import { useId, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RaiseSupportRequestInput } from "../api/support-contracts";
import { SUPPORT_MESSAGE_MAX, SUPPORT_SUBJECT_MAX, isValidSupportText } from "../support-model";

/**
 * "Raise a support request": shared by the candidate link and the Client Admin
 * navbar. The server decides the client and case; this only collects the query.
 */
export function RaiseSupportRequestForm({
  withCaseNumber = false,
  busy,
  onSubmit,
}: {
  withCaseNumber?: boolean;
  busy: boolean;
  onSubmit: (input: RaiseSupportRequestInput, reset: () => void) => void;
}) {
  const [subject, setSubject] = useState("");
  const id = useId();
  const [message, setMessage] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const ready =
    isValidSupportText(subject, SUPPORT_SUBJECT_MAX) &&
    isValidSupportText(message, SUPPORT_MESSAGE_MAX);
  const reset = () => {
    setSubject("");
    setMessage("");
    setCaseNumber("");
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy)
          onSubmit(
            {
              subject: subject.trim(),
              message: message.trim(),
              caseNumber: caseNumber.trim() || undefined,
            },
            reset,
          );
      }}
    >
      <div>
        <Label htmlFor={`${id}-subject`} className="mb-1.5 block text-xs">
          What is it about?
        </Label>
        <Input
          id={`${id}-subject`}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={SUPPORT_SUBJECT_MAX}
          placeholder="For example: my document upload keeps failing"
        />
      </div>
      {withCaseNumber ? (
        <div>
          <Label htmlFor={`${id}-case`} className="mb-1.5 block text-xs">
            Case number (optional)
          </Label>
          <Input
            id={`${id}-case`}
            value={caseNumber}
            onChange={(event) => setCaseNumber(event.target.value)}
            maxLength={32}
            placeholder="SG-20260928-600E89"
          />
        </div>
      ) : null}
      <div>
        <Label htmlFor={`${id}-message`} className="mb-1.5 block text-xs">
          Describe the problem
        </Label>
        <Textarea
          id={`${id}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={SUPPORT_MESSAGE_MAX}
          rows={5}
          placeholder="What happened, what you expected, and anything you already tried"
        />
      </div>
      <Button type="submit" disabled={!ready || busy} loading={busy}>
        <Send className="size-4" aria-hidden /> {busy ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
