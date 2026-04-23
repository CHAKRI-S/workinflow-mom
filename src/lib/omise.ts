/**
 * Omise payment gateway wrapper
 *
 * Handles:
 * - PromptPay QR sources (for scan-to-pay)
 * - Card charges (via Omise.js token from browser)
 * - Webhook signature verification
 *
 * Gracefully returns null / throws CONFIG_MISSING if OMISE_SECRET_KEY not set.
 */

import Omise from "omise";
import crypto from "node:crypto";

const secretKey = process.env.OMISE_SECRET_KEY;
const publicKey = process.env.OMISE_PUBLIC_KEY;
const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;

export const OMISE_CONFIGURED = Boolean(secretKey && publicKey);

function getClient() {
  if (!secretKey) {
    throw new Error("CONFIG_MISSING:OMISE_SECRET_KEY");
  }
  return Omise({ secretKey, omiseVersion: "2019-05-29" });
}

export function getPublicKey(): string | null {
  return publicKey ?? null;
}

/** Create a PromptPay source — returns QR code SVG/image URL */
export async function createPromptPaySource(params: {
  amountSatang: number;
  description?: string;
}) {
  const client = getClient();
  const source = await client.sources.create({
    type: "promptpay",
    amount: params.amountSatang,
    currency: "THB",
  });
  return {
    id: source.id,
    type: source.type,
    // QR code details are in source.scannable_code if available
    scannable_code: (source as unknown as { scannable_code?: { image?: { download_uri?: string } } })
      .scannable_code,
    raw: source,
  };
}

/**
 * Create a charge.
 *
 * Params:
 * - `token`    — raw card token produced by Omise.js browser-side tokenization
 *                (`Omise.createToken`). Use this for the credit-card 3DS flow.
 * - `sourceId` — id of a pre-created Source (e.g. PromptPay QR returned by
 *                `createPromptPaySource`). Use this for async source-based flows.
 * - `returnUri` — URL Omise redirects the customer back to after the 3DS
 *                challenge completes. Only relevant for card charges — Omise
 *                populates `charge.authorize_uri` when 3DS is required.
 *
 * Returns the raw Omise ICharge response so callers can inspect
 * `.authorize_uri`, `.id`, `.status`, `.paid`, `.failure_message` etc.
 */
export async function createCharge(params: {
  amountSatang: number;
  sourceId?: string;
  token?: string;
  /**
   * Charge a saved Omise customer directly (no new token required). Takes
   * precedence over `token` / `sourceId`. Used after Phase 6D saves a card
   * so the initial checkout charge reuses the same customer that will be
   * recharged by the renewal cron.
   */
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  returnUri?: string;
}) {
  const client = getClient();
  const chargeData: {
    amount: number;
    currency: string;
    source?: string;
    card?: string;
    customer?: string;
    description?: string;
    metadata?: Record<string, string>;
    return_uri?: string;
  } = {
    amount: params.amountSatang,
    currency: "THB",
    description: params.description,
    metadata: params.metadata,
  };
  if (params.customerId) chargeData.customer = params.customerId;
  else if (params.sourceId) chargeData.source = params.sourceId;
  else if (params.token) chargeData.card = params.token;
  if (params.returnUri) chargeData.return_uri = params.returnUri;
  const charge = await client.charges.create(chargeData);
  return charge;
}

/** Get a charge by ID (useful for webhook verification + status polling) */
export async function getCharge(chargeId: string) {
  const client = getClient();
  return client.charges.retrieve(chargeId);
}

/** Alias for getCharge — keeps call sites readable for status polling. */
export async function getChargeById(chargeId: string) {
  return getCharge(chargeId);
}

/**
 * Create an Omise customer and attach a card token to them.
 *
 * Used on the first successful card charge (Phase 6D) so the card can be
 * reused by `chargeCustomer()` on the next renewal cycle without another
 * Omise.js tokenization.
 *
 * Returns `null` on any failure — the caller's current charge already
 * succeeded, saving the card is strictly best-effort.
 */
export async function createCustomerWithCard(params: {
  email: string;
  description?: string;
  cardToken: string; // tokn_xxx produced by Omise.js
}): Promise<{
  customerId: string;
  cardId: string;
  last4: string | null;
  brand: string | null;
} | null> {
  try {
    const client = getClient();
    // Omise SDK types for customer cards are sometimes incomplete — pull
    // the narrow fields we need via an explicit shape.
    type OmiseCardLike = { id?: string; last_digits?: string; brand?: string };
    type OmiseCustomerLike = {
      id: string;
      default_card?: string | null;
      cards?: { data?: OmiseCardLike[] };
    };

    const customer = (await client.customers.create({
      email: params.email,
      description: params.description,
      card: params.cardToken,
    })) as unknown as OmiseCustomerLike;

    const cardList = customer.cards?.data ?? [];
    const defaultId = customer.default_card ?? null;
    const card: OmiseCardLike | undefined =
      (defaultId && cardList.find((c) => c.id === defaultId)) ||
      cardList[0];

    const cardId = card?.id ?? defaultId;
    if (!cardId) {
      console.error("[omise] createCustomerWithCard: no card id returned");
      return null;
    }

    return {
      customerId: customer.id,
      cardId,
      last4: card?.last_digits ?? null,
      brand: card?.brand ?? null,
    };
  } catch (err) {
    console.error("[omise] createCustomerWithCard failed:", err);
    return null;
  }
}

/**
 * Charge a saved Omise customer directly (MIT — merchant-initiated).
 *
 * Used by the renewal-retry cron (Phase 6D). Returns a normalized shape —
 * callers never see the raw SDK ICharge. Never throws; network/API errors
 * surface as `status: "failed"` with `failureMessage` set.
 */
export async function chargeCustomer(params: {
  customerId: string;
  amountSatang: number;
  currency?: "THB";
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{
  chargeId: string;
  status: "successful" | "pending" | "failed" | "expired";
  paid: boolean;
  failureMessage?: string | null;
  rawResponse: unknown;
}> {
  try {
    const client = getClient();
    type OmiseChargeLike = {
      id: string;
      status?: string;
      paid?: boolean;
      failure_message?: string | null;
      failure_code?: string | null;
    };

    const raw = (await client.charges.create({
      amount: params.amountSatang,
      currency: params.currency ?? "THB",
      customer: params.customerId,
      description: params.description,
      metadata: params.metadata,
    })) as unknown as OmiseChargeLike;

    const status: "successful" | "pending" | "failed" | "expired" =
      raw.status === "successful"
        ? "successful"
        : raw.status === "pending"
          ? "pending"
          : raw.status === "expired"
            ? "expired"
            : "failed";

    return {
      chargeId: raw.id,
      status,
      paid: raw.paid === true,
      failureMessage: raw.failure_message ?? raw.failure_code ?? null,
      rawResponse: raw,
    };
  } catch (err) {
    console.error("[omise] chargeCustomer failed:", err);
    const message = err instanceof Error ? err.message : "Charge failed";
    return {
      chargeId: "",
      status: "failed",
      paid: false,
      failureMessage: message,
      rawResponse: null,
    };
  }
}

/**
 * Verify an Omise webhook signature
 * Omise sends `X-Omise-Webhook-Signature` header (HMAC-SHA256 of body)
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!webhookSecret) {
    console.warn("[omise] OMISE_WEBHOOK_SECRET not set — skipping signature verification");
    return true; // allow in dev without secret
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
