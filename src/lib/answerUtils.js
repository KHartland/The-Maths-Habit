/**
 * Smart answer comparison for maths questions
 * Handles equivalent formats like 0.5 = 1/2 = 50%
 */

// Parse a fraction string like "1/2" or "-3/4" into a decimal
const parseFraction = (str) => {
  const fractionMatch = str.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (denominator !== 0) {
      return numerator / denominator;
    }
  }
  return null;
};

// Parse a percentage like "50%" into a decimal (0.5)
const parsePercentage = (str) => {
  const percentMatch = str.match(/^(-?\d+\.?\d*)\s*%$/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]) / 100;
  }
  return null;
};

// Parse mixed numbers like "1 1/2" or "2 3/4" into decimals
const parseMixedNumber = (str) => {
  const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    if (denominator !== 0) {
      const sign = whole < 0 ? -1 : 1;
      return whole + sign * (numerator / denominator);
    }
  }
  return null;
};

// Try to parse any numeric format
const parseNumeric = (str) => {
  if (!str || typeof str !== 'string') return null;

  const cleaned = str.trim().toLowerCase();

  // Try mixed number first (e.g., "1 1/2")
  const mixed = parseMixedNumber(cleaned);
  if (mixed !== null) return mixed;

  // Try fraction (e.g., "1/2")
  const fraction = parseFraction(cleaned);
  if (fraction !== null) return fraction;

  // Try percentage (e.g., "50%")
  const percentage = parsePercentage(cleaned);
  if (percentage !== null) return percentage;

  // Try plain number (e.g., "0.5" or "-3")
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  return null;
};

// Check if two numbers are approximately equal (handles floating point issues)
const approxEqual = (a, b, tolerance = 0.0001) => {
  if (a === b) return true;
  if (a === 0 || b === 0) return Math.abs(a - b) < tolerance;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < tolerance;
};

// Normalize text for comparison (remove extra spaces, lowercase, etc.)
const normalizeText = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Multiple spaces to single
    .replace(/\s*([=+\-×÷*\/,])\s*/g, '$1')  // Remove spaces around operators
    .replace(/£\s*/g, '£')          // Remove space after £
    .replace(/\s*%/g, '%');         // Remove space before %
};

// Normalize coordinate format: "(1, 2)" vs "(1,2)" vs "1, 2"
const normalizeCoordinates = (str) => {
  // Extract numbers from coordinate-like strings
  const nums = str.match(/-?\d+\.?\d*/g);
  if (nums && nums.length >= 2) {
    return `(${nums.join(',')})`;
  }
  return str;
};

// Check if answer involves coordinates
const isCoordinateAnswer = (str) => {
  return /\(.*,.*\)/.test(str) || /\d+\s*,\s*\d+/.test(str);
};

// Main comparison function
export const compareAnswers = (userAnswer, correctAnswer) => {
  if (!userAnswer || !correctAnswer) return false;

  const userStr = String(userAnswer).trim();
  const correctStr = String(correctAnswer).trim();

  // Exact match (case insensitive)
  if (userStr.toLowerCase() === correctStr.toLowerCase()) {
    return true;
  }

  // Normalized text match
  if (normalizeText(userStr) === normalizeText(correctStr)) {
    return true;
  }

  // Try numeric comparison (handles 0.5 = 1/2 = 50%)
  const userNum = parseNumeric(userStr);
  const correctNum = parseNumeric(correctStr);

  if (userNum !== null && correctNum !== null) {
    if (approxEqual(userNum, correctNum)) {
      return true;
    }
  }

  // Handle coordinate answers
  if (isCoordinateAnswer(correctStr)) {
    if (normalizeCoordinates(userStr) === normalizeCoordinates(correctStr)) {
      return true;
    }
  }

  // Handle multiple acceptable answers (e.g., "x = 3, y = -2" vs "y = -2, x = 3")
  if (correctStr.includes(',') && userStr.includes(',')) {
    const correctParts = correctStr.split(',').map(s => normalizeText(s)).sort();
    const userParts = userStr.split(',').map(s => normalizeText(s)).sort();

    if (correctParts.length === userParts.length) {
      const allMatch = correctParts.every((part, i) => {
        // Check exact or numeric equivalence for each part
        if (part === userParts[i]) return true;

        // Try extracting numbers and comparing
        const correctNums = part.match(/-?\d+\.?\d*/g);
        const userNums = userParts[i].match(/-?\d+\.?\d*/g);

        if (correctNums && userNums && correctNums.length === userNums.length) {
          return correctNums.every((n, j) => approxEqual(parseFloat(n), parseFloat(userNums[j])));
        }

        return false;
      });

      if (allMatch) return true;
    }
  }

  // Handle "or" answers (e.g., "x = 2 or x = -3")
  if (correctStr.toLowerCase().includes(' or ')) {
    const correctOptions = correctStr.toLowerCase().split(' or ').map(s => s.trim());
    const userOptions = userStr.toLowerCase().split(' or ').map(s => s.trim());

    // Check if user provided the same options (possibly in different order)
    if (correctOptions.length === userOptions.length) {
      const sortedCorrect = correctOptions.sort();
      const sortedUser = userOptions.sort();

      if (sortedCorrect.every((opt, i) => {
        const cNum = parseNumeric(opt.replace(/[^0-9.\-\/]/g, ''));
        const uNum = parseNumeric(sortedUser[i].replace(/[^0-9.\-\/]/g, ''));
        if (cNum !== null && uNum !== null) return approxEqual(cNum, uNum);
        return opt === sortedUser[i];
      })) {
        return true;
      }
    }
  }

  return false;
};

// Export individual utilities for testing
export { parseNumeric, approxEqual, normalizeText };
