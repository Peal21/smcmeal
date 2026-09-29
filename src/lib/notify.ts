import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * Send Telegram DM + group mention when a meal is updated from the website.
 * Fire-and-forget — never blocks or throws to the caller.
 *
 * @param userId  - Supabase auth user_id of the student whose meal changed
 * @param message - Bengali message text (HTML is OK, Telegram HTML parse mode)
 * @param roll    - Roll number string (fallback display)
 * @param name    - Full name string (fallback display)
 */
export async function sendTelegramMealNotification(params: {
  userId: string;
  message: string;
  roll?: string;
  name?: string;
}) {
  try {
    await supabase.functions.invoke('telegram-bot-webhook', {
      body: {
        action: 'notify_website_meal_change',
        user_id: params.userId,
        message: params.message,
        roll: params.roll,
        name: params.name,
      },
    });
  } catch (err) {
    // Silent — notification is best-effort
    console.warn('[TelegramNotify] Failed to send notification:', err);
  }
}
