import { toast } from 'sonner';

const EVENT_NAME = 'app:congrats';

/**
 * Notify a successful update.
 * - Students (non-privileged): big centered "অভিনন্দন" congrats dialog
 * - Managers / Admins / Admin-mode: small toast at top
 */
export function notifyUpdate(message: string, isPrivileged: boolean) {
  if (isPrivileged) {
    toast.success(message);
  } else {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: message }));
  }
}

export const CONGRATS_EVENT = EVENT_NAME;
