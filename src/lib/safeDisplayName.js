/**
 * Safely extract a display name string from a Supabase user object.
 *
 * Apple Sign-In can return user_metadata.full_name as an object like:
 *   { firstName: "Karra", givenName: "Karra", lastName: "Hartland" }
 * instead of a plain string. Rendering that object directly in JSX causes
 * React Error #310 ("Objects are not valid as a React child").
 *
 * This helper guarantees a string is always returned.
 */
export function safeDisplayName(user, fallback = 'Player') {
  if (!user) return fallback;

  const fn = user.user_metadata?.full_name;

  if (typeof fn === 'string' && fn.trim()) {
    return fn.trim();
  }

  if (fn && typeof fn === 'object') {
    const parts = [
      fn.firstName || fn.givenName || '',
      fn.lastName || fn.familyName || '',
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const dn = user.user_metadata?.display_name;
  if (typeof dn === 'string' && dn.trim()) return dn.trim();

  const name = user.user_metadata?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();

  if (user.email) return user.email.split('@')[0];

  return fallback;
}

export function safeInitial(user) {
  const name = safeDisplayName(user, '?');
  return name[0]?.toUpperCase() || '?';
}
