/**
 * Platform notification events.
 *
 * Thin, typed layer over the Telegram transport (src/lib/telegram.ts). Message
 * *building* lives in src/lib/notify-messages.ts (pure, unit tested); this file
 * wires those builders to the transport. The `notify*` functions are
 * fire-and-forget: they never throw and never block the caller's happy path.
 *
 * Events wired (per product decision):
 *   - New tenant signup
 *   - Manual bank-transfer proof submitted (awaiting SA confirmation)
 *   - Subscription activated / payment succeeded
 *   - Payment failed
 *   - Trial expiry cron summary (near-expiry reminders + suspensions)
 *   - Renewal cron summary (renewed / failed / expired)
 */

import { broadcastTelegram } from "@/lib/telegram";
import {
  buildSignupMessage,
  buildManualTransferMessage,
  buildActivatedMessage,
  buildPaymentFailedMessage,
  buildTrialCronMessage,
  buildRenewalCronMessage,
} from "@/lib/notify-messages";

function fire(promise: Promise<unknown>): void {
  void promise.catch((err) => console.error("[notify] send failed:", err));
}

export function notifySignup(p: Parameters<typeof buildSignupMessage>[0]): void {
  fire(broadcastTelegram(buildSignupMessage(p)));
}

export function notifyManualTransferSubmitted(
  p: Parameters<typeof buildManualTransferMessage>[0]
): void {
  fire(broadcastTelegram(buildManualTransferMessage(p)));
}

export function notifySubscriptionActivated(
  p: Parameters<typeof buildActivatedMessage>[0]
): void {
  fire(broadcastTelegram(buildActivatedMessage(p)));
}

export function notifyPaymentFailed(
  p: Parameters<typeof buildPaymentFailedMessage>[0]
): void {
  fire(broadcastTelegram(buildPaymentFailedMessage(p)));
}

export function notifyTrialCron(
  p: Parameters<typeof buildTrialCronMessage>[0]
): void {
  const msg = buildTrialCronMessage(p);
  if (msg) fire(broadcastTelegram(msg));
}

export function notifyRenewalCron(
  p: Parameters<typeof buildRenewalCronMessage>[0]
): void {
  const msg = buildRenewalCronMessage(p);
  if (msg) fire(broadcastTelegram(msg));
}
