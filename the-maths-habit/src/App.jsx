import React, { useState, useRef } from 'react';
import { Check, Trophy, Flame, Home, Dumbbell, Settings, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, BookOpen, Info, TrendingUp, Target, Award, Zap, Calendar, BarChart3 } from 'lucide-react';

const topics = [
  { id: 'number', name: 'Number', strand: 'Number',
    foundation: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15'],
    higher: ['N9', 'N16'] },
  { id: 'algebra', name: 'Algebra', strand: 'Algebra',
    foundation: ['A1', 'A2', 'A3', 'A4', 'A5', 'A7', 'A13', 'A14', 'A15', 'A17', 'A21', 'A23', 'A24'],
    higher: ['A6', 'A8', 'A9', 'A10', 'A11', 'A12', 'A16', 'A18', 'A19', 'A20', 'A22', 'A25'] },
  { id: 'ratio', name: 'Ratio', strand: 'Ratio',
    foundation: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R14'],
    higher: ['R13', 'R15', 'R16'] },
  { id: 'geometry', name: 'Geometry', strand: 'Geometry',
    foundation: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G11', 'G13', 'G14', 'G15', 'G19', 'G20'],
    higher: ['G10', 'G12', 'G16', 'G17', 'G18', 'G21', 'G22', 'G23', 'G24', 'G25'] },
  { id: 'prob', name: 'Probability', strand: 'Probability',
    foundation: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
    higher: ['P8', 'P9'] },
  { id: 'stats', name: 'Statistics', strand: 'Statistics',
    foundation: ['S1', 'S2', 'S3', 'S4', 'S5'],
    higher: ['S6'] }
];

const descriptions = {
  // Number
  N1: 'Order and compare decimals including recurring (e.g. circle the largest: 5.304̇, 5.344, 5.34, 5.3̇4̇)',
  N2: 'Add, subtract, multiply and divide with integers, decimals and negatives',
  N3: 'Understand place value (e.g. what is the value of the 7 in 34,728?)',
  N4: 'Use inverse operations to check answers (e.g. multiplication ↔ division)',
  N5: 'Apply BIDMAS to calculations with brackets, indices and operations',
  N6: 'Calculate with powers and roots (e.g. work out d when d = g² − 2h)',
  N7: 'Recognise cube numbers (e.g. show the 3rd cube number = sum of three primes)',
  N8: 'Find factors, prime factors, HCF and LCM (e.g. write down all factors of 45)',
  N9: 'Work with fractional and negative indices (e.g. 8^(2/3), 2^(-3))',
  N10: 'Convert between decimals, fractions and percentages (e.g. 1.52 as a fraction)',
  N11: 'Express one quantity as a fraction of another',
  N12: 'Use fractions and percentages as operators (e.g. work out 10% of 170)',
  N13: 'Convert between metric units including area and volume',
  N14: 'Estimate calculations by rounding to 1 significant figure',
  N15: 'Round to decimal places, significant figures and appropriate accuracy',
  N16: 'Write error intervals (e.g. 8 cm to nearest cm → 7.5 ⩽ length < 8.5)',

  // Algebra
  A1: 'Use and interpret algebraic notation correctly',
  A2: 'Substitute numerical values into formulae (e.g. d = g² − 2h when g=15, h=63)',
  A3: 'Understand the difference between expressions, equations and formulae',
  A4: 'Expand brackets and factorise (e.g. expand 5x(x² + 3), factorise 25a² − b²)',
  A5: 'Use standard formulae (e.g. Volume of pyramid = ⅓ × base area × height)',
  A6: 'Rearrange formulae to change the subject (e.g. make n the subject of m = n + k)',
  A7: 'Model situations algebraically using function machines and interpret solutions',
  A8: 'Know the difference between equations and identities',
  A9: 'Simplify algebraic fractions (e.g. simplify (2(x+4)⁵)/((x+4)³) to ax² + bx + c)',
  A10: 'Construct algebraic proofs (e.g. prove a sum is a multiple of 3)',
  A11: 'Use inverse operations to solve problems',
  A12: 'Work with composite and inverse functions (e.g. g(x) = a × bˣ, find g(1))',
  A13: 'Plot and read coordinates; find midpoints of line segments',
  A14: 'Find equations of straight lines (y = mx + c) passing through two points',
  A15: 'Find turning points of quadratics from roots (e.g. x-coord = (a+b)/2)',
  A16: 'Work with cubic graphs (e.g. where does y = x³ − 1 cross the y-axis?)',
  A17: 'Solve linear equations including with brackets and fractions',
  A18: 'Solve quadratics (e.g. solve 2x(x + 10) = 5x − 18)',
  A19: 'Solve simultaneous equations (e.g. 7x + 2y = 100 and 3x + 2y = 48)',
  A20: 'Use iteration to find approximate solutions (e.g. Aₙ₊₁ = 1.02×Aₙ − 100)',
  A21: 'Set up inequalities from context (e.g. surface area < 650 cm², find largest x)',
  A22: 'Solve and represent inequalities on number lines and graphs',
  A23: 'Find nth term of arithmetic sequences (e.g. 6, 13, 20, 27 → nth term)',
  A24: 'Recognise and continue special sequences (Fibonacci, geometric, etc.)',
  A25: 'Find the nth term of quadratic sequences',

  // Ratio
  R1: 'Convert between units of measure in different contexts',
  R2: 'Work with scale factors as fractions (e.g. 12 cm enlarged to 8 cm → SF = 2/3)',
  R3: 'Calculate a fraction of an amount (e.g. for ⅖ of 240 hours)',
  R4: 'Use ratio notation including 1:n and reduction to simplest form',
  R5: 'Work with ratios from relationships (e.g. a = ¾c and 6b = 5c, find a:b:c)',
  R6: 'Express a division as a ratio and vice versa',
  R7: 'Solve proportion problems (e.g. cost for 5 months → cost for 2 years)',
  R8: 'Link ratios to fractions and linear functions',
  R9: 'Work out percentages of amounts (e.g. work out 60 as a percentage of 20)',
  R10: 'Calculate percentage change (e.g. salary +6%, bonus −9%, overall change?)',
  R11: 'Compare quantities using percentages (e.g. which shop is best value for 8 items?)',
  R12: 'Work backwards from percentage change (reverse percentages)',
  R13: 'Set up and solve direct and inverse proportion equations (A ∝ B⁴)',
  R14: 'Use compound units and density (e.g. mass = 2340g, density = 7.5 g/cm³)',
  R15: 'Apply ratio of lengths, areas and volumes in similar solids',
  R16: 'Solve compound interest and exponential growth/decay problems',

  // Geometry
  G1: 'Use geometric terms (e.g. name a triangle with three equal sides; name a chord)',
  G2: 'Construct triangles, bisectors, perpendiculars and loci with compasses',
  G3: 'Use angle facts (straight line, point, vertically opposite)',
  G4: 'Calculate angles in parallel lines (e.g. find angle p when p = 3r)',
  G5: 'Find interior and exterior angles of polygons',
  G6: 'Know properties of special quadrilaterals and regular hexagons',
  G7: 'Identify congruent and similar shapes',
  G8: 'Describe and use column vectors for translations',
  G9: 'Perform and describe rotations, reflections and translations',
  G10: 'Find scale factors as fractions (e.g. square 12 cm → 8 cm, SF = ?)',
  G11: 'Use circle properties (e.g. tangent perpendicular to radius at point of contact)',
  G12: 'Apply circle theorems (e.g. angle in semicircle, tangent problems)',
  G13: 'Interpret plans and elevations; read dimensions from isometric grids',
  G14: 'Calculate area of triangles and compound shapes on coordinate grids',
  G15: 'Calculate circumference and area of circles; find net dimensions',
  G16: 'Find arc length and sector area; area of regular hexagon = (3√3/2)x²',
  G17: 'Calculate volume of pyramids, prisms and frustums',
  G18: 'Prove triangles congruent (e.g. prove △ABE ≅ △CDE using SAS)',
  G19: 'Apply Pythagoras\' theorem (e.g. PQ = QR, PR = 10 cm, find radius)',
  G20: 'Use trigonometry to find angles (e.g. find angle w given sides 8.3 cm, 6.7 cm)',
  G21: 'Know exact values of sin, cos and tan for 0°, 30°, 45°, 60°, 90°',
  G22: 'Apply sine rule to find sides in non-right triangles (angles 56°, 73°, side 24 cm)',
  G23: 'Use Area = ½ab sin C for triangle area',
  G24: 'Use vectors: find m, p given a = (m,3), b = (−4,p) and diagram of 2a + b',
  G25: 'Perform vector addition (e.g. 2a + b) and interpret graphically',

  // Probability
  P1: 'Design and use tables for recording experimental outcomes',
  P2: 'Understand and apply ideas of fairness and equally likely outcomes',
  P3: 'Calculate relative frequency from repeated trials (e.g. after 25, 50, 75 trials)',
  P4: 'Know that probabilities sum to 1 (e.g. P(heads) = 1/64 → how many throws?)',
  P5: 'Place probabilities on a 0 to 1 scale',
  P6: 'Use Venn diagrams; convert frequency trees to Venn diagrams',
  P7: 'Use sample spaces and systematic listing (e.g. list all subject combinations)',
  P8: 'Complete tree diagrams and find P(both green) from two bags',
  P9: 'Calculate probability without replacement (e.g. tiles game: win if total = 10)',

  // Statistics
  S1: 'Understand sampling methods and identify bias',
  S2: 'Read and interpret tables, bar charts and pictograms; spot mistakes in diagrams',
  S3: 'Construct and interpret pie charts (e.g. calculate angles from frequencies)',
  S4: 'Draw tangents on graphs to estimate rates of change (e.g. cm/s at t = 10)',
  S5: 'Calculate mean from grouped data; find combined mean of two groups',
  S6: 'Draw histograms with unequal class widths using frequency density'
};

// Revision hints - simple explanations for students when they get questions wrong
const revisionHints = {
  // Number
  N1: 'Revise how to compare decimals by looking at each digit from left to right. For recurring decimals, write out several decimal places to compare.',
  N2: 'Revise the rules for calculating with negative numbers: negative × negative = positive, negative × positive = negative.',
  N3: 'Revise place value - each digit has a value based on its position (units, tens, hundreds, thousands, etc.).',
  N4: 'Revise inverse operations - addition undoes subtraction, multiplication undoes division. Use these to check your answers.',
  N5: 'Revise BIDMAS order: Brackets, Indices, Division/Multiplication (left to right), Addition/Subtraction (left to right).',
  N6: 'Revise powers (e.g. 3² = 9) and roots (e.g. √16 = 4). Remember: squaring and square rooting are inverse operations.',
  N7: 'Revise cube numbers: 1³=1, 2³=8, 3³=27, 4³=64, 5³=125. A cube number is a number multiplied by itself three times.',
  N8: 'Revise finding factors (numbers that divide exactly) and using prime factor trees to find HCF and LCM.',
  N9: 'Revise index laws: a^(m/n) = ⁿ√(aᵐ) and a^(-n) = 1/aⁿ. For example, 8^(2/3) = ³√(8²) = ³√64 = 4.',
  N10: 'Revise converting: decimal to fraction (use place value), fraction to decimal (divide), percentage = fraction × 100.',
  N11: 'Revise writing one quantity as a fraction of another: put the first number on top, the second on the bottom, then simplify.',
  N12: 'Revise finding percentages: 10% = divide by 10, 1% = divide by 100. Build up other percentages from these.',
  N13: 'Revise metric conversions: 1km=1000m, 1m=100cm, 1cm=10mm. For area use squared units, for volume use cubed.',
  N14: 'Revise rounding to 1 significant figure for estimates. Round each number, then calculate.',
  N15: 'Revise rounding: for decimal places, count digits after the point. For significant figures, count from the first non-zero digit.',
  N16: 'Revise error intervals: if rounded to nearest unit, the true value is ±0.5 from the rounded value.',

  // Algebra
  A1: 'Revise algebra notation: ab means a×b, a² means a×a, 2a means 2×a.',
  A2: 'Revise substitution: replace each letter with its value, then calculate using BIDMAS.',
  A3: 'Revise: an expression has no equals sign, an equation can be solved, a formula shows a relationship.',
  A4: 'Revise expanding: multiply each term inside the bracket. Factorising: find the common factor and take it outside.',
  A5: 'Revise standard formulae for area, volume, speed, density etc. Check your formula sheet.',
  A6: 'Revise rearranging: do the same operation to both sides to isolate the new subject.',
  A7: 'Revise function machines: follow operations in order for the output, reverse for the input.',
  A8: 'Revise: an equation is true for specific values, an identity (≡) is true for all values.',
  A9: 'Revise simplifying algebraic fractions: factorise top and bottom, then cancel common factors.',
  A10: 'Revise algebraic proof: let n be any integer, 2n is always even, 2n+1 is always odd.',
  A11: 'Revise inverse operations: work backwards using opposite operations.',
  A12: 'Revise composite functions: fg(x) means do g first, then f. For inverse functions, swap x and y then rearrange.',
  A13: 'Revise coordinates: (x, y) where x is across, y is up. Midpoint = average of x-coords and average of y-coords.',
  A14: 'Revise y = mx + c: m is the gradient (change in y ÷ change in x), c is the y-intercept.',
  A15: 'Revise: the turning point x-coordinate is halfway between the roots. Substitute to find y.',
  A16: 'Revise cubic graphs: they have an S-shape. y = x³ passes through the origin.',
  A17: 'Revise solving equations: do the same to both sides to get the unknown on its own.',
  A18: 'Revise solving quadratics: factorise and set each bracket = 0, or use the quadratic formula.',
  A19: 'Revise simultaneous equations: eliminate one variable by adding/subtracting equations.',
  A20: 'Revise iteration: substitute your answer back into the formula repeatedly until it settles.',
  A21: 'Revise setting up inequalities: translate words into symbols (< less than, > greater than, ≤ at most, ≥ at least).',
  A22: 'Revise inequality notation: open circle for < or >, closed circle for ≤ or ≥.',
  A23: 'Revise nth term: find the common difference (d), then nth term = dn + (first term - d).',
  A24: 'Revise special sequences: Fibonacci adds previous two terms, geometric multiplies by a constant.',
  A25: 'Revise quadratic sequences: find second differences, halve for the n² coefficient, then adjust.',

  // Ratio
  R1: 'Revise unit conversions by multiplying or dividing by the conversion factor.',
  R2: 'Revise scale factors: new length ÷ original length. Can be a fraction if shape gets smaller.',
  R3: 'Revise fractions of amounts: divide by the denominator, multiply by the numerator.',
  R4: 'Revise simplifying ratios: divide all parts by their HCF. For 1:n, divide both by the first number.',
  R5: 'Revise linking ratios: find a common value to connect them.',
  R6: 'Revise ratio ↔ fractions: a:b means a/(a+b) and b/(a+b) of the total.',
  R7: 'Revise proportion: find the value of 1 unit first, then multiply for what you need.',
  R8: 'Revise the link: ratio a:b is the same as the fraction a/b and the equation y = (a/b)x.',
  R9: 'Revise percentage: divide the part by the whole, then multiply by 100.',
  R10: 'Revise percentage change: (new - original) ÷ original × 100. Positive = increase, negative = decrease.',
  R11: 'Revise comparing value: find the price per item or per unit for each option.',
  R12: 'Revise reverse percentages: if price after 20% increase = £120, original = £120 ÷ 1.20.',
  R13: 'Revise direct proportion (y = kx) and inverse proportion (y = k/x). Find k first.',
  R14: 'Revise density = mass ÷ volume, speed = distance ÷ time.',
  R15: 'Revise similar shapes: if lengths are in ratio 1:k, areas are 1:k², volumes are 1:k³.',
  R16: 'Revise compound interest: multiply by (1 + rate)ⁿ where n is the number of time periods.',

  // Geometry
  G1: 'Revise geometric vocabulary: equilateral (3 equal sides), isosceles (2 equal), scalene (none equal).',
  G2: 'Revise constructions: use compasses for arcs, keep the same compass width for bisectors.',
  G3: 'Revise angle facts: straight line = 180°, around a point = 360°, vertically opposite angles are equal.',
  G4: 'Revise parallel line angles: corresponding (F-shape) are equal, alternate (Z-shape) are equal, co-interior (C-shape) add to 180°.',
  G5: 'Revise polygon angles: exterior angles sum to 360°, interior angle = 180° - exterior angle.',
  G6: 'Revise quadrilateral properties: parallelogram (opposite sides parallel), rhombus (4 equal sides), etc.',
  G7: 'Revise congruent (same size and shape) vs similar (same shape, different size).',
  G8: 'Revise vectors: column vector (x, y) means x right and y up. Add vectors by adding components.',
  G9: 'Revise transformations: rotation needs centre, angle and direction. Reflection needs mirror line.',
  G10: 'Revise scale factors: new ÷ old. Enlargement > 1, reduction < 1.',
  G11: 'Revise circle theorems: tangent meets radius at 90°, angle in semicircle = 90°.',
  G12: 'Revise circle theorem proofs using isosceles triangles from radii.',
  G13: 'Revise area formulae: rectangle = l×w, triangle = ½×b×h, parallelogram = b×h.',
  G14: 'Revise compound shapes: split into simple shapes, find each area, then add or subtract.',
  G15: 'Revise circle formulae: circumference = πd or 2πr, area = πr².',
  G16: 'Revise splitting regular polygons into triangles from the centre.',
  G17: 'Revise volume = area of cross-section × length. Surface area = sum of all faces.',
  G18: 'Revise congruence conditions: SSS, SAS, ASA, RHS (for right-angled triangles).',
  G19: 'Revise Pythagoras: a² + b² = c² where c is the hypotenuse (longest side, opposite the right angle).',
  G20: 'Revise SOHCAHTOA: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.',
  G21: 'Revise exact values: sin30°=½, cos30°=√3/2, tan30°=1/√3, sin45°=cos45°=1/√2, tan45°=1.',
  G22: 'Revise sine rule: a/sinA = b/sinB. Cosine rule: a² = b² + c² - 2bc×cosA.',
  G23: 'Revise triangle area = ½ × a × b × sin(C) where C is the angle between sides a and b.',
  G24: 'Revise vector addition: add components. Scalar multiplication: multiply each component.',
  G25: 'Revise vector proofs: show vectors are parallel (one is a multiple of the other) or equal.',

  // Probability
  P1: 'Revise probability scale: 0 = impossible, 0.5 = even chance, 1 = certain.',
  P2: 'Revise probability = number of successful outcomes ÷ total number of outcomes.',
  P3: 'Revise two-way tables: row totals and column totals must match the grand total.',
  P4: 'Revise: P(event happens) + P(event doesn\'t happen) = 1.',
  P5: 'Revise Venn diagrams: overlapping region shows elements in both sets.',
  P6: 'Revise tree diagrams: multiply along branches for AND, add between branches for OR.',
  P7: 'Revise relative frequency = number of successes ÷ number of trials.',
  P8: 'Revise dependent events: the second probability changes based on the first outcome.',
  P9: 'Revise with/without replacement: without replacement changes the denominator for the second pick.',

  // Statistics
  S1: 'Revise good questionnaire design: clear questions, no bias, appropriate response options.',
  S2: 'Revise reading scales carefully and checking units.',
  S3: 'Revise pie charts: angle = (frequency ÷ total) × 360°.',
  S4: 'Revise drawing tangents: touch the curve at one point only. Gradient = rate of change.',
  S5: 'Revise mean from grouped data: use midpoints × frequency, then divide by total frequency.',
  S6: 'Revise histograms: frequency density = frequency ÷ class width. Area of bar = frequency.'
};

const levelLabels = ['Not started', '1/4 quick', '2/4 quick', '3/4 quick', 'Exam ready!', '✓ Mastered'];

const TOPIC_HEX = {
  Number: "#EF4444",
  Algebra: "#7B4DFF",
  Ratio: "#F2A93B",
  Geometry: "#4FB9A8",
  Probability: "#2563EB",
  Statistics: "#E35AA6",
};

const INTENSITY = { 0: 0.1, 1: 0.22, 2: 0.38, 3: 0.58, 4: 0.75, 5: 0.95 };

function mixWithWhite(hex, intensity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * (1 - intensity));
  return `#${[r, g, b].map(mix).map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

// Calculate recency factor (1.0 = practiced today, fades to 0.3 over 14 days)
function getRecencyFactor(lastPracticed) {
  if (!lastPracticed) return 0.5; // Never practiced = medium fade
  const daysSince = Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24));
  if (daysSince <= 1) return 1.0;   // Today/yesterday = full color
  if (daysSince <= 3) return 0.9;   // Last 3 days
  if (daysSince <= 7) return 0.75;  // Last week
  if (daysSince <= 14) return 0.55; // Last 2 weeks
  return 0.35; // Older = faded (needs revisiting)
}

// Mix color with both progress intensity AND recency saturation
function getTileColor(hex, progressLevel, recencyFactor) {
  const baseIntensity = INTENSITY[progressLevel] || 0.1;
  // Recency affects saturation - old topics fade toward gray
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // First apply progress intensity (mix with white)
  const progressMix = (c) => Math.round(c + (255 - c) * (1 - baseIntensity));
  let pr = progressMix(r);
  let pg = progressMix(g);
  let pb = progressMix(b);
  
  // Then apply recency (desaturate old topics toward gray)
  const gray = Math.round((pr + pg + pb) / 3);
  const saturate = (c) => Math.round(gray + (c - gray) * recencyFactor);
  
  return `#${[saturate(pr), saturate(pg), saturate(pb)].map(c => 
    Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")
  ).join("")}`;
}

// Mastery system: 4 quick questions + 1 exam question = mastered
function getUnderstandingLevel(progress) {
  const quickCorrect = progress?.quickCorrect ?? 0;
  const examPassed = progress?.examPassed ?? false;
  
  if (examPassed) return 5; // Mastered
  if (quickCorrect >= 4) return 4; // Ready for exam
  if (quickCorrect === 3) return 3;
  if (quickCorrect === 2) return 2;
  if (quickCorrect === 1) return 1;
  return 0; // Not started
}

function isReadyForExam(progress) {
  return (progress?.quickCorrect ?? 0) >= 4 && !(progress?.examPassed);
}

function HoverTooltip({ open, x, y, objective, progress }) {
  if (!open || !objective) return null;
  
  const pad = 12;
  const width = 320;
  const left = Math.min(Math.max(pad, x - width / 2), window.innerWidth - width - pad);
  const top = Math.max(pad, y - 120);
  const quickCorrect = progress?.quickCorrect ?? 0;
  const examPassed = progress?.examPassed ?? false;
  const level = getUnderstandingLevel(progress);
  
  return (
    <div
      className="fixed z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl pointer-events-none"
      style={{ left, top, width }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: TOPIC_HEX[objective.topic] }}
        >
          {objective.code}
        </span>
        <span className="text-xs text-slate-500">{objective.topicName}</span>
        {objective.isHigher && (
          <span className="ml-auto px-1.5 py-0.5 bg-purple-500 text-white text-xs font-bold rounded">H</span>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">
        {objective.title}
      </div>
      
      {/* Progress toward mastery */}
      <div className="mt-3 space-y-2">
        {/* Quick questions progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-20">Quick:</span>
          <div className="flex gap-1 flex-1">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < quickCorrect ? 'bg-violet-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-slate-600">{Math.min(quickCorrect, 4)}/4</span>
        </div>
        
        {/* Exam question progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-20">Exam:</span>
          <div className="flex gap-1 flex-1">
            <div className={`h-2 flex-1 rounded-full ${
              examPassed ? 'bg-emerald-500' : quickCorrect >= 4 ? 'bg-amber-300' : 'bg-slate-200'
            }`} />
          </div>
          <span className="text-xs font-medium text-slate-600">
            {examPassed ? '✓' : quickCorrect >= 4 ? 'Ready!' : 'Locked'}
          </span>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-slate-600">
        <span className={`font-medium ${level >= 5 ? 'text-emerald-600' : ''}`}>
          {level >= 5 ? '✓ Mastered!' : level >= 4 ? '📝 Take the exam!' : levelLabels[level]}
        </span>
      </div>
      
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(streak / 5 * 100, 100)}%`,
            backgroundColor: TOPIC_HEX[objective.topic],
          }}
        />
      </div>
    </div>
  );
}

// ==================== PRACTICE PAGE SYSTEM ====================

