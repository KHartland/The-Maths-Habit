/**
 * Safely extract a display name string from a Supabase user object.
 *
 * Apple Sign-In can return `user_metadata.full_name` as an object like:
 *   { firstName: "Karra", givenName: "Karra", lastName: "Hartland", familyName: "Hartland" }
 * instead of a plain string. Rendering that object directly in JSX causes
 * React Error #310 ("Objects are not valid as a React child").
 *
 * This helper guarantees a string is always returned.
 */
export function safeDisplayName(user, fallback = 'Player') {
  if (!user) return fallback;

  const fn = user.user_metadata?.full_name;

  // If full_name is already a string, use it
  if (typeof fn === 'string' && fn.trim()) {
    return fn.trim();
  }

  // If full_name is an object (Apple Sign-In), extract name parts
  if (fn && typeof fn === 'object') {
    const parts = [
      fn.firstName || fn.givenName || '',
      fn.lastName || fn.familyName || '',
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  // Try the display_name from metadata
  const dn = user.user_metadata?.display_name;
  if (typeof dn === 'string' && dn.trim()) return dn.trim();

  // Try the name field (used by some OAuth providers)
  const name = user.user_metadata?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();

  // Fall back to the part before @ in email
  if (user.email) return user.email.split('@')[0];

  return fallback;
}

/**
 * Get a single-character initial for an avatar, safely handling
 * object-type full_name from Apple Sign-In.
 */
export function safeInitial(user) {
  const name = safeDisplayName(user, '?');
  return name[0]?.toUpperCase() || '?';
}
