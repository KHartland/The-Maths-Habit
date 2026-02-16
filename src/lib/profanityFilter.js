/**
 * Profanity filter for display names.
 * Catches explicit words, l33t speak variants, and spacing tricks.
 * Used at sign-up and on leaderboard/battle display.
 */

// Core banned words (lowercase). Short words (<=3 chars) are only matched
// as whole-name or clear standalone usage, not as substrings.
const BANNED_WORDS_LONG = [
  // Strong profanity (4+ chars — matched as substrings)
  'fuck', 'shit', 'cunt', 'dick', 'cock', 'arse', 'arsehole', 'asshole',
  'bastard', 'bitch', 'bollocks', 'bugger', 'wanker', 'twat', 'prick',
  'knob', 'bellend', 'tosser', 'minger', 'slag', 'slut', 'whore',
  'nigger', 'nigga', 'faggot', 'retard', 'spastic', 'spaz',
  'tranny', 'paki', 'chink', 'gook', 'kike', 'dyke',
  'penis', 'vagina', 'dildo', 'porn', 'hentai', 'boobs', 'tits',
  'nazi', 'hitler',
];

// Short words — only matched as the entire name (after normalisation)
const BANNED_WORDS_EXACT = [
  'ass', 'fag', 'nig', 'kkk',
];

// Allow-list: real words/names that contain banned substrings (Scunthorpe problem)
const ALLOW_LIST = [
  'scunthorpe', 'penistone', 'cockburn', 'cockermouth', 'dickens',
  'hancock', 'hitchcock', 'babcock', 'peacock', 'woodcock',
  'sussex', 'essex', 'middlesex', 'arsenal', 'classic', 'class',
  'assassin', 'cassandra', 'bass', 'brass', 'grass', 'pass', 'mass',
  'richard', 'dickson', 'benedict',
];

// L33t speak substitutions
const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
};

/**
 * Normalise a string: lowercase, strip spaces/punctuation/underscores,
 * and expand l33t speak to catch bypass attempts.
 */
const normalise = (text) => {
  let s = text.toLowerCase();

  // Strip whitespace, underscores, hyphens, dots, zero-width chars
  s = s.replace(/[\s_\-.\u200B\u200C\u200D\uFEFF]/g, '');

  // Replace l33t characters with their letter equivalents
  let result = '';
  for (const ch of s) {
    if (LEET_MAP[ch]) {
      result += LEET_MAP[ch];
    } else {
      result += ch;
    }
  }

  // Collapse runs of 3+ identical chars to 2 (catches "fuuuck" but preserves "bass", "class")
  result = result.replace(/(.)\1{2,}/g, '$1$1');

  return result;
};

/**
 * Check if normalised name is in the allow-list
 */
const isAllowed = (normalised) => {
  return ALLOW_LIST.some(word => normalised.includes(word));
};

/**
 * Check if a display name contains profanity.
 * Returns { clean: boolean, reason?: string }
 */
export const checkProfanity = (name) => {
  if (!name || typeof name !== 'string') {
    return { clean: true };
  }

  const normalised = normalise(name);
  // Also create a fully-collapsed version (all doubles removed) to catch "fuuuuck" → "fuck"
  const collapsed = normalised.replace(/(.)\1/g, '$1');

  // Check allow-list first
  if (isAllowed(normalised)) {
    return { clean: true };
  }

  // Check long banned words (substring match) against both forms
  for (const word of BANNED_WORDS_LONG) {
    if (normalised.includes(word) || collapsed.includes(word)) {
      return {
        clean: false,
        reason: 'Display name contains inappropriate language. Please choose a different name.',
      };
    }
  }

  // Check short banned words (exact match only — the whole name IS the bad word)
  for (const word of BANNED_WORDS_EXACT) {
    if (normalised === word || collapsed === word) {
      return {
        clean: false,
        reason: 'Display name contains inappropriate language. Please choose a different name.',
      };
    }
  }

  return { clean: true };
};

/**
 * Sanitise a display name for safe rendering.
 * If it contains profanity, replaces with a placeholder.
 * Use this as a safety net on the leaderboard/battle display.
 */
export const sanitiseName = (name) => {
  if (!name) return 'Anonymous';
  const { clean } = checkProfanity(name);
  if (!clean) return 'Student';
  return name;
};