// Storage helpers
const STORAGE_KEY = 'maths-habit-progress';
const SETTINGS_KEY = 'maths-habit-settings';
const SESSION_COUNT_KEY = 'maths-habit-session-count';
const SESSION_HISTORY_KEY = 'maths-habit-session-history';
const DAILY_ACTIVITY_KEY = 'maths-habit-daily-activity';
const STREAK_DATA_KEY = 'maths-habit-streak-data';
const TOTAL_QUESTIONS_KEY = 'maths-habit-total-questions';
const ONBOARDING_COMPLETE_KEY = 'maths-habit-onboarding-complete';
const FSRS_DATA_KEY = 'maths-habit-fsrs';
const MIGRATION_VERSION_KEY = 'maths-habit-migration-version';
const CURRENT_MIGRATION_VERSION = 2;

// ==================== FSRS ALGORITHM (Cognitive Science) ====================
// Based on Free Spaced Repetition Scheduler - 20-30% more efficient than SM-2

// FSRS Constants (research-backed defaults)
const FSRS_DEFAULTS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9,   // Target 90% retention rate
  maxInterval: 365,        // Max interval in days
  DECAY: -0.5,
  FACTOR: 19 / 81,
  learningSteps: [1, 10],  // Minutes for learning steps
  relearningSteps: [10],   // Minutes for relearning
};

// Rating enum for FSRS
const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

// Calculate retrievability (probability of recall) using power function
const fsrsRetrievability = (elapsedDays, stability) => {
  if (!stability || stability <= 0) return 0;
  const { DECAY, FACTOR } = FSRS_DEFAULTS;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
};

// Calculate next interval given stability and target retention
const fsrsInterval = (stability, requestRetention = 0.9) => {
  const { DECAY, FACTOR, maxInterval } = FSRS_DEFAULTS;
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return Math.min(Math.max(1, Math.round(interval)), maxInterval);
};

// Update stability after successful review
const fsrsNextStability = (card, rating, elapsedDays) => {
  const w = FSRS_DEFAULTS.w;
  const { stability: S, difficulty: D } = card;

  if (rating === Rating.Again) {
    // Lapse: stability decreases significantly
    const retrievability = fsrsRetrievability(elapsedDays, S);
    const newS = w[11] * Math.pow(D + 0.1, -w[12]) * (Math.pow(S + 1, w[13]) - 1) *
                 Math.exp(w[14] * (1 - retrievability));
    return Math.max(0.1, newS);
  }

  // Successful recall: stability increases
  const hardPenalty = rating === Rating.Hard ? w[15] : 1;
  const easyBonus = rating === Rating.Easy ? w[16] : 1;
  const retrievability = fsrsRetrievability(elapsedDays, S);

  const newS = S * (1 + Math.exp(w[8]) *
              (11 - D * 10) *
              Math.pow(S, -w[9]) *
              (Math.exp(w[10] * (1 - retrievability)) - 1) *
              hardPenalty * easyBonus);

  return Math.min(Math.max(0.1, newS), FSRS_DEFAULTS.maxInterval);
};

// Update difficulty after review
const fsrsNextDifficulty = (currentD, rating) => {
  const w = FSRS_DEFAULTS.w;
  const delta = (rating - 3) / 3; // -0.67 to +0.33
  const newD = currentD - w[6] * delta;

  // Mean reversion toward default difficulty
  const meanD = w[4] / 10;
  const revertedD = w[7] * meanD + (1 - w[7]) * newD;

  return Math.max(0.1, Math.min(1, revertedD));
};

// Generate stable question ID from objective code and question content
const getQuestionId = (objectiveCode, questionIndex, question) => {
  const hash = simpleHash((question.q || '') + (question.a || ''));
  return `${objectiveCode}_${questionIndex}_${hash}`;
};

const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
};

// Initialize new FSRS card
const fsrsInitCard = (questionId) => ({
  questionId,
  stability: FSRS_DEFAULTS.w[0],
  difficulty: FSRS_DEFAULTS.w[4] / 10,
  lastReview: null,
  nextReview: Date.now(),
  reps: 0,
  lapses: 0,
  state: 'new', // 'new', 'learning', 'review', 'relearning'
  learningStep: 0,
  confidenceHistory: [],
  responseTimeHistory: [],
});

// Process review and update FSRS card
const fsrsReview = (card, rating, responseTime, confidence = null) => {
  const now = Date.now();
  const elapsedDays = card.lastReview
    ? (now - card.lastReview) / (1000 * 60 * 60 * 24)
    : 0;

  const updated = { ...card };

  // Record confidence calibration for metacognition tracking
  if (confidence !== null) {
    const retrievability = card.lastReview
      ? fsrsRetrievability(elapsedDays, card.stability)
      : 0.5;
    updated.confidenceHistory = [
      ...(updated.confidenceHistory || []).slice(-49),
      { predicted: confidence, actual: rating >= Rating.Good ? 1 : 0, retrievability, timestamp: now }
    ];
  }

  // Record response time
  updated.responseTimeHistory = [
    ...(updated.responseTimeHistory || []).slice(-19),
    responseTime
  ];
  updated.avgResponseTime = updated.responseTimeHistory.reduce((a, b) => a + b, 0) /
                            updated.responseTimeHistory.length;

  // Handle by card state
  if (card.state === 'new' || card.state === 'learning') {
    return fsrsHandleLearning(updated, rating, now);
  } else if (card.state === 'relearning') {
    return fsrsHandleRelearning(updated, rating, now);
  } else {
    return fsrsHandleReview(updated, rating, elapsedDays, now);
  }
};

// Handle learning state (new cards)
const fsrsHandleLearning = (card, rating, now) => {
  const learningSteps = FSRS_DEFAULTS.learningSteps;
  const updated = { ...card };

  if (rating === Rating.Again) {
    updated.learningStep = 0;
    updated.nextReview = now + learningSteps[0] * 60 * 1000;
  } else if (rating === Rating.Easy) {
    // Graduate immediately with bonus stability
    updated.state = 'review';
    updated.stability = FSRS_DEFAULTS.w[3];
    updated.reps = 1;
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  } else {
    // Good or Hard: advance learning step
    updated.learningStep = (updated.learningStep || 0) + 1;
    if (updated.learningStep >= learningSteps.length) {
      // Graduate to review state
      updated.state = 'review';
      updated.stability = rating === Rating.Hard ? FSRS_DEFAULTS.w[1] : FSRS_DEFAULTS.w[2];
      updated.reps = 1;
      updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
    } else {
      updated.nextReview = now + learningSteps[updated.learningStep] * 60 * 1000;
    }
  }

  updated.lastReview = now;
  return updated;
};

// Handle relearning state (lapsed cards)
const fsrsHandleRelearning = (card, rating, now) => {
  const relearningSteps = FSRS_DEFAULTS.relearningSteps;
  const updated = { ...card };

  if (rating === Rating.Again) {
    updated.learningStep = 0;
    updated.nextReview = now + relearningSteps[0] * 60 * 1000;
  } else {
    // Return to review state
    updated.state = 'review';
    updated.learningStep = 0;
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  }

  updated.lastReview = now;
  return updated;
};

// Handle review state (graduated cards)
const fsrsHandleReview = (card, rating, elapsedDays, now) => {
  const updated = { ...card };

  if (rating === Rating.Again) {
    // Lapse: enter relearning
    updated.lapses = (updated.lapses || 0) + 1;
    updated.state = 'relearning';
    updated.learningStep = 0;
    updated.stability = fsrsNextStability(card, rating, elapsedDays);
    updated.nextReview = now + (FSRS_DEFAULTS.relearningSteps[0] || 10) * 60 * 1000;
  } else {
    // Successful review
    updated.reps = (updated.reps || 0) + 1;
    updated.stability = fsrsNextStability(card, rating, elapsedDays);
    updated.difficulty = fsrsNextDifficulty(card.difficulty, rating);
    updated.nextReview = now + fsrsInterval(updated.stability) * 24 * 60 * 60 * 1000;
  }

  updated.lastReview = now;
  return updated;
};

// FSRS Data Storage
const loadFsrsData = () => {
  try {
    const saved = localStorage.getItem(FSRS_DATA_KEY);
    return saved ? JSON.parse(saved) : { questionCards: {}, params: { ...FSRS_DEFAULTS } };
  } catch { return { questionCards: {}, params: { ...FSRS_DEFAULTS } }; }
};

const saveFsrsData = (data) => {
  try {
    localStorage.setItem(FSRS_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save FSRS data:', e);
  }
};

// Discriminative interleaving pairs (commonly confused topics)
const confusablePairs = {
  'N5': ['N6'],        // BIDMAS vs powers
  'N6': ['N5'],
  'N8': ['R4'],        // HCF/LCM vs ratio simplification
  'R4': ['N8'],
  'N10': ['R9'],       // Converting fractions/decimals vs percentages
  'R9': ['N10'],
  'A4': ['A6'],        // Expanding vs rearranging
  'A6': ['A4'],
  'A17': ['A18'],      // Linear vs quadratic equations
  'A18': ['A17', 'A19'],
  'A19': ['A18'],      // Simultaneous vs quadratic
  'G3': ['G4'],        // Angle facts vs parallel lines
  'G4': ['G3', 'G5'],
  'G5': ['G4'],        // Polygon angles
  'G19': ['G20'],      // Pythagoras vs trigonometry
  'G20': ['G19'],
  'R10': ['R12'],      // Percentage change vs reverse percentage
  'R12': ['R10'],
  'R3': ['R4'],        // Fraction of amount vs ratios
  'P4': ['P8'],        // Basic probability vs tree diagrams
  'P8': ['P4', 'P9'],
};

// Data migration function
const migrateToFSRS = (progress, questionBank) => {
  const fsrsData = {
    questionCards: {},
    params: { ...FSRS_DEFAULTS },
  };

  Object.entries(progress).forEach(([objectiveCode, prog]) => {
    if (!prog) return;

    const questions = questionBank[objectiveCode] || [];
    const quickCorrect = prog.quickCorrect || 0;
    const examPassed = prog.examPassed || false;

    // Estimate FSRS parameters from existing mastery data
    let stability, state, reps;
    if (examPassed) {
      stability = 30; // ~1 month for mastered
      state = 'review';
      reps = 5;
    } else if (quickCorrect >= 3) {
      stability = 7;  // ~1 week
      state = 'review';
      reps = quickCorrect;
    } else if (quickCorrect > 0) {
      stability = 1;  // ~1 day
      state = 'learning';
      reps = quickCorrect;
    } else {
      stability = FSRS_DEFAULTS.w[0];
      state = 'new';
      reps = 0;
    }

    questions.forEach((q, idx) => {
      const questionId = getQuestionId(objectiveCode, idx, q);
      fsrsData.questionCards[questionId] = {
        questionId,
        stability,
        difficulty: FSRS_DEFAULTS.w[4] / 10,
        lastReview: prog.lastPracticed || null,
        nextReview: prog.nextDue || Date.now(),
        reps,
        lapses: 0,
        state,
        learningStep: state === 'learning' ? quickCorrect : 0,
        confidenceHistory: [],
        responseTimeHistory: [],
      };
    });
  });

  return fsrsData;
};

// Run migration if needed
const runMigration = (progress, questionBank) => {
  try {
    const currentVersion = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '1');
    if (currentVersion >= CURRENT_MIGRATION_VERSION) return loadFsrsData();

    console.log(`Migrating FSRS data from v${currentVersion} to v${CURRENT_MIGRATION_VERSION}`);
    const fsrsData = migrateToFSRS(progress, questionBank);
    saveFsrsData(fsrsData);
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    console.log(`Migration complete: ${Object.keys(fsrsData.questionCards).length} cards`);
    return fsrsData;
  } catch (e) {
    console.error('Migration failed:', e);
    return loadFsrsData();
  }
};

// AI features unlock after this many questions answered
const AI_UNLOCK_THRESHOLD = 15;

// Quick Fire unlocks after 5 objectives mastered OR 3-day streak
const QUICKFIRE_MASTERY_THRESHOLD = 5;
const QUICKFIRE_STREAK_THRESHOLD = 3;

// Check if onboarding is complete
const isOnboardingComplete = () => {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch { return false; }
};

const setOnboardingComplete = () => {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {}
};

const defaultStreakData = {
  freezesAvailable: 1, // Start with 1 free freeze
  freezesUsed: [], // Dates when freezes were used
  lastStreakMilestone: 0, // Last streak length that earned a freeze
  repairNeeded: false, // Whether streak needs repair
  repairDate: null, // Date when repair became needed
  longestStreak: 0, // Personal best
};

const defaultSettings = {
  questionsPerSession: 5,
  showHints: true,
  includeHigherTier: false,
  dailyGoal: 10, // questions per day
  weeklyMasteryGoal: 3, // objectives to master per week
  // Accessibility
  fontSize: 'normal', // 'normal', 'large', 'xlarge'
  dyslexiaFont: false,
  highContrast: false,
};

const loadProgress = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

const saveProgress = (progress) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
};

