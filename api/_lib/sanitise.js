/**
 * Input sanitisation and payload validation for all API routes.
 *
 * - rejectOversizedPayload: blocks requests above a byte limit
 * - sanitiseString:         strips control chars, trims, enforces max length
 * - sanitiseEmail:          validates email format and normalises
 * - sanitiseUrl:            validates URL format and restricts to https
 * - sanitiseId:             validates Stripe/Supabase-style IDs (alphanumeric + _-)
 * - sanitiseBody:           validates JSON body exists and is a plain object
 * - sanitiseAuthHeader:     validates Bearer token format
 */

// ─── Payload size ────────────────────────────────────────────────────────────

const DEFAULT_MAX_BODY_BYTES = 10_240; // 10 KB — generous for JSON, tiny for abuse

/**
 * Reject requests whose Content-Length exceeds `maxBytes`.
 * Returns { ok: true } or sends a 413 and returns { ok: false }.
 */
export function rejectOversizedPayload(req, res, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > maxBytes) {
    res.status(413).json({
      error: `Payload too large. Maximum size is ${maxBytes} bytes.`,
    });
    return { ok: false };
  }
  return { ok: true };
}

// ─── String sanitisation ─────────────────────────────────────────────────────

/**
 * Sanitise a generic string value:
 *  - must be a string
 *  - strip ASCII control characters (tabs/newlines kept)
 *  - trim whitespace
 *  - enforce max length
 *
 * Returns the cleaned string, or null if invalid.
 */
export function sanitiseString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  // Strip control chars except \t \n \r
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) return null;
  return cleaned;
}

// ─── Email ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalise an email address.
 * Returns the lowercased email, or null if invalid.
 */
export function sanitiseEmail(value) {
  const cleaned = sanitiseString(value, 254); // RFC 5321 max
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  return EMAIL_RE.test(lower) ? lower : null;
}

// ─── URL ─────────────────────────────────────────────────────────────────────

/**
 * Validate a URL string. Only https is allowed.
 * Returns the URL string or null if invalid.
 */
export function sanitiseUrl(value) {
  const cleaned = sanitiseString(value, 2048);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

// ─── IDs (Stripe / Supabase style) ──────────────────────────────────────────

// Stripe IDs: price_xxx, cus_xxx, sub_xxx  |  Supabase UUIDs
const ID_RE = /^[a-zA-Z0-9_-]{1,255}$/;

/**
 * Validate an ID string (Stripe IDs, Supabase UUIDs, etc.).
 * Returns the ID or null if it contains unexpected characters.
 */
export function sanitiseId(value) {
  const cleaned = sanitiseString(value, 255);
  if (!cleaned) return null;
  return ID_RE.test(cleaned) ? cleaned : null;
}

// ─── Body validation ─────────────────────────────────────────────────────────

/**
 * Validate that req.body exists and is a plain object (not an array, null, etc.).
 * Returns { ok: true, body } or sends a 400 and returns { ok: false }.
 */
export function sanitiseBody(req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return { ok: false, body: null };
  }
  return { ok: true, body };
}

// ─── Auth header ─────────────────────────────────────────────────────────────

const BEARER_RE = /^Bearer\s+[\w\-\.]+$/;

/**
 * Validate the Authorization header is a well-formed Bearer token.
 * Returns the full header string, or null if malformed.
 */
export function sanitiseAuthHeader(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // JWT Bearer tokens: "Bearer <base64url>.<base64url>.<base64url>"
  if (!trimmed.startsWith('Bearer ')) return null;
  // Enforce reasonable length (JWTs are typically under 2 KB)
  if (trimmed.length > 4096) return null;
  return trimmed;
}
