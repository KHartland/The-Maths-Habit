// ==================== FORGIVING ANSWER CHECKER ====================

// Parse a fraction string like "3/4" or "1/2" into a decimal
export const parseFraction = (str) => {
  const fractionMatch = str.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    if (den !== 0) return num / den;
  }
  return null;
};

// Parse mixed number like "1 1/2" or "2 3/4"
export const parseMixedNumber = (str) => {
  const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    if (den !== 0) {
      const sign = whole < 0 ? -1 : 1;
      return whole + sign * (num / den);
    }
  }
  return null;
};

// Normalize a string for comparison (remove spaces, lowercase, normalize symbols)
export const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[−–—]/g, '-') // Normalize different minus signs
    .replace(/<=/g, '≤') // Normalize inequality text to symbols
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/°/g, '')
    // Normalize superscripts to ^n so x² matches x^2
    .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8').replace(/⁹/g, '^9')
    .replace(/£|\$|€|p|cm|m|mm|km|kg|g|ml|l|%$/gi, '') // Remove units at end
    .replace(/^[£$€]/gi, '') // Remove currency at start
    .trim();
};

// Extract numeric value from answer (handles "x = 5", "5cm", etc.)
const extractNumber = (str) => {
  // Remove common prefixes like "x =", "y =", "answer:", etc.
  let cleaned = str
    .replace(/^[a-z]\s*=\s*/i, '')
    .replace(/^(answer|ans|solution)[\s:=]*/i, '')
    .replace(/[£$€°%]|cm|mm|m|km|kg|g|ml|l|hours?|mins?|minutes?|seconds?|secs?/gi, '')
    .trim();

  // Try to parse as number
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  // Try fraction
  const frac = parseFraction(cleaned);
  if (frac !== null) return frac;

  // Try mixed number
  const mixed = parseMixedNumber(cleaned);
  if (mixed !== null) return mixed;

  return null;
};

// Check if two numbers are equivalent (with tolerance for decimals)
const numbersEquivalent = (a, b, tolerance = 0.0001) => {
  if (a === null || b === null) return false;
  if (a === b) return true;
  // Check with tolerance for floating point
  if (Math.abs(a - b) < tolerance) return true;
  // Check if they round to same value (for answers like 3.14 vs 3.1416)
  if (Math.abs(a - b) < 0.05 && Math.round(a * 10) === Math.round(b * 10)) return true;
  return false;
};

// Parse ratio like "2:3" or "2 : 3"
const parseRatio = (str) => {
  const ratioMatch = str.replace(/\s/g, '').match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (ratioMatch) {
    const parts = [parseFloat(ratioMatch[1]), parseFloat(ratioMatch[2])];
    if (ratioMatch[3]) parts.push(parseFloat(ratioMatch[3]));
    return parts;
  }
  return null;
};

// Check if two ratios are equivalent
const ratiosEquivalent = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  // Find scale factor
  const scale = a[0] / b[0];
  return a.every((val, i) => Math.abs(val - b[i] * scale) < 0.001);
};

// Parse coordinate pair like "(2, 3)" or "2, 3"
const parseCoordinate = (str) => {
  const coordMatch = str.replace(/[()]/g, '').match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];
  }
  return null;
};

// Extract multiple values from answer (for "x = 1 and x = 3" type answers)
const extractMultipleValues = (str) => {
  // Patterns: "1 and 3", "x = 1, x = 3", "1, 3", "(1, 3)"
  const values = [];

  // Try comma-separated
  const commaParts = str.split(/[,;]/);
  if (commaParts.length > 1) {
    commaParts.forEach(part => {
      const num = extractNumber(part.trim());
      if (num !== null) values.push(num);
    });
    if (values.length > 0) return values.sort((a, b) => a - b);
  }

  // Try "and" separated
  const andParts = str.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    andParts.forEach(part => {
      const num = extractNumber(part.trim());
      if (num !== null) values.push(num);
    });
    if (values.length > 0) return values.sort((a, b) => a - b);
  }

  return null;
};

