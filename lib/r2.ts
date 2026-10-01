import { AwsClient } from "aws4fetch";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export const ATTACHMENT_ALLOWED_MIME_TYPES: readonly string[] = ALLOWED_MIME_TYPES;
export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getClient() {
  return new AwsClient({
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function getObjectUrl(key: string): string {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURIComponent(key)}`;
}

/** Builds a collision-resistant object key, namespaced by which booking the file belongs to. */
export function buildAttachmentKey(bookingType: "ACCOMMODATION" | "BANQUET", bookingId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `attachments/${bookingType.toLowerCase()}/${bookingId}/${unique}-${safeName}`;
}

/** A short-lived presigned PUT URL the browser uploads directly to — the file never passes through our server. */
export async function getUploadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const client = getClient();
  const url = new URL(getObjectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await client.sign(url, { method: "PUT", aws: { signQuery: true } });
  return signed.url;
}

/** A short-lived presigned GET URL for viewing/downloading a private object. */
export async function getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const client = getClient();
  const url = new URL(getObjectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await client.sign(url, { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  const res = await client.fetch(getObjectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete R2 object ${key}: ${res.status} ${await res.text()}`);
  }
}
