import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { changeQaReservation, claimQaCase, submitQaDecision, type QaQueueItem } from "@/lib/api/qa";

export function useQaActions(
  item: QaQueueItem,
  input: Parameters<typeof submitQaDecision>[1],
  onRefresh: () => Promise<void>,
) {
  const failed = (error: Error) => toast.error(error.message);
  const claim = useMutation({
    mutationFn: () => claimQaCase(item.id, item.version),
    onSuccess: async () => {
      toast.success("Case reserved for your independent review");
      await onRefresh();
    },
    onError: failed,
  });
  const reservation = useMutation({
    mutationFn: (action: "renew" | "release") => changeQaReservation(item.id, item.version, action),
    onSuccess: async (_, action) => {
      toast.success(
        action === "renew"
          ? "Reservation renewed. Recheck the quality controls before deciding."
          : "Reservation released to the review queue",
      );
      await onRefresh();
    },
    onError: failed,
  });
  const decision = useMutation({
    mutationFn: () => submitQaDecision(item.id, input),
    onSuccess: async (result) => {
      toast.success(
        result.decision === "APPROVED"
          ? "QA approved; case sent to independent Manager Review"
          : "New verifier rework task created",
      );
      await onRefresh();
    },
    onError: failed,
  });
  return {
    claim,
    reservation,
    decision,
    busy: claim.isPending || reservation.isPending || decision.isPending,
  };
}
