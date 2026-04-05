/**
 * Shared CORS configuration for all API routes.
 *
 * - Only allows the configured FRONTEND_URL origin
 * - Only allows POST and OPTIONS methods
 * - Only allows necessary headers
 */

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'https://www.themathshabit.co.uk';

/**
 * Apply CORS headers to the response.
 * For OPTIONS preflight requests, sends 204 and returns { preflight: true }.
 * Otherwise returns { preflight: false }.
 *
 * @param {object} req
 * @param {object} res
 * @param {object} options
 * @param {string[]} [options.allowHeaders] - Additional headers to allow beyond Content-Type
 */
export function applyCors(req, res, { allowHeaders = [] } = {}) {
  const origin = req.headers.origin;

  // Only reflect the origin if it matches our allowed origin
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    ['Content-Type', ...allowHeaders].join(', ')
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return { preflight: true };
  }

  return { preflight: false };
}
