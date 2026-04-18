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

/** Charge a pre-created source (from createPromptPaySource or from browser Omise.js) */
export async function createCharge(params: {
  amountSatang: number;
  sourceId?: string;
  token?: string;
  description?: string;
  metadata?: Record<string, string>;
}) {
  const client = getClient();
  const chargeData: {
    amount: number;
    currency: string;
    source?: string;
    card?: string;
    description?: string;
    metadata?: Record<string, string>;
  } = {
    amount: params.amountSatang,
    currency: "THB",
    description: params.description,
    metadata: params.metadata,
  };
  if (params.sourceId) chargeData.source = params.sourceId;
  if (params.token) chargeData.card = params.token;
  const charge = await client.charges.create(chargeData);
  return charge;
}

/** Get a charge by ID (useful for webhook verification) */
export async function getCharge(chargeId: string) {
  const client = getClient();
  return client.charges.retrieve(chargeId);
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
