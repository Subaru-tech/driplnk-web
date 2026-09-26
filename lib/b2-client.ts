import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const B2_CONFIG = {
  get endpoint() {
    const raw = process.env.B2_S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
    return raw.startsWith("http") ? raw : `https://${raw}`;
  },
  get region() {
    return process.env.B2_REGION || "us-east-005";
  },
  get keyId() {
    return process.env.B2_APPLICATION_KEY_ID || "";
  },
  get applicationKey() {
    return process.env.B2_APPLICATION_KEY || "";
  },
  get bucketName() {
    return process.env.B2_BUCKET_NAME || "driplink-models-storage";
  },
};

let cachedClient: S3Client | null = null;

/**
 * Returns an authenticated AWS S3 Client instance configured for Backblaze B2.
 */
export function getB2Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const { endpoint, region, keyId, applicationKey } = B2_CONFIG;

  if (!keyId || !applicationKey) {
    throw new Error(
      "Missing Backblaze B2 credentials in environment (B2_APPLICATION_KEY_ID or B2_APPLICATION_KEY)."
    );
  }

  cachedClient = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey,
    },
    // Backblaze B2 S3-compatible API supports path-style or virtual-host style
    forcePathStyle: true,
  });

  return cachedClient;
}

/**
 * Uploads a model file buffer directly to the private Backblaze B2 bucket.
 */
export async function uploadModelToB2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string = "application/octet-stream"
): Promise<{ success: boolean; key: string; eTag?: string; error?: string }> {
  try {
    const client = getB2Client();
    const command = new PutObjectCommand({
      Bucket: B2_CONFIG.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    const response = await client.send(command);

    return {
      success: true,
      key,
      eTag: response.ETag?.replace(/"/g, ""),
    };
  } catch (err) {
    console.error(`Failed to upload object '${key}' to B2:`, err);
    return {
      success: false,
      key,
      error: err instanceof Error ? err.message : "B2 upload failed.",
    };
  }
}

/**
 * Generates a short-lived (10-15 min) presigned GET URL for an entitled user.
 */
export async function generateB2PresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 900 // 15 minutes default
): Promise<string> {
  const client = getB2Client();

  const command = new GetObjectCommand({
    Bucket: B2_CONFIG.bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Verifies object existence and retrieves metadata (size, etag) from B2.
 */
export async function headB2Object(key: string) {
  try {
    const client = getB2Client();
    const command = new HeadObjectCommand({
      Bucket: B2_CONFIG.bucketName,
      Key: key,
    });

    const res = await client.send(command);
    return {
      exists: true,
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType,
      eTag: res.ETag?.replace(/"/g, ""),
      lastModified: res.LastModified,
    };
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) {
      return { exists: false, contentLength: 0 };
    }
    throw err;
  }
}

/**
 * Lists objects in the B2 bucket with an optional prefix.
 */
export async function listB2Objects(prefix?: string, maxKeys: number = 100) {
  const client = getB2Client();
  const command = new ListObjectsV2Command({
    Bucket: B2_CONFIG.bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const res = await client.send(command);
  return {
    contents: (res.Contents || []).map((item) => ({
      key: item.Key || "",
      size: item.Size || 0,
      lastModified: item.LastModified,
      eTag: item.ETag?.replace(/"/g, ""),
    })),
    keyCount: res.KeyCount || 0,
    isTruncated: res.IsTruncated || false,
  };
}

/**
 * Deletes an object from the Backblaze B2 bucket.
 */
export async function deleteB2Object(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getB2Client();
    const command = new DeleteObjectCommand({
      Bucket: B2_CONFIG.bucketName,
      Key: key,
    });
    await client.send(command);
    return { success: true };
  } catch (err) {
    console.error(`Failed to delete object '${key}' from B2:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete B2 object." };
  }
}

/**
 * Fetches object bytes and metadata directly from Backblaze B2.
 */
export async function getB2Object(key: string) {
  const client = getB2Client();
  const command = new GetObjectCommand({
    Bucket: B2_CONFIG.bucketName,
    Key: key,
  });
  const res = await client.send(command);
  const bytes = await res.Body?.transformToByteArray();
  return {
    bytes: bytes ? Buffer.from(bytes) : null,
    contentType: res.ContentType || "application/octet-stream",
    contentLength: res.ContentLength,
  };
}