const loadSessionCount = () => {
  try {
    const saved = localStorage.getItem(SESSION_COUNT_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch { return 0; }
};

const saveSessionCount = (count) => {
  try {
    localStorage.setItem(SESSION_COUNT_KEY, count.toString());
  } catch {}
};

const loadSessionHistory = () => {
  try {
    const saved = localStorage.getItem(SESSION_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const saveSessionHistory = (history) => {
  try {
    // Keep last 100 sessions
    const trimmed = history.slice(-100);
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
};

// Total questions answered (lifetime) - for AI unlock
const loadTotalQuestions = () => {
  try {
    const saved = localStorage.getItem(TOTAL_QUESTIONS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch { return 0; }
};

const saveTotalQuestions = (count) => {
  try {
    localStorage.setItem(TOTAL_QUESTIONS_KEY, count.toString());
  } catch {}
};

const isAIUnlocked = (totalQuestions) => totalQuestions >= AI_UNLOCK_THRESHOLD;

// Daily activity tracking
const loadDailyActivity = () => {
  try {
    const saved = localStorage.getItem(DAILY_ACTIVITY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

const saveDailyActivity = (activity) => {
  try {
    localStorage.setItem(DAILY_ACTIVITY_KEY, JSON.stringify(activity));
  } catch {}
};

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const recordDailyActivity = (questionsAnswered, correctCount, masteryGained) => {
  const activity = loadDailyActivity();
  const todayKey = getTodayKey();
  
  if (!activity[todayKey]) {
    activity[todayKey] = { questions: 0, correct: 0, mastery: 0, sessions: 0, firstPractice: Date.now() };
  }
  
  activity[todayKey].questions += questionsAnswered;
  activity[todayKey].correct += correctCount;
  activity[todayKey].mastery += masteryGained;
  activity[todayKey].sessions += 1;
  activity[todayKey].lastPractice = Date.now();
  
  saveDailyActivity(activity);
  return activity;
};

// Streak data management
const loadStreakData = () => {
  try {
    const saved = localStorage.getItem(STREAK_DATA_KEY);
    return saved ? { ...defaultStreakData, ...JSON.parse(saved) } : defaultStreakData;
  } catch { return defaultStreakData; }
};

const saveStreakData = (data) => {
  try {
    localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
  } catch {}
};

const calculateStreak = () => {
  const activity = loadDailyActivity();
  const streakData = loadStreakData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getTodayKey();
  
  const practicedToday = activity[todayKey]?.questions > 0;
  const todayGoalMet = (activity[todayKey]?.questions ?? 0) >= 5; // Min 5 questions for streak
  
  // Get yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const practicedYesterday = activity[yesterdayKey]?.questions >= 5;
  
  // Check if we need to use a freeze or initiate repair
  let needsRepair = streakData.repairNeeded;
  let freezeUsedToday = streakData.freezesUsed.includes(yesterdayKey);
  
  // If didn't practice yesterday and haven't used a freeze
  if (!practicedYesterday && !freezeUsedToday && !needsRepair) {
    // Check if there was a streak to protect
    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    const twoDaysAgoKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;
    const hadStreak = activity[twoDaysAgoKey]?.questions >= 5;
    
    if (hadStreak) {
      // Try to auto-use a freeze
      if (streakData.freezesAvailable > 0) {
        streakData.freezesAvailable--;
        streakData.freezesUsed.push(yesterdayKey);
        freezeUsedToday = true;
        saveStreakData(streakData);
      } else {
        // No freeze available - streak needs repair
        streakData.repairNeeded = true;
        streakData.repairDate = yesterdayKey;
        needsRepair = true;
        saveStreakData(streakData);
      }
    }
  }
  
  // Calculate actual streak
  let streak = 0;
  let checkDate = new Date(today);
  
  // If not practiced today, start checking from yesterday
  if (!todayGoalMet) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // Count consecutive days (including freeze days)
  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const practiced = activity[key]?.questions >= 5;
    const froze = streakData.freezesUsed.includes(key);
    
    if (practiced || froze) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 365) break;
  }
  
  // Update longest streak
  if (streak > streakData.longestStreak) {
    streakData.longestStreak = streak;
    saveStreakData(streakData);
  }
  
  // Check for repair completion (double session = 10+ questions)
  const repairCompleted = needsRepair && (activity[todayKey]?.questions ?? 0) >= 10;
  if (repairCompleted) {
    streakData.repairNeeded = false;
    streakData.repairDate = null;
    saveStreakData(streakData);
    needsRepair = false;
  }
  
  // Calculate repair progress
  const repairProgress = needsRepair ? Math.min((activity[todayKey]?.questions ?? 0) / 10 * 100, 100) : 0;
  
  return { 
    streak: needsRepair ? 0 : streak, // Show 0 if repair needed
    potentialStreak: streak, // What streak would be after repair
    practicedToday: todayGoalMet,
    needsRepair,
    repairProgress,
    repairCompleted,
    freezesAvailable: streakData.freezesAvailable,
    freezeUsedToday,
    longestStreak: streakData.longestStreak,
  };
};

// Award streak freeze for milestones
const checkStreakMilestone = (streak) => {
  const streakData = loadStreakData();
  const milestones = [7, 14, 30, 60, 90, 180, 365]; // Days that earn freezes
  
  for (const milestone of milestones) {
    if (streak >= milestone && streakData.lastStreakMilestone < milestone) {
      streakData.freezesAvailable++;
      streakData.lastStreakMilestone = milestone;
      saveStreakData(streakData);
      return { earned: true, milestone, total: streakData.freezesAvailable };
    }
  }
  return { earned: false };
};

const getWeeklyMastery = (progress) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let count = 0;
  
  Object.values(progress).forEach(p => {
    if (p.masteredAt && p.masteredAt > weekAgo) {
      count++;
    }
  });
  
  return count;
};

const getBestPracticeTime = () => {
  const history = loadSessionHistory();
  if (history.length < 5) return null;
  
  const hourCounts = {};
  history.forEach(s => {
    const hour = new Date(s.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  let bestHour = null;
  let maxCount = 0;
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      bestHour = parseInt(hour);
    }
  });
  
  if (bestHour === null) return null;
  
  const formatHour = (h) => {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };
  
  return `${formatHour(bestHour)} - ${formatHour((bestHour + 1) % 24)}`;
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch { return defaultSettings; }
};

const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
};

const resetAllProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_COUNT_KEY);
    localStorage.removeItem(SESSION_HISTORY_KEY);
    localStorage.removeItem(DAILY_ACTIVITY_KEY);
    localStorage.removeItem(STREAK_DATA_KEY);
  } catch {}
};

const exportProgress = () => {
  const data = {
    progress: loadProgress(),
    settings: loadSettings(),
    sessionCount: loadSessionCount(),
    sessionHistory: loadSessionHistory(),
    dailyActivity: loadDailyActivity(),
    streakData: loadStreakData(),
    exportedAt: new Date().toISOString(),
    version: '1.3',
  };
  return JSON.stringify(data, null, 2);
};

const importProgress = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.progress) saveProgress(data.progress);
    if (data.settings) saveSettings(data.settings);
    if (data.sessionCount !== undefined) saveSessionCount(data.sessionCount);
    if (data.sessionHistory) saveSessionHistory(data.sessionHistory);
    if (data.dailyActivity) saveDailyActivity(data.dailyActivity);
    if (data.streakData) saveStreakData(data.streakData);
    return true;
  } catch {
    return false;
  }
};

// Question bank - sample questions for each objective
const questionBank = {
  // Number - with multiple choice and calculator modes
  N1: [
    { q: "Which is the largest?", type: "mcq", options: ["5.304̇", "5.344", "5.34", "5.3̇4̇"], a: "5.3̇4̇", calculator: false },
    { q: "Order these from smallest to largest: 0.45, 0.405, 0.54, 0.045", a: "0.045, 0.405, 0.45, 0.54", type: "text", calculator: false },
    { q: "Which decimal is equivalent to 1/3?", type: "mcq", options: ["0.3", "0.33", "0.3̇", "0.33̇"], a: "0.3̇", calculator: false },
  ],
  N2: [
    { q: "Work out: −7 × −4", a: "28", type: "number", calculator: false },
    { q: "Calculate: 3.6 ÷ 0.4", a: "9", type: "number", calculator: true },
    { q: "What is −15 ÷ 3?", type: "mcq", options: ["-5", "5", "-45", "45"], a: "-5", calculator: false },
    { q: "Calculate: 2.4 × 3.5", a: "8.4", type: "number", calculator: true },
  ],
  N3: [
    { q: "What is the value of the 7 in 34,728?", type: "mcq", options: ["7", "70", "700", "7000"], a: "700", calculator: false },
    { q: "Write 45,000 in standard form", a: "4.5 × 10⁴", type: "text", calculator: false },
    { q: "What is 3.2 × 10³ as an ordinary number?", a: "3200", type: "number", calculator: false },
  ],
  N5: [
    { q: "Work out: 3 + 4 × 2", a: "11", type: "number", calculator: false },
    { q: "Calculate: (5 + 3)² ÷ 4", a: "16", type: "number", calculator: false },
    { q: "What is 20 - 3 × 4?", type: "mcq", options: ["68", "8", "32", "17"], a: "8", calculator: false },
    { q: "Calculate: 6 + 12 ÷ (2 + 1)", a: "10", type: "number", calculator: false },
  ],
  N6: [
    { q: "Work out: √144", a: "12", type: "number", calculator: false },
    { q: "Calculate: 2³ + 3²", a: "17", type: "number", calculator: false },
    { q: "What is √225?", type: "mcq", options: ["13", "14", "15", "16"], a: "15", calculator: false },
    { q: "Calculate: 5² - √49", a: "18", type: "number", calculator: false },
  ],
  N7: [
    { q: "What is the 4th cube number?", type: "mcq", options: ["27", "64", "81", "125"], a: "64", calculator: false },
    { q: "Is 64 a cube number? (yes/no)", a: "yes", type: "text", calculator: false },
    { q: "What is 5³?", a: "125", type: "number", calculator: false },
  ],
  N8: [
    { q: "Find the HCF of 24 and 36", a: "12", type: "number", calculator: false },
    { q: "Find the LCM of 6 and 8", a: "24", type: "number", calculator: false },
    { q: "What is the HCF of 18 and 24?", type: "mcq", options: ["2", "3", "6", "12"], a: "6", calculator: false },
    { q: "Find the LCM of 4 and 6", a: "12", type: "number", calculator: false },
  ],
  N10: [
    { q: "Write 0.75 as a fraction in simplest form", a: "3/4", type: "text", calculator: false },
    { q: "Write 35% as a decimal", a: "0.35", type: "text", calculator: false },
    { q: "What is 0.4 as a percentage?", type: "mcq", options: ["4%", "0.4%", "40%", "400%"], a: "40%", calculator: false },
    { q: "Convert 2/5 to a decimal", a: "0.4", type: "text", calculator: false },
  ],
  N12: [
    { q: "Work out 15% of 80", a: "12", type: "number", calculator: true },
    { q: "Find 3/4 of 60", a: "45", type: "number", calculator: false },
    { q: "What is 20% of 150?", type: "mcq", options: ["15", "20", "30", "35"], a: "30", calculator: true },
    { q: "Calculate 12.5% of 400", a: "50", type: "number", calculator: true },
  ],
  N14: [
    { q: "Estimate: 4.8 × 21.3", a: "100", type: "number", hint: "Round to 1 s.f.", calculator: false },
    { q: "Estimate: 198 ÷ 4.1", a: "50", type: "number", hint: "Round to 1 s.f.", calculator: false },
    { q: "Estimate 9.7 × 5.2", type: "mcq", options: ["40", "45", "50", "55"], a: "50", hint: "Round to 1 s.f.", calculator: false },
  ],
  N15: [
    { q: "Round 3.456 to 2 decimal places", a: "3.46", type: "text", calculator: false },
    { q: "Round 12,345 to 2 significant figures", a: "12000", type: "text", calculator: false },
    { q: "What is 0.0456 rounded to 2 s.f.?", type: "mcq", options: ["0.04", "0.05", "0.046", "0.045"], a: "0.046", calculator: false },
  ],
  N16: [
    { q: "A length is 8 cm to the nearest cm. What is the lower bound?", a: "7.5", type: "number", calculator: false },
    { q: "A mass is 50g to the nearest 10g. Write the error interval.", a: "45 ≤ x < 55", type: "text", calculator: false },
  ],
  
  // Algebra
  A2: [
    { q: "If y = 3x + 5, find y when x = 4", a: "17", type: "number", calculator: false },
    { q: "Work out d when d = g² − 2h, g = 5, h = 3", a: "19", type: "number", calculator: false },
    { q: "If P = 2(l + w), find P when l = 7 and w = 3", a: "20", type: "number", calculator: false },
  ],
  A4: [
    { q: "Expand: 3(x + 4)", a: "3x + 12", type: "text", calculator: false },
    { q: "Factorise: x² + 5x", a: "x(x + 5)", type: "text", calculator: false },
    { q: "Expand: 2(3x - 5)", type: "mcq", options: ["6x - 5", "6x - 10", "5x - 10", "6x + 10"], a: "6x - 10", calculator: false },
    { q: "Factorise: 6x + 9", a: "3(2x + 3)", type: "text", calculator: false },
  ],
  A6: [
    { q: "Make x the subject: y = 3x + 2", a: "x = (y - 2)/3", type: "text", calculator: false },
    { q: "Rearrange for r: A = πr²", a: "r = √(A/π)", type: "text", calculator: false },
  ],
  A14: [
    { q: "Find the gradient of the line joining (0, 2) and (3, 8)", a: "2", type: "number", calculator: false },
    { q: "A line has equation y = 4x - 3. What is its gradient?", type: "mcq", options: ["-3", "3", "4", "-4"], a: "4", calculator: false },
    { q: "Find the y-intercept of y = 2x + 7", a: "7", type: "number", calculator: false },
  ],
  A17: [
    { q: "Solve: 3x + 7 = 22", a: "5", type: "number", calculator: false },
    { q: "Solve: 2(x - 3) = 10", a: "8", type: "number", calculator: false },
    { q: "Solve: 5x - 3 = 2x + 9", a: "4", type: "number", calculator: false },
    { q: "What is x if 4x + 1 = 17?", type: "mcq", options: ["3", "4", "4.5", "5"], a: "4", calculator: false },
  ],
  A18: [
    { q: "Solve: x² = 49 (positive solution)", a: "7", type: "number", calculator: false },
    { q: "Solve: x² - 5x + 6 = 0 (smaller solution)", a: "2", type: "number", calculator: false },
    { q: "What are the solutions to x² = 25?", type: "mcq", options: ["5", "-5", "±5", "±25"], a: "±5", calculator: false },
  ],
  A19: [
    { q: "Solve: 2x + y = 7 and x + y = 4. Find x.", a: "3", type: "number", calculator: false },
    { q: "Solve: x + y = 10 and x - y = 4. Find x.", a: "7", type: "number", calculator: false },
  ],
  A23: [
    { q: "Find the nth term: 5, 8, 11, 14, ...", a: "3n + 2", type: "text", calculator: false },
    { q: "Find the 10th term of: 4, 7, 10, 13, ...", a: "31", type: "number", calculator: false },
    { q: "A sequence has nth term 2n + 5. What is the 8th term?", type: "mcq", options: ["13", "16", "21", "24"], a: "21", calculator: false },
  ],
  
  // Ratio
  R3: [
    { q: "Work out 2/5 of 35", a: "14", type: "number", calculator: false },
    { q: "Find 3/8 of 56", a: "21", type: "number", calculator: false },
    { q: "What is 1/4 of 84?", type: "mcq", options: ["16", "20", "21", "24"], a: "21", calculator: false },
  ],
  R4: [
    { q: "Simplify the ratio 12:18", a: "2:3", type: "text", calculator: false },
    { q: "Write 3:5 in the form 1:n", a: "1:1.67", type: "text", hint: "Round to 2 d.p.", calculator: true },
    { q: "Simplify 24:36", type: "mcq", options: ["2:3", "4:6", "12:18", "3:4"], a: "2:3", calculator: false },
  ],
  R9: [
    { q: "Express 45 as a percentage of 180", a: "25", type: "number", calculator: true },
    { q: "What is 12 as a percentage of 60?", type: "mcq", options: ["12%", "15%", "20%", "25%"], a: "20%", calculator: true },
  ],
  R10: [
    { q: "A price increases from £80 to £92. Find the percentage increase.", a: "15", type: "number", calculator: true },
    { q: "A value decreases from 50 to 40. What is the percentage decrease?", type: "mcq", options: ["10%", "15%", "20%", "25%"], a: "20%", calculator: true },
  ],
  R12: [
    { q: "After a 20% decrease, a price is £64. What was the original price?", a: "80", type: "number", calculator: true },
    { q: "After a 25% increase, a price is £100. What was the original?", a: "80", type: "number", calculator: true },
  ],
  R2: [
    { q: "On a map, the scale is 1 cm : 5 km. Two towns are 6 cm apart on the map. What is the actual distance in km?", a: "30", type: "number", calculator: true, diagram: "scale-map-towns" },
    { q: "A model car is made at scale 1:50. The real car is 4 metres long. How long is the model in cm?", a: "8", type: "number", calculator: true },
    { q: "A map has scale 1:25000. Two points are 8 cm apart on the map. What is the real distance in km?", a: "2", type: "number", calculator: true },
    { q: "A plan is drawn at scale 1:200. A room is 6 cm long on the plan. What is the actual length in metres?", a: "12", type: "number", calculator: true },
    { q: "The scale on a map is 1 cm : 2 km. What is this as a ratio?", type: "mcq", options: ["1:200", "1:2000", "1:20000", "1:200000"], a: "1:200000", calculator: false },
  ],

  // Geometry
  G3: [
    { q: "Angles on a straight line sum to how many degrees?", type: "mcq", options: ["90°", "180°", "270°", "360°"], a: "180°", calculator: false },
    { q: "Angles around a point sum to how many degrees?", a: "360", type: "number", calculator: false },
  ],
  G4: [
    { q: "Two parallel lines are cut by a transversal. One angle is 70°. What is the corresponding angle?", a: "70", type: "number", diagram: "parallel", calculator: false },
    { q: "Alternate angles are:", type: "mcq", options: ["Always equal", "Add to 90°", "Add to 180°", "Never equal"], a: "Always equal", calculator: false },
  ],
  G5: [
    { q: "Find the exterior angle of a regular hexagon", a: "60", type: "number", calculator: false },
    { q: "Find the sum of interior angles of a pentagon", a: "540", type: "number", calculator: false },
    { q: "What is the interior angle of a regular hexagon?", type: "mcq", options: ["90°", "108°", "120°", "135°"], a: "120°", calculator: false },
  ],
  G14: [
    { q: "Find the area of a triangle with base 8cm and height 5cm", a: "20", type: "number", calculator: false },
    { q: "A triangle has area 24cm² and height 6cm. Find the base.", a: "8", type: "number", calculator: false },
  ],
  G15: [
    { q: "Find the area of a circle with radius 5 cm. Give your answer to 1 d.p.", a: "78.5", type: "number", hint: "Use π = 3.14", calculator: true },
    { q: "Find the circumference of a circle with diameter 10cm (to 1 d.p.)", a: "31.4", type: "number", calculator: true },
    { q: "The formula for circumference is:", type: "mcq", options: ["πr", "2πr", "πr²", "2πr²"], a: "2πr", calculator: false },
  ],
  G16: [
    { q: "Find the area of this sector. Give your answer in terms of π.", a: "24π", type: "text", diagram: "sector-60-degrees", calculator: false, hint: "Area = (θ/360) × πr²" },
    { q: "Find the arc length of this sector. Give your answer in terms of π.", a: "4π", type: "text", diagram: "sector-60-degrees", calculator: false, hint: "Arc length = (θ/360) × 2πr" },
    { q: "A sector has angle 90° and radius 8cm. Find the area in terms of π.", a: "16π", type: "text", calculator: false },
    { q: "The formula for arc length is:", type: "mcq", options: ["(θ/360) × πr²", "(θ/360) × 2πr", "(θ/180) × πr", "θ × r"], a: "(θ/360) × 2πr", calculator: false },
  ],
  G17: [
    { q: "Find the volume of this cone. Give your answer in terms of π.", a: "100π", type: "text", diagram: "cone-diagram", calculator: false, hint: "Volume = (1/3)πr²h" },
    { q: "Find the curved surface area of this cone. Give your answer in terms of π.", a: "65π", type: "text", diagram: "cone-diagram", calculator: false, hint: "Curved SA = πrl where l is slant height" },
    { q: "The formula for volume of a cone is:", type: "mcq", options: ["πr²h", "(1/2)πr²h", "(1/3)πr²h", "(2/3)πr²h"], a: "(1/3)πr²h", calculator: false },
  ],
  G19: [
    { q: "Find the value of x in this right-angled triangle. Give your answer to 1 decimal place.", a: "19.6", type: "number", diagram: "pythagoras-triangle", calculator: true, hint: "Use Pythagoras: x² + 24² = 31²" },
    { q: "Find the hypotenuse of a right-angled triangle with sides 3 cm and 4 cm", a: "5", type: "number", diagram: "pythagoras", calculator: false },
    { q: "A right triangle has hypotenuse 13 and one side 5. Find the other side.", a: "12", type: "number", calculator: true },
    { q: "In Pythagoras' theorem a² + b² = c², c is:", type: "mcq", options: ["Any side", "The shortest side", "The hypotenuse", "The base"], a: "The hypotenuse", calculator: false },
  ],
  G20: [
    { q: "In a right-angled triangle, the opposite side is 4 and the adjacent is 3. Find tan(θ) as a fraction.", a: "4/3", type: "text", diagram: "triangle", calculator: false },
    { q: "SOH CAH TOA: sin(θ) = ", type: "mcq", options: ["O/A", "A/H", "O/H", "H/O"], a: "O/H", calculator: false },
    { q: "Find sin(30°)", type: "mcq", options: ["1/2", "√2/2", "√3/2", "1"], a: "1/2", calculator: false },
  ],
  
  // Probability
  P4: [
    { q: "The probability of rain is 0.3. What is the probability of no rain?", a: "0.7", type: "text", calculator: false },
    { q: "P(A) = 0.45. What is P(not A)?", type: "mcq", options: ["0.45", "0.55", "0.65", "1.45"], a: "0.55", calculator: false },
  ],
  P8: [
    { q: "Using the tree diagram, find the probability of getting two gold cards. Give your answer as a decimal.", a: "0.0025", type: "number", diagram: "tree-diagram-gold", calculator: true, hint: "Multiply along the branches: 0.05 × 0.05" },
    { q: "Using the tree diagram, find P(at least one gold card). Give your answer as a decimal.", a: "0.0975", type: "number", diagram: "tree-diagram-gold", calculator: true, hint: "P(at least one) = 1 - P(none)" },
    { q: "A bag has 3 red and 2 blue balls. One is picked and replaced, then another is picked. Find P(both red) as a fraction.", a: "9/25", type: "text", calculator: false },
    { q: "Two coins are flipped. P(both heads) = ", type: "mcq", options: ["1/2", "1/3", "1/4", "1/8"], a: "1/4", calculator: false },
  ],
  
  // Statistics
  S2: [
    { q: "The pie chart shows votes in an election. Amy received 162°. If 180 people voted in total, how many voted for Amy?", a: "81", type: "number", diagram: "pie-chart-talent", calculator: true, hint: "162° out of 360° represents what fraction?" },
    { q: "What fraction of the total votes did Amy receive? Give your answer in simplest form.", a: "9/20", type: "text", diagram: "pie-chart-talent", calculator: false },
    { q: "Reading a pie chart: 90° represents what fraction of the total?", type: "mcq", options: ["1/2", "1/3", "1/4", "1/5"], a: "1/4", calculator: false },
  ],
  S5: [
    { q: "Find the mean of: 4, 7, 9, 12, 8", a: "8", type: "number", calculator: true },
    { q: "Find the median of: 3, 7, 2, 9, 5", a: "5", type: "number", calculator: false },
    { q: "Find the range of: 4, 8, 2, 11, 5", a: "9", type: "number", calculator: false },
    { q: "The mode is:", type: "mcq", options: ["The middle value", "The most common value", "The average", "The difference"], a: "The most common value", calculator: false },
  ],

  // Algebra with diagrams
  A9: [
    { q: "Points A, B and C lie on a straight line. Find the gradient of the line.", a: "-2", type: "number", diagram: "linear-graph-abc", calculator: false, hint: "Use gradient = change in y ÷ change in x" },
    { q: "Find the y-intercept of the line through A, B and C.", a: "1", type: "number", diagram: "linear-graph-abc", calculator: false },
    { q: "A straight line has gradient 3 and passes through (0, 2). Find its equation.", a: "y = 3x + 2", type: "text", calculator: false },
    { q: "What is the gradient of y = 5x - 3?", type: "mcq", options: ["5", "-3", "3", "-5"], a: "5", calculator: false },
  ],
  A18: [
    { q: "A circle has centre O at the origin. Point (0, 6) lies on the circle. What is the equation of the circle?", a: "x² + y² = 36", type: "text", diagram: "circle-equation", calculator: false },
    { q: "The point (3, 4) lies on a circle centred at the origin. Find the radius.", a: "5", type: "number", calculator: false, hint: "Use r² = x² + y²" },
    { q: "Which point lies on the circle x² + y² = 25?", type: "mcq", options: ["(3, 3)", "(4, 3)", "(3, 4)", "(4, 4)"], a: "(3, 4)", calculator: false },
  ],

  // Geometry with diagrams
  G7: [
    { q: "Describe fully the single transformation that maps shape A onto shape B.", a: "Rotation 180° about the origin", type: "text", diagram: "transformation-grid", calculator: false },
    { q: "Which transformation keeps the shape the same size?", type: "mcq", options: ["Enlargement", "Rotation", "Stretch", "Scale factor 2"], a: "Rotation", calculator: false },
    { q: "A shape is reflected in the y-axis. Point (3, 5) maps to:", type: "mcq", options: ["(-3, 5)", "(3, -5)", "(-3, -5)", "(5, 3)"], a: "(-3, 5)", calculator: false },
  ],

  // Probability with diagrams
  P6: [
    { q: "In a group of 30 students, 18 study German (G), 15 study Latin (L), and 8 study both. How many study neither?", a: "5", type: "number", diagram: "venn-diagram-gl", calculator: false, hint: "Use: n(G∪L) = n(G) + n(L) - n(G∩L)" },
    { q: "Using the Venn diagram context: Find the number who study German only.", a: "10", type: "number", diagram: "venn-diagram-gl", calculator: false },
    { q: "In a Venn diagram, the intersection shows:", type: "mcq", options: ["Neither A nor B", "A or B", "A and B", "Only A"], a: "A and B", calculator: false },
  ],
};

// Exam-style questions - harder, multi-step problems for mastery
const examQuestions = {
  N1: [
    { q: "Put in order from smallest to largest: 0.7̇, 0.77, 0.707, 0.7̇0̇7̇. Show your working.", a: "0.707, 0.7̇0̇7̇, 0.7̇, 0.77", type: "text", calculator: false, marks: 3 },
  ],
  N2: [
    { q: "Calculate: (-3)² × (-2) + 18 ÷ (-3)", a: "-24", type: "number", calculator: false, marks: 3 },
  ],
  N5: [
    { q: "Work out: 4² + 3 × (8 - 2) ÷ 2", a: "25", type: "number", calculator: false, marks: 3 },
  ],
  N6: [
    { q: "Find the value of √(64 + 36) × 2³", a: "80", type: "number", calculator: false, marks: 3 },
  ],
  N8: [
    { q: "Find the HCF and LCM of 60 and 84. Use prime factorisation.", a: "HCF=12, LCM=420", type: "text", calculator: false, marks: 4 },
  ],
  N10: [
    { q: "Write 0.36̇ as a fraction in its simplest form. Show your working.", a: "11/30", type: "text", calculator: false, marks: 3 },
  ],
  N12: [
    { q: "A shop reduces prices by 15%. A jacket now costs £68. What was the original price?", a: "80", type: "number", calculator: true, marks: 3 },
  ],
  A4: [
    { q: "Expand and simplify: (2x + 3)(x - 4) + 5x", a: "2x² + 2x - 12", type: "text", calculator: false, marks: 3 },
  ],
  A6: [
    { q: "Make t the subject of: v = u + at", a: "t = (v - u)/a", type: "text", calculator: false, marks: 2 },
  ],
  A14: [
    { q: "A quadratic y = x² - 4x + 3 crosses the x-axis at two points. Find both x values.", a: "x = 1 and x = 3", type: "text", calculator: false, marks: 3 },
  ],
  A17: [
    { q: "Solve: 3(2x - 1) = 4x + 9", a: "6", type: "number", calculator: false, marks: 3 },
  ],
  R3: [
    { q: "John earns £2400 per month. He spends 2/5 on rent and 1/6 on food. How much is left?", a: "1040", type: "number", calculator: true, marks: 4 },
  ],
  R4: [
    { q: "Share £270 in the ratio 2:3:4", a: "£60, £90, £120", type: "text", calculator: true, marks: 3 },
  ],
  R10: [
    { q: "A house value increases by 8% in Year 1, then decreases by 5% in Year 2. If it's now worth £308,880, what was the original value?", a: "301000", type: "number", calculator: true, marks: 4 },
  ],
  G3: [
    { q: "Three angles meet at a point. Two are 127° and 85°. Find the third angle.", a: "148", type: "number", calculator: false, marks: 2 },
  ],
  G5: [
    { q: "A regular polygon has interior angles of 156°. How many sides does it have?", a: "15", type: "number", calculator: true, marks: 3 },
  ],
  G14: [
    { q: "A triangle has vertices at (1,2), (5,2) and (3,6). Find its area.", a: "8", type: "number", calculator: false, marks: 3 },
  ],
  G15: [
    { q: "A circle has circumference 31.4cm. Find its area to 1 d.p.", a: "78.5", type: "number", calculator: true, marks: 3 },
  ],
  G19: [
    { q: "A ladder of length 5m leans against a wall. The foot is 1.5m from the wall. How high up the wall does it reach? Give your answer to 2 d.p.", a: "4.77", type: "number", calculator: true, marks: 3 },
  ],
  G20: [
    { q: "From a point 50m from a tower, the angle of elevation to the top is 32°. Find the height of the tower to 1 d.p.", a: "31.2", type: "number", calculator: true, marks: 3 },
  ],
  P4: [
    { q: "P(A) = 0.4 and P(B) = 0.3. If A and B are independent, find P(A and B).", a: "0.12", type: "number", calculator: true, marks: 2 },
  ],
  P8: [
    { q: "A bag contains 4 red and 6 blue balls. Two are picked without replacement. Find P(both red) as a fraction.", a: "2/15", type: "text", calculator: false, marks: 3 },
  ],
  S5: [
    { q: "The mean of 5 numbers is 12. Four of the numbers are 8, 10, 14, and 15. Find the fifth number.", a: "13", type: "number", calculator: true, marks: 3 },
  ],
};

// Worked examples with step-by-step solutions
const workedExamples = {
  N5: {
    title: "Order of Operations (BIDMAS)",
    steps: [
      "1. Look for Brackets first - calculate anything inside them",
      "2. Next, calculate any Indices (powers/roots)",
      "3. Then Division and Multiplication (left to right)",
      "4. Finally Addition and Subtraction (left to right)"
    ],
    example: {
      q: "Calculate: 3 + 4 × 2",
      solution: [
        "Step 1: No brackets or indices",
        "Step 2: Do multiplication first: 4 × 2 = 8",
        "Step 3: Then addition: 3 + 8 = 11",
        "Answer: 11"
      ]
    },
    examTip: "Always show your working. Write out each step to get method marks even if your final answer is wrong."
  },
  N8: {
    title: "HCF and LCM",
    steps: [
      "1. HCF (Highest Common Factor): List factors of each number, find the largest shared one",
      "2. LCM (Lowest Common Multiple): List multiples until you find the first shared one",
      "3. Or use prime factorisation for larger numbers"
    ],
    example: {
      q: "Find the HCF of 24 and 36",
      solution: [
        "Factors of 24: 1, 2, 3, 4, 6, 8, 12, 24",
        "Factors of 36: 1, 2, 3, 4, 6, 9, 12, 18, 36",
        "Common factors: 1, 2, 3, 4, 6, 12",
        "HCF = 12 (the highest)"
      ]
    },
    examTip: "For HCF/LCM questions with large numbers, use prime factor trees - it's more reliable than listing."
  },
  A17: {
    title: "Solving Linear Equations",
    steps: [
      "1. Expand any brackets first",
      "2. Collect like terms on each side",
      "3. Get all x terms on one side, numbers on the other",
      "4. Divide to find x"
    ],
    example: {
      q: "Solve: 3x + 7 = 22",
      solution: [
        "Step 1: Subtract 7 from both sides",
        "3x + 7 - 7 = 22 - 7",
        "3x = 15",
        "Step 2: Divide both sides by 3",
        "x = 15 ÷ 3 = 5"
      ]
    },
    examTip: "Write '= ...' at the start of each new line. Examiners want to see the equation balanced at every step."
  },
  G5: {
    title: "Angles in Polygons",
    steps: [
      "1. Exterior angles of ANY polygon sum to 360°",
      "2. For regular polygons: exterior angle = 360° ÷ n (where n = number of sides)",
      "3. Interior angle = 180° - exterior angle",
      "4. Sum of interior angles = (n - 2) × 180°"
    ],
    example: {
      q: "Find the exterior angle of a regular hexagon",
      solution: [
        "A hexagon has 6 sides",
        "Exterior angle = 360° ÷ 6",
        "= 60°"
      ]
    },
    examTip: "Learn the formula (n-2) × 180° for interior angle sum - it comes up almost every year!"
  },
  G19: {
    title: "Pythagoras' Theorem",
    steps: [
      "1. Identify the hypotenuse (longest side, opposite the right angle)",
      "2. Use a² + b² = c² where c is the hypotenuse",
      "3. To find hypotenuse: c = √(a² + b²)",
      "4. To find a shorter side: a = √(c² - b²)"
    ],
    example: {
      q: "Find the hypotenuse when sides are 3cm and 4cm",
      solution: [
        "a² + b² = c²",
        "3² + 4² = c²",
        "9 + 16 = c²",
        "25 = c²",
        "c = √25 = 5cm"
      ]
    },
    examTip: "3-4-5 and 5-12-13 are common Pythagorean triples. Recognising them saves calculation time!"
  },
  R10: {
    title: "Percentage Change",
    steps: [
      "1. Find the actual change (new - original)",
      "2. Divide by the original amount",
      "3. Multiply by 100 to get percentage",
      "4. Formula: (change ÷ original) × 100"
    ],
    example: {
      q: "Price increases from £80 to £92. Find the percentage increase.",
      solution: [
        "Change = 92 - 80 = £12",
        "Percentage = (12 ÷ 80) × 100",
        "= 0.15 × 100",
        "= 15%"
      ]
    },
    examTip: "Always divide by the ORIGINAL value, not the new one. This is the most common mistake!"
  },
  S5: {
    title: "Averages",
    steps: [
      "Mean = sum of all values ÷ number of values",
      "Median = middle value when ordered (or mean of middle two)",
      "Mode = most frequent value",
      "Range = highest - lowest (not an average!)"
    ],
    example: {
      q: "Find the mean of: 4, 7, 9, 12, 8",
      solution: [
        "Sum = 4 + 7 + 9 + 12 + 8 = 40",
        "Count = 5 values",
        "Mean = 40 ÷ 5 = 8"
      ]
    },
    examTip: "For median, ALWAYS order the data first. With an even count, find the mean of the middle two."
  },
};

// Exam technique tips by topic
const examTips = {
  Number: "Show all working clearly. Write intermediate steps - you get method marks even with a wrong answer.",
  Algebra: "Always check your answer by substituting back into the original equation.",
  Ratio: "Keep ratios in the same order as the question. Label your working (e.g., 'Ali : Ben').",
  Geometry: "Draw diagrams if none given. Mark known angles and sides. State angle rules you use.",
  Probability: "Give probabilities as fractions unless told otherwise. Check they're between 0 and 1.",
  Statistics: "Order data for median. State which average you're using. Range is NOT an average.",
};

// ==================== DIAGNOSTIC AI SCAFFOLDING ====================

// Prerequisite mappings - what simpler skill is needed for each objective
const prerequisites = {
  // Algebra prerequisites
  A18: 'A17', // Quadratics need linear equations first
  A19: 'A17', // Simultaneous equations need linear equations
  A6: 'A4',   // Rearranging formulas needs expanding/factorising
  A25: 'A23', // Quadratic sequences need linear sequences
  
  // Number prerequisites
  N8: 'N6',   // HCF/LCM needs understanding of factors (powers/roots)
  N16: 'N15', // Error intervals need rounding
  N14: 'N15', // Estimation needs rounding
  N2: 'N1',   // Negative numbers need number ordering
  N5: 'N2',   // BIDMAS often trips on negatives
  
  // Ratio prerequisites
  R12: 'R10', // Reverse percentages need percentage change
  R10: 'N12', // Percentage change needs percentages of amounts
  R16: 'R10', // Compound interest needs percentage change
  
  // Geometry prerequisites
  G19: 'N6',  // Pythagoras needs squares and roots
  G20: 'G19', // Trigonometry needs Pythagoras understanding
  G22: 'G20', // Sine rule needs basic trig
  G5: 'G3',   // Polygon angles need basic angle facts
  
  // Statistics prerequisites
  S5: 'N12',  // Mean calculation needs fractions/percentages
};

// ==================== 60-SECOND MINI-LESSONS ====================
// Each lesson has: title, keyPoints (3-4 bullet points), example, commonMistakes, quickTip

const miniLessons = {
  N2: {
    title: "Negative Numbers",
    duration: 60,
    keyPoints: [
      "Negative × Negative = Positive (−3 × −2 = +6)",
      "Negative × Positive = Negative (−3 × 2 = −6)",
      "Subtracting a negative is the same as adding (5 − (−3) = 5 + 3 = 8)",
      "On a number line, negatives are LEFT of zero"
    ],
    example: {
      problem: "Calculate: −4 × −5",
      steps: ["Both numbers are negative", "Negative × Negative = Positive", "4 × 5 = 20", "Answer: +20"],
      answer: "20"
    },
    commonMistakes: [
      "Forgetting that two negatives make a positive",
      "Confusing subtraction with negative numbers"
    ],
    quickTip: "🎯 Remember: SAME signs = Positive, DIFFERENT signs = Negative",
    practiceQ: { q: "What is −6 × −3?", a: "18", type: "number" }
  },
  
  N6: {
    title: "Squares, Cubes & Roots",
    duration: 60,
    keyPoints: [
      "Square: multiply a number by itself (5² = 5 × 5 = 25)",
      "Cube: multiply a number by itself three times (2³ = 2 × 2 × 2 = 8)",
      "Square root: what number × itself gives this? (√25 = 5)",
      "Learn these: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144"
    ],
    example: {
      problem: "Find √81 + 2³",
      steps: ["√81 = 9 (because 9 × 9 = 81)", "2³ = 2 × 2 × 2 = 8", "9 + 8 = 17"],
      answer: "17"
    },
    commonMistakes: [
      "Thinking √16 = 8 (it's 4, because 4×4=16)",
      "Confusing 3² (=9) with 2³ (=8)"
    ],
    quickTip: "🎯 Square root UNDOES squaring: √(5²) = √25 = 5",
    practiceQ: { q: "What is 4² + √49?", a: "23", type: "number" }
  },
  
  N12: {
    title: "Percentages of Amounts",
    duration: 60,
    keyPoints: [
      "10% = divide by 10 (10% of 80 = 8)",
      "1% = divide by 100 (1% of 200 = 2)",
      "50% = half, 25% = quarter",
      "To find any %, find 10% or 1% first, then multiply"
    ],
    example: {
      problem: "Find 15% of £80",
      steps: ["10% of £80 = £8", "5% = half of 10% = £4", "15% = 10% + 5% = £8 + £4 = £12"],
      answer: "£12"
    },
    commonMistakes: [
      "Multiplying by 15 instead of 0.15",
      "Forgetting to move the decimal point"
    ],
    quickTip: "🎯 15% = 0.15 as a decimal. Always divide the percentage by 100!",
    practiceQ: { q: "What is 20% of 60?", a: "12", type: "number" }
  },
  
  N15: {
    title: "Rounding Numbers",
    duration: 60,
    keyPoints: [
      "Look at the digit AFTER the place you're rounding to",
      "If it's 5 or more, round UP",
      "If it's 4 or less, round DOWN",
      "1 d.p. = one digit after decimal, 2 d.p. = two digits"
    ],
    example: {
      problem: "Round 3.847 to 2 decimal places",
      steps: ["Look at 2nd decimal place: 4", "Look at NEXT digit: 7", "7 ≥ 5, so round UP", "3.847 → 3.85"],
      answer: "3.85"
    },
    commonMistakes: [
      "Looking at the wrong digit",
      "Rounding 3.45 to 3.4 (should be 3.5 - the 5 rounds up!)"
    ],
    quickTip: "🎯 Circle the digit you're rounding, underline the next one, then decide!",
    practiceQ: { q: "Round 7.863 to 1 decimal place", a: "7.9", type: "text" }
  },
  
  A4: {
    title: "Expanding Brackets",
    duration: 60,
    keyPoints: [
      "Multiply EVERYTHING inside the bracket by the number outside",
      "2(x + 3) means 2 × x AND 2 × 3",
      "Watch out for negative signs: −2(x − 1) = −2x + 2",
      "Two brackets: use FOIL (First, Outside, Inside, Last)"
    ],
    example: {
      problem: "Expand: 3(2x + 5)",
      steps: ["3 × 2x = 6x", "3 × 5 = 15", "Put together: 6x + 15"],
      answer: "6x + 15"
    },
    commonMistakes: [
      "Only multiplying the first term: 3(2x + 5) ≠ 6x + 5",
      "Sign errors with negatives"
    ],
    quickTip: "🎯 Draw arrows from the outside number to EACH term inside!",
    practiceQ: { q: "Expand: 4(x + 2)", a: "4x + 8", type: "text" }
  },
  
  A17: {
    title: "Solving Linear Equations",
    duration: 60,
    keyPoints: [
      "Goal: get x on its own on one side",
      "Whatever you do to one side, do to the other",
      "Undo operations in reverse order (SADMEP - opposite of BIDMAS)",
      "Addition undoes subtraction, multiplication undoes division"
    ],
    example: {
      problem: "Solve: 3x + 7 = 22",
      steps: ["Subtract 7 from both sides: 3x = 15", "Divide both sides by 3: x = 5", "Check: 3(5) + 7 = 15 + 7 = 22 ✓"],
      answer: "x = 5"
    },
    commonMistakes: [
      "Subtracting from only one side",
      "Dividing only the number, not the whole side"
    ],
    quickTip: "🎯 Always check your answer by substituting back into the original!",
    practiceQ: { q: "Solve: 2x + 4 = 12", a: "4", type: "number" }
  },
  
  A23: {
    title: "Linear Sequences",
    duration: 60,
    keyPoints: [
      "Find the common difference (what's added each time)",
      "nth term = dn + (a - d) where d = difference, a = first term",
      "Or: nth term = difference × n + zero term",
      "The zero term is what comes BEFORE the first term"
    ],
    example: {
      problem: "Find the nth term: 3, 7, 11, 15, ...",
      steps: ["Difference = 4 (add 4 each time)", "Zero term = 3 - 4 = -1", "nth term = 4n + (-1) = 4n - 1", "Check: n=1: 4(1)-1=3 ✓"],
      answer: "4n - 1"
    },
    commonMistakes: [
      "Using the first term instead of zero term",
      "Getting the sign wrong on the constant"
    ],
    quickTip: "🎯 The number in front of n is ALWAYS the common difference!",
    practiceQ: { q: "Find the 5th term: 2, 5, 8, 11, ...", a: "14", type: "number" }
  },
  
  R10: {
    title: "Percentage Change",
    duration: 60,
    keyPoints: [
      "Formula: (Change ÷ Original) × 100",
      "Change = New value − Original value",
      "Always divide by the ORIGINAL, not the new value",
      "Positive = increase, Negative = decrease"
    ],
    example: {
      problem: "Price rises from £80 to £92. Find % increase.",
      steps: ["Change = £92 - £80 = £12", "% change = (12 ÷ 80) × 100", "= 0.15 × 100 = 15%"],
      answer: "15%"
    },
    commonMistakes: [
      "Dividing by the new value instead of original",
      "Forgetting to multiply by 100"
    ],
    quickTip: "🎯 Original goes on the BOTTOM of the fraction!",
    practiceQ: { q: "Price drops from £50 to £40. What's the % decrease?", a: "20", type: "number" }
  },
  
  G3: {
    title: "Angle Facts",
    duration: 60,
    keyPoints: [
      "Angles on a straight line = 180°",
      "Angles around a point = 360°",
      "Vertically opposite angles are EQUAL",
      "Angles in a triangle = 180°"
    ],
    example: {
      problem: "Two angles on a straight line are x and 130°. Find x.",
      steps: ["Angles on straight line = 180°", "x + 130° = 180°", "x = 180° - 130° = 50°"],
      answer: "50°"
    },
    commonMistakes: [
      "Using 360° for a straight line (it's 180°!)",
      "Forgetting that 'vertically opposite' means equal"
    ],
    quickTip: "🎯 Straight line = 180° (half turn), Full turn = 360°",
    practiceQ: { q: "Angles on a straight line: 65° and x°. Find x.", a: "115", type: "number" }
  },
  
  G19: {
    title: "Pythagoras' Theorem",
    duration: 60,
    keyPoints: [
      "Only works in RIGHT-ANGLED triangles",
      "a² + b² = c² (c is always the HYPOTENUSE - longest side)",
      "To find hypotenuse: √(a² + b²)",
      "To find shorter side: √(c² - a²)"
    ],
    example: {
      problem: "Find the hypotenuse when a = 3, b = 4",
      steps: ["c² = a² + b²", "c² = 3² + 4² = 9 + 16 = 25", "c = √25 = 5"],
      answer: "5"
    },
    commonMistakes: [
      "Adding without squaring: 3 + 4 = 7 ✗",
      "Forgetting to square root at the end"
    ],
    quickTip: "🎯 Remember 3-4-5 and 5-12-13 - these are common Pythagorean triples!",
    practiceQ: { q: "Find c when a = 6 and b = 8", a: "10", type: "number" }
  },
  
  G20: {
    title: "Basic Trigonometry (SOH CAH TOA)",
    duration: 60,
    keyPoints: [
      "SOH: sin θ = Opposite / Hypotenuse",
      "CAH: cos θ = Adjacent / Hypotenuse",
      "TOA: tan θ = Opposite / Adjacent",
      "Label sides from the angle you're using (not the right angle!)"
    ],
    example: {
      problem: "Find sin θ if opposite = 3, hypotenuse = 5",
      steps: ["SOH: sin θ = Opposite / Hypotenuse", "sin θ = 3/5", "sin θ = 0.6"],
      answer: "0.6 or 3/5"
    },
    commonMistakes: [
      "Labeling sides from the wrong angle",
      "Using the wrong ratio (e.g., tan when you need sin)"
    ],
    quickTip: "🎯 SOH CAH TOA - say it out loud! Some Old Hag Caught A Hippie Tripping On Acid 😄",
    practiceQ: { q: "If opposite = 4 and adjacent = 3, what is tan θ as a fraction?", a: "4/3", type: "text" }
  },
  
  N5: {
    title: "Order of Operations (BIDMAS)",
    duration: 60,
    keyPoints: [
      "B - Brackets first ()",
      "I - Indices (powers) second",
      "DM - Division & Multiplication (left to right)",
      "AS - Addition & Subtraction (left to right)"
    ],
    example: {
      problem: "Calculate: 3 + 4 × 2",
      steps: ["No brackets or indices", "Do multiplication first: 4 × 2 = 8", "Then addition: 3 + 8 = 11", "NOT (3+4) × 2 = 14!"],
      answer: "11"
    },
    commonMistakes: [
      "Going left to right instead of following BIDMAS",
      "Forgetting that × and ÷ come before + and −"
    ],
    quickTip: "🎯 Circle all × and ÷ first, do those, THEN do + and −",
    practiceQ: { q: "Calculate: 10 - 2 × 3", a: "4", type: "number" }
  },
  
  N8: {
    title: "HCF and LCM",
    duration: 60,
    keyPoints: [
      "HCF = Highest Common Factor (biggest number that divides BOTH)",
      "LCM = Lowest Common Multiple (smallest number BOTH divide into)",
      "Use prime factorisation for big numbers",
      "HCF: multiply common primes. LCM: multiply ALL primes (highest powers)"
    ],
    example: {
      problem: "Find HCF and LCM of 12 and 18",
      steps: ["12 = 2² × 3", "18 = 2 × 3²", "HCF = 2 × 3 = 6 (common primes, lowest powers)", "LCM = 2² × 3² = 36 (all primes, highest powers)"],
      answer: "HCF = 6, LCM = 36"
    },
    commonMistakes: [
      "Mixing up HCF and LCM",
      "Finding factors when you need multiples"
    ],
    quickTip: "🎯 HCF is smaller (factor), LCM is bigger (multiple). HCF × LCM = product of the two numbers!",
    practiceQ: { q: "What is the HCF of 16 and 24?", a: "8", type: "number" }
  },
};

// Error patterns that suggest specific prerequisite weaknesses
const errorToPrerequisite = {
  // Sign errors suggest negative number issues
  signError: 'N2',
  // Factor of 10 errors suggest percentage/decimal issues
  factorOf10: 'N12',
  // BIDMAS errors
  leftToRight: 'N5',
  // Pythagoras errors
  noSquare: 'G19',
  noRoot: 'N6',
  // Equation solving errors
  wrongOperation: 'A17',
};

// Building block questions - simpler versions to build foundation
const buildingBlocks = {
  A17: [
    { q: "Solve: x + 5 = 12", a: "7", type: "number", scaffold: true, hint: "Subtract 5 from both sides" },
    { q: "Solve: 2x = 10", a: "5", type: "number", scaffold: true, hint: "Divide both sides by 2" },
    { q: "If x + 3 = 8, what is x?", a: "5", type: "number", scaffold: true },
  ],
  A4: [
    { q: "Expand: 2(x + 3)", a: "2x + 6", type: "text", scaffold: true, hint: "Multiply 2 by each term inside" },
    { q: "Simplify: 3x + 2x", a: "5x", type: "text", scaffold: true },
  ],
  A23: [
    { q: "What is the next number: 2, 4, 6, 8, ...", a: "10", type: "number", scaffold: true },
    { q: "Find the pattern: 5, 10, 15, 20, ... What's added each time?", a: "5", type: "number", scaffold: true },
  ],
  N2: [
    { q: "What is −3 × −4?", a: "12", type: "number", scaffold: true, hint: "Negative × Negative = Positive" },
    { q: "What is −10 + 6?", a: "-4", type: "number", scaffold: true },
    { q: "What is 5 − (−3)?", a: "8", type: "number", scaffold: true, hint: "Subtracting a negative = adding" },
  ],
  N5: [
    { q: "Calculate: 2 + 3 × 4", a: "14", type: "number", scaffold: true, hint: "Multiplication before addition" },
    { q: "Calculate: 20 ÷ 4 + 1", a: "6", type: "number", scaffold: true },
  ],
  N6: [
    { q: "What is 5²?", a: "25", type: "number", scaffold: true, hint: "5 × 5" },
    { q: "What is √36?", a: "6", type: "number", scaffold: true, hint: "What number times itself = 36?" },
    { q: "Calculate: 3²", a: "9", type: "number", scaffold: true },
  ],
  N8: [
    { q: "What is the HCF of 8 and 12?", a: "4", type: "number", scaffold: true },
    { q: "What is the LCM of 3 and 4?", a: "12", type: "number", scaffold: true },
  ],
  N12: [
    { q: "What is 10% of 50?", a: "5", type: "number", scaffold: true, hint: "Divide by 10" },
    { q: "What is 50% of 20?", a: "10", type: "number", scaffold: true, hint: "Half of the number" },
    { q: "Find 25% of 40", a: "10", type: "number", scaffold: true, hint: "Quarter of the number" },
  ],
  N15: [
    { q: "Round 3.7 to the nearest whole number", a: "4", type: "number", scaffold: true },
    { q: "Round 12.34 to 1 decimal place", a: "12.3", type: "text", scaffold: true },
  ],
  R10: [
    { q: "A price goes from £10 to £12. What is the increase?", a: "2", type: "number", scaffold: true },
    { q: "If something costs £20 and increases by £5, what's the new price?", a: "25", type: "number", scaffold: true },
  ],
  G3: [
    { q: "If one angle on a straight line is 60°, what is the other?", a: "120", type: "number", scaffold: true, hint: "Angles on a straight line = 180°" },
    { q: "Two angles add up to 90°. One is 30°. What's the other?", a: "60", type: "number", scaffold: true },
  ],
  G19: [
    { q: "In a right triangle, if a = 3 and b = 4, what is a² + b²?", a: "25", type: "number", scaffold: true, hint: "Calculate 9 + 16" },
  ],
  G20: [
    { q: "In SOH CAH TOA, what does the 'O' stand for?", a: "Opposite", type: "text", scaffold: true },
    { q: "If opposite = 6 and hypotenuse = 10, what is sin θ as a decimal?", a: "0.6", type: "text", scaffold: true },
  ],
};

// ==================== FORGIVING ANSWER CHECKER ====================

// Parse a fraction string like "3/4" or "1/2" into a decimal
const parseFraction = (str) => {
  const fractionMatch = str.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    if (den !== 0) return num / den;
  }
  return null;
};

