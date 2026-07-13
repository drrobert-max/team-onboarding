/**
 * S3-compatible object storage.
 *
 * Replaces the Manus "forge" presign endpoints with direct calls to any
 * S3-compatible backend (AWS S3, Cloudflare R2, MinIO, ...). Configure via the
 * S3_* environment variables (see server/_core/env.ts and .env.example).
 */
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./env";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (client) return client;
  if (!ENV.s3Bucket) {
    throw new Error(
      "S3 storage is not configured (set S3_BUCKET, S3_REGION and credentials)"
    );
  }
  client = new S3Client({
    region: ENV.s3Region,
    ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
    forcePathStyle: ENV.s3ForcePathStyle || Boolean(ENV.s3Endpoint),
    ...(ENV.s3AccessKeyId && ENV.s3SecretAccessKey
      ? {
          credentials: {
            accessKeyId: ENV.s3AccessKeyId,
            secretAccessKey: ENV.s3SecretAccessKey,
          },
        }
      : {}),
  });
  return client;
}

export async function presignGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }),
    { expiresIn: ENV.s3SignedUrlTtl }
  );
}

export async function presignPutUrl(
  key: string,
  contentType?: string
): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
    { expiresIn: ENV.s3SignedUrlTtl }
  );
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}
