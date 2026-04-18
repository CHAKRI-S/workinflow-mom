/**
 * SlipOK API wrapper — verify PromptPay slip images
 * Docs: https://slipok.com/docs
 *
 * Usage:
 *   const result = await verifySlipByUrl("https://.../slip.jpg");
 *   if (result.success && result.data.amount >= expectedAmount) { ... }
 *
 * Gracefully returns null if SLIPOK_API_KEY not configured.
 */

const apiKey = process.env.SLIPOK_API_KEY;
const branchId = process.env.SLIPOK_BRANCH_ID;
const API_BASE = "https://api.slipok.com/api/line/apikey";

export const SLIPOK_CONFIGURED = Boolean(apiKey && branchId);

export interface SlipVerifyResult {
  success: boolean;
  data?: {
    success: boolean;
    amount: number;       // in baht
    transRef: string;
    transDate: string;
    transTime: string;
    sendingBank: string;
    receivingBank: string;
    sender: { displayName: string };
    receiver: { displayName: string };
  };
  error?: string;
}

/** Verify a slip image by uploading file (multipart) */
export async function verifySlipByFile(file: File): Promise<SlipVerifyResult> {
  if (!SLIPOK_CONFIGURED) {
    return { success: false, error: "CONFIG_MISSING:SLIPOK_API_KEY" };
  }

  const formData = new FormData();
  formData.append("files", file);

  try {
    const res = await fetch(`${API_BASE}/${branchId}`, {
      method: "POST",
      headers: { "x-authorization": apiKey! },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.message || "Slip verification failed" };
    }
    return { success: true, data: json.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Verify a slip image by URL (if image already uploaded elsewhere) */
export async function verifySlipByUrl(url: string): Promise<SlipVerifyResult> {
  if (!SLIPOK_CONFIGURED) {
    return { success: false, error: "CONFIG_MISSING:SLIPOK_API_KEY" };
  }

  try {
    const res = await fetch(`${API_BASE}/${branchId}`, {
      method: "POST",
      headers: { "x-authorization": apiKey!, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.message || "Slip verification failed" };
    }
    return { success: true, data: json.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
