import "server-only";

/**
 * Fixed-window rate limiter for the expensive API routes (upload buffering,
 * full-object B2 file reads). Zero dependencies, zero shared state beyond the
 * process.
 *
 * ponytail: counts are per-instance and reset on restart — exact for a
 * single-node deployment, approximate (per-instance) on serverless with
 * many instances. If multi-instance exactness or cross-instance budgets
 * matter, move this behind Upstash Redis or the platform WAF; the call
 * sites only depend on this function's signature.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Periodic sweep threshold: bounds Map growth from unique IPs. */
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** First x-forwarded-for hop, or a shared fallback when the header is absent. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "direct";
}