// Parse mixed number like "1 1/2" or "2 3/4"
const parseMixedNumber = (str) => {
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
const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[−–—]/g, '-') // Normalize different minus signs
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/°/g, '')
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
  
  const userNorm = normalizeString(userAnswer);
  const correctNorm = normalizeString(correctAnswer);
  
  // Exact match after normalization
  if (userNorm === correctNorm) return true;
  
  // Try numeric comparison
  const userNum = extractNumber(userAnswer);
  const correctNum = extractNumber(correctAnswer);
  if (numbersEquivalent(userNum, correctNum)) return true;
  
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
  
  // Handle percentage as decimal (when answer has %)
  if (correctAnswer.includes('%')) {
    const correctPct = parseFloat(correctAnswer.replace('%', ''));
    if (!isNaN(correctPct)) {
      // User might enter as decimal (15% -> 0.15) or just number (15)
      if (numbersEquivalent(userNum, correctPct)) return true;
      if (numbersEquivalent(userNum, correctPct / 100)) return true;
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

// AI tutor diagnosis using Claude API
const diagnoseErrorWithAI = async (question, userAnswer, objective, correctAnswer) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `You are a friendly GCSE maths tutor helping a student who just got a question wrong.

Question: ${question.q}
Student's answer: ${userAnswer}
Correct answer: ${correctAnswer}
Topic: ${objective.topic} (${objective.code}: ${objective.title || ''})

Analyze their specific mistake and respond in this exact JSON format:
{
  "diagnosis": "One sentence explaining what specific mistake they made (e.g., 'You calculated left-to-right instead of following BIDMAS - multiplication should come before addition.')",
  "tip": "One practical tip to fix this (e.g., 'Try circling all the × and ÷ signs first, then do those before + and -')",
  "encouragement": "A brief encouraging word (e.g., 'This is a really common mistake - you're nearly there!')"
}

Be specific about THEIR error, not generic. If you can identify exactly what they did wrong, explain it. Keep it supportive and age-appropriate for a 14-16 year old.`
          }
        ],
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        hasDiagnosis: true,
        diagnosis: parsed.diagnosis,
        tip: parsed.tip,
        encouragement: parsed.encouragement,
        isAI: true,
      };
    }
  } catch (error) {
    console.log('AI diagnosis unavailable, using fallback:', error);
  }
  
  // Fallback to quick pattern detection if AI fails
  return quickDiagnosis(question, userAnswer, correctAnswer);
};

// Fast fallback diagnosis (no API call)
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

// Function to get a building block question
const getBuildingBlock = (objectiveCode) => {
  // First check for direct prerequisite
  const prereqCode = prerequisites[objectiveCode];
  
  if (prereqCode && buildingBlocks[prereqCode]) {
    const blocks = buildingBlocks[prereqCode];
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    return {
      ...block,
      prerequisiteFor: objectiveCode,
      prerequisiteCode: prereqCode,
    };
  }
  
  // Check if there are building blocks for this objective directly
  if (buildingBlocks[objectiveCode]) {
    const blocks = buildingBlocks[objectiveCode];
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    return {
      ...block,
      prerequisiteFor: objectiveCode,
      prerequisiteCode: objectiveCode,
    };
  }
  
  return null;
};

// Generate diagram HTML - uses PNG images for AQA-style diagrams
const generateDiagram = (type) => {
  // Image-based diagrams (AQA exam style)
  const imageDiagrams = {
    'cone-diagram': 'cone-diagram.png',
    'pythagoras-triangle': 'pythagoras-triangle.png',
    'transformation-grid': 'transformation-grid.png',
    'linear-graph-abc': 'linear-graph-abc.png',
    'circle-equation': 'circle-equation.png',
    'venn-diagram-gl': 'venn-diagram-gl.png',
    'tree-diagram-gold': 'tree-diagram-gold.png',
    'pie-chart-talent': 'pie-chart-talent.png',
    'sector-60-degrees': 'sector-60-degrees.png',
    'scale-map-towns': 'scale-map-towns.png',
  };

  // Check for image-based diagram first
  if (imageDiagrams[type]) {
    return `<img src="/images/${imageDiagrams[type]}" alt="${type}" class="max-w-full h-auto max-h-64 mx-auto rounded-lg" />`;
  }

  // Fallback SVG diagrams for legacy questions
  const svgDiagrams = {
    parallel: `<svg viewBox="0 0 200 120" class="w-full h-32">
      <line x1="20" y1="30" x2="180" y2="30" stroke="#64748b" stroke-width="2"/>
      <line x1="20" y1="90" x2="180" y2="90" stroke="#64748b" stroke-width="2"/>
      <line x1="50" y1="10" x2="150" y2="110" stroke="#7c3aed" stroke-width="2"/>
      <text x="70" y="45" fill="#7c3aed" font-size="14">70°</text>
      <text x="110" y="85" fill="#64748b" font-size="14">?</text>
    </svg>`,
    pythagoras: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 30,30" fill="none" stroke="#64748b" stroke-width="2"/>
      <rect x="30" y="110" width="10" height="10" fill="none" stroke="#64748b"/>
      <text x="90" y="140" fill="#64748b" font-size="14">4 cm</text>
      <text x="10" y="80" fill="#64748b" font-size="14">3 cm</text>
      <text x="100" y="70" fill="#7c3aed" font-size="14">?</text>
    </svg>`,
    triangle: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 170,30" fill="none" stroke="#64748b" stroke-width="2"/>
      <rect x="160" y="110" width="10" height="10" fill="none" stroke="#64748b"/>
      <text x="90" y="140" fill="#64748b" font-size="14">adj = 3</text>
      <text x="175" y="80" fill="#64748b" font-size="14">opp = 4</text>
      <text x="40" y="110" fill="#7c3aed" font-size="14">θ</text>
    </svg>`,
  };
  return svgDiagrams[type] || null;
};

// Spaced repetition intervals (in milliseconds)
const INTERVALS = {
  initial: 10 * 60 * 1000,        // 10 minutes
  level1: 24 * 60 * 60 * 1000,    // 1 day
  level2: 3 * 24 * 60 * 60 * 1000, // 3 days
  level3: 7 * 24 * 60 * 60 * 1000, // 7 days
  level4: 21 * 24 * 60 * 60 * 1000, // 21 days
  wrong: 2 * 60 * 1000,           // 2 minutes
};

const getNextDueTime = (streak, isCorrect) => {
  if (!isCorrect) return Date.now() + INTERVALS.wrong;
  const intervals = [INTERVALS.initial, INTERVALS.level1, INTERVALS.level2, INTERVALS.level3, INTERVALS.level4];
  return Date.now() + (intervals[Math.min(streak, 4)] || INTERVALS.level4);
};

const isDue = (progress) => {
  if (!progress?.nextDue) return true;
  return Date.now() >= progress.nextDue;
};

const isMastered = (progress) => progress?.examPassed === true && (progress?.quickCorrect ?? 0) >= 4;

