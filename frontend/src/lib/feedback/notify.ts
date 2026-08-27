import { toast } from "sonner";

/**
 * Phase 1 placeholder feedback. Every action that will be wired to the NestJS
 * API in the integration phase reports through this helper so nothing looks
 * broken or decorative to the user.
 */
export function notifyPendingIntegration(action: string, detail?: string) {
  toast.info(action, {
    description: detail ?? "This connects to the Sapling Global API in the integration phase.",
  });
}

export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

export function notifyError(title: string, description?: string) {
  toast.error(title, description ? { description } : undefined);
}
