import { toast } from "sonner";

export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}
