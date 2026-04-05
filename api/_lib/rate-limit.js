import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// General rate limiter: 100 requests per 15 minutes per IP
export const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '15 m'),
  prefix: 'ratelimit:general',
  analytics: true,
});

// Strict rate limiter for sensitive routes: 5 requests per 15 minutes per IP
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:auth',
  analytics: true,
});

/**
 * Get the client IP address from a Vercel serverless request
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Apply rate limiting to a request.
 * Returns { success: true } if allowed, or sends a 429 response and returns { success: false }.
 *
 * @param {object} req - Vercel request object
 * @param {object} res - Vercel response object
 * @param {Ratelimit} limiter - Which rate limiter to use (generalLimiter or authLimiter)
 */
export async function applyRateLimit(req, res, limiter = generalLimiter) {
  // Skip rate limiting if Upstash is not configured (dev environment)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Rate limiting skipped: Upstash Redis not configured');
    return { success: true };
  }

  const ip = getClientIp(req);

  try {
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    // Always set rate limit headers so clients can see their usage
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter,
      });
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    // Fail closed: if Redis is down, reject the request rather than
    // allowing unlimited traffic through
    console.error('Rate limiting error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    return { success: false };
  }
}