// Build session queue with FSRS-based spaced repetition + discriminative interleaving
const buildSessionQueue = (allObjectives, progress, count = 5, sessionCount = 0) => {
  const now = Date.now();
  const fsrsData = loadFsrsData();

  // Session structure configuration
  const SESSION_STRUCTURE = {
    warmUp: 1,      // Easy questions to build confidence
    challenge: count - 2, // Main learning (interleaved)
    coolDown: 1,    // End on success
  };

  // Collect all available questions with FSRS data
  const allQuestions = [];

  allObjectives.forEach(obj => {
    const objProg = progress[obj.code];

    // Skip objectives in cooldown
    if (objProg?.skipUntilSession && objProg.skipUntilSession > sessionCount) {
      return;
    }

    const questions = questionBank[obj.code] || [];
    questions.forEach((q, idx) => {
      const questionId = getQuestionId(obj.code, idx, q);
      const card = fsrsData.questionCards[questionId] || fsrsInitCard(questionId);

      // Calculate retrievability (how likely they'll remember)
      const elapsedDays = card.lastReview
        ? (now - card.lastReview) / (1000 * 60 * 60 * 24)
        : 0;
      const retrievability = card.lastReview
        ? fsrsRetrievability(elapsedDays, card.stability)
        : 0;

      // Due score: lower = more urgent (0 = overdue, 1 = just reviewed)
      const dueScore = card.nextReview <= now
        ? Math.max(0, retrievability)
        : 1 + (card.nextReview - now) / (1000 * 60 * 60 * 24 * 7); // Future cards score >1

      allQuestions.push({
        objective: obj,
        question: q,
        questionIndex: idx,
        questionId,
        card,
        dueScore,
        retrievability,
        difficulty: card.difficulty,
        state: card.state,
        isExamReady: (objProg?.quickCorrect ?? 0) >= 4 && !objProg?.examPassed,
        isMastered: objProg?.examPassed === true,
      });
    });
  });

  // Separate into buckets for session structure
  const dueCards = allQuestions.filter(q => q.dueScore <= 1).sort((a, b) => a.dueScore - b.dueScore);
  const newCards = allQuestions.filter(q => q.state === 'new' && q.dueScore > 1);
  const examReadyCards = allQuestions.filter(q => q.isExamReady);
  const easyCards = allQuestions.filter(q => q.difficulty < 0.4 && q.retrievability > 0.8);

  // Build session with structure
  const queue = [];
  const usedObjectives = new Set();
  const usedQuestionIds = new Set();

  const addToQueue = (questionData, phase) => {
    if (usedQuestionIds.has(questionData.questionId)) return false;
    usedQuestionIds.add(questionData.questionId);
    usedObjectives.add(questionData.objective.code);
    queue.push({ ...questionData, sessionPhase: phase });
    return true;
  };

  // Helper to apply discriminative interleaving
  const addWithInterleaving = (candidates, phase, maxCount) => {
    let added = 0;
    const candidatesCopy = [...candidates];

    while (added < maxCount && candidatesCopy.length > 0) {
      // Pick next candidate
      const next = candidatesCopy.shift();
      if (usedQuestionIds.has(next.questionId)) continue;

      addToQueue(next, phase);
      added++;

      // Try to add a confusable pair immediately after (interleaving)
      if (added < maxCount && confusablePairs[next.objective.code]) {
        const confusableCodes = confusablePairs[next.objective.code];
        const confusable = candidatesCopy.find(c =>
          confusableCodes.includes(c.objective.code) &&
          !usedQuestionIds.has(c.questionId)
        );
        if (confusable) {
          candidatesCopy.splice(candidatesCopy.indexOf(confusable), 1);
          addToQueue(confusable, phase);
          added++;
        }
      }
    }
    return added;
  };

  // Phase 1: Warm-up (easy questions)
  const warmUpCandidates = easyCards.length > 0
    ? easyCards
    : allQuestions.filter(q => q.difficulty < 0.5).sort((a, b) => a.difficulty - b.difficulty);

  for (let i = 0; i < Math.min(SESSION_STRUCTURE.warmUp, warmUpCandidates.length); i++) {
    if (warmUpCandidates[i] && !usedQuestionIds.has(warmUpCandidates[i].questionId)) {
      addToQueue(warmUpCandidates[i], 'warmup');
    }
  }

  // Phase 2: Challenge (interleaved due cards, exam-ready, and new)
  const challengeTarget = SESSION_STRUCTURE.challenge;

  // Prioritize exam-ready (up to 2)
  addWithInterleaving(
    examReadyCards.filter(q => !usedQuestionIds.has(q.questionId)),
    'challenge',
    Math.min(2, challengeTarget)
  );

  // Add due cards with interleaving
  const dueTarget = Math.ceil((challengeTarget - queue.length + 1) * 0.6);
  addWithInterleaving(
    dueCards.filter(q => !usedQuestionIds.has(q.questionId)),
    'challenge',
    dueTarget
  );

  // Fill with new cards
  const newTarget = challengeTarget - queue.length + SESSION_STRUCTURE.warmUp;
  addWithInterleaving(
    newCards.filter(q => !usedQuestionIds.has(q.questionId)).sort(() => Math.random() - 0.5),
    'challenge',
    newTarget
  );

  // Phase 3: Cool-down (end on an easy success)
  const coolDownCandidates = allQuestions
    .filter(q => !usedQuestionIds.has(q.questionId) && q.difficulty < 0.4)
    .sort((a, b) => a.difficulty - b.difficulty);

  if (coolDownCandidates.length > 0) {
    addToQueue(coolDownCandidates[0], 'cooldown');
  } else {
    // Fall back to any unused easy-ish question
    const fallback = allQuestions.find(q => !usedQuestionIds.has(q.questionId));
    if (fallback) addToQueue(fallback, 'cooldown');
  }

  // Fill any remaining slots
  const remainingSlots = count - queue.length;
  if (remainingSlots > 0) {
    const unused = allQuestions.filter(q => !usedQuestionIds.has(q.questionId));
    unused.sort((a, b) => a.dueScore - b.dueScore);
    for (let i = 0; i < Math.min(remainingSlots, unused.length); i++) {
      addToQueue(unused[i], 'challenge');
    }
  }

  // Reorder to ensure warm-up first, cool-down last
  const warmUp = queue.filter(q => q.sessionPhase === 'warmup');
  const challenge = queue.filter(q => q.sessionPhase === 'challenge');
  const coolDown = queue.filter(q => q.sessionPhase === 'cooldown');

  // Return objectives for compatibility with existing code
  const orderedQueue = [...warmUp, ...challenge, ...coolDown];
  return orderedQueue.map(q => ({
    ...q.objective,
    _fsrsQuestionId: q.questionId,
    _fsrsQuestionIndex: q.questionIndex,
    _sessionPhase: q.sessionPhase,
    _dueScore: q.dueScore,
    _retrievability: q.retrievability,
  }));
};

// Get question for objective based on progress
const getQuestion = (objective, progressData) => {
  const prog = progressData?.[objective.code];
  const quickCorrect = prog?.quickCorrect ?? 0;
  const examPassed = prog?.examPassed ?? false;
  
  // If already mastered, return a quick question for review
  if (examPassed) {
    const questions = questionBank[objective.code];
    if (questions && questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      return { ...q, objective, questionType: 'review' };
    }
  }
  
  // If ready for exam (4 quick questions done), serve exam question
  if (quickCorrect >= 4 && !examPassed) {
    const exams = examQuestions[objective.code];
    if (exams && exams.length > 0) {
      const q = exams[Math.floor(Math.random() * exams.length)];
      return { ...q, objective, questionType: 'exam', isExamQuestion: true };
    }
    // Fallback to a harder quick question if no exam question available
    const questions = questionBank[objective.code];
    if (questions && questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      return { ...q, objective, questionType: 'exam', isExamQuestion: true };
    }
  }
  
  // Otherwise, serve a quick question
  const questions = questionBank[objective.code];
  if (questions && questions.length > 0) {
    const q = questions[Math.floor(Math.random() * questions.length)];
    return { ...q, objective, questionType: 'quick' };
  }
  
  // Fallback: generic question
  return {
    q: objective.title,
    a: null, // Self-assessed
    type: "self",
    objective,
    questionType: 'quick',
  };
};

