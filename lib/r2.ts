/**
 * Cloudflare R2 client — server-side only.
 * R2 is S3-compatible; we use the AWS SDK pointed at the R2 endpoint.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
 *   R2_BUCKET_NAME      — bucket name (e.g. "inka-audio")
 *   R2_PUBLIC_URL       — optional public bucket domain (e.g. "https://audio.inka.app")
 *                         If set, public GET URLs are served directly (no signed URL needed).
 *                         Leave unset to always use signed URLs.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID!
const bucketName = process.env.R2_BUCKET_NAME!

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

/** Generate a presigned PUT URL for direct browser-to-R2 upload. Expires in 15 min. */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn: 900 })
}

/** Generate a presigned GET URL for audio playback. Expires in 1 hour. */
export async function getAudioUrl(key: string): Promise<string> {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, '')}/${key}`
  }
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}

export { bucketName }