// Main forgiving comparison function
const answersEquivalent = (userAnswer, correctAnswer) => {
  if (!userAnswer || !correctAnswer) return false;

  // For recurring decimals with [r] notation, require exact match
  // This prevents 5.3[r] being treated as equivalent to 5.34
  if (correctAnswer.includes('[r]') || userAnswer.includes('[r]')) {
    return userAnswer === correctAnswer;
  }

  const userNorm = normalizeString(userAnswer);
  const correctNorm = normalizeString(correctAnswer);

  // Exact match after normalization
  if (userNorm === correctNorm) return true;

  // Check if the correct answer contains multiple values (comma-separated list)
  // If so, require the user answer to also have multiple values
  const correctHasMultiple = correctAnswer.includes(',') && correctAnswer.split(',').length > 1;
  const userHasMultiple = userAnswer.includes(',') && userAnswer.split(',').length > 1;

  if (correctHasMultiple && !userHasMultiple) {
    // Correct answer is a list but user only gave one value - not correct
    return false;
  }

  // Try numeric comparison (only for single values)
  const userNum = extractNumber(userAnswer);
  const correctNum = extractNumber(correctAnswer);
  if (!correctHasMultiple && numbersEquivalent(userNum, correctNum)) return true;

  // Try ratio comparison
  const userRatio = parseRatio(userNorm);
  const correctRatio = parseRatio(correctNorm);
  if (userRatio && correctRatio && ratiosEquivalent(userRatio, correctRatio)) return true;

  // Try coordinate comparison
  const userCoord = parseCoordinate(userNorm);
  const correctCoord = parseCoordinate(correctNorm);
  if (userCoord && correctCoord) {
    if (numbersEquivalent(userCoord[0], correctCoord[0]) &&
        numbersEquivalent(userCoord[1], correctCoord[1])) return true;
  }

  // Try multiple values comparison (for quadratic solutions etc.)
  const userMulti = extractMultipleValues(userAnswer);
  const correctMulti = extractMultipleValues(correctAnswer);
  if (userMulti && correctMulti && userMulti.length === correctMulti.length) {
    const allMatch = userMulti.every((val, i) => numbersEquivalent(val, correctMulti[i]));
    if (allMatch) return true;
  }

  // Check for common equivalent representations
  // Fraction to decimal: 1/2 = 0.5
  if (userNum !== null && correctNum === null) {
    const correctFrac = parseFraction(correctNorm);
    if (correctFrac !== null && numbersEquivalent(userNum, correctFrac)) return true;
  }
  if (correctNum !== null && userNum === null) {
    const userFrac = parseFraction(userNorm);
    if (userFrac !== null && numbersEquivalent(correctNum, userFrac)) return true;
  }

  // Handle "yes/no" variations
  const yesVariants = ['yes', 'y', 'true', 'correct', '1'];
  const noVariants = ['no', 'n', 'false', 'incorrect', '0'];
  if (yesVariants.includes(userNorm) && yesVariants.includes(correctNorm)) return true;
  if (noVariants.includes(userNorm) && noVariants.includes(correctNorm)) return true;

  // === Full fraction ↔ decimal ↔ percentage equivalence ===
  // Parse a value into its decimal form, aware of percentages
  const toDecimal = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    // If it's a percentage, divide by 100
    if (trimmed.endsWith('%')) {
      const pctVal = parseFloat(trimmed.replace('%', ''));
      if (!isNaN(pctVal)) return pctVal / 100;
    }
    // Try fraction
    const frac = parseFraction(normalizeString(trimmed));
    if (frac !== null) return frac;
    // Try mixed number
    const mixed = parseMixedNumber(normalizeString(trimmed));
    if (mixed !== null) return mixed;
    // Try plain number
    const num = extractNumber(trimmed);
    if (num !== null) return num;
    return null;
  };

  const userDecimal = toDecimal(userAnswer);
  const correctDecimal = toDecimal(correctAnswer);

  if (userDecimal !== null && correctDecimal !== null) {
    // Direct comparison as decimals (handles 3/4 = 0.75 = 75%)
    if (numbersEquivalent(userDecimal, correctDecimal)) return true;
  }

  // Also handle the case where one side is a percentage number without %
  // e.g. correct = "40" (meaning 40%) and user enters "0.4" or "2/5"
  // This is ambiguous, so only do it if the correct answer literally has %
  if (correctAnswer.includes('%')) {
    const correctPct = parseFloat(correctAnswer.replace('%', ''));
    if (!isNaN(correctPct)) {
      if (numbersEquivalent(userNum, correctPct)) return true;
      if (numbersEquivalent(userNum, correctPct / 100)) return true;
      // User enters fraction equivalent of the percentage
      const userFracVal = parseFraction(userNorm);
      if (userFracVal !== null && numbersEquivalent(userFracVal, correctPct / 100)) return true;
    }
  }
  // Reverse: user enters percentage, correct is a plain number or fraction
  if (userAnswer.includes('%') && !correctAnswer.includes('%')) {
    const userPct = parseFloat(userAnswer.replace('%', ''));
    if (!isNaN(userPct)) {
      // e.g. user enters "75%" and correct is "0.75" or "3/4"
      if (correctNum !== null && numbersEquivalent(userPct / 100, correctNum)) return true;
      const correctFracVal = parseFraction(correctNorm);
      if (correctFracVal !== null && numbersEquivalent(userPct / 100, correctFracVal)) return true;
    }
  }

  // Handle expressions like "2x² + 2x - 12" with different spacing/ordering
  // Remove all spaces and compare
  const userExpr = userNorm.replace(/\s/g, '').replace(/\+-/g, '-').replace(/-\+/g, '-');
  const correctExpr = correctNorm.replace(/\s/g, '').replace(/\+-/g, '-').replace(/-\+/g, '-');
  if (userExpr === correctExpr) return true;

  // Handle formula rearrangements like "t = (v-u)/a" vs "(v-u)/a"
  const userFormula = userNorm.replace(/^[a-z]=/, '');
  const correctFormula = correctNorm.replace(/^[a-z]=/, '');
  if (userFormula === correctFormula) return true;

  return false;
};

