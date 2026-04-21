import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

/**
 * S3-compatible client for Cloudflare R2.
 *
 * Required env vars (set in .env.local for dev, Coolify for prod):
 *   S3_ENDPOINT          = https://<account_id>.r2.cloudflarestorage.com
 *   S3_REGION            = auto  (R2 uses "auto")
 *   S3_ACCESS_KEY_ID     = <R2 access key id>
 *   S3_SECRET_ACCESS_KEY = <R2 secret access key>
 *   S3_BUCKET            = workinflow-wht-certs
 */

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "auto";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

export const S3_BUCKET = process.env.S3_BUCKET || "workinflow-wht-certs";

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 credentials not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY."
    );
  }

  _client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // R2 requires path-style; enable forcePathStyle for S3-compat clients
    forcePathStyle: true,
  });
  return _client;
}

export function isS3Configured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

// ───────────────────────────────────────────────────────────
// Object key generation
// ───────────────────────────────────────────────────────────

/** Build canonical object key for a WHT cert file. */
export function buildWhtCertKey(params: {
  tenantId: string;
  receiptId: string;
  originalFilename: string;
}): string {
  const { tenantId, receiptId, originalFilename } = params;
  const ext = extractExtension(originalFilename);
  const rand = crypto.randomBytes(8).toString("hex");
  return `tenants/${tenantId}/wht-certs/${receiptId}/${Date.now()}-${rand}${ext}`;
}

/** Build canonical object key for a PromptPay slip audit-trail file. */
export function buildSlipKey(params: {
  tenantId: string;
  subscriptionId: string;
  originalFilename?: string;
  contentType?: string;
}): string {
  const { tenantId, subscriptionId, originalFilename, contentType } = params;
  const ext =
    (originalFilename ? extractExtension(originalFilename) : "") ||
    extensionFromMime(contentType);
  return `slips/${tenantId}/${subscriptionId}-${Date.now()}${ext}`;
}

function extractExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  const ext = filename.slice(idx).toLowerCase();
  // whitelist
  if ([".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) return ext;
  return "";
}

function extensionFromMime(contentType?: string): string {
  switch ((contentType || "").toLowerCase()) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    default:
      return "";
  }
}

// ───────────────────────────────────────────────────────────
// Signed URLs
// ───────────────────────────────────────────────────────────

const DEFAULT_EXPIRES_IN = 60 * 60; // 1 hour

export async function createSignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSec?: number;
}): Promise<string> {
  const { key, contentType, expiresInSec = DEFAULT_EXPIRES_IN } = params;
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function createSignedDownloadUrl(params: {
  key: string;
  expiresInSec?: number;
  filename?: string;
}): Promise<string> {
  const { key, expiresInSec = DEFAULT_EXPIRES_IN, filename } = params;
  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ...(filename && {
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
  });
  return await getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );
}

/** Upload an object directly (server-side) — used for slip audit-trail etc. */
export async function putObject(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const { key, body, contentType } = params;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getS3Client().send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// Upload policy
// ───────────────────────────────────────────────────────────

export const MAX_WHT_CERT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_WHT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type AllowedWhtMime = (typeof ALLOWED_WHT_MIME)[number];

export function isAllowedMime(mime: string): mime is AllowedWhtMime {
  return (ALLOWED_WHT_MIME as readonly string[]).includes(mime);
}