function PracticePage({ dailyObjectives, progress, setProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings }) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [questionCount, setQuestionCount] = useState(settings?.questionsPerSession ?? 5);
  const [sessionCount, setSessionCount] = useState(() => loadSessionCount());
  const [masteryGained, setMasteryGained] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [practiceMode, setPracticeMode] = useState('standard'); // 'standard', 'quickfire', or 'exam'
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  
  // Scaffolding state
  const [failureCounts, setFailureCounts] = useState({}); // Track consecutive failures per objective
  const [currentDiagnosis, setCurrentDiagnosis] = useState(null); // AI diagnosis of error
  const [isScaffoldQuestion, setIsScaffoldQuestion] = useState(false); // Is current question a building block?
  const [scaffoldInfo, setScaffoldInfo] = useState(null); // Info about the scaffold question
  const [isAnalyzing, setIsAnalyzing] = useState(false); // AI is analyzing the error
  
  // Mini-lesson state
  const [showMiniLesson, setShowMiniLesson] = useState(false);
  const [currentMiniLesson, setCurrentMiniLesson] = useState(null);
  const [miniLessonTimer, setMiniLessonTimer] = useState(60);
  const [miniLessonComplete, setMiniLessonComplete] = useState(false);
  const miniLessonTimerRef = useRef(null);
  
  // AI unlock state - AI features phase in after 15 questions
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(() => loadTotalQuestions());
  const [showAIUnlockNotification, setShowAIUnlockNotification] = useState(false);
  const aiUnlocked = isAIUnlocked(totalQuestionsAnswered);
  
  // Math keyboard state
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathKeyboardTab, setMathKeyboardTab] = useState('123'); // '123', 'f(x)', 'ABC', '#&¬'
  const inputRef = useRef(null);
  
  // Photo input state
  const [inputMode, setInputMode] = useState('type'); // 'type' or 'photo'
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef(null);

  // FSRS state for cognitive science features
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [userConfidence, setUserConfidence] = useState(null); // null, 1-4 (guessing, unsure, fairly sure, certain)
  const [showConfidenceRating, setShowConfidenceRating] = useState(false);
  const [showDelayedFeedback, setShowDelayedFeedback] = useState(false); // 500ms pause before showing result
  const [fsrsData, setFsrsData] = useState(() => loadFsrsData());
  
  // Process handwritten answer from image using AI
  const processHandwrittenAnswer = async (imageData) => {
    setIsProcessingImage(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageData.split(',')[1] // Remove data:image/jpeg;base64, prefix
                  }
                },
                {
                  type: "text",
                  text: `This is a photo of a student's handwritten maths answer. Extract ONLY the final answer they wrote. 
                  
Rules:
- Return just the answer value (e.g., "12", "3/4", "2x + 5", "yes")
- If there's working out shown, only extract the final answer
- If you see a fraction, write it as "a/b" format
- If you see a mixed number, write it as "1 3/4" format
- If it's unclear or unreadable, respond with "UNCLEAR"
- Do not include any explanation, just the answer

What is the student's answer?`
                }
              ]
            }
          ],
        })
      });

      const data = await response.json();
      const extractedAnswer = data.content?.[0]?.text?.trim() || '';
      
      if (extractedAnswer && extractedAnswer !== 'UNCLEAR') {
        setUserAnswer(extractedAnswer);
        return extractedAnswer;
      } else {
        alert('Could not read the handwriting clearly. Please try again or type your answer.');
        return null;
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try typing your answer instead.');
      return null;
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  // Handle file selection for photo
  const handlePhotoCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;
      setCapturedImage(imageData);
      await processHandwrittenAnswer(imageData);
    };
    reader.readAsDataURL(file);
  };
  
  // Clear photo and reset
  const clearPhoto = () => {
    setCapturedImage(null);
    setUserAnswer('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Start a mini-lesson for a specific prerequisite
  const startMiniLesson = (prereqCode) => {
    const lesson = miniLessons[prereqCode];
    if (!lesson) return;
    
    setCurrentMiniLesson({ ...lesson, code: prereqCode });
    setShowMiniLesson(true);
    setMiniLessonTimer(lesson.duration || 60);
    setMiniLessonComplete(false);
    
    // Start countdown timer
    if (miniLessonTimerRef.current) clearInterval(miniLessonTimerRef.current);
    miniLessonTimerRef.current = setInterval(() => {
      setMiniLessonTimer(prev => {
        if (prev <= 1) {
          setMiniLessonComplete(true);
          clearInterval(miniLessonTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // Close mini-lesson and continue
  const closeMiniLesson = (startBuildingBlock = false) => {
    if (miniLessonTimerRef.current) clearInterval(miniLessonTimerRef.current);
    setShowMiniLesson(false);
    setCurrentMiniLesson(null);
    setMiniLessonTimer(60);
    setMiniLessonComplete(false);
    
    // If user wants to try a building block question
    if (startBuildingBlock && scaffoldInfo) {
      // The scaffoldInfo is already set, nextQuestion will handle it
    }
  };
  
  // Detect specific skill gaps from error patterns
  const detectSkillGap = (question, userAnswer, correctAnswer, objective) => {
    const userNum = parseFloat(userAnswer);
    const correctNum = parseFloat(correctAnswer);
    
    // Check for sign error → suggests negative number issues
    if (!isNaN(userNum) && !isNaN(correctNum) && userNum === -correctNum) {
      return 'N2'; // Negative numbers
    }
    
    // Check for factor of 10 error → suggests percentage/decimal issues
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      if (userNum === correctNum * 10 || userNum === correctNum / 10) {
        return 'N12'; // Percentages
      }
    }
    
    // Check for BIDMAS errors (if question contains multiple operations)
    if (question.q && question.q.includes('×') && question.q.includes('+')) {
      // If they got it wrong, might be BIDMAS
      return 'N5';
    }
    
    // Check for Pythagoras errors
    if (objective.code === 'G19' || question.q?.toLowerCase().includes('pythag')) {
      if (!isNaN(userNum) && !isNaN(correctNum)) {
        // They added without squaring
        if (Math.abs(userNum - Math.sqrt(correctNum * correctNum)) < 1) {
          return 'N6'; // Squares and roots
        }
      }
    }
    
    // Default to the objective's prerequisite
    return prerequisites[objective.code] || null;
  };
  
  // Insert symbol at cursor position
  const insertSymbol = (symbol) => {
    const input = inputRef.current;
    if (!input) {
      setUserAnswer(prev => prev + symbol);
      return;
    }
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = userAnswer.slice(0, start) + symbol + userAnswer.slice(end);
    setUserAnswer(newValue);
    
    // Set cursor position after the inserted symbol
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 0);
  };

  // Calculate stats
  const totalObjectives = allObjectives?.length ?? 0;
  const masteredCount = allObjectives?.filter(o => isMastered(progress[o.code])).length ?? 0;
  const dueCount = allObjectives?.filter(o => isDue(progress[o.code]) && !isMastered(progress[o.code])).length ?? 0;
  const cooldownCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    return prog?.skipUntilSession && prog.skipUntilSession > sessionCount;
  }).length ?? 0;
  
  // Count objectives with MCQ questions for Quick Fire
  const mcqObjectiveCount = allObjectives?.filter(o => {
    const questions = questionBank[o.code];
    return questions && questions.some(q => q.type === 'mcq');
  }).length ?? 0;

  // Quick Fire timer effect
  const startQuestionTimer = () => {
    if (practiceMode === 'quickfire' && !showFeedback) {
      setTimeLeft(15); // 15 seconds per question
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Auto-submit wrong if time runs out
            checkAnswer(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Start session
  const startSession = (mode = practiceMode) => {
    let questionsWithData;
    
    if (mode === 'quickfire') {
      // Quick Fire mode: ONLY use objectives that have MCQ questions
      const objectivesWithMCQ = allObjectives.filter(obj => {
        const questions = questionBank[obj.code];
        return questions && questions.some(q => q.type === 'mcq');
      });
      
      if (objectivesWithMCQ.length === 0) {
        // Fallback to standard mode if no MCQs available
        alert('No quick-fire questions available yet. Starting standard mode instead.');
        mode = 'standard';
        const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount);
        questionsWithData = queue.map(obj => getQuestion(obj, progress));
      } else {
        // Build queue from MCQ-capable objectives only
        const queue = buildSessionQueue(objectivesWithMCQ, progress, questionCount, sessionCount);
        
        // Get only MCQ questions (Quick Fire always uses quick questions, not exam)
        questionsWithData = queue.map(obj => {
          const mcqQuestions = questionBank[obj.code]?.filter(q => q.type === 'mcq') || [];
          const mcq = mcqQuestions[Math.floor(Math.random() * mcqQuestions.length)];
          return { ...mcq, objective: obj, questionType: 'quick' };
        });
      }
    } else {
      // Standard mode - includes exam questions when ready
      const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount);
      questionsWithData = queue.map(obj => getQuestion(obj, progress));
    }
    
    setSessionQueue(questionsWithData);
    setCurrentIndex(0);
    setSessionResults([]);
    setSessionStarted(true);
    setShowFeedback(false);
    setUserAnswer('');
    setMasteryGained(0);
    setAchievements([]);
    setShowConfetti(false);
    setPracticeMode(mode);
    setShowMathKeyboard(false);
    setCapturedImage(null);
    setInputMode('type');
    
    // Reset scaffolding state
    setFailureCounts({});
    setCurrentDiagnosis(null);
    setIsScaffoldQuestion(false);
    setScaffoldInfo(null);
    setIsAnalyzing(false);
    
    // Reset mini-lesson state
    setShowMiniLesson(false);
    setCurrentMiniLesson(null);
    setMiniLessonTimer(60);
    setMiniLessonComplete(false);
    if (miniLessonTimerRef.current) clearInterval(miniLessonTimerRef.current);

    // Reset FSRS cognitive science state
    setQuestionStartTime(Date.now());
    setUserConfidence(null);
    setShowConfidenceRating(false);
    setShowDelayedFeedback(false);

    // Start timer for Quick Fire
    if (mode === 'quickfire') {
      setTimeout(() => startQuestionTimer(), 100);
    }
  };

  // Convert answer correctness and response time to FSRS rating
  const getfsrsRating = (correct, responseTimeMs, avgResponseTime) => {
    if (!correct) return Rating.Again;

    // Compare to average response time for this question
    const avg = avgResponseTime || 15000; // Default 15s if no history
    const ratio = responseTimeMs / avg;

    if (ratio < 0.5) return Rating.Easy;     // Very fast = easy
    if (ratio < 1.0) return Rating.Good;     // Normal speed = good
    if (ratio < 2.0) return Rating.Hard;     // Slower than normal = hard
    return Rating.Hard;                      // Very slow but correct = hard
  };

  // Check answer
  const checkAnswer = (selfAssessedCorrect = null) => {
    // Stop Quick Fire timer
    if (timerRef.current) clearInterval(timerRef.current);

    const current = sessionQueue[currentIndex];
    let correct = selfAssessedCorrect;

    if (current.type !== 'self' && selfAssessedCorrect === null) {
      // Use forgiving answer checker that accepts mathematical equivalents
      correct = answersEquivalent(userAnswer, current.a);
    }

    // Calculate response time for FSRS
    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : 15000;

    setIsCorrect(correct);
    setShowFeedback(true);
    
    // Track total questions answered (for AI unlock)
    const newTotal = totalQuestionsAnswered + 1;
    setTotalQuestionsAnswered(newTotal);
    saveTotalQuestions(newTotal);
    
    // Check if AI just got unlocked
    if (newTotal === AI_UNLOCK_THRESHOLD) {
      setTimeout(() => setShowAIUnlockNotification(true), 500);
    }
    
    const code = current.objective.code;
    
    // === SCAFFOLDING LOGIC (disabled in Quick Fire and Exam modes) ===
    const scaffoldingEnabled = practiceMode !== 'quickfire' && practiceMode !== 'exam';
    
    if (!correct && !isScaffoldQuestion && scaffoldingEnabled) {
      // Start with quick fallback diagnosis immediately (always available)
      const quickDiag = quickDiagnosis(current, userAnswer, current.a);
      setCurrentDiagnosis(quickDiag);
      
      // Only run AI diagnosis if unlocked (after 15 questions)
      if (isAIUnlocked(newTotal)) {
        setIsAnalyzing(true);
        diagnoseErrorWithAI(current, userAnswer, current.objective, current.a)
          .then(aiDiagnosis => {
            if (aiDiagnosis.hasDiagnosis) {
              setCurrentDiagnosis(aiDiagnosis);
            }
            setIsAnalyzing(false);
          })
          .catch(() => {
            setIsAnalyzing(false);
          });
      }
      
      // Track failure count for this objective
      const newFailureCount = (failureCounts[code] || 0) + 1;
      setFailureCounts(prev => ({ ...prev, [code]: newFailureCount }));
      
      // IMMEDIATELY detect skill gap and prepare mini-lesson
      const detectedGap = detectSkillGap(current, userAnswer, current.a, current.objective);
      const prereqCode = detectedGap || prerequisites[code];
      
      if (prereqCode && miniLessons[prereqCode]) {
        // Prepare building block for after the mini-lesson
        const buildingBlock = getBuildingBlock(code);
        if (buildingBlock) {
          setScaffoldInfo({
            buildingBlock,
            originalObjective: current.objective,
            prereqCode: prereqCode,
            reason: `Let's strengthen your ${miniLessons[prereqCode]?.title || 'foundation'} skills first.`
          });
        }
      }
    } else if (correct) {
      // Reset failure count on success
      setCurrentDiagnosis(null);
      setIsAnalyzing(false);
      if (!isScaffoldQuestion) {
        setFailureCounts(prev => ({ ...prev, [code]: 0 }));
      }
    }
    
    // If scaffold question answered correctly, clear scaffold info
    if (isScaffoldQuestion && correct) {
      setScaffoldInfo(null);
      setIsScaffoldQuestion(false);
    }
    
    // Update progress and track mastery (skip for scaffold questions)
    if (!isScaffoldQuestion) {
      const prog = progress[code] || {};
      const oldQuickCorrect = prog.quickCorrect ?? 0;
      const wasExamPassed = prog.examPassed ?? false;
      const wasMastered = wasExamPassed && oldQuickCorrect >= 4;
      const isExamQuestion = current.isExamQuestion || current.questionType === 'exam';
      
      let newQuickCorrect = oldQuickCorrect;
      let newExamPassed = wasExamPassed;
      
      if (correct) {
        if (isExamQuestion) {
          // Exam question answered correctly - mastery achieved!
          newExamPassed = true;
        } else {
          // Quick question answered correctly
          newQuickCorrect = Math.min(oldQuickCorrect + 1, 4);
        }
      } else {
        // Wrong answer
        if (isExamQuestion) {
          // Failed exam - need to redo some quick questions
          newQuickCorrect = Math.max(0, oldQuickCorrect - 2); // Lose 2 quick questions
          newExamPassed = false;
        } else {
          // Failed quick question - lose progress
          newQuickCorrect = Math.max(0, oldQuickCorrect - 1);
        }
      }
      
      const nowMastered = newExamPassed && newQuickCorrect >= 4;
      
      // Track mastery gained
      if (correct && nowMastered && !wasMastered) {
        setMasteryGained(prev => prev + 1);
      }
      
      setProgress(prev => {
        const updated = {
          ...prev,
          [code]: {
            ...prev[code],
            quickCorrect: newQuickCorrect,
            examPassed: newExamPassed,
            lastPracticed: Date.now(),
            nextDue: getNextDueTime(newQuickCorrect, correct),
            // If wrong, skip this objective for 2 sessions to give time to revise
            skipUntilSession: correct ? prev[code]?.skipUntilSession : sessionCount + 3,
            // Track when objective was mastered
            masteredAt: (nowMastered && !wasMastered) ? Date.now() : prev[code]?.masteredAt,
          }
        };
        saveProgress(updated);
        return updated;
      });
      
      setSessionResults(prev => [...prev, {
        code,
        correct,
        question: current.q,
        topic: current.objective.topic,
        questionType: isExamQuestion ? 'exam' : 'quick',
        oldQuickCorrect,
        newQuickCorrect,
        wasExamPassed,
        newExamPassed,
        newMastery: correct && nowMastered && !wasMastered
      }]);

      // === FSRS UPDATE ===
      // Update FSRS card for this specific question (question-level tracking)
      const questionId = current._fsrsQuestionId || getQuestionId(
        code,
        current._fsrsQuestionIndex || 0,
        current
      );

      setFsrsData(prevFsrs => {
        const currentCard = prevFsrs.questionCards[questionId] || fsrsInitCard(questionId);
        const rating = getfsrsRating(correct, responseTimeMs, currentCard.avgResponseTime);
        const updatedCard = fsrsReview(currentCard, rating, responseTimeMs, userConfidence);

        const updatedFsrsData = {
          ...prevFsrs,
          questionCards: {
            ...prevFsrs.questionCards,
            [questionId]: updatedCard
          }
        };

        // Persist to localStorage
        saveFsrsData(updatedFsrsData);
        return updatedFsrsData;
      });
    }
  };

  // Next question
  const nextQuestion = () => {
    setShowFeedback(false);
    setUserAnswer('');
    setIsCorrect(null);
    setCurrentDiagnosis(null);
    setIsAnalyzing(false);
    setShowMathKeyboard(false);
    setCapturedImage(null);

    // Reset FSRS state for next question
    setQuestionStartTime(Date.now());
    setUserConfidence(null);
    setShowConfidenceRating(false);
    setShowDelayedFeedback(false);
    
    // Clear mini-lesson if open
    if (showMiniLesson) {
      closeMiniLesson(false);
    }
    
    // Clear Quick Fire timer
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Check if we need to insert a building block question
    if (scaffoldInfo && !isScaffoldQuestion) {
      // Insert building block before continuing
      const buildingBlockQ = {
        ...scaffoldInfo.buildingBlock,
        objective: scaffoldInfo.originalObjective,
        isScaffold: true,
      };
      
      // Insert at current position + 1
      setSessionQueue(prev => {
        const newQueue = [...prev];
        newQueue.splice(currentIndex + 1, 0, buildingBlockQ);
        return newQueue;
      });
      
      setIsScaffoldQuestion(true);
      setCurrentIndex(prev => prev + 1);
      return;
    }
    
    // Clear scaffold state when moving past it
    if (isScaffoldQuestion) {
      setIsScaffoldQuestion(false);
      setScaffoldInfo(null);
    }
    
    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Restart timer for Quick Fire mode
      if (practiceMode === 'quickfire') {
        setTimeout(() => startQuestionTimer(), 100);
      }
    } else {
      // Session complete - cleanup timers
      setTimeLeft(null);
      
      // Increment session count
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      saveSessionCount(newCount);
      
      // Calculate session stats for history
      const correctCount = sessionResults.filter(r => r.correct).length + (isCorrect ? 1 : 0);
      const totalQuestions = sessionResults.length + 1;
      const topicsCovered = [...new Set(sessionResults.map(r => r.topic))];
      
      // Record daily activity
      recordDailyActivity(totalQuestions, correctCount, masteryGained);
      
      // Check for streak milestones (earns freezes)
      const updatedStreak = calculateStreak();
      const freezeEarned = checkStreakMilestone(updatedStreak.streak);
      
      // Check if streak was repaired
      const streakRepaired = updatedStreak.repairCompleted;
      
      // Save session to history
      const sessionData = {
        date: Date.now(),
        correct: correctCount,
        total: totalQuestions,
        masteryGained: masteryGained + (sessionResults[sessionResults.length]?.newMastery ? 1 : 0),
        topics: topicsCovered,
        sessionNumber: newCount,
        mode: practiceMode, // Track which mode was used
      };
      const history = loadSessionHistory();
      history.push(sessionData);
      saveSessionHistory(history);
      
      // Calculate achievements
      const newAchievements = [];
      
      // Streak repair achievement
      if (streakRepaired) {
        newAchievements.push({ icon: '🔧', title: 'Streak Repaired!', desc: `Your ${updatedStreak.potentialStreak} day streak is back!` });
      }
      
      // Freeze earned achievement
      if (freezeEarned.earned) {
        newAchievements.push({ icon: '🛡️', title: 'Streak Freeze Earned!', desc: `${freezeEarned.milestone} day milestone! (${freezeEarned.total} freezes)` });
      }
      
      if (correctCount === totalQuestions) {
        newAchievements.push({ icon: '🎯', title: 'Perfect Score!', desc: 'All questions correct' });
      }
      if (masteryGained > 0) {
        newAchievements.push({ icon: '⭐', title: 'New Mastery!', desc: `Mastered ${masteryGained} objective${masteryGained > 1 ? 's' : ''}` });
      }
      if (newCount === 1) {
        newAchievements.push({ icon: '🚀', title: 'First Session!', desc: 'You started your journey' });
      }
      if (newCount === 10) {
        newAchievements.push({ icon: '🔥', title: '10 Sessions!', desc: 'Dedicated learner' });
      }
      if (newCount === 50) {
        newAchievements.push({ icon: '💎', title: '50 Sessions!', desc: 'Maths champion' });
      }
      if (correctCount >= 5 && totalQuestions >= 5) {
        newAchievements.push({ icon: '💪', title: 'Strong Session!', desc: '5+ correct answers' });
      }
      // Quick Fire achievement
      if (practiceMode === 'quickfire' && correctCount >= totalQuestions * 0.8) {
        newAchievements.push({ icon: '⚡', title: 'Lightning Fast!', desc: '80%+ in Quick Fire mode' });
      }
      
      setAchievements(newAchievements);
      
      // Only show confetti for mastery gains - not trivial achievements
      if (masteryGained > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
      
      setSessionStarted(false); // Show results
    }
  };

  // Handle empty objectives
  if (!allObjectives || allObjectives.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 text-center">
          <Dumbbell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900">No questions available</h2>
          <p className="text-slate-500 mt-2">Go to Home to set up your objectives first.</p>
        </div>
      </div>
    );
  }

  // Results screen
  if (!sessionStarted && sessionResults.length > 0) {
    const correctCount = sessionResults.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / sessionResults.length) * 100);
    const topicsSet = new Set(sessionResults.map(r => r.topic));
    const streakGained = sessionResults.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        {/* Confetti Animation */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            <style>{`
              @keyframes confettiFall {
                0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
              }
              @keyframes confettiSway {
                0%, 100% { margin-left: 0; }
                50% { margin-left: 30px; }
              }
            `}</style>
            {[...Array(60)].map((_, i) => {
              const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
              const shapes = ['rounded-full', 'rounded-sm', 'rounded-none'];
              const size = 8 + Math.random() * 8;
              return (
                <div
                  key={i}
                  className={shapes[Math.floor(Math.random() * shapes.length)]}
                  style={{
                    position: 'absolute',
                    left: `${Math.random() * 100}%`,
                    top: '-20px',
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                    animation: `confettiFall ${2 + Math.random() * 3}s ease-out forwards, confettiSway ${1 + Math.random()}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                  }}
                />
              );
            })}
          </div>
        )}

        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              {/* Header */}
              <div className="text-center mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  accuracy === 100 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                  accuracy >= 80 ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' :
                  accuracy >= 60 ? 'bg-gradient-to-br from-blue-400 to-blue-500' :
                  'bg-gradient-to-br from-slate-400 to-slate-500'
                }`}>
                  {accuracy === 100 ? <Trophy className="w-10 h-10 text-white" /> :
                   accuracy >= 80 ? <Sparkles className="w-10 h-10 text-white" /> :
                   <Target className="w-10 h-10 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {accuracy === 100 ? 'Perfect! 🎉' : 
                   accuracy >= 80 ? 'Great Work!' :
                   accuracy >= 60 ? 'Good Effort!' : 'Keep Practicing!'}
                </h2>
              </div>

              {/* Score */}
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  {correctCount}/{sessionResults.length}
                </div>
                <p className="text-slate-500 mt-1">{accuracy}% accuracy</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-slate-900">{topicsSet.size}</div>
                  <div className="text-xs text-slate-500">Topics</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-emerald-600">+{streakGained}</div>
                  <div className="text-xs text-emerald-600">Streak pts</div>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-violet-600">{masteryGained}</div>
                  <div className="text-xs text-violet-600">Mastered</div>
                </div>
              </div>

              {/* Question Results - prioritize showing mastery gains */}
              <div className="space-y-2 text-left mb-6 max-h-60 overflow-y-auto">
                {sessionResults.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg ${r.correct ? 'bg-slate-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-3 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        r.correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <span className="font-medium text-slate-700">{r.code}</span>
                      {r.newMastery && (
                        <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                          ✓ Mastered!
                        </span>
                      )}
                    </div>
                    {!r.correct && revisionHints[r.code] && (
                      <p className="text-xs text-red-700 mt-2 ml-9">
                        📚 {revisionHints[r.code]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Achievements - visually subordinate, smaller */}
              {achievements.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 justify-center">
                  {achievements.map((ach, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                      <span>{ach.icon}</span>
                      <span>{ach.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {sessionResults.some(r => !r.correct) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-amber-800">
                    <strong>📖 Time to revise!</strong> The objectives you got wrong won't appear for the next 2 sessions.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={startSession}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl transition-all"
                >
                  Practice Again
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('stats'); }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                  View Progress Stats
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('home'); }}
                  className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-session screen
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Dumbbell className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Practice Session</h2>
                <p className="text-slate-500 mt-1">Build lasting maths skills</p>
              </div>

              {/* Practice Mode Selection - Quick Fire unlocks after 5 mastered OR 3-day streak */}
              {(() => {
                const quickFireUnlocked = masteredCount >= QUICKFIRE_MASTERY_THRESHOLD || dayStreak >= QUICKFIRE_STREAK_THRESHOLD;
                const examModeUnlocked = masteredCount >= 10; // Exam mode after 10 mastered
                
                return (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Practice Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Standard Mode - Always available */}
                      <button
                        onClick={() => setPracticeMode('standard')}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          practiceMode === 'standard'
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-lg mb-1">📚</div>
                        <div className="font-semibold text-slate-900 text-sm">Standard</div>
                        <div className="text-[10px] text-slate-500">With hints</div>
                      </button>
                      
                      {/* Quick Fire - Unlocks after 5 mastered OR 3-day streak */}
                      <button
                        onClick={() => quickFireUnlocked && mcqObjectiveCount >= 5 && setPracticeMode('quickfire')}
                        disabled={!quickFireUnlocked || mcqObjectiveCount < 5}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          !quickFireUnlocked || mcqObjectiveCount < 5
                            ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                            : practiceMode === 'quickfire'
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-lg mb-1">{quickFireUnlocked ? '⚡' : '🔒'}</div>
                        <div className="font-semibold text-slate-900 text-sm">Quick Fire</div>
                        <div className="text-[10px] text-slate-500">
                          {!quickFireUnlocked 
                            ? `${QUICKFIRE_MASTERY_THRESHOLD - masteredCount} more to unlock`
                            : '15s timer'}
                        </div>
                      </button>
                      
                      {/* Exam Mode - Unlocks after 10 mastered */}
                      <button
                        onClick={() => examModeUnlocked && setPracticeMode('exam')}
                        disabled={!examModeUnlocked}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          !examModeUnlocked
                            ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                            : practiceMode === 'exam'
                              ? 'border-red-500 bg-red-50'
                              : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-lg mb-1">{examModeUnlocked ? '🎯' : '🔒'}</div>
                        <div className="font-semibold text-slate-900 text-sm">Exam</div>
                        <div className="text-[10px] text-slate-500">
                          {!examModeUnlocked 
                            ? `${10 - masteredCount} more to unlock`
                            : 'No hints'}
                        </div>
                      </button>
                    </div>
                    
                    {/* Exam Mode explanation */}
                    {practiceMode === 'exam' && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                        <strong>Exam conditions:</strong> No hints, no scaffolding, delayed feedback. Train your exam mindset.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-slate-900">{dueCount}</div>
                  <div className="text-xs text-slate-500">Due now</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{masteredCount}</div>
                  <div className="text-xs text-emerald-600">Mastered</div>
                </div>
              </div>
              
              {cooldownCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                  <div className="flex items-center gap-2 text-amber-700">
                    <span className="text-lg">📚</span>
                    <span className="text-sm">
                      <strong>{cooldownCount}</strong> {cooldownCount === 1 ? 'objective needs' : 'objectives need'} revision
                    </span>
                  </div>
                </div>
              )}

              {/* Question count selector - simplified to 2 options */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-700 mb-2 block">Questions</label>
                <div className="flex gap-2">
                  {[5, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                        questionCount === n
                          ? practiceMode === 'quickfire' 
                            ? 'bg-orange-500 text-white' 
                            : practiceMode === 'exam'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {n === 5 ? '5 (Quick)' : '10 (Full)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Coach Progress - shows until unlocked */}
              {!aiUnlocked && (
                <div className="mb-6 p-4 bg-gradient-to-br from-slate-50 to-purple-50 border border-purple-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">AI Coach</p>
                      <p className="text-xs text-slate-500">Unlocks in {AI_UNLOCK_THRESHOLD - totalQuestionsAnswered} questions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-600">{totalQuestionsAnswered}/{AI_UNLOCK_THRESHOLD}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-400 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${(totalQuestionsAnswered / AI_UNLOCK_THRESHOLD) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* AI Coach Active indicator - shows when unlocked */}
              {aiUnlocked && (
                <div className="mb-6 p-3 bg-gradient-to-r from-purple-100 to-violet-100 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2 text-purple-700">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-medium">AI Coach Active</span>
                    <span className="ml-auto text-xs bg-purple-200 px-2 py-0.5 rounded-full">Smart feedback enabled</span>
                  </div>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={() => startSession(practiceMode)}
                className={`w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg ${
                  practiceMode === 'quickfire'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-500/25'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/25'
                }`}
              >
                {practiceMode === 'quickfire' ? '⚡ Start Quick Fire' : 'Start Session'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active session
  const current = sessionQueue[currentIndex];
  const progressPct = ((currentIndex + (showFeedback ? 1 : 0)) / sessionQueue.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
      
      <div className="pt-24 pb-24 px-4">
        <div className="max-w-lg mx-auto">
          {/* Quick Fire Timer */}
          {practiceMode === 'quickfire' && timeLeft !== null && !showFeedback && (
            <div className="mb-4">
              <div className={`text-center p-3 rounded-xl ${
                timeLeft <= 5 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              }`}>
                <div className="text-3xl font-bold">{timeLeft}s</div>
                <div className="text-xs">⚡ Quick Fire Mode</div>
              </div>
            </div>
          )}
          
          {/* Exam Mode Banner */}
          {practiceMode === 'exam' && !showFeedback && (
            <div className="mb-4">
              <div className="text-center p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                <div className="font-bold">🎯 Exam Conditions</div>
                <div className="text-xs">No hints · No scaffolding · Delayed feedback</div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Question {currentIndex + 1} of {sessionQueue.length}</span>
              <span className="text-sm font-bold text-slate-900">{sessionResults.filter(r => r.correct).length} correct</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  practiceMode === 'quickfire'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                    : practiceMode === 'exam'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500'
                      : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Session Phase Indicator (FSRS-based learning structure) */}
            {current?._sessionPhase && practiceMode === 'standard' && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  current._sessionPhase === 'warmup'
                    ? 'bg-green-100 text-green-700'
                    : current._sessionPhase === 'cooldown'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-violet-100 text-violet-700'
                }`}>
                  {current._sessionPhase === 'warmup' && '🌱 Warm-up'}
                  {current._sessionPhase === 'challenge' && '💪 Challenge'}
                  {current._sessionPhase === 'cooldown' && '✨ Cool-down'}
                </span>
                {current._sessionPhase === 'warmup' && (
                  <span className="text-slate-500">Build confidence</span>
                )}
                {current._sessionPhase === 'challenge' && (
                  <span className="text-slate-500">Main learning</span>
                )}
                {current._sessionPhase === 'cooldown' && (
                  <span className="text-slate-500">End on a win</span>
                )}
              </div>
            )}
          </div>

          {/* Question card */}
          {current && (
            <div className={`bg-white rounded-3xl border shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden ${
              isScaffoldQuestion ? 'border-indigo-300 ring-2 ring-indigo-100' : 
              current.isExamQuestion ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
            }`}>
              {/* Building Block Banner */}
              {isScaffoldQuestion && (
                <div className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center">
                  <span className="text-sm font-semibold">🧱 Building Block Question</span>
                  <span className="text-xs ml-2 opacity-80">· Strengthen your foundation</span>
                </div>
              )}
              
              {/* Exam Question Banner */}
              {current.isExamQuestion && !isScaffoldQuestion && (
                <div className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center">
                  <span className="text-sm font-semibold">📝 Exam Question</span>
                  <span className="text-xs ml-2 opacity-80">· Get this right to master {current.objective.code}!</span>
                </div>
              )}

              {/* Header with badges */}
              <div 
                className="px-6 py-3 flex items-center gap-2 flex-wrap"
                style={{ backgroundColor: isScaffoldQuestion ? '#eef2ff' : current.isExamQuestion ? '#fef3c7' : TOPIC_HEX[current.objective.topic] + '15' }}
              >
                <span 
                  className="px-2 py-1 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: isScaffoldQuestion ? '#6366f1' : current.isExamQuestion ? '#f59e0b' : TOPIC_HEX[current.objective.topic] }}
                >
                  {current.prerequisiteCode || current.objective.code}
                </span>
                <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded-lg" style={{ color: isScaffoldQuestion ? '#6366f1' : current.isExamQuestion ? '#b45309' : TOPIC_HEX[current.objective.topic] }}>
                  {isScaffoldQuestion ? 'Foundation Skill' : current.objective.topicName}
                </span>
                {current.objective.isHigher && !isScaffoldQuestion && (
                  <span className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-lg">Higher</span>
                )}
                
                {/* Progress toward mastery - show for non-scaffold questions */}
                {!isScaffoldQuestion && !current.isExamQuestion && (
                  <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg">
                    {Math.min(progress[current.objective.code]?.quickCorrect ?? 0, 4)}/4 quick
                  </span>
                )}
                
                {/* Calculator badge */}
                <span className={`ml-auto px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  current.calculator ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {current.calculator ? '🧮' : '✏️'}
                  {current.calculator ? 'Calculator' : 'Non-calc'}
                </span>
              </div>

              {/* Question content */}
              <div className="p-6">
                {/* Diagram if applicable */}
                {current.diagram && (
                  <div className="mb-4" dangerouslySetInnerHTML={{ __html: generateDiagram(current.diagram) }} />
                )}

                {/* Question text */}
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  {current.q}
                </h3>

                {/* Hint for scaffold questions */}
                {current.hint && (settings?.showHints || isScaffoldQuestion) && (
                  <p className="text-sm text-slate-500 mb-4 italic">💡 {current.hint}</p>
                )}

                {/* Answer input */}
                {!showFeedback && (
                  <>
                    {current.type === 'self' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-500 mb-4">Try this on paper, then mark yourself:</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => checkAnswer(true)}
                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Got it right
                          </button>
                          <button
                            onClick={() => checkAnswer(false)}
                            className="flex-1 py-3 bg-red-400 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <X className="w-5 h-5" />
                            Got it wrong
                          </button>
                        </div>
                      </div>
                    ) : current.type === 'mcq' ? (
                      <div className="space-y-2">
                        {current.options.map((option, i) => (
                          <button
                            key={i}
                            onClick={() => { setUserAnswer(option); }}
                            className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${
                              userAnswer === option 
                                ? 'border-violet-500 bg-violet-50 text-violet-900' 
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-sm font-bold mr-3">
                              {['A', 'B', 'C', 'D'][i]}
                            </span>
                            {option}
                          </button>
                        ))}

                        {/* Confidence Rating for MCQ (cognitive science feature) */}
                        {userAnswer && practiceMode === 'standard' && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs text-slate-600 mb-2 font-medium">How confident are you? <span className="text-slate-400">(optional)</span></p>
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { value: 1, label: '🎲', desc: 'Guessing' },
                                { value: 2, label: '🤔', desc: 'Unsure' },
                                { value: 3, label: '😊', desc: 'Fairly sure' },
                                { value: 4, label: '😎', desc: 'Certain' },
                              ].map(({ value, label, desc }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setUserConfidence(userConfidence === value ? null : value)}
                                  className={`py-1.5 px-1 rounded-lg text-center transition-all text-sm ${
                                    userConfidence === value
                                      ? 'bg-violet-100 border-2 border-violet-400 text-violet-700'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
                                  }`}
                                >
                                  <span className="text-lg block">{label}</span>
                                  <span className="text-[10px] block">{desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer}
                          className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Input mode toggle */}
                        <div className="flex rounded-xl bg-slate-100 p-1">
                          <button
                            type="button"
                            onClick={() => { setInputMode('type'); clearPhoto(); }}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                              inputMode === 'type'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <span>⌨️</span> Type
                          </button>
                          <button
                            type="button"
                            onClick={() => aiUnlocked && setInputMode('photo')}
                            disabled={!aiUnlocked}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                              !aiUnlocked
                                ? 'text-slate-300 cursor-not-allowed'
                                : inputMode === 'photo'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700'
                            }`}
                            title={aiUnlocked ? 'Photo mode' : `Unlocks after ${AI_UNLOCK_THRESHOLD - totalQuestionsAnswered} more questions`}
                          >
                            <span>{aiUnlocked ? '📷' : '🔒'}</span> Photo
                            {!aiUnlocked && (
                              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full">
                                {AI_UNLOCK_THRESHOLD - totalQuestionsAnswered}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Type mode */}
                        {inputMode === 'type' && (
                          <>
                            {/* Input with math keyboard toggle */}
                            <div className="relative">
                              <input
                                ref={inputRef}
                                type="text"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && userAnswer && checkAnswer()}
                                placeholder="Type your answer..."
                                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:outline-none text-lg"
                                autoFocus
                              />
                              {/* Math keyboard toggle button */}
                              <button
                                type="button"
                                onClick={() => setShowMathKeyboard(!showMathKeyboard)}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                  showMathKeyboard 
                                    ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                                title="Math symbols"
                              >
                                <span className="text-sm font-bold">π</span>
                              </button>
                            </div>
                        
                            {/* Math Keyboard */}
                            {showMathKeyboard && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-lg">
                                {/* Keyboard tabs */}
                                <div className="flex gap-1 mb-2 pb-2 border-b border-slate-200">
                                  {[
                                    { id: '123', label: '123' },
                                    { id: 'f(x)', label: 'f(x)' },
                                    { id: 'ABC', label: 'ABC' },
                                    { id: 'symbols', label: '#&¬' },
                                  ].map(tab => (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => setMathKeyboardTab(tab.id)}
                                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                        mathKeyboardTab === tab.id
                                          ? 'bg-violet-100 text-violet-700'
                                          : 'text-slate-500 hover:bg-slate-100'
                                      }`}
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>
                            
                                {/* Keyboard keys */}
                            <div className="grid grid-cols-10 gap-1">
                              {mathKeyboardTab === '123' && (
                                <>
                                  {/* Row 1 */}
                                  {['x', 'y', 'π', 'e', '7', '8', '9', '×', '÷'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => key && insertSymbol(key)}
                                      disabled={!key}
                                      className={`p-2 rounded-lg text-center font-medium transition-all ${
                                        key ? 'bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100' : ''
                                      } ${['×', '÷', '+', '−', '='].includes(key) ? 'bg-slate-100' : ''}`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {/* Fraction button - inserts / for typing fractions like 3/4 */}
                                  <button
                                    type="button"
                                    onClick={() => insertSymbol('/')}
                                    className="p-2 rounded-lg text-center font-medium transition-all bg-amber-50 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 active:bg-amber-200"
                                    title="Insert fraction (type like 3/4)"
                                  >
                                    <span className="text-xs leading-none flex flex-col items-center">
                                      <span className="border-b border-current px-1">a</span>
                                      <span className="px-1">b</span>
                                    </span>
                                  </button>
                                  
                                  {/* Row 2 */}
                                  {['²', '³', '√', '∛', '4', '5', '6', '+', '−'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => key && insertSymbol(key)}
                                      disabled={!key}
                                      className={`p-2 rounded-lg text-center font-medium transition-all ${
                                        key ? 'bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100' : ''
                                      } ${['×', '÷', '+', '−', '='].includes(key) ? 'bg-slate-100' : ''}`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {/* Mixed number button - inserts space then / for typing like 1 3/4 */}
                                  <button
                                    type="button"
                                    onClick={() => insertSymbol(' /')}
                                    className="p-2 rounded-lg text-center font-medium transition-all bg-amber-50 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 active:bg-amber-200"
                                    title="Insert mixed number (type like 1 3/4)"
                                  >
                                    <span className="text-xs leading-none flex items-center gap-0.5">
                                      <span>1</span>
                                      <span className="flex flex-col items-center">
                                        <span className="border-b border-current px-0.5 text-[10px]">a</span>
                                        <span className="px-0.5 text-[10px]">b</span>
                                      </span>
                                    </span>
                                  </button>
                                  
                                  {/* Row 3 */}
                                  {['<', '>', '≤', '≥', '1', '2', '3', '=', '≠', '⌫'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => key === '⌫' ? setUserAnswer(prev => prev.slice(0, -1)) : insertSymbol(key)}
                                      className={`p-2 rounded-lg text-center font-medium transition-all ${
                                        key === '⌫' ? 'bg-slate-200 hover:bg-slate-300' :
                                        'bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100'
                                      } ${['×', '÷', '+', '−', '=', '≠'].includes(key) ? 'bg-slate-100' : ''}`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  
                                  {/* Row 4 */}
                                  {['±', '°', '(', ')', '0', '.', '/', ':', '%', '↵'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => key === '↵' ? (userAnswer && checkAnswer()) : insertSymbol(key)}
                                      className={`p-2 rounded-lg text-center font-medium transition-all ${
                                        key === '↵' ? 'bg-violet-500 text-white hover:bg-violet-600' :
                                        'bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100'
                                      }`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                </>
                              )}
                              
                              {mathKeyboardTab === 'f(x)' && (
                                <>
                                  {['sin', 'cos', 'tan', 'log', '⁻¹', 'ⁿ', '√', '∛', '(', ')'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center text-sm font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['θ', 'α', 'β', 'Δ', '∞', 'Σ', '∫', 'λ', 'μ', 'σ'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₀'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                </>
                              )}
                              
                              {mathKeyboardTab === 'ABC' && (
                                <>
                                  {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['u', 'v', 'w', 'x', 'y', 'z', ' ', ' ', ' ', '⌫'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => key === '⌫' ? setUserAnswer(prev => prev.slice(0, -1)) : key.trim() && insertSymbol(key)}
                                      disabled={!key.trim() && key !== '⌫'}
                                      className={`p-2 rounded-lg text-center font-medium transition-all ${
                                        key === '⌫' ? 'bg-slate-200 hover:bg-slate-300' :
                                        key.trim() ? 'bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100' : ''
                                      }`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                </>
                              )}
                              
                              {mathKeyboardTab === 'symbols' && (
                                <>
                                  {['∈', '∉', '⊂', '⊃', '∪', '∩', '∅', '∀', '∃', '¬'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['→', '←', '↔', '⇒', '⇔', '∧', '∨', '⊕', '≡', '≈'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['£', '$', '€', '¢', '‰', '′', '″', '…', '·', '×'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100 transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                          </>
                        )}

                        {/* Photo mode */}
                        {inputMode === 'photo' && (
                          <div className="space-y-3">
                            {/* Hidden file input */}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handlePhotoCapture}
                              className="hidden"
                            />
                            
                            {!capturedImage ? (
                              <div className="space-y-2">
                                {/* Camera capture button */}
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-violet-400 hover:bg-violet-50 transition-all flex flex-col items-center gap-2 text-slate-500 hover:text-violet-600"
                                >
                                  <span className="text-4xl">📷</span>
                                  <span className="font-medium">Take a photo of your answer</span>
                                  <span className="text-xs text-slate-400">or tap to upload from gallery</span>
                                </button>
                                
                                <p className="text-xs text-center text-slate-400">
                                  Write your answer clearly on paper, then photograph it
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* Image preview */}
                                <div className="relative">
                                  <img 
                                    src={capturedImage} 
                                    alt="Your handwritten answer" 
                                    className="w-full rounded-xl border border-slate-200"
                                  />
                                  {/* Processing overlay */}
                                  {isProcessingImage && (
                                    <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="animate-spin text-3xl mb-2">🔍</div>
                                        <p className="text-sm font-medium text-slate-600">Reading your handwriting...</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* Clear button */}
                                  <button
                                    type="button"
                                    onClick={clearPhoto}
                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                
                                {/* Extracted answer display */}
                                {userAnswer && !isProcessingImage && (
                                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <p className="text-xs text-emerald-600 mb-1">AI read your answer as:</p>
                                    <p className="text-lg font-semibold text-emerald-700">{userAnswer}</p>
                                    <p className="text-xs text-emerald-500 mt-1">
                                      You can edit this if it's not quite right
                                    </p>
                                  </div>
                                )}
                                
                                {/* Editable answer field */}
                                {!isProcessingImage && (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={userAnswer}
                                      onChange={(e) => setUserAnswer(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && userAnswer && checkAnswer()}
                                      placeholder="Edit answer if needed..."
                                      className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:outline-none text-lg"
                                    />
                                  </div>
                                )}
                                
                                {/* Retake button */}
                                <button
                                  type="button"
                                  onClick={() => { clearPhoto(); fileInputRef.current?.click(); }}
                                  className="w-full py-2 text-sm text-slate-500 hover:text-violet-600 transition-all"
                                >
                                  📷 Take a new photo
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Confidence Rating (cognitive science feature) */}
                        {userAnswer && !isProcessingImage && practiceMode === 'standard' && (
                          <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs text-slate-600 mb-2 font-medium">How confident are you? <span className="text-slate-400">(optional)</span></p>
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { value: 1, label: '🎲', desc: 'Guessing' },
                                { value: 2, label: '🤔', desc: 'Unsure' },
                                { value: 3, label: '😊', desc: 'Fairly sure' },
                                { value: 4, label: '😎', desc: 'Certain' },
                              ].map(({ value, label, desc }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setUserConfidence(userConfidence === value ? null : value)}
                                  className={`py-1.5 px-1 rounded-lg text-center transition-all text-sm ${
                                    userConfidence === value
                                      ? 'bg-violet-100 border-2 border-violet-400 text-violet-700'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
                                  }`}
                                >
                                  <span className="text-lg block">{label}</span>
                                  <span className="text-[10px] block">{desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer || isProcessingImage}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold rounded-xl transition-all"
                        >
                          {isProcessingImage ? 'Processing...' : 'Check Answer'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Feedback */}
                {showFeedback && (
                  <div className="space-y-4">
                    {/* Exam Mode - Minimal feedback only */}
                    {practiceMode === 'exam' ? (
                      <div className={`p-4 rounded-xl ${
                        isCorrect 
                          ? 'bg-emerald-50 border border-emerald-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <>
                              <Check className="w-5 h-5 text-emerald-600" />
                              <span className="font-semibold text-emerald-700">Correct</span>
                            </>
                          ) : (
                            <>
                              <X className="w-5 h-5 text-red-600" />
                              <span className="font-semibold text-red-700">Incorrect</span>
                              {current.a && (
                                <span className="text-sm text-slate-600 ml-2">
                                  Answer: <strong>{current.a}</strong>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Scaffold Question Indicator */}
                        {isScaffoldQuestion && (
                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <div className="flex items-center gap-2 text-indigo-700">
                              <span className="text-xl">🧱</span>
                              <div>
                                <span className="font-semibold">Building Block Question</span>
                                <p className="text-xs text-indigo-600">Strengthening your foundation before the harder question</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className={`p-4 rounded-xl ${
                          isCorrect 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {isCorrect ? (
                              <>
                                <Check className="w-5 h-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-700">
                                  {isScaffoldQuestion ? 'Great! Foundation strengthened!' : 'Correct!'}
                                </span>
                              </>
                            ) : (
                              <>
                                <X className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-red-700">Not quite</span>
                              </>
                            )}
                          </div>
                          {current.a && !isCorrect && (
                            <p className="text-sm text-slate-600 mb-2">
                              The answer was: <strong>{current.a}</strong>
                            </p>
                          )}
                        </div>

                        {/* AI Analyzing Indicator - only when AI is unlocked */}
                        {!isCorrect && isAnalyzing && aiUnlocked && !currentDiagnosis?.isAI && (
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <span className="text-xl animate-spin">🤖</span>
                              </div>
                              <div>
                                <h4 className="font-semibold text-purple-900">AI Coach is analyzing your answer...</h4>
                                <p className="text-sm text-purple-600">Finding what went wrong</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Diagnosis - different style for AI vs pattern matching */}
                        {!isCorrect && currentDiagnosis?.hasDiagnosis && (
                          <div className={`p-4 rounded-xl ${
                            currentDiagnosis.isAI 
                              ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200' 
                              : 'bg-amber-50 border border-amber-200'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                currentDiagnosis.isAI ? 'bg-purple-100' : 'bg-amber-100'
                              }`}>
                                <span className="text-xl">{currentDiagnosis.isAI ? '🤖' : '💡'}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`font-semibold ${currentDiagnosis.isAI ? 'text-purple-900' : 'text-amber-900'}`}>
                                    {currentDiagnosis.isAI ? 'What went wrong?' : 'Hint'}
                                  </h4>
                                  {currentDiagnosis.isAI && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded-full font-medium">
                                      AI Coach
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm mb-2 ${currentDiagnosis.isAI ? 'text-purple-800' : 'text-amber-800'}`}>
                                  {currentDiagnosis.diagnosis}
                                </p>
                                {currentDiagnosis.tip && (
                                  <div className={`mt-2 p-2 rounded-lg ${currentDiagnosis.isAI ? 'bg-white/60' : 'bg-white/80'}`}>
                                    <p className={`text-xs ${currentDiagnosis.isAI ? 'text-purple-700' : 'text-amber-700'}`}>
                                      <span className="font-semibold">💡 Try this:</span> {currentDiagnosis.tip}
                                    </p>
                                  </div>
                                )}
                                {currentDiagnosis.encouragement && currentDiagnosis.isAI && (
                                  <p className="text-xs text-purple-600 mt-2 italic">
                                    {currentDiagnosis.encouragement}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Skill Tool Offer - shown immediately on failure if prerequisite exists */}
                        {!isCorrect && scaffoldInfo && !isScaffoldQuestion && scaffoldInfo.prereqCode && miniLessons[scaffoldInfo.prereqCode] && (
                          <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-300 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                                <span className="text-2xl">🔧</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-violet-900 mb-1">
                                  The {miniLessons[scaffoldInfo.prereqCode].title} Tool
                                </h4>
                                <p className="text-sm text-violet-700 mb-3">
                                  {scaffoldInfo.reason}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startMiniLesson(scaffoldInfo.prereqCode)}
                                    className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all shadow-md flex items-center gap-2"
                                  >
                                    <span>🔧</span> Use This Tool
                                  </button>
                                  <button
                                    onClick={() => nextQuestion()}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-all"
                                  >
                                    Skip
                                  </button>
                                </div>
                                <p className="text-xs text-violet-500 mt-2">
                                  60 seconds · Then try a practice question
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                    
                        {/* Building Block Notice - when no mini-lesson available */}
                        {!isCorrect && scaffoldInfo && !isScaffoldQuestion && (!scaffoldInfo.prereqCode || !miniLessons[scaffoldInfo.prereqCode]) && (
                          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-xl">🪜</span>
                              </div>
                              <div>
                                <h4 className="font-semibold text-amber-900 mb-1">Let's build up to this!</h4>
                                <p className="text-sm text-amber-800">
                                  Next, you'll get a simpler question to strengthen your foundation.
                                </p>
                                <p className="text-xs text-amber-600 mt-2">
                                  ✨ This is how the best maths learners improve - one step at a time!
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Worked Example - only show when incorrect and no diagnosis */}
                        {!isCorrect && !currentDiagnosis?.hasDiagnosis && workedExamples[current.objective.code] && (
                          <details className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
                            <summary className="p-4 cursor-pointer font-semibold text-blue-800 hover:bg-blue-100 transition-colors flex items-center gap-2">
                              <BookOpen className="w-5 h-5" />
                              View Worked Example: {workedExamples[current.objective.code].title}
                            </summary>
                            <div className="p-4 pt-0 space-y-4">
                              {/* Steps */}
                              <div>
                                <h4 className="font-semibold text-blue-900 mb-2">Method:</h4>
                                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                  {workedExamples[current.objective.code].steps.map((step, i) => (
                                    <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                                  ))}
                                </ol>
                              </div>
                              
                              {/* Worked Example */}
                              <div className="bg-white/50 rounded-lg p-3">
                                <h4 className="font-semibold text-blue-900 mb-2">Example: {workedExamples[current.objective.code].example.q}</h4>
                                <div className="text-sm text-blue-800 space-y-1">
                                  {workedExamples[current.objective.code].example.solution.map((line, i) => (
                                    <p key={i} className={line.startsWith('Answer') || line.startsWith('=') ? 'font-semibold' : ''}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </div>
                          
                              {/* Exam Tip */}
                              <div className="bg-amber-100/50 rounded-lg p-3">
                                <p className="text-sm text-amber-900">
                                  <span className="font-semibold">📝 Exam Tip:</span> {workedExamples[current.objective.code].examTip}
                                </p>
                              </div>
                            </div>
                          </details>
                        )}
                    
                        {/* Simple revision hint if no worked example and no diagnosis */}
                        {!isCorrect && !currentDiagnosis?.hasDiagnosis && !workedExamples[current.objective.code] && revisionHints[current.objective.code] && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                              <span className="font-semibold">📚 Revision tip:</span> {revisionHints[current.objective.code]}
                            </p>
                          </div>
                        )}

                        {/* Exam technique tip - standard mode only */}
                        {isCorrect && !isScaffoldQuestion && examTips[current.objective.topic] && practiceMode !== 'exam' && (
                          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                            <p className="text-sm text-violet-800">
                              <span className="font-semibold">📝 Exam Tip:</span> {examTips[current.objective.topic]}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <button
                      onClick={nextQuestion}
                      className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        scaffoldInfo && !isScaffoldQuestion && !isCorrect && practiceMode !== 'exam'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {scaffoldInfo && !isScaffoldQuestion && !isCorrect && practiceMode !== 'exam' ? (
                        <>🧱 Try Building Block</>
                      ) : currentIndex < sessionQueue.length - 1 ? (
                        <>Continue <ChevronRight className="w-5 h-5" /></>
                      ) : (
                        <>See Results <ChevronRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mini-Lesson Modal */}
      {showMiniLesson && currentMiniLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-200 text-sm font-medium">🔧 Skill Tool</p>
                  <h2 className="text-white text-2xl font-bold">The {currentMiniLesson.title} Tool</h2>
                </div>
                <div className="flex items-center gap-3">
                  {/* Timer */}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${
                    miniLessonTimer > 30 ? 'bg-white/20 text-white' :
                    miniLessonTimer > 10 ? 'bg-amber-400 text-amber-900' :
                    'bg-red-400 text-red-900 animate-pulse'
                  }`}>
                    {miniLessonTimer}s
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Key Points */}
              <div className="bg-violet-50 rounded-xl p-4">
                <h3 className="font-bold text-violet-900 mb-3 flex items-center gap-2">
                  <span>📌</span> Key Points
                </h3>
                <ul className="space-y-2">
                  {currentMiniLesson.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-violet-800">
                      <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-sm font-bold text-violet-700 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Worked Example */}
              <div className="bg-emerald-50 rounded-xl p-4">
                <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                  <span>✏️</span> Worked Example
                </h3>
                <div className="bg-white rounded-lg p-4 mb-3">
                  <p className="font-semibold text-slate-900 mb-2">{currentMiniLesson.example.problem}</p>
                  <div className="space-y-1">
                    {currentMiniLesson.example.steps.map((step, i) => (
                      <p key={i} className={`text-sm ${
                        i === currentMiniLesson.example.steps.length - 1 
                          ? 'font-bold text-emerald-700' 
                          : 'text-slate-600'
                      }`}>
                        {step}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Common Mistakes */}
              <div className="bg-red-50 rounded-xl p-4">
                <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                  <span>⚠️</span> Common Mistakes to Avoid
                </h3>
                <ul className="space-y-2">
                  {currentMiniLesson.commonMistakes.map((mistake, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                      <span className="text-red-500">✗</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Quick Tip */}
              <div className="bg-amber-100 rounded-xl p-4">
                <p className="font-bold text-amber-900 text-lg">
                  {currentMiniLesson.quickTip}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                {miniLessonComplete ? (
                  <>
                    <button
                      onClick={() => closeMiniLesson(true)}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <span>🎯</span> Try a Practice Question
                    </button>
                    <button
                      onClick={() => closeMiniLesson(false)}
                      className="px-6 py-4 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-all"
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-slate-500 text-sm mb-2">Take a moment to read through the lesson...</p>
                    <button
                      onClick={() => { setMiniLessonTimer(0); setMiniLessonComplete(true); }}
                      className="text-violet-600 hover:text-violet-700 text-sm font-medium"
                    >
                      I've finished reading ↓
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* AI Coach Unlock Notification */}
      {showAIUnlockNotification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-bounce-in">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 p-8 text-center relative overflow-hidden">
              {/* Sparkles */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-4 left-8 text-2xl animate-pulse">✨</div>
                <div className="absolute top-8 right-12 text-xl animate-pulse delay-100">⭐</div>
                <div className="absolute bottom-6 left-16 text-lg animate-pulse delay-200">💫</div>
                <div className="absolute bottom-4 right-8 text-2xl animate-pulse delay-300">✨</div>
              </div>
              
              <div className="relative">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <span className="text-5xl">🤖</span>
                </div>
                <h2 className="text-white text-2xl font-bold mb-2">AI Coach Unlocked!</h2>
                <p className="text-violet-100">You've earned a personal tutor</p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-center">
                After {AI_UNLOCK_THRESHOLD} questions, you've unlocked <strong>AI-powered features</strong>:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <p className="font-semibold text-purple-900">Smart Error Analysis</p>
                    <p className="text-xs text-purple-600">AI identifies exactly where you went wrong</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
                  <span className="text-2xl">📷</span>
                  <div>
                    <p className="font-semibold text-violet-900">Photo Answers</p>
                    <p className="text-xs text-violet-600">Photograph your handwritten working</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="font-semibold text-indigo-900">Personalised Feedback</p>
                    <p className="text-xs text-indigo-600">Encouragement tailored to your mistakes</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setShowAIUnlockNotification(false)}
                className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold rounded-xl hover:from-violet-600 hover:to-purple-600 transition-all shadow-lg mt-4"
              >
                Let's Go! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STATS PAGE ====================

function StatsPage({ currentPage, setCurrentPage, dayStreak, progress, allObjectives }) {
  const [timeRange, setTimeRange] = useState('week'); // 'week', 'month', 'all'
  const sessionHistory = loadSessionHistory();
  
  // Calculate time-based stats
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  const filteredHistory = sessionHistory.filter(s => {
    if (timeRange === 'week') return s.date > weekAgo;
    if (timeRange === 'month') return s.date > monthAgo;
    return true;
  });
  
  // Overall stats
  const totalSessions = sessionHistory.length;
  const totalQuestions = sessionHistory.reduce((sum, s) => sum + s.total, 0);
  const totalCorrect = sessionHistory.reduce((sum, s) => sum + s.correct, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  // Period stats
  const periodSessions = filteredHistory.length;
  const periodQuestions = filteredHistory.reduce((sum, s) => sum + s.total, 0);
  const periodCorrect = filteredHistory.reduce((sum, s) => sum + s.correct, 0);
  const periodAccuracy = periodQuestions > 0 ? Math.round((periodCorrect / periodQuestions) * 100) : 0;
  
  // Topic breakdown
  const topicStats = {};
  Object.entries(TOPIC_HEX).forEach(([topic]) => {
    const topicObjectives = allObjectives?.filter(o => o.topic === topic) ?? [];
    const mastered = topicObjectives.filter(o => isMastered(progress[o.code])).length;
    const examReady = topicObjectives.filter(o => {
      const prog = progress[o.code];
      return (prog?.quickCorrect ?? 0) >= 4 && !prog?.examPassed;
    }).length;
    const learning = topicObjectives.filter(o => {
      const prog = progress[o.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      return quickCorrect > 0 && quickCorrect < 4 && !prog?.examPassed;
    }).length;
    topicStats[topic] = {
      total: topicObjectives.length,
      mastered,
      examReady,
      learning,
      notStarted: topicObjectives.length - mastered - examReady - learning,
      percentage: topicObjectives.length > 0 ? Math.round((mastered / topicObjectives.length) * 100) : 0,
    };
  });
  
  // Weekly activity chart data (last 7 days)
  const weeklyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    const daySessions = sessionHistory.filter(s => s.date >= dayStart.getTime() && s.date <= dayEnd.getTime());
    const dayQuestions = daySessions.reduce((sum, s) => sum + s.total, 0);
    const dayCorrect = daySessions.reduce((sum, s) => sum + s.correct, 0);
    
    weeklyActivity.push({
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayStart.getDay()],
      questions: dayQuestions,
      correct: dayCorrect,
      sessions: daySessions.length,
    });
  }
  
  // Calculate exam readiness
  const totalObjectiveCount = allObjectives?.length ?? 0;
  const masteredCount = allObjectives?.filter(o => isMastered(progress[o.code])).length ?? 0;
  const examReadyCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    return (prog?.quickCorrect ?? 0) >= 4 && !prog?.examPassed;
  }).length ?? 0;
  const learningCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    const quickCorrect = prog?.quickCorrect ?? 0;
    return quickCorrect > 0 && quickCorrect < 4 && !prog?.examPassed;
  }).length ?? 0;
  
  // Weighted readiness: mastered = 100%, exam ready = 80%, learning = 40%, not started = 0%
  const readinessScore = totalObjectiveCount > 0 
    ? Math.round(((masteredCount * 100) + (examReadyCount * 80) + (learningCount * 40)) / totalObjectiveCount)
    : 0;
  
  const getReadinessLabel = (score) => {
    if (score >= 80) return { label: 'Exam Ready! 🎯', color: 'text-emerald-600' };
    if (score >= 60) return { label: 'Almost There! 📚', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Making Progress 💪', color: 'text-amber-600' };
    if (score >= 20) return { label: 'Getting Started 🌱', color: 'text-orange-600' };
    return { label: 'Just Beginning 🚀', color: 'text-slate-600' };
  };
  
  const readiness = getReadinessLabel(readinessScore);
  
  // Max for chart scaling
  const maxQuestions = Math.max(...weeklyActivity.map(d => d.questions), 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
      
      <div className="pt-24 pb-24 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Progress Analytics</h1>
            <p className="text-slate-500 mt-1">Track your learning journey</p>
          </div>

          {/* Exam Readiness Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Exam Readiness</h2>
                <p className={`text-sm font-medium ${readiness.color}`}>{readiness.label}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-slate-900">{readinessScore}%</div>
              </div>
            </div>
            
            {/* Readiness bar */}
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">{masteredCount}</div>
                <div className="text-xs text-slate-500">Mastered</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-600">{learningCount}</div>
                <div className="text-xs text-slate-500">Learning</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-400">{totalObjectiveCount - masteredCount - learningCount}</div>
                <div className="text-xs text-slate-500">Not Started</div>
              </div>
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Weekly Activity</h2>
              </div>
            </div>
            
            {/* Simple bar chart */}
            <div className="flex items-end justify-between gap-2 h-32 mt-4">
              {weeklyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    {day.questions > 0 ? (
                      <div 
                        className="w-full max-w-[40px] bg-gradient-to-t from-indigo-500 to-violet-400 rounded-t-lg transition-all"
                        style={{ height: `${(day.questions / maxQuestions) * 100}%`, minHeight: '8px' }}
                      />
                    ) : (
                      <div className="w-full max-w-[40px] h-2 bg-slate-100 rounded-lg" />
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{day.day}</span>
                  <span className="text-xs font-medium text-slate-700">{day.questions}</span>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">{weeklyActivity.reduce((s, d) => s + d.sessions, 0)}</div>
                <div className="text-xs text-slate-500">Sessions this week</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">{weeklyActivity.reduce((s, d) => s + d.questions, 0)}</div>
                <div className="text-xs text-slate-500">Questions answered</div>
              </div>
            </div>
          </div>

          {/* Streak Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{dayStreak} Day Streak</h2>
                  <p className="text-xs text-slate-500">Last 12 weeks of activity</p>
                </div>
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="flex gap-1 overflow-x-auto pb-2">
              {(() => {
                const dailyActivity = loadDailyActivity();
                const weeks = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                for (let w = 11; w >= 0; w--) {
                  const weekDays = [];
                  for (let d = 6; d >= 0; d--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - (w * 7 + d));
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const activity = dailyActivity[key];
                    const questions = activity?.questions ?? 0;
                    const intensity = questions === 0 ? 0 : questions >= 10 ? 4 : questions >= 7 ? 3 : questions >= 4 ? 2 : 1;
                    
                    weekDays.push(
                      <div
                        key={key}
                        className={`w-4 h-4 rounded-sm transition-colors ${
                          intensity === 0 ? 'bg-slate-100' :
                          intensity === 1 ? 'bg-violet-200' :
                          intensity === 2 ? 'bg-violet-300' :
                          intensity === 3 ? 'bg-violet-400' :
                          'bg-violet-600'
                        }`}
                        title={`${key}: ${questions} questions`}
                      />
                    );
                  }
                  weeks.push(
                    <div key={w} className="flex flex-col gap-1">
                      {weekDays}
                    </div>
                  );
                }
                return weeks;
              })()}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-slate-100" />
                <div className="w-3 h-3 rounded-sm bg-violet-200" />
                <div className="w-3 h-3 rounded-sm bg-violet-300" />
                <div className="w-3 h-3 rounded-sm bg-violet-400" />
                <div className="w-3 h-3 rounded-sm bg-violet-600" />
                <span>More</span>
              </div>
              <div className="text-xs text-slate-500">
                {Object.keys(loadDailyActivity()).length} days practiced
              </div>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="font-semibold text-slate-900">All-Time Stats</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{totalSessions}</div>
                <div className="text-sm text-slate-500">Total Sessions</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{totalQuestions}</div>
                <div className="text-sm text-slate-500">Questions Answered</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{overallAccuracy}%</div>
                <div className="text-sm text-emerald-600">Accuracy</div>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-600">{dayStreak}</div>
                <div className="text-sm text-violet-600">Current Streak</div>
              </div>
            </div>
            
            {/* Streak Protection Stats */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-600">{loadStreakData().longestStreak}</div>
                <div className="text-xs text-amber-600">🏆 Longest Streak</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{loadStreakData().freezesAvailable}</div>
                <div className="text-xs text-blue-600">🛡️ Streak Freezes</div>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 mt-3 text-center">
              Earn freezes at 7, 14, 30, 60, 90, 180 & 365 day milestones
            </p>
            
            {/* Best Practice Time */}
            {getBestPracticeTime() && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">🕐 Best time to practice:</span>
                  <span className="font-semibold text-slate-700">{getBestPracticeTime()}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Based on when you're most active</p>
              </div>
            )}
          </div>

          {/* Topic Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <Award className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="font-semibold text-slate-900">Topic Mastery</h2>
            </div>
            
            <div className="space-y-3">
              {Object.entries(topicStats).map(([topic, stats]) => (
                <div key={topic} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TOPIC_HEX[topic] }}
                      />
                      <span className="font-medium text-slate-700">{topic}</span>
                    </div>
                    <span className="text-slate-500">
                      {stats.mastered}/{stats.total} mastered
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${stats.percentage}%`,
                        backgroundColor: TOPIC_HEX[topic]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          {sessionHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Recent Sessions</h2>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessionHistory.slice(-10).reverse().map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Session #{session.sessionNumber}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(session.date).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        session.correct === session.total ? 'text-emerald-600' :
                        session.correct >= session.total * 0.8 ? 'text-blue-600' :
                        'text-slate-600'
                      }`}>
                        {session.correct}/{session.total}
                      </div>
                      <div className="text-xs text-slate-500">
                        {Math.round((session.correct / session.total) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== SETTINGS PAGE ====================

function SettingsPage({ currentPage, setCurrentPage, dayStreak, settings, setSettings, progress, setProgress }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  
  // Generate plain-English weekly summary for teachers/parents
  const generateWeeklySummary = () => {
    const sessionHistory = loadSessionHistory();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekSessions = sessionHistory.filter(s => s.date > weekAgo);
    
    // Calculate stats
    const totalQuestions = weekSessions.reduce((sum, s) => sum + (s.total || 0), 0);
    const correctAnswers = weekSessions.reduce((sum, s) => sum + (s.correct || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    // Find topics practiced
    const topicCounts = {};
    const strugglingTopics = {};
    weekSessions.forEach(session => {
      session.results?.forEach(r => {
        const topic = r.topic || 'Unknown';
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        if (!r.correct) {
          strugglingTopics[topic] = (strugglingTopics[topic] || 0) + 1;
        }
      });
    });
    
    // Sort by count
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    
    const needsWork = Object.entries(strugglingTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    
    // Count mastered objectives
    const allObjectives = OBJECTIVES.filter(o => !o.higher || settings?.includeHigherTier);
    const masteredCount = allObjectives.filter(o => {
      const prog = progress[o.code];
      return prog?.examPassed && (prog?.quickCorrect ?? 0) >= 4;
    }).length;
    
    // Generate summary text
    const lines = [
      `GCSE MATHS WEEKLY SUMMARY`,
      `========================`,
      `Week ending: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      ``,
      `PRACTICE STATS`,
      `• Practice sessions: ${weekSessions.length}`,
      `• Questions answered: ${totalQuestions}`,
      `• Accuracy: ${accuracy}%`,
      `• Current streak: ${dayStreak} days`,
      ``,
      `OVERALL PROGRESS`,
      `• Objectives mastered: ${masteredCount} of ${allObjectives.length} (${Math.round(masteredCount/allObjectives.length*100)}%)`,
      ``,
      `FOCUS AREAS`,
      topTopics.length > 0 
        ? `• Focused on: ${topTopics.join(', ')}`
        : `• No practice sessions this week`,
      ``,
      needsWork.length > 0
        ? `NEEDS MORE PRACTICE\n• ${needsWork.join('\n• ')}`
        : `GREAT WORK! No struggling topics identified.`,
      ``,
      `---`,
      `Generated by GCSE Maths Habit Tracker`,
    ];
    
    return lines.join('\n');
  };
  
  // Export weekly summary
  const handleExportSummary = () => {
    const summary = generateWeeklySummary();
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maths-weekly-summary-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle export
  const handleExport = () => {
    const data = exportProgress();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maths-habit-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const success = importProgress(event.target.result);
        if (success) {
          setProgress(loadProgress());
          setSettings(loadSettings());
          setImportStatus('success');
        } else {
          setImportStatus('error');
        }
      } catch {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Handle reset
  const handleReset = () => {
    resetAllProgress();
    setProgress({});
    setShowResetConfirm(false);
  };

  // Update setting
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
      
      <div className="pt-24 pb-24 px-4">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 mt-1">Customise your learning experience</p>
          </div>

          {/* Study Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Study Preferences</h2>
                <p className="text-sm text-slate-500">Adjust your practice sessions</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Questions per session */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Questions per session</label>
                  <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">
                    {settings.questionsPerSession}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={settings.questionsPerSession}
                  onChange={(e) => updateSetting('questionsPerSession', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5</span>
                  <span>30</span>
                </div>
              </div>

              {/* Show hints toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-700">Show hints</div>
                  <div className="text-xs text-slate-500">Display helpful hints during practice</div>
                </div>
                <button
                  onClick={() => updateSetting('showHints', !settings.showHints)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.showHints ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.showHints ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Higher tier toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-700">Include Higher tier</div>
                  <div className="text-xs text-slate-500">Add Higher-only objectives to practice</div>
                </div>
                <button
                  onClick={() => updateSetting('includeHigherTier', !settings.includeHigherTier)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.includeHigherTier ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.includeHigherTier ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Daily goal */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Daily question goal</label>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    {settings.dailyGoal ?? 10}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.dailyGoal ?? 10}
                  onChange={(e) => updateSetting('dailyGoal', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5</span>
                  <span>50</span>
                </div>
              </div>

              {/* Weekly mastery goal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Weekly mastery goal</label>
                  <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                    {settings.weeklyMasteryGoal ?? 3}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={settings.weeklyMasteryGoal ?? 3}
                  onChange={(e) => updateSetting('weeklyMasteryGoal', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Objectives to master each week</p>
              </div>
            </div>
          </div>

          {/* Accessibility & Focus */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Accessibility</h2>
                <p className="text-sm text-slate-500">Customize your learning experience</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Text Size</label>
                <div className="flex gap-2">
                  {[
                    { value: 'normal', label: 'A', size: 'text-sm' },
                    { value: 'large', label: 'A', size: 'text-base' },
                    { value: 'xlarge', label: 'A', size: 'text-lg' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => updateSetting('fontSize', option.value)}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${option.size} ${
                        (settings.fontSize ?? 'normal') === option.value
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dyslexia-friendly font */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-700">Dyslexia-friendly font</div>
                  <div className="text-xs text-slate-500">Use OpenDyslexic for easier reading</div>
                </div>
                <button
                  onClick={() => updateSetting('dyslexiaFont', !settings.dyslexiaFont)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.dyslexiaFont ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.dyslexiaFont ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-700">High contrast</div>
                  <div className="text-xs text-slate-500">Increase color contrast for visibility</div>
                </div>
                <button
                  onClick={() => updateSetting('highContrast', !settings.highContrast)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.highContrast ? 'bg-slate-900' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.highContrast ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Data Management</h2>
                <p className="text-sm text-slate-500">Backup and manage your progress</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Weekly Summary for Parents/Teachers */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📋</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900">Weekly Summary</h3>
                    <p className="text-xs text-blue-700 mb-3">
                      Plain-English report for parents or teachers
                    </p>
                    <button
                      onClick={handleExportSummary}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      📥 Download Summary
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Export button */}
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Progress
              </button>

              {/* Import button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Progress
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />

              {/* Import status */}
              {importStatus && (
                <div className={`p-3 rounded-xl text-sm ${
                  importStatus === 'success' 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'bg-red-50 text-red-700'
                }`}>
                  {importStatus === 'success' 
                    ? '✓ Progress imported successfully!' 
                    : '✗ Failed to import. Check file format.'}
                </div>
              )}

              {/* Reset button */}
              <div className="pt-4 border-t border-slate-100">
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Progress
                  </button>
                ) : (
                  <div className="bg-red-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-700 mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold">Are you sure?</span>
                    </div>
                    <p className="text-sm text-red-600 mb-4">
                      This will permanently delete all your progress. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors border border-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Yes, Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">About</h2>
                <p className="text-sm text-slate-500">The Maths Habit v1.0</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              A spaced repetition app designed to help GCSE students master every maths objective. 
              Practice a little each day to build lasting understanding and confidence.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Objectives tracked</span>
                <span className="font-medium text-slate-900">{Object.keys(progress).length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreakDisplay({ streak }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-xl border border-orange-200">
      <Flame className="w-5 h-5 text-orange-500" />
      <span className="font-bold text-orange-600">{streak}</span>
      <span className="text-sm text-orange-500 hidden sm:inline">day streak</span>
    </div>
  );
}

function NavBar({ currentPage, setCurrentPage, streak }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'practice', label: 'Practice', icon: Dumbbell },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center p-1.5">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                  {[0.3, 0.6, 0.9, 0.5, 0.2, 0.8, 0.7, 0.4, 0.95].map((opacity, i) => (
                    <div key={i} className="rounded-sm" style={{ backgroundColor: `rgba(255,255,255,${opacity})` }} />
                  ))}
                </div>
              </div>
              <span className="font-bold text-xl text-slate-900 hidden sm:block">The Maths Habit</span>
            </button>

            {/* Nav links - desktop */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      currentPage === item.id
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Streak */}
            <StreakDisplay streak={streak} />
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate-200 md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                  currentPage === item.id
                    ? "text-violet-600"
                    : "text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default function App() {
  const [tier, setTier] = useState('foundation');
  const [tooltip, setTooltip] = useState({ open: false, x: 0, y: 0, objective: null });
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [currentPage, setCurrentPage] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  
  // Handle onboarding completion
  const completeOnboarding = () => {
    setOnboardingComplete();
    setShowOnboarding(false);
    setCurrentPage('practice'); // Go straight to practice
  };
  
  // Simple onboarding screen
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Heatmap Icon */}
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl p-2">
            <div className="grid grid-cols-3 gap-1 w-full h-full">
              {[0.3, 0.6, 0.9, 0.5, 0.2, 0.8, 0.7, 0.4, 0.95].map((opacity, i) => (
                <div 
                  key={i} 
                  className="rounded-sm" 
                  style={{ backgroundColor: `rgba(255,255,255,${opacity})` }}
                />
              ))}
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-3">The Maths Habit</h1>
          <p className="text-lg text-violet-100 mb-8">
            Master every GCSE objective,<br />
            one square at a time.
          </p>
          
          {/* Trust indicators */}
          <div className="flex justify-center gap-6 mb-10 text-violet-200 text-sm">
            <div className="flex items-center gap-1.5">
              <span>✓</span> 90+ objectives
            </div>
            <div className="flex items-center gap-1.5">
              <span>✓</span> Spaced practice
            </div>
          </div>
          
          <button
            onClick={completeOnboarding}
            className="w-full py-5 bg-white text-violet-700 font-bold text-xl rounded-2xl shadow-xl hover:bg-violet-50 transition-all active:scale-[0.98]"
          >
            Start Practicing →
          </button>
          
          <p className="text-violet-300 text-xs mt-6">
            No account needed · Progress saves locally
          </p>
        </div>
      </div>
    );
  }
  
  // Calculate real streak from activity with protection
  const streakInfo = calculateStreak();
  const dayStreak = streakInfo.streak;
  const practicedToday = streakInfo.practicedToday;
  const needsRepair = streakInfo.needsRepair;
  const repairProgress = streakInfo.repairProgress;
  const potentialStreak = streakInfo.potentialStreak;
  const freezesAvailable = streakInfo.freezesAvailable;
  const longestStreak = streakInfo.longestStreak;
  
  // Today's progress towards daily goal
  const dailyActivity = loadDailyActivity();
  const todayKey = getTodayKey();
  const todayQuestions = dailyActivity[todayKey]?.questions ?? 0;
  const dailyGoal = settings.dailyGoal ?? 10;
  const dailyProgress = Math.min((todayQuestions / dailyGoal) * 100, 100);
  
  // Weekly mastery progress
  const weeklyMastery = getWeeklyMastery(progress);
  const weeklyGoal = settings.weeklyMasteryGoal ?? 3;

  // Sync tier with settings
  const effectiveTier = settings.includeHigherTier ? 'higher' : tier;

  const getObjectives = (topic) => effectiveTier === 'higher' ? [...topic.foundation, ...topic.higher] : topic.foundation;
  
  const allObjectives = topics.flatMap(t => 
    getObjectives(t).map(code => ({ 
      code, 
      topic: t.strand, 
      topicName: t.name,
      title: descriptions[code],
      isHigher: t.higher.includes(code) 
    }))
  );

  const getLevel = (code) => getUnderstandingLevel(progress[code]);
  const totalMastered = allObjectives.filter(o => getLevel(o.code) >= 4).length;

  // FSRS: Calculate questions due for review today
  const fsrsData = loadFsrsData();
  const now = Date.now();
  const dueForReview = Object.values(fsrsData.questionCards || {}).filter(
    card => card.nextReview && card.nextReview <= now
  ).length;
  const totalCards = Object.keys(fsrsData.questionCards || {}).length;

  const handleMouseEnter = (e, obj) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      open: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      objective: obj
    });
  };

  const handleMouseLeave = () => {
    setTooltip(t => ({ ...t, open: false }));
  };

  const cols = Math.ceil(Math.sqrt(allObjectives.length * 1.3));

  // Spaced retrieval: weight objectives by how much they need practice
  const getWeightedObjectives = () => {
    return allObjectives.map(obj => {
      const prog = progress[obj.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      const examPassed = prog?.examPassed ?? false;
      const lastPracticed = prog?.lastPracticed ?? 0;
      const daysSince = lastPracticed ? Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24)) : 999;
      
      // Weight: lower progress = higher weight, longer time since practice = higher weight
      // Mastered objectives get lowest weight (1), exam ready get medium (3), others higher
      let progressWeight;
      if (examPassed) {
        progressWeight = 1; // Mastered - low priority
      } else if (quickCorrect >= 4) {
        progressWeight = 3; // Exam ready - medium priority
      } else {
        progressWeight = Math.max(5 - quickCorrect, 2); // Learning - higher priority
      }
      
      const timeWeight = Math.min(daysSince + 1, 7); // 1-7 based on days
      const weight = progressWeight * timeWeight;
      
      return { ...obj, weight };
    });
  };

  // Select 5 objectives for today's practice using weighted random selection
  const selectDailyObjectives = (seed) => {
    const weighted = getWeightedObjectives();
    const selected = [];
    const available = [...weighted];
    
    // Seeded random for consistent daily selection
    const seededRandom = (i) => {
      const x = Math.sin(seed + i * 9999) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < 5 && available.length > 0; i++) {
      const totalWeight = available.reduce((sum, obj) => sum + obj.weight, 0);
      let rand = seededRandom(i) * totalWeight;
      
      for (let j = 0; j < available.length; j++) {
        rand -= available[j].weight;
        if (rand <= 0) {
          selected.push(available[j]);
          available.splice(j, 1); // Remove selected item
          break;
        }
      }
    }
    
    // Fallback: if selection failed, just take first 5
    if (selected.length < 5) {
      const remaining = weighted.filter(w => !selected.find(s => s.code === w.code));
      while (selected.length < 5 && remaining.length > 0) {
        selected.push(remaining.shift());
      }
    }
    
    return selected;
  };

  // Get today's seed (changes daily)
  const todaySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  let dailyObjectives = selectDailyObjectives(todaySeed);
  
  // Fallback if selection returned empty
  if (!dailyObjectives || dailyObjectives.length === 0) {
    dailyObjectives = allObjectives.slice(0, 5);
  }

  // Placeholder pages
  if (currentPage === 'practice') {
    return (
      <PracticePage 
        dailyObjectives={dailyObjectives}
        progress={progress}
        setProgress={setProgress}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        allObjectives={allObjectives}
        settings={settings}
      />
    );
  }

  if (currentPage === 'stats') {
    return (
      <StatsPage
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        progress={progress}
        allObjectives={allObjectives}
      />
    );
  }

  if (currentPage === 'settings') {
    return (
      <SettingsPage
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        settings={settings}
        setSettings={setSettings}
        progress={progress}
        setProgress={setProgress}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      {/* Main Content */}
      <div className="pt-20 pb-24 md:pb-10">
        
      {/* Hero Heatmap Card */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
          
          {/* Header with stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Your Maths Journey</h1>
              <p className="text-slate-500 mt-1">{allObjectives.length} GCSE objectives · Click to track progress</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                  <span>✨</span> Smart Learning Active
                </span>
                <span className="text-xs text-slate-400">Powered by spaced repetition</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Tier toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                {['foundation', 'higher'].map(t => (
                  <button key={t} onClick={() => setTier(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                      tier === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>{t}</button>
                ))}
              </div>

              {/* Due for review badge */}
              {dueForReview > 0 && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 px-3 py-2 rounded-xl">
                  <span className="text-lg">🧠</span>
                  <span className="font-bold text-violet-700">{dueForReview}</span>
                  <span className="text-violet-600 text-sm">due</span>
                </div>
              )}

              {/* Mastery badge */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-4 py-2 rounded-xl">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-amber-700">{totalMastered}</span>
                <span className="text-amber-600 text-sm">/ {allObjectives.length}</span>
              </div>
            </div>
          </div>

          {/* Topic Legend - Top */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-6 pb-6 border-b border-slate-100">
            {Object.entries(TOPIC_HEX).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-sm text-slate-600">{name}</span>
              </div>
            ))}
          </div>

          {/* THE HEATMAP - Hero Element */}
          <div className="flex justify-center py-4">
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(28px, 36px))`,
              gap: 6
            }}>
              {allObjectives.map((obj) => {
                const level = getLevel(obj.code);
                const objProg = progress[obj.code];
                const isMastered = level >= 5; // Mastered = exam passed
                const isExamReady = level === 4; // Ready for exam question
                const recency = getRecencyFactor(objProg?.lastPracticed);
                const needsRevisit = recency < 0.6 && level > 0 && level < 5; // Faded = needs attention
                return (
                  <div
                    key={obj.code}
                    onMouseEnter={(e) => handleMouseEnter(e, obj)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: getTileColor(TOPIC_HEX[obj.topic], level, recency),
                      border: isMastered ? '2px solid rgba(255,255,255,0.8)' : 
                              isExamReady ? '2px solid #f59e0b' : 
                              needsRevisit ? '2px dashed rgba(0,0,0,0.2)' :
                              '1px solid rgba(0,0,0,0.06)',
                      boxShadow: isMastered ? '0 2px 8px rgba(0,0,0,0.15)' : 
                                 isExamReady ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                    }}
                    className="w-full transition-all duration-200 hover:scale-125 hover:shadow-xl hover:z-20 relative cursor-default"
                  >
                    {isMastered && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                      </span>
                    )}
                    {isExamReady && !isMastered && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs">📝</span>
                      </span>
                    )}
                    {needsRevisit && !isExamReady && (
                      <span className="absolute inset-0 flex items-center justify-center opacity-50">
                        <span className="text-[8px]">↻</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend - Readiness & Recency */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
              {/* Readiness indicators */}
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: '#8B5CF6', border: '2px solid rgba(255,255,255,0.8)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                  className="flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
                <span>Mastered</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: mixWithWhite('#8B5CF6', 0.75),
                    border: '2px solid #f59e0b',
                  }}
                />
                <span>Exam ready</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: mixWithWhite('#8B5CF6', 0.4),
                    border: '2px dashed rgba(0,0,0,0.2)',
                  }}
                  className="flex items-center justify-center opacity-60"
                >
                  <span className="text-[8px]">↻</span>
                </div>
                <span>Needs revisit</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Tiles fade when topics haven't been practiced recently · Questions are scheduled using cognitive science
            </p>
          </div>
          </div>
        </div>
      </div>

      {/* Streak Status & Daily Progress */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {/* Streak Repair Banner */}
        {needsRepair && (
          <div className="mb-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">🔧</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-bold text-lg">Repair Your Streak!</h3>
                <p className="text-amber-100 text-sm">
                  Complete 10 questions today to restore your {potentialStreak} day streak
                </p>
                <div className="mt-2 bg-white/20 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${repairProgress}%` }}
                  />
                </div>
                <p className="text-xs text-amber-100 mt-1">{todayQuestions}/10 questions · {Math.round(repairProgress)}% complete</p>
              </div>
              <button
                onClick={() => setCurrentPage('practice')}
                className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg"
              >
                Repair Now →
              </button>
            </div>
          </div>
        )}

        {/* Regular Progress Bar */}
        <div className={`bg-white rounded-2xl border p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] ${needsRepair ? 'border-amber-200' : 'border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Mini Progress Ring */}
            <div className="relative flex-shrink-0">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke={dailyProgress >= 100 ? '#10b981' : '#8b5cf6'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${dailyProgress * 1.38} 138`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-700">{todayQuestions}</span>
              </div>
            </div>
            
            {/* Status */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className={`text-sm font-semibold ${dailyProgress >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {dailyProgress >= 100 ? '🎉 Goal complete!' : `${todayQuestions}/${dailyGoal} today`}
                </span>
                <span className="text-slate-300">·</span>
                <span className={`text-sm flex items-center gap-1 ${needsRepair ? 'text-amber-600' : 'text-slate-500'}`}>
                  <Flame className={`w-4 h-4 ${needsRepair ? 'text-amber-500' : 'text-orange-500'}`} />
                  {needsRepair ? `${potentialStreak} day streak (needs repair)` : `${dayStreak} day streak`}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500">
                  ⭐ {weeklyMastery}/{weeklyGoal} weekly
                </span>
              </div>
              
              {/* Streak Freezes & Identity Message */}
              <div className="flex flex-wrap items-center gap-3 mt-2 justify-center sm:justify-start">
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                  🛡️ {freezesAvailable} streak {freezesAvailable === 1 ? 'freeze' : 'freezes'}
                </span>
                {longestStreak > 0 && (
                  <span className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-full">
                    🏆 Best: {longestStreak} days
                  </span>
                )}
                {dayStreak >= 3 && !needsRepair && (
                  <span className="text-xs text-slate-400 italic">
                    You're a person who does maths every day 💪
                  </span>
                )}
              </div>
            </div>
            
            {/* Start Practice Button */}
            <button
              onClick={() => setCurrentPage('practice')}
              className={`px-6 py-2.5 font-semibold rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                needsRepair 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/25'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              {needsRepair ? 'Repair Streak' : 'Practice'}
            </button>
          </div>
        </div>
      </div>
    

      {/* Hover Tooltip */}
      <HoverTooltip
        open={tooltip.open}
        x={tooltip.x}
        y={tooltip.y}
        objective={tooltip.objective}
        progress={tooltip.objective ? progress[tooltip.objective.code] : null}
      />
    </div>
  );
}