// ==================== LLM-POWERED ERROR DIAGNOSIS ====================

// Quick diagnosis for wrong answers (pattern matching)
const quickDiagnosis = (question, userAnswer, correctAnswer) => {
  const userNum = parseFloat(userAnswer);
  const correctNum = parseFloat(correctAnswer);

  if (!isNaN(userNum) && !isNaN(correctNum)) {
    // Sign error
    if (userNum === -correctNum) {
      return {
        hasDiagnosis: true,
        diagnosis: "You have the right number but the wrong sign.",
        tip: "Check: negative × negative = positive, negative × positive = negative",
        encouragement: "The calculation was right - just a sign slip!",
      };
    }

    // Factor of 10
    if (userNum === correctNum * 10 || userNum === correctNum / 10) {
      return {
        hasDiagnosis: true,
        diagnosis: "Your answer is off by a factor of 10.",
        tip: "Check your decimal point placement or percentage conversion (15% = 0.15)",
        encouragement: "You're on the right track!",
      };
    }

    // Very close
    if (Math.abs(userNum - correctNum) < Math.abs(correctNum * 0.1) && userNum !== correctNum) {
      return {
        hasDiagnosis: true,
        diagnosis: "You're very close! Check your final calculation or rounding.",
        tip: "Re-read how many decimal places or significant figures are needed.",
        encouragement: "Nearly there!",
      };
    }

    // BIDMAS common errors
    if (question.q.includes('×') && question.q.includes('+')) {
      return {
        hasDiagnosis: true,
        diagnosis: "This question tests order of operations (BIDMAS).",
        tip: "Do Brackets, then Indices, then Division/Multiplication, finally Addition/Subtraction.",
        encouragement: "BIDMAS trips up lots of students - practice makes perfect!",
      };
    }
  }

  return {
    hasDiagnosis: false,
    diagnosis: null,
    tip: null,
  };
};

// Main check answer function
export const checkAnswer = (userAnswer, question, selfAssessedCorrect = null) => {
  const correctAnswer = question.a;

  // Self-assessed overrides answer checking
  if (selfAssessedCorrect === true) {
    return {
      isCorrect: true,
      diagnosis: null,
      tip: null,
      encouragement: "Great self-assessment!",
    };
  }

  if (selfAssessedCorrect === false) {
    return {
      isCorrect: false,
      diagnosis: null,
      tip: null,
      encouragement: null,
    };
  }

  const isCorrect = answersEquivalent(userAnswer, correctAnswer);

  if (isCorrect) {
    return {
      isCorrect: true,
      diagnosis: null,
      tip: null,
      encouragement: null,
    };
  }

  // Get diagnosis for wrong answer
  const diagnosis = quickDiagnosis(question, userAnswer, correctAnswer);

  return {
    isCorrect: false,
    ...diagnosis,
  };
};
