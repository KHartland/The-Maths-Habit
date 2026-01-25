import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import { redirectToCheckout, STRIPE_PRICES } from './lib/stripe';
import { migrateLocalToCloud, loadFromCloud, saveProgressToCloud, saveFsrsToCloud, saveSettingsToCloud, saveStreakToCloud, saveDailyActivityToCloud } from './lib/syncService';
import { CubeIcon, SquareRootIcon, CompassIcon, InfinityIcon, BrainIcon, CompassStarIcon, BooksIcon, PiIcon } from './components/MathIcons';
import DragDropOrder from './components/DragDropOrder';
import DragDropMatch from './components/DragDropMatch';

// Custom maths-themed icons for the app
const HomeIcon = CubeIcon;           // 3D cube for Home
const PracticeIcon = SquareRootIcon; // Square root √ for Practice
const SettingsIcon = CompassIcon;    // Drawing compass for Settings
const StreakIcon = InfinityIcon;     // Infinity ∞ for Streak
const StatsIcon = PiIcon;            // Pi π for Stats
const TrophyIcon = CompassStarIcon;  // Compass star for Awards
const StandardIcon = BooksIcon;      // Stack of books for Standard mode

// ==================== ANIMATED LOGO COMPONENT ====================
// Landing page logo with squares that pulse/glow using CSS animations
const AnimatedLogo = () => {
  const baseOpacities = [0.3, 0.6, 0.9, 0.5, 0.2, 0.8, 0.7, 0.4, 0.95];
  const delays = [0, 0.8, 0.4, 1.2, 0.2, 1.0, 0.6, 1.4, 0.3]; // Staggered delays

  return (
    <div className="grid grid-cols-3 gap-1.5 w-full h-full">
      {baseOpacities.map((baseOpacity, i) => (
        <div
          key={i}
          className="rounded-sm animate-logo-pulse"
          style={{
            backgroundColor: `rgba(110, 51, 177, ${baseOpacity})`,
            animationDelay: `${delays[i]}s`,
          }}
        />
      ))}
    </div>
  );
};

// ==================== RECURRING DECIMAL COMPONENT ====================
// Renders recurring decimals with clear dots above digits (UK GCSE standard)
// Usage: <Rec>0.3</Rec> for 0.3̇ or <Rec>0.142857</Rec> for 0.1̇42857̇
// For multiple dots: <Rec dots={[1,6]}>0.142857</Rec> puts dots on 1st and 6th decimal digit

const Rec = ({ children, dots = 'ends' }) => {
  const text = String(children);
  const decimalIndex = text.indexOf('.');

  if (decimalIndex === -1) return <span>{text}</span>;

  const beforeDecimal = text.slice(0, decimalIndex + 1);
  const afterDecimal = text.slice(decimalIndex + 1);

  // Determine which positions get dots
  let dotPositions = [];
  if (dots === 'ends') {
    // First and last digit of recurring part
    if (afterDecimal.length === 1) {
      dotPositions = [0];
    } else {
      dotPositions = [0, afterDecimal.length - 1];
    }
  } else if (dots === 'first') {
    dotPositions = [0];
  } else if (dots === 'all') {
    dotPositions = afterDecimal.split('').map((_, i) => i);
  } else if (Array.isArray(dots)) {
    dotPositions = dots.map(d => d - 1); // Convert 1-indexed to 0-indexed
  }

  return (
    <span style={{ whiteSpace: 'nowrap', lineHeight: '1.8' }}>
      {beforeDecimal}
      {afterDecimal.split('').map((digit, i) => (
        dotPositions.includes(i) ? (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
            }}
          >
            {digit}
            <span style={{
              position: 'absolute',
              top: '-0.6em',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5em',
              fontWeight: 'bold',
            }}>●</span>
          </span>
        ) : (
          <span key={i}>{digit}</span>
        )
      ))}
    </span>
  );
};

// Helper to render recurring text in questions (parses special syntax)
// Use: renderRecurring("Order: 0.7[r], 0.77, 0.707, 0.7[r]0[r]7[r]")
// [r] marks the preceding digit as recurring
const renderRecurring = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Pattern: digit followed by [r] means that digit is recurring
  const parts = [];
  let i = 0;
  let currentText = '';

  while (i < text.length) {
    if (text.slice(i, i + 3) === '[r]') {
      // Previous character should get a dot
      if (currentText.length > 0) {
        const lastChar = currentText.slice(-1);
        const beforeLast = currentText.slice(0, -1);
        if (beforeLast) parts.push(beforeLast);
        parts.push(
          <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
            {lastChar}
            <span style={{
              position: 'absolute',
              top: '-0.6em',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5em',
              fontWeight: 'bold',
            }}>●</span>
          </span>
        );
        currentText = '';
      }
      i += 3;
    } else {
      currentText += text[i];
      i++;
    }
  }

  if (currentText) parts.push(currentText);

  return parts.length > 0 ? <span style={{ lineHeight: '1.8' }}>{parts}</span> : text;
};

// ==================== SCIENTIFIC CALCULATOR COMPONENT ====================
// On-screen calculator for questions that allow calculator use

const Calculator = ({ onInsert, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState('');
  const [memory, setMemory] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [pendingOperator, setPendingOperator] = useState(null);
  const [previousValue, setPreviousValue] = useState(null);

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setHistory('');
    setPreviousValue(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(-value));
  };

  const percentage = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const calculate = (leftOperand, rightOperand, operator) => {
    switch (operator) {
      case '+': return leftOperand + rightOperand;
      case '−': return leftOperand - rightOperand;
      case '×': return leftOperand * rightOperand;
      case '÷': return rightOperand !== 0 ? leftOperand / rightOperand : 'Error';
      case '^': return Math.pow(leftOperand, rightOperand);
      default: return rightOperand;
    }
  };

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
      setHistory(`${inputValue} ${nextOperator}`);
    } else if (pendingOperator) {
      const result = calculate(previousValue, inputValue, pendingOperator);
      setDisplay(String(result));
      setPreviousValue(result);
      setHistory(`${result} ${nextOperator}`);
    }

    setWaitingForOperand(true);
    setPendingOperator(nextOperator);
  };

  const equals = () => {
    if (pendingOperator && previousValue !== null) {
      const inputValue = parseFloat(display);
      const result = calculate(previousValue, inputValue, pendingOperator);
      setHistory(`${previousValue} ${pendingOperator} ${inputValue} =`);
      setDisplay(String(result));
      setPreviousValue(null);
      setPendingOperator(null);
      setWaitingForOperand(true);
    }
  };

  const sqrt = () => {
    const value = parseFloat(display);
    setHistory(`√${value}`);
    setDisplay(value >= 0 ? String(Math.sqrt(value)) : 'Error');
  };

  const square = () => {
    const value = parseFloat(display);
    setHistory(`${value}²`);
    setDisplay(String(value * value));
  };

  const cube = () => {
    const value = parseFloat(display);
    setHistory(`${value}³`);
    setDisplay(String(value * value * value));
  };

  const sin = () => {
    const value = parseFloat(display);
    setHistory(`sin(${value}°)`);
    setDisplay(String(Math.sin(value * Math.PI / 180)));
  };

  const cos = () => {
    const value = parseFloat(display);
    setHistory(`cos(${value}°)`);
    setDisplay(String(Math.cos(value * Math.PI / 180)));
  };

  const tan = () => {
    const value = parseFloat(display);
    setHistory(`tan(${value}°)`);
    setDisplay(String(Math.tan(value * Math.PI / 180)));
  };

  const pi = () => {
    setDisplay(String(Math.PI));
    setWaitingForOperand(true);
  };

  const memoryStore = () => setMemory(parseFloat(display));
  const memoryRecall = () => { if (memory !== null) setDisplay(String(memory)); };
  const memoryClear = () => setMemory(null);
  const memoryAdd = () => setMemory((memory || 0) + parseFloat(display));

  const useAnswer = () => {
    if (onInsert && display !== '0' && display !== 'Error') {
      const value = parseFloat(display);
      const rounded = Math.abs(value) < 0.0001 ? value : Math.round(value * 10000) / 10000;
      onInsert(String(rounded));
    }
  };

  const btnBase = 'p-3 rounded-xl font-semibold transition-all active:scale-95 select-none ';
  const btnNum = btnBase + 'bg-white/10 hover:bg-white/20 text-white text-lg';
  const btnOp = btnBase + 'bg-violet/40 hover:bg-violet/60 text-violet-light text-lg';
  const btnFn = btnBase + 'bg-white/5 hover:bg-white/10 text-secondary-text text-sm';
  const btnEq = btnBase + 'bg-mint hover:bg-mint/80 text-void text-lg font-bold';
  const btnClear = btnBase + 'bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm';

  return (
    <div className="glass-panel rounded-2xl p-4 w-80 shadow-2xl border border-violet/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧮</span>
          <span className="text-sm font-semibold text-primary-text">Scientific Calculator</span>
          {memory !== null && <span className="text-xs bg-violet/30 text-violet-light px-2 py-0.5 rounded-full">M</span>}
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-secondary-text" />
        </button>
      </div>

      {/* Display */}
      <div className="bg-void/80 rounded-xl p-4 mb-3 border border-white/10">
        {history && (
          <div className="text-right text-xs text-secondary-text mb-1 truncate h-4">
            {history}
          </div>
        )}
        <div className="text-right text-3xl font-mono text-primary-text truncate">
          {display}
        </div>
      </div>

      {/* Scientific functions */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        <button onClick={sin} className={btnFn}>sin</button>
        <button onClick={cos} className={btnFn}>cos</button>
        <button onClick={tan} className={btnFn}>tan</button>
        <button onClick={pi} className={btnFn}>π</button>
        <button onClick={() => performOperation('^')} className={btnFn}>xʸ</button>
      </div>

      {/* Memory row */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        <button onClick={memoryClear} className={btnFn}>MC</button>
        <button onClick={memoryRecall} className={btnFn}>MR</button>
        <button onClick={memoryAdd} className={btnFn}>M+</button>
        <button onClick={sqrt} className={btnFn}>√</button>
        <button onClick={square} className={btnFn}>x²</button>
      </div>

      {/* Main keypad */}
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={clear} className={btnClear}>AC</button>
        <button onClick={backspace} className={btnClear}>⌫</button>
        <button onClick={percentage} className={btnFn}>%</button>
        <button onClick={() => performOperation('÷')} className={btnOp}>÷</button>

        <button onClick={() => inputDigit('7')} className={btnNum}>7</button>
        <button onClick={() => inputDigit('8')} className={btnNum}>8</button>
        <button onClick={() => inputDigit('9')} className={btnNum}>9</button>
        <button onClick={() => performOperation('×')} className={btnOp}>×</button>

        <button onClick={() => inputDigit('4')} className={btnNum}>4</button>
        <button onClick={() => inputDigit('5')} className={btnNum}>5</button>
        <button onClick={() => inputDigit('6')} className={btnNum}>6</button>
        <button onClick={() => performOperation('−')} className={btnOp}>−</button>

        <button onClick={() => inputDigit('1')} className={btnNum}>1</button>
        <button onClick={() => inputDigit('2')} className={btnNum}>2</button>
        <button onClick={() => inputDigit('3')} className={btnNum}>3</button>
        <button onClick={() => performOperation('+')} className={btnOp}>+</button>

        <button onClick={toggleSign} className={btnFn}>±</button>
        <button onClick={() => inputDigit('0')} className={btnNum}>0</button>
        <button onClick={inputDecimal} className={btnNum}>.</button>
        <button onClick={equals} className={btnEq}>=</button>
      </div>

      {/* Use Answer button */}
      <button
        onClick={useAnswer}
        className="w-full mt-3 py-3 btn-gradient-mint text-void font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        Use Answer
      </button>
    </div>
  );
};

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
  N1: 'Order and compare decimals including recurring (e.g. circle the largest: 5.304[r], 5.344, 5.34, 5.3[r]4[r])',
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
  Number: "#A78BFA",      // Soft violet
  Algebra: "#38E6A2",     // Mint green
  Ratio: "#F0ABFC",       // Light orchid
  Geometry: "#67E8F9",    // Cyan
  Probability: "#818CF8", // Indigo
  Statistics: "#C084FC",  // Purple
};

const INTENSITY = { 0: 0.08, 1: 0.25, 2: 0.42, 3: 0.6, 4: 0.78, 5: 0.95 };

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

// Mix color with dark background for progress AND recency
function getTileColor(hex, progressLevel, recencyFactor) {
  const baseIntensity = INTENSITY[progressLevel] || 0.08;
  // Dark background RGB (void: #0E0307)
  const bgR = 14, bgG = 3, bgB = 7;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Mix with dark background based on progress (brighter = more progress)
  const progressMix = (c, bg) => Math.round(bg + (c - bg) * baseIntensity);
  let pr = progressMix(r, bgR);
  let pg = progressMix(g, bgG);
  let pb = progressMix(b, bgB);

  // Apply recency (desaturate old topics toward darker)
  const dim = (c) => Math.round(c * (0.4 + 0.6 * recencyFactor));

  return `#${[dim(pr), dim(pg), dim(pb)].map(c =>
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

function TileDetailModal({ open, objective, progress, onClose }) {
  if (!open || !objective) return null;

  const quickCorrect = progress?.quickCorrect ?? 0;
  const examPassed = progress?.examPassed ?? false;
  const level = getUnderstandingLevel(progress);
  const lastPracticed = progress?.lastPracticed;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="glass-panel-strong rounded-2xl w-full max-w-sm p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: TOPIC_HEX[objective.topic] }}
            >
              {objective.code}
            </span>
            <span className="text-xs text-secondary-text">{objective.topicName}</span>
            {objective.isHigher && (
              <span className="px-1.5 py-0.5 bg-violet text-white text-xs font-bold rounded">H</span>
            )}
          </div>
          <button onClick={onClose} className="text-secondary-text/60 hover:text-primary-text p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-primary-text mb-4">
          {objective.title}
        </h3>

        {/* Status badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            level >= 5 ? 'bg-mint/20 text-mint border border-mint/30' :
            level >= 4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            level > 0 ? 'bg-violet/20 text-violet-light border border-violet/30' :
            'bg-white/10 text-secondary-text border border-white/10'
          }`}>
            {level >= 5 ? '✓ Mastered' :
             level >= 4 ? '📝 Exam ready' :
             level > 0 ? '📚 Learning' :
             '○ Not started'}
          </span>
        </div>

        {/* Progress bars */}
        <div className="space-y-3 mb-4">
          {/* Quick questions */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-secondary-text">Quick questions</span>
              <span className="font-medium text-primary-text">{Math.min(quickCorrect, 4)}/4</span>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-2.5 flex-1 rounded-full transition-all"
                  style={{
                    backgroundColor: i < quickCorrect
                      ? TOPIC_HEX[objective.topic]
                      : 'rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Exam question */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-secondary-text">Exam question</span>
              <span className="font-medium text-primary-text">
                {examPassed ? '✓ Passed' : quickCorrect >= 4 ? 'Ready!' : 'Locked'}
              </span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: examPassed ? '100%' : quickCorrect >= 4 ? '50%' : '0%',
                  backgroundColor: examPassed ? '#38E6A2' : '#f59e0b'
                }}
              />
            </div>
          </div>
        </div>

        {/* Last practiced */}
        {lastPracticed && (
          <p className="text-xs text-secondary-text/60">
            Last practiced: {new Date(lastPracticed).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}
          </p>
        )}
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

// ==================== PRACTICE TIPS SYSTEM ====================
const TIPS_STORAGE_KEY = 'maths-habit-tips-shown';

const PRACTICE_TIPS = {
  firstQuestion: {
    id: 'firstQuestion',
    text: 'Answer each question to build your mastery. Get 4 right to master an objective!',
  },
  firstCorrect: {
    id: 'firstCorrect',
    text: 'Nice! Keep practising to unlock Quick Fire mode (5 objectives mastered) and Exam mode (10 mastered).',
  },
  firstIncorrect: {
    id: 'firstIncorrect',
    text: "Don't worry! Mistakes help you learn. You'll get easier building-block questions to strengthen your skills.",
  },
  sessionComplete: {
    id: 'sessionComplete',
    text: 'Come back tomorrow to build your streak! Consistent daily practice is the fastest way to improve.',
  },
  aiCoach: {
    id: 'aiCoach',
    text: 'Answer 15 questions total to unlock your AI Coach — a personal tutor that analyses your mistakes!',
  },
  secondSession: {
    id: 'secondSession',
    text: 'Your progress is tracked on the home screen heatmap. Each square represents a GCSE objective.',
  },
};

const loadShownTips = () => {
  try {
    return JSON.parse(localStorage.getItem(TIPS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const markTipShown = (tipId) => {
  try {
    const shown = loadShownTips();
    if (!shown.includes(tipId)) {
      shown.push(tipId);
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(shown));
    }
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
    { q: "Which is the largest?", type: "mcq", options: ["5.304[r]", "5.344", "5.34", "5.3[r]4[r]"], a: "5.3[r]4[r]", calculator: false },
    { q: "Order these from smallest to largest: 0.45, 0.405, 0.54, 0.045", a: "0.045, 0.405, 0.45, 0.54", type: "text", calculator: false },
    { q: "Which decimal is equivalent to 1/3?", type: "mcq", options: ["0.3", "0.33", "0.3[r]", "0.33[r]"], a: "0.3[r]", calculator: false },
    { q: "Put these decimals in order from smallest to largest:", type: "order", items: ["0.7", "0.07", "0.77", "0.707"], correctOrder: ["0.07", "0.7", "0.707", "0.77"], calculator: false },
    { q: "Order these decimals from largest to smallest:", type: "order", items: ["0.35", "0.5", "0.305", "0.53"], correctOrder: ["0.53", "0.5", "0.35", "0.305"], calculator: false },
  ],
  N2: [
    { q: "Work out: −7 × −4", a: "28", type: "number", calculator: false },
    { q: "Calculate: 3.6 ÷ 0.4", a: "9", type: "number", calculator: true },
    { q: "What is −15 ÷ 3?", type: "mcq", options: ["-5", "5", "-45", "45"], a: "-5", calculator: false },
    { q: "Calculate: 2.4 × 3.5", a: "8.4", type: "number", calculator: false },
  ],
  N3: [
    { q: "What is the value of the 7 in 34,728?", type: "mcq", options: ["7", "70", "700", "7000"], a: "700", calculator: false },
    { q: "Write 45,000 in standard form", a: "4.5 × 10⁴", type: "text", calculator: false },
    { q: "What is 3.2 × 10³ as an ordinary number?", a: "3200", type: "number", calculator: false },
    { q: "Write 0.00056 in standard form", a: "5.6 × 10⁻⁴", type: "text", calculator: false },
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
    { q: "Put these in order from smallest to largest:", type: "order", items: ["2³", "3²", "√25", "4²"], correctOrder: ["√25", "2³", "3²", "4²"], calculator: false },
  ],
  N7: [
    { q: "What is the 4th cube number?", type: "mcq", options: ["27", "64", "81", "125"], a: "64", calculator: false },
    { q: "Is 64 a cube number? (yes/no)", a: "yes", type: "text", calculator: false },
    { q: "What is 5³?", a: "125", type: "number", calculator: false },
    { q: "Find ³√216", a: "6", type: "number", calculator: false },
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
    { q: "Match each fraction to its decimal:", type: "match", leftItems: ["1/4", "1/2", "3/4", "1/5"], rightItems: ["0.5", "0.25", "0.2", "0.75"], correctMatches: { "0": 1, "1": 0, "2": 3, "3": 2 }, calculator: false },
    { q: "Match each percentage to its fraction:", type: "match", leftItems: ["25%", "50%", "75%", "20%"], rightItems: ["1/2", "1/4", "1/5", "3/4"], correctMatches: { "0": 1, "1": 0, "2": 3, "3": 2 }, calculator: false },
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
    { q: "Estimate: (29.8 × 4.1) ÷ 9.7", a: "12", type: "number", hint: "Round to 1 s.f.", calculator: false },
  ],
  N15: [
    { q: "Round 3.456 to 2 decimal places", a: "3.46", type: "text", calculator: false },
    { q: "Round 12,345 to 2 significant figures", a: "12000", type: "text", calculator: false },
    { q: "What is 0.0456 rounded to 2 s.f.?", type: "mcq", options: ["0.04", "0.05", "0.046", "0.045"], a: "0.046", calculator: false },
    { q: "Round 0.006789 to 3 significant figures", a: "0.00679", type: "text", calculator: false },
  ],
  N16: [
    { q: "A length is 8 cm to the nearest cm. What is the lower bound?", a: "7.5", type: "number", calculator: false },
    { q: "A mass is 50g to the nearest 10g. Write the error interval.", a: "45 ≤ x < 55", type: "text", calculator: false },
    { q: "A time is 24 seconds to the nearest second. What is the upper bound?", a: "24.5", type: "number", calculator: false },
    { q: "A length is 3.5m to 1 d.p. What is the lower bound?", type: "mcq", options: ["3.4", "3.45", "3.49", "3.0"], a: "3.45", calculator: false },
  ],
  N4: [
    { q: "I calculate 156 ÷ 12 = 13. Which calculation checks this?", type: "mcq", options: ["156 × 12", "13 × 12", "156 - 12", "13 + 12"], a: "13 × 12", calculator: false },
    { q: "Check: Is 23 × 17 = 391? Use the inverse operation.", a: "yes", type: "text", calculator: true, hint: "Calculate 391 ÷ 17" },
    { q: "I subtracted and got 458 - 279 = 179. What calculation checks this?", a: "179 + 279", type: "text", calculator: false },
    { q: "Which is the inverse of squaring a number?", type: "mcq", options: ["Halving", "Doubling", "Square rooting", "Cubing"], a: "Square rooting", calculator: false },
  ],
  N11: [
    { q: "Express 15 as a fraction of 60", a: "1/4", type: "text", calculator: false },
    { q: "Write 30 as a fraction of 50 in simplest form", a: "3/5", type: "text", calculator: false },
    { q: "What is 12 out of 48 as a fraction in simplest form?", type: "mcq", options: ["12/48", "1/4", "1/3", "2/8"], a: "1/4", calculator: false },
    { q: "Express 45 minutes as a fraction of 1 hour", a: "3/4", type: "text", calculator: false },
  ],
  N13: [
    { q: "Convert 3.5 metres to centimetres", a: "350", type: "number", calculator: false },
    { q: "Convert 4500 grams to kilograms", a: "4.5", type: "number", calculator: false },
    { q: "How many millilitres in 2.5 litres?", type: "mcq", options: ["25", "250", "2500", "25000"], a: "2500", calculator: false },
    { q: "Convert 3 m² to cm²", a: "30000", type: "number", calculator: false, hint: "1 m² = 10000 cm²" },
  ],

  // Algebra
  A2: [
    { q: "If y = 3x + 5, find y when x = 4", a: "17", type: "number", calculator: false },
    { q: "Work out d when d = g² − 2h, g = 5, h = 3", a: "19", type: "number", calculator: false },
    { q: "If P = 2(l + w), find P when l = 7 and w = 3", a: "20", type: "number", calculator: false },
    { q: "If V = lwh, find V when l = 5, w = 3 and h = 4", a: "60", type: "number", calculator: false },
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
    { q: "Make b the subject: a = 5b - 7", a: "b = (a + 7)/5", type: "text", calculator: false },
    { q: "Make h the subject: V = πr²h", type: "mcq", options: ["h = V/πr²", "h = Vπr²", "h = V - πr²", "h = V/πr"], a: "h = V/πr²", calculator: false },
  ],
  A14: [
    { q: "Find the gradient of the line joining (0, 2) and (3, 8)", a: "2", type: "number", calculator: false },
    { q: "A line has equation y = 4x - 3. What is its gradient?", type: "mcq", options: ["-3", "3", "4", "-4"], a: "4", calculator: false },
    { q: "Find the y-intercept of y = 2x + 7", a: "7", type: "number", calculator: false },
    { q: "Find the gradient of the line joining (2, 5) and (6, 13)", a: "2", type: "number", calculator: false },
  ],
  A17: [
    { q: "Solve: 3x + 7 = 22", a: "5", type: "number", calculator: false },
    { q: "Solve: 2(x - 3) = 10", a: "8", type: "number", calculator: false },
    { q: "Solve: 5x - 3 = 2x + 9", a: "4", type: "number", calculator: false },
    { q: "What is x if 4x + 1 = 17?", type: "mcq", options: ["3", "4", "4.5", "5"], a: "4", calculator: false },
  ],
  A18: [
    // Foundation - factorising
    { q: "Solve by factorising: x² + 5x + 6 = 0", a: "x = -2 and x = -3", type: "text", calculator: false },
    { q: "Solve by factorising: x² - 7x + 12 = 0", a: "x = 3 and x = 4", type: "text", calculator: false },
    { q: "Solve: x² - 9 = 0", type: "mcq", options: ["x = 3", "x = -3", "x = 3 and x = -3", "x = 9"], a: "x = 3 and x = -3", calculator: false },
    // Foundation - reading from graph
    { q: "Use the graph to solve x² - 2x - 3 = 0", a: "x = -1 and x = 3", type: "text", calculator: false, image: "quadratic-graph-1.png" },
    // Higher - rearrangement
    { q: "Solve: x² + 3x = 10 (give both solutions)", a: "x = 2 and x = -5", type: "text", calculator: false, tier: "higher" },
    // Higher - quadratic formula
    { q: "Solve 2x² + 5x - 3 = 0 using the quadratic formula", type: "mcq", options: ["x = 0.5 and x = -3", "x = -0.5 and x = 3", "x = 1 and x = -1.5", "x = 3 and x = -0.5"], a: "x = 0.5 and x = -3", calculator: true, tier: "higher" },
  ],
  A19: [
    { q: "Solve: 2x + y = 7 and x + y = 4. Find x.", a: "3", type: "number", calculator: false },
    { q: "Solve: x + y = 10 and x - y = 4. Find x.", a: "7", type: "number", calculator: false },
    { q: "Solve: 3x + 2y = 19 and x + 2y = 13. Find x.", a: "3", type: "number", calculator: false },
    { q: "Solve: 2x + y = 11 and x - y = 1. Find y.", type: "mcq", options: ["2", "3", "4", "5"], a: "3", calculator: false },
  ],
  A23: [
    { q: "Find the nth term: 5, 8, 11, 14, ...", a: "3n + 2", type: "text", calculator: false },
    { q: "Find the 10th term of: 4, 7, 10, 13, ...", a: "31", type: "number", calculator: false },
    { q: "A sequence has nth term 2n + 5. What is the 8th term?", type: "mcq", options: ["13", "16", "21", "24"], a: "21", calculator: false },
    { q: "Find the nth term: 7, 11, 15, 19, ...", a: "4n + 3", type: "text", calculator: false },
  ],
  A1: [
    { q: "Write 'add 5 to x, then multiply by 3' as an algebraic expression", a: "3(x + 5)", type: "text", calculator: false },
    { q: "What does 4x mean?", type: "mcq", options: ["4 + x", "4 - x", "4 × x", "4 ÷ x"], a: "4 × x", calculator: false },
    { q: "Simplify: a + a + a", a: "3a", type: "text", calculator: false },
    { q: "Write using algebra: the cost of n books at £5 each", a: "5n", type: "text", calculator: false },
  ],
  A3: [
    { q: "Is '3x + 5' an expression, equation, formula or identity?", type: "mcq", options: ["Expression", "Equation", "Formula", "Identity"], a: "Expression", calculator: false },
    { q: "Is '3x + 5 = 20' an expression, equation, formula or identity?", type: "mcq", options: ["Expression", "Equation", "Formula", "Identity"], a: "Equation", calculator: false },
    { q: "Is 'A = πr²' an expression, equation, formula or identity?", type: "mcq", options: ["Expression", "Equation", "Formula", "Identity"], a: "Formula", calculator: false },
    { q: "Which is an identity?", type: "mcq", options: ["x + 5 = 12", "2(x + 3) = 2x + 6", "A = lw", "3x - 1"], a: "2(x + 3) = 2x + 6", calculator: false },
  ],
  A5: [
    { q: "Use V = lwh to find V when l = 5, w = 4, h = 3", a: "60", type: "number", calculator: false },
    { q: "Use A = ½bh to find A when b = 8 and h = 6", a: "24", type: "number", calculator: false },
    { q: "The formula for speed is s = d/t. Find s when d = 150 and t = 3.", a: "50", type: "number", calculator: false },
    { q: "Use C = 2πr to find C when r = 7 (give answer in terms of π)", a: "14π", type: "text", calculator: false },
  ],
  A7: [
    { q: "A function machine does: input → ×3 → +2 → output. If input is 5, what is output?", a: "17", type: "number", calculator: false },
    { q: "A function machine does: input → -4 → ×2 → output. If input is 10, what is output?", a: "12", type: "number", calculator: false },
    { q: "A function machine gives output 20. It does: input → ×4 → +8 → output. Find the input.", a: "3", type: "number", calculator: false },
    { q: "Which function machine gives y = 2x + 1?", type: "mcq", options: ["×2 then +1", "+1 then ×2", "×1 then +2", "+2 then ×1"], a: "×2 then +1", calculator: false },
  ],
  A13: [
    { q: "What are the coordinates of point A at 3 along and 5 up?", a: "(3, 5)", type: "text", calculator: false },
    { q: "Find the midpoint of (2, 4) and (6, 8)", a: "(4, 6)", type: "text", calculator: false },
    { q: "Find the midpoint of (0, 3) and (4, 7)", a: "(2, 5)", type: "text", calculator: false },
    { q: "Point P is at (-3, 4). Which quadrant is P in?", type: "mcq", options: ["1st", "2nd", "3rd", "4th"], a: "2nd", calculator: false },
  ],
  A15: [
    { q: "A quadratic has roots x = 2 and x = 6. What is the x-coordinate of the turning point?", a: "4", type: "number", calculator: false },
    { q: "A parabola crosses the x-axis at x = -1 and x = 5. Find the x-coordinate of the vertex.", a: "2", type: "number", calculator: false },
    { q: "The turning point x-coordinate is halfway between the roots. If roots are x = 0 and x = 8, find it.", a: "4", type: "number", calculator: false },
    { q: "A quadratic has roots at x = -3 and x = 1. The turning point x-coordinate is:", type: "mcq", options: ["-3", "-1", "0", "1"], a: "-1", calculator: false },
  ],
  A21: [
    { q: "Write as an inequality: x is greater than 5", a: "x > 5", type: "text", calculator: false },
    { q: "Write as an inequality: y is at most 10", a: "y ≤ 10", type: "text", calculator: false },
    { q: "A ride requires height h cm where h ≥ 120. Can someone 115cm tall go on?", type: "mcq", options: ["Yes", "No"], a: "No", calculator: false },
    { q: "n is an integer where -2 < n ≤ 3. List all possible values of n.", a: "-1, 0, 1, 2, 3", type: "text", calculator: false },
  ],
  A24: [
    { q: "What is the next term in: 1, 1, 2, 3, 5, 8, ...?", a: "13", type: "number", calculator: false, hint: "Fibonacci - add the previous two terms" },
    { q: "What is the next term in: 1, 4, 9, 16, 25, ...?", a: "36", type: "number", calculator: false, hint: "Square numbers" },
    { q: "Identify the sequence: 2, 6, 12, 20, 30, ...", type: "mcq", options: ["Square numbers", "Cube numbers", "Triangular numbers", "Pronic numbers"], a: "Pronic numbers", calculator: false },
    { q: "What is the next triangular number after 10?", a: "15", type: "number", calculator: false },
  ],

  // Ratio
  R3: [
    { q: "Work out 2/5 of 35", a: "14", type: "number", calculator: false },
    { q: "Find 3/8 of 56", a: "21", type: "number", calculator: false },
    { q: "What is 1/4 of 84?", type: "mcq", options: ["16", "20", "21", "24"], a: "21", calculator: false },
    { q: "Find 5/6 of 42", a: "35", type: "number", calculator: false },
  ],
  R4: [
    { q: "Simplify the ratio 12:18", a: "2:3", type: "text", calculator: false },
    { q: "Write 3:5 in the form 1:n", a: "1:1.67", type: "text", hint: "Round to 2 d.p.", calculator: true },
    { q: "Simplify 24:36", type: "mcq", options: ["2:3", "4:6", "12:18", "3:4"], a: "2:3", calculator: false },
    { q: "Share £60 in the ratio 2:3", a: "£24 and £36", type: "text", calculator: false },
  ],
  R9: [
    { q: "Express 45 as a percentage of 180", a: "25", type: "number", calculator: true },
    { q: "What is 12 as a percentage of 60?", type: "mcq", options: ["12%", "15%", "20%", "25%"], a: "20%", calculator: true },
    { q: "Express 18 as a percentage of 72", a: "25", type: "number", calculator: true },
    { q: "What is 35 as a percentage of 140?", a: "25", type: "number", calculator: true },
  ],
  R10: [
    { q: "A price increases from £80 to £92. Find the percentage increase.", a: "15", type: "number", calculator: true },
    { q: "A value decreases from 50 to 40. What is the percentage decrease?", type: "mcq", options: ["10%", "15%", "20%", "25%"], a: "20%", calculator: true },
    { q: "A house price rises from £200,000 to £230,000. Find the percentage increase.", a: "15", type: "number", calculator: true },
    { q: "A car value drops from £12,000 to £9,000. Find the percentage decrease.", a: "25", type: "number", calculator: true },
  ],
  R12: [
    { q: "After a 20% decrease, a price is £64. What was the original price?", a: "80", type: "number", calculator: true },
    { q: "After a 25% increase, a price is £100. What was the original?", a: "80", type: "number", calculator: true },
    { q: "A sale item is £45 after a 10% reduction. What was the original price?", a: "50", type: "number", calculator: true },
    { q: "After a 15% increase, a price is £230. What was the original?", type: "mcq", options: ["£195.50", "£200", "£210", "£215"], a: "£200", calculator: true },
  ],
  R2: [
    { q: "On a map, the scale is 1 cm : 5 km. Two towns are 6 cm apart on the map. What is the actual distance in km?", a: "30", type: "number", calculator: true, diagram: "scale-map-towns" },
    { q: "A model car is made at scale 1:50. The real car is 4 metres long. How long is the model in cm?", a: "8", type: "number", calculator: true },
    { q: "A map has scale 1:25000. Two points are 8 cm apart on the map. What is the real distance in km?", a: "2", type: "number", calculator: true },
    { q: "A plan is drawn at scale 1:200. A room is 6 cm long on the plan. What is the actual length in metres?", a: "12", type: "number", calculator: true },
    { q: "The scale on a map is 1 cm : 2 km. What is this as a ratio?", type: "mcq", options: ["1:200", "1:2000", "1:20000", "1:200000"], a: "1:200000", calculator: false },
  ],
  R1: [
    { q: "Convert 2.5 km to metres", a: "2500", type: "number", calculator: false },
    { q: "Convert 450 cm to metres", a: "4.5", type: "number", calculator: false },
    { q: "How many grams in 3.2 kg?", type: "mcq", options: ["32", "320", "3200", "32000"], a: "3200", calculator: false },
    { q: "Convert 180 minutes to hours", a: "3", type: "number", calculator: false },
  ],
  R5: [
    { q: "For every 3 red sweets there are 5 blue sweets. If there are 12 red sweets, how many blue?", a: "20", type: "number", calculator: false },
    { q: "The ratio of boys to girls is 2:3. There are 10 boys. How many girls?", a: "15", type: "number", calculator: false },
    { q: "For every £2 Tom saves, Amy saves £5. Tom saves £8. How much does Amy save?", a: "20", type: "number", calculator: false },
    { q: "Purple paint is made with red and blue in ratio 3:7. I use 9 litres of red. How much blue?", type: "mcq", options: ["7 litres", "14 litres", "21 litres", "28 litres"], a: "21 litres", calculator: false },
  ],
  R6: [
    { q: "Write 15 ÷ 20 as a ratio in simplest form", a: "3:4", type: "text", calculator: false },
    { q: "The ratio 2:5 means dividing in the proportion:", type: "mcq", options: ["2 ÷ 5", "2 out of 5", "2 out of 7", "5 out of 7"], a: "2 out of 7", calculator: false },
    { q: "Express the ratio 1:4 as a fraction (smaller part)", a: "1/5", type: "text", calculator: false },
    { q: "Write 12:18 as a division", a: "12 ÷ 18 or 2 ÷ 3", type: "text", calculator: false },
  ],
  R7: [
    { q: "5 pens cost £3. How much do 8 pens cost?", a: "4.80", type: "number", calculator: true },
    { q: "3 workers take 12 days to complete a job. How long would 4 workers take?", a: "9", type: "number", calculator: false, hint: "Inverse proportion" },
    { q: "If 4 apples cost £1.20, how much do 10 apples cost?", a: "3", type: "number", calculator: true },
    { q: "y is directly proportional to x. When x = 4, y = 20. Find y when x = 7.", a: "35", type: "number", calculator: false },
  ],
  R8: [
    { q: "In a ratio 2:3, what fraction is the first part?", a: "2/5", type: "text", calculator: false },
    { q: "The ratio of flour to sugar is 3:1. What fraction of the mixture is flour?", a: "3/4", type: "text", calculator: false },
    { q: "A line goes through (0,0) and (2,6). What is the ratio x:y?", a: "1:3", type: "text", calculator: false },
    { q: "The ratio a:b = 4:5. Write a as a fraction of b.", a: "4/5", type: "text", calculator: false },
  ],
  R11: [
    { q: "A TV was £400, now £340. What is the percentage decrease?", a: "15", type: "number", calculator: true },
    { q: "Population grew from 5000 to 6500. Find the percentage increase.", a: "30", type: "number", calculator: true },
    { q: "Which is better value: 20% off £50, or £12 off £50?", type: "mcq", options: ["20% off", "£12 off", "Same"], a: "£12 off", calculator: true },
    { q: "Shop A sells item for £80 (was £100). Shop B sells same item for £85 (was £110). Which has bigger % discount?", type: "mcq", options: ["Shop A", "Shop B", "Same"], a: "Shop B", calculator: true },
  ],
  R14: [
    { q: "Speed = distance ÷ time. Find speed if distance = 150km and time = 3 hours.", a: "50", type: "number", calculator: false },
    { q: "Density = mass ÷ volume. Find density when mass = 240g and volume = 30cm³.", a: "8", type: "number", calculator: false },
    { q: "What are the units of speed if distance is in miles and time is in hours?", type: "mcq", options: ["miles", "hours", "mph", "m/s"], a: "mph", calculator: false },
    { q: "A car travels 180 miles in 3 hours. What is its average speed?", a: "60", type: "number", calculator: false },
  ],

  // Geometry
  G1: [
    { q: "What is the name of a 7-sided polygon?", type: "mcq", options: ["Hexagon", "Heptagon", "Octagon", "Nonagon"], a: "Heptagon", calculator: false },
    { q: "How many vertices does a cube have?", a: "8", type: "number", calculator: false },
    { q: "What type of angle is 135°?", type: "mcq", options: ["Acute", "Right", "Obtuse", "Reflex"], a: "Obtuse", calculator: false },
    { q: "A line from center to edge of a circle is called a:", type: "mcq", options: ["Diameter", "Chord", "Radius", "Tangent"], a: "Radius", calculator: false },
  ],
  G2: [
    { q: "To construct a 60° angle, you need:", type: "mcq", options: ["Protractor only", "Compass and ruler", "Ruler only", "Set square only"], a: "Compass and ruler", calculator: false },
    { q: "An angle bisector divides an angle into:", type: "mcq", options: ["Three equal parts", "Two equal parts", "Unequal parts", "Four parts"], a: "Two equal parts", calculator: false },
    { q: "A perpendicular bisector of a line segment:", type: "mcq", options: ["Goes through one end", "Cuts at 45°", "Cuts at 90° through the midpoint", "Is parallel to it"], a: "Cuts at 90° through the midpoint", calculator: false },
    { q: "The locus of points equidistant from two fixed points is:", type: "mcq", options: ["A circle", "A straight line", "Two parallel lines", "An arc"], a: "A straight line", calculator: false },
  ],
  G3: [
    { q: "Angles on a straight line sum to how many degrees?", type: "mcq", options: ["90°", "180°", "270°", "360°"], a: "180°", calculator: false },
    { q: "Angles around a point sum to how many degrees?", a: "360", type: "number", calculator: false },
    { q: "Two angles on a straight line are x and 115°. Find x.", a: "65", type: "number", calculator: false },
    { q: "Vertically opposite angles are:", type: "mcq", options: ["Always equal", "Add to 90°", "Add to 180°", "Add to 360°"], a: "Always equal", calculator: false },
  ],
  G4: [
    { q: "Two parallel lines are cut by a transversal. One angle is 70°. What is the corresponding angle?", a: "70", type: "number", diagram: "parallel", calculator: false },
    { q: "Alternate angles are:", type: "mcq", options: ["Always equal", "Add to 90°", "Add to 180°", "Never equal"], a: "Always equal", calculator: false },
    { q: "Co-interior (allied) angles add up to:", type: "mcq", options: ["90°", "180°", "270°", "360°"], a: "180°", calculator: false },
    { q: "Angle x and angle y are co-interior. If x = 115°, find y.", a: "65", type: "number", calculator: false },
  ],
  G5: [
    { q: "Find the exterior angle of a regular hexagon", a: "60", type: "number", calculator: false },
    { q: "Find the sum of interior angles of a pentagon", a: "540", type: "number", calculator: false },
    { q: "What is the interior angle of a regular hexagon?", type: "mcq", options: ["90°", "108°", "120°", "135°"], a: "120°", calculator: false },
    { q: "A regular polygon has exterior angles of 40°. How many sides does it have?", a: "9", type: "number", calculator: false },
  ],
  G6: [
    { q: "Which quadrilateral has all sides equal and all angles 90°?", type: "mcq", options: ["Rectangle", "Rhombus", "Square", "Parallelogram"], a: "Square", calculator: false },
    { q: "A rhombus has how many lines of symmetry?", a: "2", type: "number", calculator: false },
    { q: "Which quadrilateral has exactly one pair of parallel sides?", type: "mcq", options: ["Rectangle", "Parallelogram", "Trapezium", "Kite"], a: "Trapezium", calculator: false },
    { q: "The diagonals of a rectangle:", type: "mcq", options: ["Are perpendicular", "Are equal length", "Bisect the angles", "Are different lengths"], a: "Are equal length", calculator: false },
  ],
  G8: [
    { q: "Describe the translation from (2, 3) to (5, 7) as a column vector", a: "(3, 4)", type: "text", calculator: false },
    { q: "A shape is translated by vector (−2, 5). Point (4, 1) moves to:", type: "mcq", options: ["(2, 6)", "(6, 6)", "(2, −4)", "(6, −4)"], a: "(2, 6)", calculator: false },
    { q: "What is the column vector for 3 left and 2 up?", a: "(-3, 2)", type: "text", calculator: false },
    { q: "Point A(1, 4) is translated by (5, −3). Find the new coordinates.", a: "(6, 1)", type: "text", calculator: false },
  ],
  G9: [
    { q: "A shape is rotated 90° clockwise about the origin. Point (2, 0) moves to:", type: "mcq", options: ["(0, 2)", "(0, −2)", "(−2, 0)", "(2, 0)"], a: "(0, −2)", calculator: false },
    { q: "Reflecting in the line y = x swaps:", type: "mcq", options: ["x with -x", "y with -y", "x with y", "Nothing changes"], a: "x with y", calculator: false },
    { q: "A shape is reflected in the x-axis. Point (3, 5) maps to:", type: "mcq", options: ["(−3, 5)", "(3, −5)", "(−3, −5)", "(5, 3)"], a: "(3, −5)", calculator: false },
    { q: "What single transformation is the same as two reflections in parallel lines?", type: "mcq", options: ["Rotation", "Translation", "Enlargement", "Reflection"], a: "Translation", calculator: false },
  ],
  G11: [
    { q: "A tangent to a circle meets the radius at:", type: "mcq", options: ["45°", "60°", "90°", "180°"], a: "90°", calculator: false },
    { q: "An arc is part of a:", type: "mcq", options: ["Diameter", "Radius", "Circumference", "Chord"], a: "Circumference", calculator: false },
    { q: "A chord divides a circle into:", type: "mcq", options: ["Two semicircles", "A segment and major arc", "Two segments", "A sector"], a: "Two segments", calculator: false },
    { q: "The angle in a semicircle is:", type: "mcq", options: ["45°", "60°", "90°", "180°"], a: "90°", calculator: false },
  ],
  G13: [
    { q: "A plan view shows a shape from:", type: "mcq", options: ["The front", "The side", "Above", "Below"], a: "Above", calculator: false },
    { q: "How many faces does a triangular prism have?", a: "5", type: "number", calculator: false },
    { q: "The front elevation of a cylinder looks like:", type: "mcq", options: ["A circle", "A rectangle", "A triangle", "An oval"], a: "A rectangle", calculator: false },
    { q: "A cube has how many edges?", a: "12", type: "number", calculator: false },
  ],
  G14: [
    { q: "Find the area of a triangle with base 8cm and height 5cm", a: "20", type: "number", calculator: false },
    { q: "A triangle has area 24cm² and height 6cm. Find the base.", a: "8", type: "number", calculator: false },
    { q: "Find the area of a parallelogram with base 12cm and height 7cm", a: "84", type: "number", calculator: false },
    { q: "A trapezium has parallel sides 6cm and 10cm, and height 4cm. Find the area.", a: "32", type: "number", calculator: false },
  ],
  G15: [
    { q: "Find the area of a circle with radius 5 cm. Give your answer to 1 d.p.", a: "78.5", type: "number", hint: "Use π = 3.14", calculator: true },
    { q: "Find the circumference of a circle with diameter 10cm (to 1 d.p.)", a: "31.4", type: "number", calculator: true },
    { q: "The formula for circumference is:", type: "mcq", options: ["πr", "2πr", "πr²", "2πr²"], a: "2πr", calculator: false },
    { q: "A circle has circumference 20π cm. Find the radius.", a: "10", type: "number", calculator: false },
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
    { q: "In a right-angled triangle, the hypotenuse is 10 and the adjacent is 8. Find cos(θ) as a decimal.", a: "0.8", type: "number", calculator: false },
  ],
  
  // Probability
  P1: [
    { q: "A coin is flipped 20 times. Heads appears 12 times. What is the experimental probability of heads as a decimal?", a: "0.6", type: "number", calculator: false },
    { q: "A dice is rolled 50 times. Which table best records the outcomes?", type: "mcq", options: ["List of all 50 numbers", "Tally chart with frequency", "Bar chart", "Pie chart"], a: "Tally chart with frequency", calculator: false },
    { q: "In an experiment, a spinner lands on red 15 times out of 60 spins. What is the relative frequency of red?", a: "0.25", type: "number", calculator: false },
    { q: "Why do we record experimental outcomes in a table?", type: "mcq", options: ["It looks neat", "To spot patterns and calculate probabilities", "The teacher said so", "It's faster"], a: "To spot patterns and calculate probabilities", calculator: false },
  ],
  P2: [
    { q: "A dice has faces 1,1,1,2,2,3. Is it fair?", type: "mcq", options: ["Yes", "No"], a: "No", calculator: false },
    { q: "For a fair spinner with 5 equal sections, P(any section) = ", a: "0.2", type: "number", calculator: false },
    { q: "A coin is fair. What is P(heads)?", type: "mcq", options: ["0.25", "0.5", "0.75", "1"], a: "0.5", calculator: false },
    { q: "Which would make an experiment unfair?", type: "mcq", options: ["Using a normal dice", "Flipping a coin", "Using a weighted dice", "Drawing from a shuffled deck"], a: "Using a weighted dice", calculator: false },
  ],
  P3: [
    { q: "A spinner lands on blue 18 times in 60 spins. What is the relative frequency of blue?", a: "0.3", type: "number", calculator: false },
    { q: "After 100 trials, an event occurred 35 times. Estimate the probability.", a: "0.35", type: "number", calculator: false },
    { q: "Relative frequency = ", type: "mcq", options: ["Total trials ÷ successes", "Successes ÷ total trials", "Successes × total trials", "Total - successes"], a: "Successes ÷ total trials", calculator: false },
    { q: "As the number of trials increases, relative frequency gets closer to:", type: "mcq", options: ["Zero", "One", "Theoretical probability", "Infinity"], a: "Theoretical probability", calculator: false },
  ],
  P4: [
    { q: "The probability of rain is 0.3. What is the probability of no rain?", a: "0.7", type: "text", calculator: false },
    { q: "P(A) = 0.45. What is P(not A)?", type: "mcq", options: ["0.45", "0.55", "0.65", "1.45"], a: "0.55", calculator: false },
    { q: "P(winning) = 1/5. Find P(not winning) as a fraction.", a: "4/5", type: "text", calculator: false },
    { q: "Events A and B are mutually exclusive. P(A) = 0.3, P(B) = 0.4. Find P(A or B).", a: "0.7", type: "number", calculator: false },
  ],
  P5: [
    { q: "An event is certain to happen. Its probability is:", type: "mcq", options: ["0", "0.5", "1", "2"], a: "1", calculator: false },
    { q: "An event is impossible. Its probability is:", type: "mcq", options: ["0", "0.5", "1", "-1"], a: "0", calculator: false },
    { q: "P(event) = 0.75. Describe this likelihood:", type: "mcq", options: ["Impossible", "Unlikely", "Evens", "Likely"], a: "Likely", calculator: false },
    { q: "Put in order from least to most likely: P=0.8, P=0.2, P=0.5, P=0.95", a: "0.2, 0.5, 0.8, 0.95", type: "text", calculator: false },
  ],
  P7: [
    { q: "Two coins are flipped. List all possible outcomes.", a: "HH, HT, TH, TT", type: "text", calculator: false },
    { q: "A dice is rolled and a coin is flipped. How many possible outcomes?", a: "12", type: "number", calculator: false },
    { q: "Two dice are rolled. How many ways can you get a total of 7?", a: "6", type: "number", calculator: false },
    { q: "From cards A, B, C, how many ways can you pick 2 in order?", type: "mcq", options: ["3", "6", "9", "12"], a: "6", calculator: false },
  ],
  P8: [
    { q: "Using the tree diagram, find the probability of getting two gold cards. Give your answer as a decimal.", a: "0.0025", type: "number", diagram: "tree-diagram-gold", calculator: true, hint: "Multiply along the branches: 0.05 × 0.05" },
    { q: "Using the tree diagram, find P(at least one gold card). Give your answer as a decimal.", a: "0.0975", type: "number", diagram: "tree-diagram-gold", calculator: true, hint: "P(at least one) = 1 - P(none)" },
    { q: "A bag has 3 red and 2 blue balls. One is picked and replaced, then another is picked. Find P(both red) as a fraction.", a: "9/25", type: "text", calculator: false },
    { q: "Two coins are flipped. P(both heads) = ", type: "mcq", options: ["1/2", "1/3", "1/4", "1/8"], a: "1/4", calculator: false },
  ],
  
  // Statistics
  S1: [
    { q: "Which sampling method picks names from a hat?", type: "mcq", options: ["Systematic", "Random", "Stratified", "Quota"], a: "Random", calculator: false },
    { q: "A survey only asks people in a shopping centre. This is:", type: "mcq", options: ["Random sampling", "Stratified sampling", "Biased sampling", "Systematic sampling"], a: "Biased sampling", calculator: false },
    { q: "To get a representative sample of a school, you should:", type: "mcq", options: ["Ask your friends", "Ask one class", "Sample from each year group", "Ask teachers only"], a: "Sample from each year group", calculator: false },
    { q: "Why might an online survey about internet usage be biased?", type: "mcq", options: ["It's free", "Only internet users respond", "It's anonymous", "It's quick"], a: "Only internet users respond", calculator: false },
  ],
  S2: [
    { q: "The pie chart shows votes in an election. Amy received 162°. If 180 people voted in total, how many voted for Amy?", a: "81", type: "number", diagram: "pie-chart-talent", calculator: true, hint: "162° out of 360° represents what fraction?" },
    { q: "What fraction of the total votes did Amy receive? Give your answer in simplest form.", a: "9/20", type: "text", diagram: "pie-chart-talent", calculator: false },
    { q: "Reading a pie chart: 90° represents what fraction of the total?", type: "mcq", options: ["1/2", "1/3", "1/4", "1/5"], a: "1/4", calculator: false },
    { q: "In a pie chart, 45 people are represented by 90°. How many degrees represent 60 people?", a: "120", type: "number", calculator: false },
  ],
  S3: [
    { q: "In a pie chart, how many degrees represent the whole?", a: "360", type: "number", calculator: false },
    { q: "25% of data in a pie chart is represented by:", type: "mcq", options: ["25°", "45°", "90°", "180°"], a: "90°", calculator: false },
    { q: "40 people out of 120 chose 'red'. What angle represents 'red' on a pie chart?", a: "120", type: "number", calculator: false },
    { q: "A pie chart sector is 72°. What percentage of the total is this?", a: "20", type: "number", calculator: false },
  ],
  S4: [
    { q: "On a distance-time graph, a steeper line means:", type: "mcq", options: ["Slower speed", "Faster speed", "Stopped", "Going backwards"], a: "Faster speed", calculator: false },
    { q: "A horizontal line on a distance-time graph means:", type: "mcq", options: ["Moving fast", "Moving slowly", "Stationary", "Accelerating"], a: "Stationary", calculator: false },
    { q: "The gradient of a distance-time graph gives:", type: "mcq", options: ["Distance", "Time", "Speed", "Acceleration"], a: "Speed", calculator: false },
    { q: "On a graph, the rate of change is found by:", type: "mcq", options: ["Reading the y-axis", "Reading the x-axis", "Drawing a tangent and finding its gradient", "Adding coordinates"], a: "Drawing a tangent and finding its gradient", calculator: false },
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
  A26: [
    { q: "A circle has centre O at the origin. Point (0, 6) lies on the circle. What is the equation of the circle?", a: "x² + y² = 36", type: "text", diagram: "circle-equation", calculator: false },
    { q: "The point (3, 4) lies on a circle centred at the origin. Find the radius.", a: "5", type: "number", calculator: false, hint: "Use r² = x² + y²" },
    { q: "Which point lies on the circle x² + y² = 25?", type: "mcq", options: ["(3, 3)", "(4, 3)", "(3, 4)", "(4, 4)"], a: "(3, 4)", calculator: false },
    { q: "A circle has equation x² + y² = 100. What is its radius?", a: "10", type: "number", calculator: false },
  ],

  // Geometry with diagrams
  G7: [
    { q: "Describe fully the single transformation that maps shape A onto shape B.", a: "Rotation 180° about the origin", type: "text", diagram: "transformation-grid", calculator: false },
    { q: "Which transformation keeps the shape the same size?", type: "mcq", options: ["Enlargement", "Rotation", "Stretch", "Scale factor 2"], a: "Rotation", calculator: false },
    { q: "A shape is reflected in the y-axis. Point (3, 5) maps to:", type: "mcq", options: ["(-3, 5)", "(3, -5)", "(-3, -5)", "(5, 3)"], a: "(-3, 5)", calculator: false },
    { q: "A shape is rotated 90° clockwise about the origin. Point (2, 3) maps to:", type: "mcq", options: ["(3, -2)", "(-3, 2)", "(3, 2)", "(-2, -3)"], a: "(3, -2)", calculator: false },
  ],

  // Probability with diagrams
  P6: [
    { q: "In a group of 30 students, 18 study German (G), 15 study Latin (L), and 8 study both. How many study neither?", a: "5", type: "number", diagram: "venn-diagram-gl", calculator: false, hint: "Use: n(G∪L) = n(G) + n(L) - n(G∩L)" },
    { q: "Using the Venn diagram context: Find the number who study German only.", a: "10", type: "number", diagram: "venn-diagram-gl", calculator: false },
    { q: "In a Venn diagram, the intersection shows:", type: "mcq", options: ["Neither A nor B", "A or B", "A and B", "Only A"], a: "A and B", calculator: false },
    { q: "50 people were surveyed. 32 like tea, 28 like coffee, 15 like both. How many like neither?", a: "5", type: "number", calculator: false },
  ],

  // ========== HIGHER TIER OBJECTIVES ==========

  // Number - Higher
  N9: [
    { q: "Simplify: 8^(2/3)", a: "4", type: "number", calculator: false, hint: "8^(2/3) = (³√8)² = 2² = 4" },
    { q: "Simplify: 27^(-1/3)", a: "1/3", type: "text", calculator: false },
    { q: "What is 16^(3/4)?", type: "mcq", options: ["8", "12", "64", "4"], a: "8", calculator: false },
    { q: "Simplify: 5^(-2)", a: "1/25", type: "text", calculator: false },
  ],

  // Algebra - Higher
  A8: [
    { q: "Is 2(x + 3) = 2x + 6 an equation or identity?", type: "mcq", options: ["Equation", "Identity"], a: "Identity", calculator: false },
    { q: "Which is an identity?", type: "mcq", options: ["x² = 9", "x² - 9 = (x+3)(x-3)", "x² = x + 6", "2x = 10"], a: "x² - 9 = (x+3)(x-3)", calculator: false },
    { q: "An identity is true for:", type: "mcq", options: ["One value of x", "Two values of x", "All values of x", "No values of x"], a: "All values of x", calculator: false },
    { q: "Is (x + 1)² = x² + 2x + 1 an identity?", type: "mcq", options: ["Yes", "No"], a: "Yes", calculator: false },
  ],
  A10: [
    { q: "Prove that (n+1)² - n² is always odd", a: "= 2n + 1, which is always odd", type: "text", calculator: false },
    { q: "The sum of any two consecutive integers is:", type: "mcq", options: ["Always even", "Always odd", "Sometimes even", "A multiple of 4"], a: "Always odd", calculator: false },
    { q: "If n is even, what is n² + n?", type: "mcq", options: ["Always even", "Always odd", "Could be either"], a: "Always even", calculator: false },
    { q: "Prove the sum of 3 consecutive integers is divisible by 3", a: "n + (n+1) + (n+2) = 3n + 3 = 3(n+1)", type: "text", calculator: false },
  ],
  A11: [
    { q: "If f(x) = 2x + 3, find f⁻¹(x)", a: "(x - 3)/2", type: "text", calculator: false },
    { q: "The inverse of 'multiply by 4 then add 5' is:", type: "mcq", options: ["Subtract 5 then divide by 4", "Divide by 4 then subtract 5", "Add 5 then multiply by 4", "Subtract 4 then divide by 5"], a: "Subtract 5 then divide by 4", calculator: false },
    { q: "If f(x) = x² for x ≥ 0, find f⁻¹(25)", a: "5", type: "number", calculator: false },
    { q: "If g(x) = 3x - 1, what is g⁻¹(8)?", a: "3", type: "number", calculator: false },
  ],
  A12: [
    { q: "f(x) = 2x + 1, g(x) = x². Find fg(3)", a: "19", type: "number", calculator: false, hint: "fg(3) = f(g(3)) = f(9) = 19" },
    { q: "f(x) = x + 3, g(x) = 2x. Find gf(5)", a: "16", type: "number", calculator: false },
    { q: "f(x) = x², g(x) = x + 1. What is fg(x)?", type: "mcq", options: ["x² + 1", "(x + 1)²", "x² + x", "2x²"], a: "(x + 1)²", calculator: false },
    { q: "f(x) = 3x, g(x) = x - 2. Find gf(4) - fg(4)", a: "4", type: "number", calculator: false },
  ],
  A16: [
    { q: "Where does y = x³ cross the y-axis?", a: "(0, 0)", type: "text", calculator: false },
    { q: "The graph y = x³ - 8 crosses the x-axis at:", type: "mcq", options: ["x = 0", "x = 2", "x = 8", "x = -2"], a: "x = 2", calculator: false },
    { q: "How many turning points does a cubic graph have at most?", type: "mcq", options: ["0", "1", "2", "3"], a: "2", calculator: false },
    { q: "Sketch y = x³ passes through which quadrants?", type: "mcq", options: ["1 and 3", "2 and 4", "1 and 2", "All four"], a: "1 and 3", calculator: false },
  ],
  A20: [
    { q: "Using xₙ₊₁ = (xₙ + 5/xₙ)/2 with x₀ = 2, find x₁", a: "2.25", type: "number", calculator: true },
    { q: "The iteration xₙ₊₁ = 3 + 1/xₙ with x₀ = 3 gives x₁ =", type: "mcq", options: ["3.33", "3.5", "4", "3.25"], a: "3.33", calculator: true },
    { q: "What does iteration help us find?", type: "mcq", options: ["Exact solutions", "Approximate solutions", "Factors", "Graphs"], a: "Approximate solutions", calculator: false },
    { q: "Using xₙ₊₁ = √(10 - xₙ) with x₀ = 3, find x₂ to 2dp", a: "2.83", type: "number", calculator: true },
  ],
  A22: [
    { q: "Solve: 3x - 7 > 5", a: "x > 4", type: "text", calculator: false },
    { q: "Solve: 2x + 1 ≤ 9", a: "x ≤ 4", type: "text", calculator: false },
    { q: "If -3 < x ≤ 2 and x is an integer, list all values", a: "-2, -1, 0, 1, 2", type: "text", calculator: false },
    { q: "Solve: 4 < 2x + 6 < 12", a: "-1 < x < 3", type: "text", calculator: false },
  ],
  A25: [
    { q: "Find the nth term of: 2, 6, 12, 20, 30, ...", a: "n² + n", type: "text", calculator: false, hint: "Second difference = 2, so starts with n²" },
    { q: "The second difference of a quadratic sequence is:", type: "mcq", options: ["Always 0", "Always constant", "Always 2", "Variable"], a: "Always constant", calculator: false },
    { q: "Find the nth term of: 1, 4, 9, 16, 25, ...", a: "n²", type: "text", calculator: false },
    { q: "Find the 10th term of the sequence with nth term n² + 3n", a: "130", type: "number", calculator: false },
  ],

  // Ratio - Higher
  R13: [
    { q: "y is directly proportional to x². When x = 2, y = 12. Find y when x = 5.", a: "75", type: "number", calculator: false },
    { q: "y is inversely proportional to x. When x = 4, y = 6. Find y when x = 8.", a: "3", type: "number", calculator: false },
    { q: "If A ∝ r², and A = 50 when r = 5, find A when r = 7.", a: "98", type: "number", calculator: false },
    { q: "P is inversely proportional to √Q. P = 8 when Q = 9. Find P when Q = 16.", a: "6", type: "number", calculator: false },
  ],
  R15: [
    { q: "Two similar shapes have lengths in ratio 2:3. What is the ratio of their areas?", a: "4:9", type: "text", calculator: false },
    { q: "Two similar solids have surface areas in ratio 4:9. What is the ratio of their volumes?", a: "8:27", type: "text", calculator: false },
    { q: "A model is 1:50 scale. The real car is 4m long. The model's surface area is 0.032m². What is the real car's surface area?", a: "80", type: "number", calculator: true },
    { q: "Similar cones have volumes 64cm³ and 27cm³. The larger has height 12cm. Find the smaller's height.", a: "9", type: "number", calculator: false },
  ],
  R16: [
    { q: "£5000 is invested at 3% compound interest per year. Find the value after 2 years.", a: "5304.50", type: "number", calculator: true },
    { q: "A car depreciates by 15% per year. It cost £12000. Find its value after 3 years (to nearest £).", a: "7370", type: "number", calculator: true },
    { q: "A population of 10000 grows by 5% each year. After how many years will it exceed 12000?", type: "mcq", options: ["3", "4", "5", "6"], a: "4", calculator: true },
    { q: "The formula for compound interest is:", type: "mcq", options: ["P(1 + r)ⁿ", "P + Prn", "P × r × n", "P/(1 + r)ⁿ"], a: "P(1 + r)ⁿ", calculator: false },
  ],

  // Geometry - Higher
  G10: [
    { q: "A shape is enlarged from 12cm to 8cm. What is the scale factor?", a: "2/3", type: "text", calculator: false },
    { q: "Scale factor -2 means:", type: "mcq", options: ["Enlarge by 2", "Reduce by half", "Enlarge by 2 and rotate 180°", "Reflect and double"], a: "Enlarge by 2 and rotate 180°", calculator: false },
    { q: "A shape is enlarged SF 3 from centre (1, 2). Point (3, 4) maps to:", a: "(7, 8)", type: "text", calculator: false },
    { q: "Two similar triangles have sides 6cm and 9cm. What is the scale factor?", a: "3/2", type: "text", calculator: false },
  ],
  G12: [
    { q: "Angle in a semicircle is always:", type: "mcq", options: ["45°", "60°", "90°", "180°"], a: "90°", calculator: false },
    { q: "Angles in the same segment are:", type: "mcq", options: ["Supplementary", "Equal", "Complementary", "Different"], a: "Equal", calculator: false },
    { q: "The angle at the centre is _____ the angle at the circumference", type: "mcq", options: ["Half", "Equal to", "Twice", "Three times"], a: "Twice", calculator: false },
    { q: "A tangent meets a radius at:", type: "mcq", options: ["45°", "60°", "90°", "Any angle"], a: "90°", calculator: false },
  ],
  G18: [
    { q: "Which congruence rule needs two sides and the included angle?", type: "mcq", options: ["SSS", "SAS", "ASA", "RHS"], a: "SAS", calculator: false },
    { q: "Two triangles have sides 3, 4, 5 and 3, 4, 5. They are congruent by:", type: "mcq", options: ["SSS", "SAS", "ASA", "AAS"], a: "SSS", calculator: false },
    { q: "RHS applies only to:", type: "mcq", options: ["All triangles", "Isosceles triangles", "Right-angled triangles", "Equilateral triangles"], a: "Right-angled triangles", calculator: false },
    { q: "If △ABC ≅ △DEF by SAS, which angle must be between the two sides?", type: "mcq", options: ["Any angle", "The largest angle", "The included angle", "The smallest angle"], a: "The included angle", calculator: false },
  ],
  G21: [
    { q: "What is sin 30°?", a: "1/2", type: "text", calculator: false },
    { q: "What is cos 60°?", a: "1/2", type: "text", calculator: false },
    { q: "What is tan 45°?", a: "1", type: "number", calculator: false },
    { q: "sin 90° = ", type: "mcq", options: ["0", "1/2", "√2/2", "1"], a: "1", calculator: false },
  ],
  G22: [
    { q: "In triangle ABC, a = 8cm, angle A = 40°, angle B = 60°. Find b (to 1dp).", a: "10.8", type: "number", calculator: true, hint: "Use sine rule: a/sinA = b/sinB" },
    { q: "The sine rule is used when you know:", type: "mcq", options: ["Three sides", "Two sides and included angle", "A side and opposite angle", "All angles"], a: "A side and opposite angle", calculator: false },
    { q: "In sine rule, a/sin A = ", type: "mcq", options: ["b/sin B", "b × sin B", "sin B/b", "a × sin A"], a: "b/sin B", calculator: false },
    { q: "Find angle B if a = 10, b = 15, angle A = 30°", a: "48.6", type: "number", calculator: true },
  ],
  G23: [
    { q: "Find the area of a triangle with sides 7cm and 9cm and included angle 50°", a: "24.1", type: "number", calculator: true, hint: "Area = ½ab sin C" },
    { q: "Area = ½ab sin C requires:", type: "mcq", options: ["Three sides", "Two sides and included angle", "Two angles and a side", "All angles"], a: "Two sides and included angle", calculator: false },
    { q: "A triangle has sides 8cm and 6cm with included angle 90°. Find the area.", a: "24", type: "number", calculator: false },
    { q: "Find the area: a = 12, b = 10, C = 30°", a: "30", type: "number", calculator: false, hint: "sin 30° = 0.5" },
  ],
  G24: [
    { q: "If a = (3, 4), find |a| (the magnitude)", a: "5", type: "number", calculator: false },
    { q: "If a = (2, 5) and b = (3, -1), find a + b", a: "(5, 4)", type: "text", calculator: false },
    { q: "If a = (4, 2), find 3a", a: "(12, 6)", type: "text", calculator: false },
    { q: "Find the magnitude of vector (5, 12)", a: "13", type: "number", calculator: false },
  ],
  G25: [
    { q: "If a = (1, 3) and b = (2, -1), find 2a + b", a: "(4, 5)", type: "text", calculator: false },
    { q: "If a = (3, 1) and b = (-1, 4), find a - b", a: "(4, -3)", type: "text", calculator: false },
    { q: "OA = a, OB = b. Express AB in terms of a and b.", a: "b - a", type: "text", calculator: false },
    { q: "If M is midpoint of AB, OM = ", type: "mcq", options: ["a + b", "(a + b)/2", "a - b", "2(a + b)"], a: "(a + b)/2", calculator: false },
  ],

  // Probability - Higher
  P9: [
    { q: "A bag has 4 red and 3 blue balls. Two are drawn without replacement. Find P(both red) as a fraction.", a: "2/7", type: "text", calculator: false },
    { q: "From 5 cards (1,2,3,4,5), two are picked without replacement. Find P(both even).", a: "1/10", type: "text", calculator: false },
    { q: "A box has 6 red and 4 blue. Two are taken without replacement. Find P(different colours).", a: "8/15", type: "text", calculator: false },
    { q: "Without replacement changes probabilities because:", type: "mcq", options: ["Total stays same", "Total decreases", "Probabilities stay same", "Events become independent"], a: "Total decreases", calculator: false },
  ],

  // Statistics - Higher
  S6: [
    { q: "Frequency density = ", type: "mcq", options: ["Frequency × class width", "Frequency ÷ class width", "Class width ÷ frequency", "Frequency + class width"], a: "Frequency ÷ class width", calculator: false },
    { q: "A histogram bar has width 10 and height (FD) 3. What is the frequency?", a: "30", type: "number", calculator: false },
    { q: "Class 10-20 has frequency 24. What is the frequency density?", a: "2.4", type: "number", calculator: false },
    { q: "In a histogram, the area of a bar represents:", type: "mcq", options: ["Class width", "Frequency density", "Frequency", "Midpoint"], a: "Frequency", calculator: false },
  ],
};

// Higher tier question bank - harder versions of shared objectives for grades 4-9
// These replace the foundation questions when the student is on Higher tier
const higherQuestionBank = {
  // Number - Higher versions (grades 4-9 difficulty)
  N1: [
    { q: "Order from smallest to largest: 3.2 × 10⁻², 0.03[r], 0.032, 3.02 × 10⁻²", a: "3.2 × 10⁻², 0.032, 3.02 × 10⁻², 0.03[r]", type: "text", calculator: false },
    { q: "Which is largest?", type: "mcq", options: ["0.45[r]6[r]", "0.456", "0.4[r]5[r]6[r]", "0.46"], a: "0.4[r]5[r]6[r]", calculator: false },
    { q: "Order from smallest to largest:", type: "order", items: ["√0.16", "0.39", "2/5", "0.4[r]"], correctOrder: ["√0.16", "0.39", "2/5", "0.4[r]"], calculator: false },
    { q: "Order these from smallest to largest: -0.35, -3/8, -0.3[r], -0.38", a: "-3/8, -0.38, -0.35, -0.3[r]", type: "text", calculator: false },
    { q: "Put in order from largest to smallest:", type: "order", items: ["7.2 × 10⁻³", "0.072", "7.02 × 10⁻²", "0.007[r]"], correctOrder: ["7.02 × 10⁻²", "0.072", "0.007[r]", "7.2 × 10⁻³"], calculator: false },
  ],
  N2: [
    { q: "Calculate: (-8)² ÷ (-2)³", a: "-8", type: "number", calculator: false },
    { q: "Work out: 3.6 × 0.25 ÷ 0.09", a: "10", type: "number", calculator: false },
    { q: "Calculate: -2.4 × (-3.5) + (-1.2)²", a: "9.84", type: "number", calculator: true },
    { q: "What is (-5)³ ÷ (-5)²?", type: "mcq", options: ["-25", "-5", "5", "25"], a: "-5", calculator: false },
    { q: "Calculate: 0.125 × 0.8 ÷ 0.04", a: "2.5", type: "number", calculator: false },
  ],
  N3: [
    { q: "Write 0.000052 in standard form", a: "5.2 × 10⁻⁵", type: "text", calculator: false },
    { q: "Calculate: (3 × 10⁴) × (2 × 10⁻²)", a: "6 × 10²", type: "text", calculator: false },
    { q: "Which calculation gives 8 × 10⁷?", type: "mcq", options: ["(2 × 10⁴) × (4 × 10³)", "(4 × 10⁵) × (2 × 10³)", "(8 × 10⁴) × (1 × 10²)", "(2 × 10⁵) × (4 × 10³)"], a: "(2 × 10⁴) × (4 × 10³)", calculator: false },
    { q: "Write (4.8 × 10⁵) ÷ (1.2 × 10⁻²) in standard form", a: "4 × 10⁷", type: "text", calculator: false },
    { q: "Order from smallest to largest:", type: "order", items: ["3 × 10⁻⁴", "3.1 × 10⁻⁵", "0.0003", "2.9 × 10⁻⁴"], correctOrder: ["3.1 × 10⁻⁵", "2.9 × 10⁻⁴", "0.0003", "3 × 10⁻⁴"], calculator: false },
  ],
  N4: [
    { q: "I calculated (2.5)³ = 15.625. Which check confirms this?", type: "mcq", options: ["15.625 ÷ 2.5", "∛15.625", "15.625 × 3", "2.5 × 3"], a: "∛15.625", calculator: false },
    { q: "Use estimation to check: 48.7 × 21.3 ≈ 1037. Is this reasonable? (yes/no)", a: "yes", type: "text", calculator: false, hint: "50 × 20 = 1000" },
    { q: "Which inverse operation checks √324 = 18?", a: "18²", type: "text", calculator: false },
    { q: "I calculated 4.8 ÷ 0.12 = 40. Which calculation verifies this?", type: "mcq", options: ["40 × 0.12", "4.8 × 0.12", "40 - 0.12", "4.8 + 40"], a: "40 × 0.12", calculator: false },
  ],
  N5: [
    { q: "Work out: 2³ + 4² × 3 - 24 ÷ (6 - 2)", a: "50", type: "number", calculator: false },
    { q: "Calculate: (3² × 2³) ÷ (√36)", a: "12", type: "number", calculator: false },
    { q: "What is 5 × 2³ - 4² ÷ 2?", type: "mcq", options: ["32", "36", "40", "24"], a: "32", calculator: false },
    { q: "Calculate: ((8 + 4)² - 6²) ÷ (3² + 3)", a: "9", type: "number", calculator: false },
    { q: "Work out: 2⁴ - 3 × (5 - 2)² + 1", a: "-10", type: "number", calculator: false },
  ],
  N6: [
    { q: "Calculate: √(3² + 4²)", a: "5", type: "number", calculator: false },
    { q: "What is 4⁻² as a fraction?", a: "1/16", type: "text", calculator: false },
    { q: "Calculate: 27^(1/3) × 16^(1/4)", a: "6", type: "number", calculator: false },
    { q: "Which is equivalent to 8^(2/3)?", type: "mcq", options: ["2", "4", "6", "16"], a: "4", calculator: false },
    { q: "Calculate: 5⁰ + 5¹ + 5⁻¹", a: "6.2", type: "number", calculator: false },
    { q: "Put in order from smallest to largest:", type: "order", items: ["√50", "3²", "2⁴", "∛125"], correctOrder: ["∛125", "√50", "3²", "2⁴"], calculator: false },
  ],
  N7: [
    { q: "Find ∛(-64)", a: "-4", type: "number", calculator: false },
    { q: "Calculate: 4³ - 3⁴", a: "-17", type: "number", calculator: false },
    { q: "Which value of x satisfies x³ = -125?", type: "mcq", options: ["-5", "5", "-25", "25"], a: "-5", calculator: false },
    { q: "Work out: ∛1000 × ∛8", a: "20", type: "number", calculator: false },
    { q: "Calculate: ∛(27/8)", a: "1.5", type: "number", calculator: false },
  ],
  N8: [
    { q: "Find the HCF of 126 and 168 using prime factorisation", a: "42", type: "number", calculator: false },
    { q: "Two buses leave together. One returns every 18 minutes, one every 24 minutes. When do they next leave together?", a: "72", type: "number", calculator: false, hint: "Answer in minutes" },
    { q: "The HCF of two numbers is 14. Their LCM is 168. One number is 56. What is the other?", a: "42", type: "number", calculator: false },
    { q: "Express 360 as a product of prime factors", a: "2³ × 3² × 5", type: "text", calculator: false },
    { q: "Find the LCM of 15, 20 and 25", a: "300", type: "number", calculator: false },
  ],
  N10: [
    { q: "Write 0.2[r]7[r] as a fraction", a: "3/11", type: "text", calculator: false },
    { q: "Convert 0.1[r]8[r] to a fraction in simplest form", a: "2/11", type: "text", calculator: false },
    { q: "Which fraction equals 0.8[r]3[r]?", type: "mcq", options: ["83/99", "83/100", "5/6", "83/90"], a: "5/6", calculator: false },
    { q: "Express 0.41[r] as a fraction", a: "37/90", type: "text", calculator: false },
    { q: "Match each recurring decimal to its fraction:", type: "match", leftItems: ["0.1[r]", "0.0[r]9[r]", "0.2[r]", "0.1[r]2[r]"], rightItems: ["1/9", "2/9", "4/33", "1/11"], correctMatches: { "0": 0, "1": 3, "2": 1, "3": 2 }, calculator: false },
  ],
  N11: [
    { q: "Express 45 seconds as a fraction of 2 minutes in simplest form", a: "3/8", type: "text", calculator: false },
    { q: "A is 20% of B. Express A as a fraction of B.", a: "1/5", type: "text", calculator: false },
    { q: "Express 750ml as a fraction of 2 litres", a: "3/8", type: "text", calculator: false },
    { q: "What fraction of 2.5 hours is 45 minutes?", type: "mcq", options: ["3/10", "9/25", "3/8", "18/25"], a: "3/10", calculator: false },
  ],
  N12: [
    { q: "Increase £240 by 15%, then decrease by 10%. What is the final amount?", a: "248.40", type: "number", calculator: true },
    { q: "After a 12% increase, a price is £336. What was the original price?", a: "300", type: "number", calculator: true },
    { q: "Find 2/5 of 3/4 of 200", a: "60", type: "number", calculator: false },
    { q: "A jacket costs £85 after a 15% reduction. What was the original price?", a: "100", type: "number", calculator: true },
    { q: "Calculate: 3/8 × 2/3 + 1/4", a: "1/2", type: "text", calculator: false },
  ],
  N13: [
    { q: "Convert 0.075 km² to m²", a: "75000", type: "number", calculator: true },
    { q: "Which is larger: 2500 cm³ or 0.025 m³?", type: "mcq", options: ["2500 cm³", "0.025 m³", "They are equal", "Cannot compare"], a: "0.025 m³", calculator: false },
    { q: "Convert 4.5 × 10⁻³ km to mm", a: "4500", type: "number", calculator: false },
    { q: "A tank holds 0.35 m³ of water. How many litres is this?", a: "350", type: "number", calculator: false },
  ],
  N14: [
    { q: "Estimate: (4.92 × 10⁴) × (3.1 × 10⁻²)", a: "1500", type: "number", hint: "Round to 1 s.f.", calculator: false },
    { q: "Estimate: √(98.7) × 4.1²", a: "160", type: "number", hint: "Round suitably", calculator: false },
    { q: "The circumference of a circle is 47.3 cm. Estimate the diameter.", a: "15", type: "number", hint: "Use π ≈ 3", calculator: false },
    { q: "Estimate: 0.49 × 803 ÷ 0.21", a: "2000", type: "number", hint: "Round to 1 s.f.", calculator: false },
  ],
  N15: [
    { q: "Round 0.004567 to 2 significant figures", a: "0.0046", type: "text", calculator: false },
    { q: "A calculation gives 0.0049876. What is this to 3 s.f.?", a: "0.00499", type: "text", calculator: false },
    { q: "What is the greatest value that rounds to 4500 to 2 s.f.?", type: "mcq", options: ["4549", "4549.9...", "4500", "4450"], a: "4549.9...", calculator: false },
    { q: "Round 3456.789 to 4 significant figures", a: "3457", type: "text", calculator: false },
    { q: "The answer to a calculation is 1.999876. Round to 3 significant figures.", a: "2.00", type: "text", calculator: false },
  ],

  // Algebra - Higher versions (grades 4-9 difficulty)
  A1: [
    { q: "Simplify: 3a²b × 4ab³", a: "12a³b⁴", type: "text", calculator: false },
    { q: "Simplify: (2x³y²)³", a: "8x⁹y⁶", type: "text", calculator: false },
    { q: "Which is equivalent to 15p⁴q³ ÷ 3pq²?", type: "mcq", options: ["5p³q", "5p⁴q", "12p³q", "5p³q²"], a: "5p³q", calculator: false },
    { q: "Simplify: 4x⁻²y³ × 2xy⁻¹", a: "8y²/x", type: "text", calculator: false },
    { q: "Simplify: (3a²)⁻² × 27a⁴", a: "3", type: "text", calculator: false },
  ],
  A2: [
    { q: "Expand and simplify: (3x + 2)(2x - 5)", a: "6x² - 11x - 10", type: "text", calculator: false },
    { q: "Expand: (x + 4)² - (x - 2)²", a: "12x + 12", type: "text", calculator: false },
    { q: "Which is the expansion of (2x - 3)²?", type: "mcq", options: ["4x² - 9", "4x² - 6x + 9", "4x² - 12x + 9", "4x² + 12x + 9"], a: "4x² - 12x + 9", calculator: false },
    { q: "Expand and simplify: (x + 3)(x - 3)(x + 1)", a: "x³ + x² - 9x - 9", type: "text", calculator: false },
    { q: "Expand: (2a + b)(a - 3b)", a: "2a² - 5ab - 3b²", type: "text", calculator: false },
  ],
  A3: [
    { q: "Factorise: 6x² - 15xy", a: "3x(2x - 5y)", type: "text", calculator: false },
    { q: "Factorise completely: 12a³b - 18a²b² + 6ab", a: "6ab(2a² - 3ab + 1)", type: "text", calculator: false },
    { q: "Which is the fully factorised form of 8p²q - 12pq²?", type: "mcq", options: ["4pq(2p - 3q)", "2pq(4p - 6q)", "4p(2pq - 3q²)", "pq(8p - 12q)"], a: "4pq(2p - 3q)", calculator: false },
    { q: "Factorise: 3x³y² - 6x²y³ + 9xy²", a: "3xy²(x² - 2xy + 3)", type: "text", calculator: false },
  ],
  A4: [
    { q: "Factorise: x² - 11x + 28", a: "(x - 4)(x - 7)", type: "text", calculator: false },
    { q: "Factorise: 2x² + 7x - 15", a: "(2x - 3)(x + 5)", type: "text", calculator: false },
    { q: "Which is the factorisation of 3x² - 10x - 8?", type: "mcq", options: ["(3x + 2)(x - 4)", "(3x - 2)(x + 4)", "(3x + 4)(x - 2)", "(3x - 4)(x + 2)"], a: "(3x + 2)(x - 4)", calculator: false },
    { q: "Factorise: 6x² - 7x - 20", a: "(2x - 5)(3x + 4)", type: "text", calculator: false },
    { q: "Factorise: 4x² - 25", a: "(2x + 5)(2x - 5)", type: "text", calculator: false },
  ],
  A5: [
    { q: "Solve: 5(2x - 3) = 3(x + 4) + 1", a: "4", type: "number", calculator: false },
    { q: "Solve: (x + 5)/3 = (2x - 1)/4", a: "23", type: "number", calculator: false },
    { q: "Solve: 4 - 3(2x - 1) = 2(5 - x)", a: "-0.75", type: "number", calculator: false },
    { q: "Which value satisfies 3(2x + 1) - 4(x - 2) = 17?", type: "mcq", options: ["2", "3", "4", "5"], a: "3", calculator: false },
    { q: "Solve: (3x + 2)/5 - (x - 1)/3 = 2", a: "5.5", type: "number", calculator: true },
  ],
  A7: [
    { q: "Make t the subject: v = u + at", a: "t = (v - u)/a", type: "text", calculator: false },
    { q: "Make r the subject: A = πr²", a: "r = √(A/π)", type: "text", calculator: false },
    { q: "Which is x in terms of y when 2x + 3y = 5x - 2?", type: "mcq", options: ["x = (3y + 2)/3", "x = (3y - 2)/3", "x = y + 2", "x = 3y + 2"], a: "x = (3y + 2)/3", calculator: false },
    { q: "Make a the subject: v² = u² + 2as", a: "a = (v² - u²)/(2s)", type: "text", calculator: false },
    { q: "Make x the subject: y = (3x + 2)/(x - 1)", a: "x = (y + 2)/(y - 3)", type: "text", calculator: false },
  ],
  A13: [
    { q: "Find the nth term: 5, 11, 17, 23, 29, ...", a: "6n - 1", type: "text", calculator: false },
    { q: "The nth term is 4n² - 3. What is the 10th term?", a: "397", type: "number", calculator: false },
    { q: "A sequence has nth term n² + 2n. Which term equals 48?", type: "mcq", options: ["5th", "6th", "7th", "8th"], a: "6th", calculator: false },
    { q: "Find the nth term: 1, 4, 9, 16, 25, ...", a: "n²", type: "text", calculator: false },
    { q: "The nth term is 2n² + n. What is term 5 minus term 3?", a: "34", type: "number", calculator: false },
  ],
  A14: [
    { q: "A line passes through (2, 5) and (6, 13). Find its equation.", a: "y = 2x + 1", type: "text", calculator: false },
    { q: "Find the equation of a line parallel to y = 3x - 2 through (1, 7)", a: "y = 3x + 4", type: "text", calculator: false },
    { q: "Which line is perpendicular to y = 2x + 1?", type: "mcq", options: ["y = 2x - 3", "y = -2x + 1", "y = -0.5x + 3", "y = 0.5x - 1"], a: "y = -0.5x + 3", calculator: false },
    { q: "Find where y = 3x - 5 and y = x + 3 intersect", a: "(4, 7)", type: "text", calculator: false },
    { q: "Find the equation of the perpendicular bisector of (2, 4) and (6, 8)", a: "y = -x + 11", type: "text", calculator: false },
  ],
  A15: [
    { q: "Solve: 3x - 2y = 13 and 2x + y = 4", a: "x = 3, y = -2", type: "text", calculator: false },
    { q: "Solve: 4x + 3y = 17 and 5x - 2y = 4", a: "x = 2, y = 3", type: "text", calculator: false },
    { q: "Which pair solves x + 2y = 8 and 3x - y = 3?", type: "mcq", options: ["(2, 3)", "(3, 2)", "(1, 3.5)", "(4, 2)"], a: "(2, 3)", calculator: false },
    { q: "The sum of two numbers is 15. Their difference is 3. Find both.", a: "9 and 6", type: "text", calculator: false },
  ],
  A17: [
    { q: "Solve: 2x² - 5x - 3 = 0", a: "x = 3 or x = -0.5", type: "text", calculator: false },
    { q: "Use the quadratic formula: x² + 4x - 2 = 0 (2 d.p.)", a: "x = 0.45 or x = -4.45", type: "text", calculator: true },
    { q: "Which are the solutions to x² - 5x + 6 = 0?", type: "mcq", options: ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = -1 and x = -6"], a: "x = 2 and x = 3", calculator: false },
    { q: "Solve by completing the square: x² + 6x + 5 = 0", a: "x = -1 or x = -5", type: "text", calculator: false },
  ],
  A21: [
    { q: "Solve: 3x + 7 ≤ 2x + 12", a: "x ≤ 5", type: "text", calculator: false },
    { q: "Solve: -2 < 3x + 4 ≤ 13", a: "-2 < x ≤ 3", type: "text", calculator: false },
    { q: "Which inequality has solution x > 3?", type: "mcq", options: ["2x - 5 > 1", "3x + 2 < 11", "4x - 7 < 5", "5 - x < 2"], a: "2x - 5 > 1", calculator: false },
    { q: "List the integers n satisfying -3 < 2n ≤ 6", a: "-1, 0, 1, 2, 3", type: "text", calculator: false },
    { q: "Solve: 5 - 2x ≥ x - 4", a: "x ≤ 3", type: "text", calculator: false },
  ],
  A23: [
    { q: "y is directly proportional to x². When x = 3, y = 36. Find y when x = 5.", a: "100", type: "number", calculator: false },
    { q: "y is inversely proportional to x. When x = 4, y = 6. Find x when y = 8.", a: "3", type: "number", calculator: false },
    { q: "If y ∝ x³ and y = 16 when x = 2, what is y when x = 3?", type: "mcq", options: ["36", "48", "54", "72"], a: "54", calculator: false },
    { q: "F is inversely proportional to d². If F = 100 when d = 2, find F when d = 5.", a: "16", type: "number", calculator: false },
  ],
  A24: [
    { q: "Sketch the graph y = x² - 4x + 3. What are the x-intercepts?", a: "x = 1 and x = 3", type: "text", calculator: false },
    { q: "For y = (x - 2)(x + 4), what are the coordinates of the minimum?", a: "(-1, -9)", type: "text", calculator: false },
    { q: "The graph y = x² + bx + c has minimum at (3, -4). Find b and c.", a: "b = -6, c = 5", type: "text", calculator: false },
    { q: "Which is the turning point of y = x² - 8x + 12?", type: "mcq", options: ["(4, -4)", "(4, 4)", "(-4, -4)", "(-4, 4)"], a: "(4, -4)", calculator: false },
  ],

  // Ratio, Proportion and Rates of Change - Higher versions
  R1: [
    { q: "Express 450g to 1.2kg as a ratio in simplest form", a: "3:8", type: "text", calculator: false },
    { q: "A map has scale 1:25000. A lake is 3.5 cm on the map. What is its real length in metres?", a: "875", type: "number", calculator: true },
    { q: "Divide £540 in the ratio 4:5:3", a: "180, 225, 135", type: "text", calculator: false },
    { q: "The ratio x:y = 5:3. If x + y = 72, what is x - y?", type: "mcq", options: ["12", "15", "18", "21"], a: "18", calculator: false },
  ],
  R2: [
    { q: "A recipe uses 250g flour for 15 biscuits. How much for 24 biscuits?", a: "400", type: "number", calculator: true },
    { q: "8 workers complete a job in 12 days. How many days for 6 workers?", a: "16", type: "number", calculator: false },
    { q: "y is inversely proportional to x. If y = 12 when x = 5, find y when x = 15.", a: "4", type: "number", calculator: false },
    { q: "Which statement is true for inverse proportion?", type: "mcq", options: ["xy = constant", "x/y = constant", "x + y = constant", "x² = y"], a: "xy = constant", calculator: false },
  ],
  R3: [
    { q: "Express 3/8 as a percentage", a: "37.5%", type: "text", calculator: false },
    { q: "Write 0.0375 as a percentage", a: "3.75%", type: "text", calculator: false },
    { q: "Which is the smallest?", type: "mcq", options: ["0.37", "38%", "3/8", "0.375"], a: "0.37", calculator: false },
    { q: "Express 7/40 as a percentage", a: "17.5%", type: "text", calculator: false },
  ],
  R4: [
    { q: "A car depreciates by 15% each year. After 3 years the value is £12,282.50. What was the original price?", a: "20000", type: "number", calculator: true },
    { q: "Compound interest: £5000 at 3.5% for 4 years. Find the final amount (2 d.p.)", a: "5737.62", type: "number", calculator: true },
    { q: "A price increases by 20% then decreases by 20%. What is the overall percentage change?", type: "mcq", options: ["0%", "-4%", "+4%", "-2%"], a: "-4%", calculator: false },
    { q: "An investment grows from £2400 to £2880 in 2 years with compound interest. Find the annual rate.", a: "9.5%", type: "text", calculator: true },
  ],
  R5: [
    { q: "A shop increases prices by 12%. Later it has a 15% sale. What is the overall change?", a: "-4.8%", type: "text", calculator: true },
    { q: "After a 25% decrease, a coat costs £63. What was the original price?", a: "84", type: "number", calculator: false },
    { q: "VAT is 20%. A price including VAT is £84. What was the price before VAT?", a: "70", type: "number", calculator: false },
    { q: "Which calculation finds the original if 15% was added to get £276?", type: "mcq", options: ["276 × 0.85", "276 ÷ 1.15", "276 × 1.15", "276 ÷ 0.85"], a: "276 ÷ 1.15", calculator: false },
  ],
  R6: [
    { q: "A car travels 195 miles using 15 litres of petrol. How many litres for 273 miles?", a: "21", type: "number", calculator: true },
    { q: "5 identical pipes fill a tank in 4 hours. How long for 8 pipes?", a: "2.5", type: "number", calculator: false },
    { q: "A car uses fuel at 7.5 litres per 100km. How far on 45 litres?", a: "600", type: "number", calculator: true },
    { q: "Which represents inverse proportion?", type: "mcq", options: ["y = 2x", "y = 12/x", "y = x + 5", "y = x²"], a: "y = 12/x", calculator: false },
  ],
  R7: [
    { q: "Calculate: 3/8 × 4/9 + 1/6", a: "1/3", type: "text", calculator: false },
    { q: "Calculate: (2/3)² ÷ 4/9", a: "1", type: "text", calculator: false },
    { q: "Work out: 2⅓ × 1⅘", a: "4⅕", type: "text", calculator: false },
    { q: "Which equals 5/6 ÷ 2/3?", type: "mcq", options: ["5/9", "10/9", "1¼", "10/18"], a: "1¼", calculator: false },
  ],
  R8: [
    { q: "A car travels 234km in 2 hours 36 minutes. Find the average speed in km/h.", a: "90", type: "number", calculator: true },
    { q: "Convert 25 m/s to km/h", a: "90", type: "number", calculator: false },
    { q: "A train travels at 144 km/h. How many metres does it travel in 5 seconds?", a: "200", type: "number", calculator: false },
    { q: "Which is the fastest?", type: "mcq", options: ["20 m/s", "70 km/h", "1.2 km/min", "4000 m/min"], a: "1.2 km/min", calculator: false },
  ],
  R9: [
    { q: "A model car is scale 1:24. The real car is 4.8m long. How long is the model in cm?", a: "20", type: "number", calculator: false },
    { q: "On a 1:50000 map, a path is 8.4cm. What is the real distance in km?", a: "4.2", type: "number", calculator: true },
    { q: "A model plane uses scale 1:72. Its wingspan is 15cm. What is the real wingspan in metres?", a: "10.8", type: "number", calculator: true },
    { q: "A map distance of 3cm represents 12km. What is the scale?", type: "mcq", options: ["1:4000", "1:40000", "1:400000", "1:4000000"], a: "1:400000", calculator: false },
  ],
  R10: [
    { q: "The density of gold is 19.3 g/cm³. Find the mass of 15 cm³ of gold.", a: "289.5", type: "number", calculator: true },
    { q: "A block has density 2.7 g/cm³ and mass 810g. Find its volume.", a: "300", type: "number", calculator: true },
    { q: "Pressure = Force/Area. A force of 450N acts on 0.03m². Find the pressure in N/m².", a: "15000", type: "number", calculator: true },
    { q: "Which material is densest?", type: "mcq", options: ["Mass 240g, Vol 80cm³", "Mass 175g, Vol 50cm³", "Mass 320g, Vol 100cm³", "Mass 280g, Vol 70cm³"], a: "Mass 280g, Vol 70cm³", calculator: true },
  ],
  R11: [
    { q: "A gradient of a hill is 1:8. Express this as a percentage.", a: "12.5%", type: "text", calculator: false },
    { q: "A ramp rises 1.5m over a horizontal distance of 12m. What is the gradient?", a: "1/8", type: "text", calculator: false },
    { q: "The gradient of a line between (2, 5) and (8, 17) is:", type: "mcq", options: ["1/2", "2", "6", "12"], a: "2", calculator: false },
    { q: "A ski slope has gradient 0.35. What angle does it make with horizontal? (1 d.p.)", a: "19.3", type: "number", calculator: true, hint: "Use tan" },
  ],
  R12: [
    { q: "A population of 15000 decreases by 4% each year. What is the population after 5 years?", a: "12245", type: "number", calculator: true },
    { q: "£8000 depreciates by 12% per year. After how many complete years is it first below £5000?", a: "4", type: "number", calculator: true },
    { q: "A bacteria colony triples every hour. Starting with 500, how many after 4 hours?", a: "40500", type: "number", calculator: true },
    { q: "An investment of £P grows to £P(1.045)⁵. What annual interest rate is this?", type: "mcq", options: ["4%", "4.5%", "5%", "45%"], a: "4.5%", calculator: false },
  ],
  R14: [
    { q: "A machine produces 720 items in 6 hours. What is the rate per minute?", a: "2", type: "number", calculator: false },
    { q: "Water flows at 8 litres per minute. How long to fill a 300 litre tank?", a: "37.5", type: "number", calculator: true, hint: "Answer in minutes" },
    { q: "A printer prints 24 pages per minute. How many seconds per page?", a: "2.5", type: "number", calculator: false },
    { q: "Which is the best rate?", type: "mcq", options: ["£3.60 for 450g", "£4.50 for 600g", "£5.40 for 750g", "£2.80 for 350g"], a: "£4.50 for 600g", calculator: true },
  ],

  // Geometry and Measures - Higher versions
  G1: [
    { q: "A regular polygon has exterior angle 24°. How many sides?", a: "15", type: "number", calculator: false },
    { q: "Find angle x in a polygon where angles are x, 2x, 3x, 4x, 5x and the sum is 540°", a: "36", type: "number", calculator: false },
    { q: "The interior angle of a regular polygon is 156°. How many sides?", type: "mcq", options: ["12", "15", "18", "20"], a: "15", calculator: false },
    { q: "In a hexagon, 5 angles are each 130°. Find the sixth angle.", a: "70", type: "number", calculator: false },
  ],
  G2: [
    { q: "Draw the net of a triangular prism. How many faces does it have?", a: "5", type: "number", calculator: false },
    { q: "A net shows 6 identical squares. What 3D shape is formed?", type: "mcq", options: ["Cuboid", "Cube", "Hexagonal prism", "Tetrahedron"], a: "Cube", calculator: false },
    { q: "How many edges does a pentagonal pyramid have?", a: "10", type: "number", calculator: false },
    { q: "A shape has 8 vertices and 12 edges. How many faces? (Use Euler's formula)", a: "6", type: "number", calculator: false },
  ],
  G3: [
    { q: "Calculate the area of a trapezium with parallel sides 8cm and 12cm, height 5cm", a: "50", type: "number", calculator: false },
    { q: "A parallelogram has area 84cm² and base 12cm. Find the perpendicular height.", a: "7", type: "number", calculator: false },
    { q: "Find the area of a triangle with vertices at (0,0), (6,0) and (4,5)", a: "15", type: "number", calculator: false },
    { q: "A semicircle has diameter 14cm. What is its area? (Use π = 22/7)", type: "mcq", options: ["77cm²", "154cm²", "308cm²", "44cm²"], a: "77cm²", calculator: false },
  ],
  G4: [
    { q: "A rectangle has perimeter 34cm and width 7cm. Find the length.", a: "10", type: "number", calculator: false },
    { q: "An equilateral triangle and a square have the same perimeter. The triangle has sides 8cm. Find the square's side.", a: "6", type: "number", calculator: false },
    { q: "A semicircular path has diameter 28m. Find its perimeter (π = 22/7)", a: "72", type: "number", calculator: false },
    { q: "The circumference of a circle is 44cm. What is its radius? (π = 22/7)", type: "mcq", options: ["7cm", "14cm", "21cm", "22cm"], a: "7cm", calculator: false },
  ],
  G5: [
    { q: "A cylinder has radius 5cm and height 12cm. Find its volume (π = 3.14)", a: "942", type: "number", calculator: true },
    { q: "A cone has base radius 6cm and height 10cm. Find its volume (π = 3.14)", a: "376.8", type: "number", calculator: true },
    { q: "A hemisphere has radius 9cm. Find its volume (2 d.p., π = 3.14)", a: "1526.04", type: "number", calculator: true },
    { q: "A cylinder and cone have equal bases and heights. The cylinder volume is 300cm³. What is the cone's?", type: "mcq", options: ["100cm³", "150cm³", "200cm³", "900cm³"], a: "100cm³", calculator: false },
  ],
  G6: [
    { q: "The plan view of a shape shows a circle. The front elevation is a triangle. What is the shape?", type: "mcq", options: ["Cylinder", "Cone", "Sphere", "Hemisphere"], a: "Cone", calculator: false },
    { q: "A triangular prism: what shape is its plan view looking from above the triangular face?", a: "triangle", type: "text", calculator: false },
    { q: "From above, a shape looks like a square. From the front, it's a rectangle 5cm by 3cm. What's the shape?", a: "cuboid", type: "text", calculator: false },
    { q: "A shape's three elevations are all circles. What is it?", type: "mcq", options: ["Cylinder", "Cone", "Sphere", "Hemisphere"], a: "Sphere", calculator: false },
  ],
  G7: [
    { q: "A shape is enlarged by scale factor 3. Its original area was 12cm². What is the new area?", a: "108", type: "number", calculator: false },
    { q: "Two similar triangles have sides 6cm and 15cm. If the small one has area 18cm², find the larger's area.", a: "112.5", type: "number", calculator: true },
    { q: "Two similar solids have heights 4cm and 12cm. The small one has volume 32cm³. Find the large one's volume.", a: "864", type: "number", calculator: false },
    { q: "If lengths are scaled by factor k, volumes are scaled by:", type: "mcq", options: ["k", "k²", "k³", "3k"], a: "k³", calculator: false },
  ],
  G8: [
    { q: "Find the area of a triangle with sides 5cm, 12cm and 13cm", a: "30", type: "number", calculator: false, hint: "Check if it's a right-angled triangle" },
    { q: "Using a = ½ab sin C, find the area: a = 8cm, b = 11cm, C = 60°", a: "38.1", type: "number", calculator: true },
    { q: "A triangle has area 24cm², base 8cm and included angle 30°. Find the other side.", a: "12", type: "number", calculator: false },
    { q: "Which formula gives triangle area with two sides and included angle?", type: "mcq", options: ["½ × base × height", "½ab cos C", "½ab sin C", "a² + b² - 2ab cos C"], a: "½ab sin C", calculator: false },
  ],
  G9: [
    { q: "A sector has arc length 15cm and radius 6cm. Find the angle in degrees (1 d.p.)", a: "143.2", type: "number", calculator: true },
    { q: "Find the area of a sector with radius 8cm and angle 135°", a: "75.4", type: "number", calculator: true, hint: "Use π = 3.14" },
    { q: "An arc of a circle is 1/5 of the circumference. What is the sector angle?", a: "72", type: "number", calculator: false },
    { q: "Which formula gives arc length?", type: "mcq", options: ["πr²θ/360", "2πr", "θ/360 × 2πr", "πr²"], a: "θ/360 × 2πr", calculator: false },
  ],
  G11: [
    { q: "The diagonal of a rectangle is 13cm and width is 5cm. Find the length.", a: "12", type: "number", calculator: false },
    { q: "A ladder 10m long leans against a wall with its foot 6m from the wall. How high up the wall does it reach?", a: "8", type: "number", calculator: false },
    { q: "Find the length of a diagonal of a 1m cube (2 d.p.)", a: "1.73", type: "number", calculator: true },
    { q: "In a right triangle, one leg is 7cm, hypotenuse is 25cm. Find the other leg.", type: "mcq", options: ["18cm", "24cm", "26cm", "32cm"], a: "24cm", calculator: false },
  ],
  G13: [
    { q: "A point moves from (2, 3) by vector (−4, 5). What are its new coordinates?", a: "(-2, 8)", type: "text", calculator: false },
    { q: "Find the translation vector from A(1, 4) to B(7, −2)", a: "(6, -6)", type: "text", calculator: false },
    { q: "Rotate point (3, 1) 90° clockwise about the origin. What are the new coordinates?", a: "(1, -3)", type: "text", calculator: false },
    { q: "Triangle ABC with A(1,1), B(3,1), C(2,4) is reflected in y = x. What are B's new coordinates?", type: "mcq", options: ["(1, 3)", "(3, 1)", "(-3, 1)", "(1, -3)"], a: "(1, 3)", calculator: false },
  ],
  G14: [
    { q: "Describe the single transformation that maps A(2, 3) to A'(6, 9)", a: "Enlargement scale factor 3 centre origin", type: "text", calculator: false },
    { q: "A shape at (1,2), (3,2), (2,4) is enlarged SF 2 centre (1,2). Where does (3,2) map to?", a: "(5, 2)", type: "text", calculator: false },
    { q: "What transformation maps y = f(x) to y = f(x) + 3?", type: "mcq", options: ["Translate 3 right", "Translate 3 up", "Stretch by 3", "Translate 3 left"], a: "Translate 3 up", calculator: false },
    { q: "Describe the transformation y = f(x) → y = f(2x)", a: "Horizontal stretch scale factor 0.5", type: "text", calculator: false },
  ],
  G15: [
    { q: "A cuboid is 5cm × 4cm × 3cm. Find the surface area.", a: "94", type: "number", calculator: false },
    { q: "A cylinder has radius 7cm and height 10cm. Find the curved surface area (π = 22/7)", a: "440", type: "number", calculator: false },
    { q: "A cone has base radius 6cm and slant height 10cm. Find total surface area (π = 3.14)", a: "301.44", type: "number", calculator: true },
    { q: "A sphere has surface area 616cm². Find its radius (π = 22/7)", type: "mcq", options: ["5cm", "7cm", "14cm", "49cm"], a: "7cm", calculator: false },
  ],
  G19: [
    { q: "A bearing of 045° is equivalent to which direction?", type: "mcq", options: ["NE", "NW", "SE", "SW"], a: "NE", calculator: false },
    { q: "The bearing of B from A is 118°. What is the bearing of A from B?", a: "298", type: "number", calculator: false },
    { q: "From P, Q is on bearing 250°. What is the bearing of P from Q?", a: "070", type: "text", calculator: false },
    { q: "A ship sails on bearing 320° for 80km. How far north has it travelled? (1 d.p.)", a: "61.3", type: "number", calculator: true },
  ],
  G20: [
    { q: "The scale on a map is 1:50000. What real distance does 8cm represent in km?", a: "4", type: "number", calculator: false },
    { q: "A model is made at 1:200 scale. The real building is 36m tall. How tall is the model in cm?", a: "18", type: "number", calculator: false },
    { q: "Two maps of the same area use scales 1:25000 and 1:50000. A park is 4cm² on the larger map. What's its area on the smaller?", a: "1", type: "number", calculator: false },
    { q: "A 1:10000 map shows a lake 12cm². What is the real area in m²?", type: "mcq", options: ["1.2 million m²", "120000 m²", "12000 m²", "1200 m²"], a: "1.2 million m²", calculator: false },
  ],

  // Probability - Higher versions
  P1: [
    { q: "Events A and B are mutually exclusive. P(A) = 0.35, P(B) = 0.28. Find P(A or B).", a: "0.63", type: "number", calculator: false },
    { q: "P(A) = 0.6, P(not A and not B) = 0.15. If A and B are mutually exclusive, find P(B).", a: "0.25", type: "number", calculator: false },
    { q: "A bag has red, blue and green beads. P(red) = 2/5, P(blue) = 1/3. Find P(green).", a: "4/15", type: "text", calculator: false },
    { q: "Which events must be mutually exclusive?", type: "mcq", options: ["Rolling even & prime on a die", "Getting heads & tails on one flip", "Drawing red & drawing a 5", "Rain & being Tuesday"], a: "Getting heads & tails on one flip", calculator: false },
  ],
  P2: [
    { q: "A spinner has P(3) = x, P(other) = 3x. Find x.", a: "0.25", type: "number", calculator: false },
    { q: "A bag has 12 balls. 5 red, 3 blue, rest green. Find P(not blue).", a: "3/4", type: "text", calculator: false },
    { q: "In 200 trials, heads appears 118 times. Estimate P(heads).", a: "0.59", type: "number", calculator: false },
    { q: "P(A) = 0.45. After 2000 trials, how many times do you expect A?", type: "mcq", options: ["45", "450", "900", "4500"], a: "900", calculator: false },
  ],
  P3: [
    { q: "Two fair dice are rolled. Find P(sum = 8).", a: "5/36", type: "text", calculator: false },
    { q: "A coin and die are thrown. Find P(heads and even).", a: "1/4", type: "text", calculator: false },
    { q: "3 coins are flipped. Find P(at least 2 heads).", a: "1/2", type: "text", calculator: false },
    { q: "Two dice are rolled. What is P(both show prime)?", type: "mcq", options: ["1/4", "9/36", "1/3", "4/9"], a: "1/4", calculator: false },
  ],
  P4: [
    { q: "Cards: P(A|B) = 0.4, P(B) = 0.3. Find P(A and B).", a: "0.12", type: "number", calculator: false },
    { q: "Bag has 5 red, 3 blue. Two drawn without replacement. P(both red)?", a: "5/14", type: "text", calculator: false },
    { q: "10 counters: 6 black, 4 white. Two drawn without replacement. P(different colours)?", a: "8/15", type: "text", calculator: false },
    { q: "If P(A) = 0.6, P(B|A) = 0.5, what is P(A and B)?", type: "mcq", options: ["0.3", "0.5", "0.8", "1.1"], a: "0.3", calculator: false },
  ],
  P5: [
    { q: "A bag has 8 red, 12 blue balls. 200 draws with replacement. Expected red draws?", a: "80", type: "number", calculator: false },
    { q: "P(win) = 0.15. In 400 games, expected wins?", a: "60", type: "number", calculator: false },
    { q: "A die is biased: P(6) = 0.2. In 250 rolls, how many 6s expected?", a: "50", type: "number", calculator: false },
    { q: "Expected frequency = 35 in 140 trials. What is the probability?", type: "mcq", options: ["0.15", "0.25", "0.35", "4"], a: "0.25", calculator: false },
  ],
  P6: [
    { q: "In a tree diagram, P(A) = 0.4, P(B|A) = 0.6, P(B|not A) = 0.3. Find P(B).", a: "0.42", type: "number", calculator: true },
    { q: "Using tree: 60% girls, 40% boys. 70% of girls pass, 55% of boys pass. P(pass)?", a: "0.64", type: "number", calculator: true },
    { q: "Bag: 3R, 2B. Pick two without replacement. P(same colour)?", a: "2/5", type: "text", calculator: false },
    { q: "First branch: P(A) = 0.7. If A then P(B) = 0.3, otherwise P(B) = 0.6. Find P(not B).", type: "mcq", options: ["0.51", "0.49", "0.39", "0.57"], a: "0.49", calculator: true },
  ],
  P7: [
    { q: "Sets: n(A) = 25, n(B) = 18, n(A∩B) = 7, n(ξ) = 50. Find n(A∪B)", a: "36", type: "number", calculator: false },
    { q: "P(A) = 0.5, P(B) = 0.4, P(A∩B) = 0.15. Find P(A∪B)", a: "0.75", type: "number", calculator: false },
    { q: "In a Venn diagram, 40 in A only, 25 in B only, 15 in both. P(A|A∪B)?", a: "11/16", type: "text", calculator: false },
    { q: "If A⊂B and P(B) = 0.6, what is P(A∪B)?", type: "mcq", options: ["P(A)", "0.6", "P(A) + 0.6", "Cannot tell"], a: "0.6", calculator: false },
  ],

  // Statistics - Higher versions
  S1: [
    { q: "Data: 3, 5, 7, 8, 8, 10, 12, 15, 18, 22. Find the interquartile range.", a: "10", type: "number", calculator: false },
    { q: "For grouped data with frequencies 5, 12, 18, 10, 5 and midpoints 25, 35, 45, 55, 65: estimate the mean.", a: "44", type: "number", calculator: true },
    { q: "A data set has median 45, LQ 32, UQ 58. What is the IQR?", a: "26", type: "number", calculator: false },
    { q: "Which measure is best for skewed data?", type: "mcq", options: ["Mean", "Median", "Mode", "Range"], a: "Median", calculator: false },
  ],
  S2: [
    { q: "From a box plot: min=12, LQ=18, median=25, UQ=34, max=45. What is the range?", a: "33", type: "number", calculator: false },
    { q: "A histogram shows bars of heights 2, 5, 8, 4 with class widths 5, 5, 10, 10. Find total frequency.", a: "150", type: "number", calculator: false },
    { q: "On a cumulative frequency graph, reading at median position gives?", type: "mcq", options: ["Mode", "Mean", "Median", "Range"], a: "Median", calculator: false },
    { q: "Data is positively skewed. Which is true?", type: "mcq", options: ["Mean < Median", "Mean > Median", "Mean = Median", "Median > Mode"], a: "Mean > Median", calculator: false },
  ],
  S3: [
    { q: "A scatter graph shows r = -0.85. Describe the correlation.", a: "strong negative", type: "text", calculator: false },
    { q: "Line of best fit: y = 2.5x + 12. Predict y when x = 8.", a: "32", type: "number", calculator: false },
    { q: "Given PMCC = 0.92 for hours studied vs marks. Is it reliable to predict marks for 20 hours if data ranged 2-8 hours?", type: "mcq", options: ["Yes, correlation is strong", "No, it's extrapolation", "Yes, linear relationship", "No, it's interpolation"], a: "No, it's extrapolation", calculator: false },
    { q: "Which r value shows strongest correlation?", type: "mcq", options: ["-0.75", "0.68", "-0.89", "0.45"], a: "-0.89", calculator: false },
  ],
  S4: [
    { q: "Time series: values 120, 128, 124, 136, 130, 142. Calculate 3-point moving averages.", a: "124, 129.3, 130, 136", type: "text", calculator: true },
    { q: "A 4-point moving average removes what type of variation?", type: "mcq", options: ["Trend", "Seasonal (quarterly)", "Random", "Cyclical"], a: "Seasonal (quarterly)", calculator: false },
    { q: "Trend equation: y = 250 + 8x where x = quarter number. Seasonal effect for Q1 = -15. Predict Q5.", a: "275", type: "number", calculator: false },
    { q: "Why use moving averages?", type: "mcq", options: ["Find mode", "Smooth data to show trend", "Calculate range", "Find median"], a: "Smooth data to show trend", calculator: false },
  ],
  S5: [
    { q: "A stratified sample of 60 from 300 students (180 boys, 120 girls). How many girls?", a: "24", type: "number", calculator: false },
    { q: "Sample 50 from population: Y7=320, Y8=280, Y9=240, Y10=160. How many from Y9?", a: "12", type: "number", calculator: true },
    { q: "Which sampling method gives each member equal chance?", type: "mcq", options: ["Convenience", "Stratified", "Simple random", "Quota"], a: "Simple random", calculator: false },
    { q: "A survey uses every 10th person on a list. What sampling method is this?", type: "mcq", options: ["Random", "Stratified", "Systematic", "Quota"], a: "Systematic", calculator: false },
  ],
};

// Helper function to get appropriate question bank based on tier
// For Higher tier students, use higherQuestionBank for shared objectives (harder questions)
// Falls back to questionBank if no higher version exists
const getQuestionBankForTier = (tier) => {
  if (tier === 'higher') {
    // Create a merged bank: higher questions for shared objectives, regular for higher-only
    return new Proxy({}, {
      get(target, code) {
        // If higher version exists, use it
        if (higherQuestionBank[code] && higherQuestionBank[code].length > 0) {
          return higherQuestionBank[code];
        }
        // Fall back to regular question bank
        return questionBank[code] || [];
      }
    });
  }
  return questionBank;
};

// Exam-style questions - harder, multi-step problems for mastery
const examQuestions = {
  N1: [
    { q: "Put in order from smallest to largest: 0.7[r], 0.77, 0.707, 0.7[r]0[r]7[r]. Show your working.", a: "0.707, 0.7[r]0[r]7[r], 0.7[r], 0.77", type: "text", calculator: false, marks: 3 },
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
    { q: "Write 0.36[r] as a fraction in its simplest form. Show your working.", a: "11/30", type: "text", calculator: false, marks: 3 },
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
    { q: "A line passes through (1, 5) and (4, 14). Find the equation of the line in the form y = mx + c.", a: "y = 3x + 2", type: "text", calculator: false, marks: 3 },
  ],
  A17: [
    { q: "Solve: 3(2x - 1) = 4x + 9", a: "6", type: "number", calculator: false, marks: 3 },
  ],
  A18: [
    { q: "A quadratic y = x² - 4x + 3 crosses the x-axis at two points. Find both x values.", a: "x = 1 and x = 3", type: "text", calculator: false, marks: 3 },
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
  // Added exam questions for objectives that were missing them
  N3: [
    { q: "Write (4.5 × 10³) × (2 × 10²) in standard form.", a: "9 × 10⁵", type: "text", calculator: false, marks: 2 },
  ],
  N7: [
    { q: "Simplify: ³√125 × 2³", a: "40", type: "number", calculator: false, marks: 2 },
  ],
  N14: [
    { q: "Estimate the value of (58.3 × 4.9) ÷ (0.52)². Show your working.", a: "1000", type: "number", calculator: false, marks: 3 },
  ],
  N15: [
    { q: "A number is given as 4.7 × 10⁻³. Write this to 2 significant figures.", a: "0.0047", type: "text", calculator: false, marks: 2 },
  ],
  N16: [
    { q: "The length of a rectangle is 12cm to the nearest cm. The width is 8cm to the nearest cm. Calculate the lower bound of the area.", a: "86.25", type: "number", calculator: true, marks: 3 },
  ],
  A2: [
    { q: "Given s = ut + ½at², find s when u = 5, t = 4 and a = 3.", a: "44", type: "number", calculator: false, marks: 3 },
  ],
  A9: [
    { q: "Line L passes through (2, 7) and (6, -1). Find the equation of line L in the form y = mx + c.", a: "y = -2x + 11", type: "text", calculator: false, marks: 3 },
  ],
  A19: [
    { q: "Solve simultaneously: 3x + 2y = 13 and 2x - y = 4. Find both x and y.", a: "x = 3, y = 2", type: "text", calculator: false, marks: 4 },
  ],
  A23: [
    { q: "The nth term of a sequence is 4n - 7. Is 101 in the sequence? Explain your answer.", a: "Yes, when n = 27", type: "text", calculator: false, marks: 3 },
  ],
  A26: [
    { q: "A circle has centre (0, 0) and passes through (5, 12). Find the equation of the circle.", a: "x² + y² = 169", type: "text", calculator: false, marks: 3 },
  ],
  R2: [
    { q: "On a map with scale 1:50000, a lake has area 3.2 cm². Find the actual area in km².", a: "0.8", type: "number", calculator: true, marks: 3 },
  ],
  R9: [
    { q: "In a class, 18 out of 30 students passed a test. Express this as a percentage.", a: "60", type: "number", calculator: true, marks: 2 },
  ],
  R12: [
    { q: "After two successive 10% decreases, a price is £162. Find the original price.", a: "200", type: "number", calculator: true, marks: 3 },
  ],
  G4: [
    { q: "Two parallel lines are crossed by a transversal. One acute angle is 65°. Find all four angles at one intersection.", a: "65°, 65°, 115°, 115°", type: "text", calculator: false, marks: 3 },
  ],
  G7: [
    { q: "Triangle A has vertices at (1,1), (3,1), (2,3). It is enlarged by scale factor 2, centre origin. Give the coordinates of the vertices of the image.", a: "(2,2), (6,2), (4,6)", type: "text", calculator: false, marks: 3 },
  ],
  G16: [
    { q: "A sector has radius 10cm and arc length 15cm. Find the angle of the sector in degrees.", a: "86", type: "number", calculator: true, marks: 3, hint: "Use arc length = (θ/360) × 2πr" },
  ],
  G17: [
    { q: "A cone has radius 6cm and height 8cm. Find the total surface area. Give your answer in terms of π.", a: "96π", type: "text", calculator: false, marks: 4, hint: "Total SA = πr² + πrl" },
  ],
  P6: [
    { q: "In a class of 30: 20 like maths, 18 like science, 5 like neither. How many like both?", a: "13", type: "number", calculator: false, marks: 3 },
  ],
  S2: [
    { q: "In a pie chart, the 'Sport' sector is 108°. If 60 people were surveyed, how many chose Sport?", a: "18", type: "number", calculator: true, marks: 2 },
  ],
  // New foundation exam questions
  N4: [
    { q: "Tom calculated 847 ÷ 7 = 121. Use an inverse operation to check if he is correct. Show your working.", a: "121 × 7 = 847, so correct", type: "text", calculator: false, marks: 2 },
  ],
  N11: [
    { q: "In a class of 32 students, 12 are boys. Express the number of girls as a fraction of the total in simplest form.", a: "5/8", type: "text", calculator: false, marks: 2 },
  ],
  N13: [
    { q: "A room is 4.5m by 3m. Calculate the area in cm².", a: "135000", type: "number", calculator: true, marks: 3 },
  ],
  A1: [
    { q: "Write an expression for: 'Think of a number, double it, then add 5'", a: "2n + 5", type: "text", calculator: false, marks: 2 },
  ],
  A3: [
    { q: "State whether each is an expression, equation, formula or identity: (a) 3x + 7 (b) 3x + 7 = 19 (c) A = ½bh (d) 2(x+3) ≡ 2x + 6", a: "expression, equation, formula, identity", type: "text", calculator: false, marks: 4 },
  ],
  A5: [
    { q: "The formula for the volume of a cylinder is V = πr²h. Find V when r = 3 and h = 7. Give your answer in terms of π.", a: "63π", type: "text", calculator: false, marks: 2 },
  ],
  A7: [
    { q: "A function machine does: input → ×4 → -5 → ÷3 → output. If output is 5, find the input.", a: "5", type: "number", calculator: false, marks: 3 },
  ],
  A13: [
    { q: "A and B have coordinates (2, 8) and (10, 4). Find the midpoint of AB and the length of AB.", a: "Midpoint (6, 6), Length ~8.94", type: "text", calculator: true, marks: 4 },
  ],
  A15: [
    { q: "A quadratic y = (x-3)(x+1) has roots at x = 3 and x = -1. Find the coordinates of the turning point.", a: "(1, -4)", type: "text", calculator: false, marks: 3 },
  ],
  A21: [
    { q: "Write an inequality for: 'You must be at least 12 years old and under 18 to join the youth club'", a: "12 ≤ age < 18", type: "text", calculator: false, marks: 2 },
  ],
  A24: [
    { q: "Find the next two terms in the Fibonacci-like sequence: 2, 5, 7, 12, 19, ...", a: "31, 50", type: "text", calculator: false, marks: 2 },
  ],
  R1: [
    { q: "A recipe needs 1.2 kg of flour. How many grams is this? If flour costs 80p per 500g, how much does 1.2kg cost?", a: "1200g, £1.92", type: "text", calculator: true, marks: 3 },
  ],
  R5: [
    { q: "The ratio of cats to dogs at a shelter is 3:5. There are 40 animals in total. How many cats are there?", a: "15", type: "number", calculator: false, marks: 3 },
  ],
  R6: [
    { q: "In a bag of sweets, the ratio of red to blue to green is 2:5:3. What fraction of the sweets are blue?", a: "1/2", type: "text", calculator: false, marks: 2 },
  ],
  R7: [
    { q: "It takes 6 workers 8 days to build a wall. How long would it take 4 workers?", a: "12", type: "number", calculator: false, marks: 3 },
  ],
  R8: [
    { q: "The ratio of x:y = 3:4. Express x as a fraction of (x+y).", a: "3/7", type: "text", calculator: false, marks: 2 },
  ],
  R11: [
    { q: "A TV was £450. In a sale it is reduced to £360. Find the percentage decrease.", a: "20", type: "number", calculator: true, marks: 2 },
  ],
  R14: [
    { q: "A car travels 180km in 2 hours 15 minutes. Calculate the average speed in km/h.", a: "80", type: "number", calculator: true, marks: 3 },
  ],
  G1: [
    { q: "Name the 3D shape that has 6 faces, 12 edges and 8 vertices. All faces are congruent.", a: "Cube", type: "text", calculator: false, marks: 2 },
  ],
  G2: [
    { q: "Describe how to construct the perpendicular bisector of a line segment AB.", a: "Draw arcs from A and B with same radius, join intersection points", type: "text", calculator: false, marks: 3 },
  ],
  G6: [
    { q: "List two properties that a rhombus has that a rectangle does not.", a: "All sides equal, diagonals bisect at right angles", type: "text", calculator: false, marks: 2 },
  ],
  G8: [
    { q: "Shape P is translated to shape Q by vector (4, -3). Point A on P is at (2, 5). What are the coordinates of the corresponding point on Q?", a: "(6, 2)", type: "text", calculator: false, marks: 2 },
  ],
  G9: [
    { q: "Triangle T has vertices at (1, 1), (3, 1), (2, 4). Draw the reflection of T in the line y = x and give the coordinates of the reflected vertices.", a: "(1, 1), (1, 3), (4, 2)", type: "text", calculator: false, marks: 3 },
  ],
  G11: [
    { q: "In a circle, a chord is 8cm from the centre. The radius is 10cm. Find the length of the chord.", a: "12", type: "number", calculator: true, marks: 3 },
  ],
  G13: [
    { q: "A solid is made from a cylinder with a cone on top. The cylinder has height 6cm and the cone has height 4cm. Both have radius 3cm. Find the total volume in terms of π.", a: "66π", type: "text", calculator: false, marks: 4 },
  ],
  P1: [
    { q: "A spinner was spun 200 times. Results: Red 82, Blue 68, Green 50. Calculate the relative frequency of blue.", a: "0.34", type: "number", calculator: true, marks: 2 },
  ],
  P2: [
    { q: "A bag contains 3 red and 7 blue balls. Explain why selecting a ball at random is not equally likely to be red or blue.", a: "Different numbers of each colour", type: "text", calculator: false, marks: 2 },
  ],
  P3: [
    { q: "A dice is rolled 150 times and lands on 6 exactly 30 times. Calculate the relative frequency and compare to the theoretical probability.", a: "0.2 vs 1/6 ≈ 0.167", type: "text", calculator: true, marks: 3 },
  ],
  P5: [
    { q: "P(rain) = 0.3, P(wind) = 0.6. If these are independent, find P(rain and wind).", a: "0.18", type: "number", calculator: true, marks: 2 },
  ],
  P7: [
    { q: "Three coins are flipped. List all possible outcomes and find P(exactly 2 heads).", a: "3/8", type: "text", calculator: false, marks: 4 },
  ],
  S1: [
    { q: "A school has 600 Year 7, 550 Year 8, and 450 Year 9 students. A stratified sample of 80 is needed. How many Year 8 students should be selected?", a: "28", type: "number", calculator: true, marks: 3 },
  ],
  S3: [
    { q: "Draw a pie chart for: Football 30 students, Tennis 15 students, Swimming 25 students, Other 10 students. Calculate each angle.", a: "135°, 67.5°, 112.5°, 45°", type: "text", calculator: true, marks: 4 },
  ],
  S4: [
    { q: "A car journey is shown on a distance-time graph. It travels 60km in the first hour, stops for 30 mins, then travels 40km in 30 mins. Find the average speed for the whole journey.", a: "50", type: "number", calculator: true, marks: 3 },
  ],
  // Higher tier exam questions
  N9: [
    { q: "Simplify fully: (16^(3/4) × 8^(-2/3)) ÷ 4^(1/2)", a: "2", type: "number", calculator: false, marks: 4 },
  ],
  A8: [
    { q: "Show that (x + 2)² - (x - 2)² ≡ 8x", a: "LHS = x² + 4x + 4 - (x² - 4x + 4) = 8x", type: "text", calculator: false, marks: 3 },
  ],
  A10: [
    { q: "Prove algebraically that the sum of the squares of any two consecutive odd numbers is always 2 more than a multiple of 8.", a: "(2n+1)² + (2n+3)² = 8n² + 16n + 10 = 8(n² + 2n + 1) + 2", type: "text", calculator: false, marks: 4 },
  ],
  A11: [
    { q: "f(x) = (3x + 2)/(x - 1). Find f⁻¹(x) and state any values of x for which f⁻¹(x) is undefined.", a: "f⁻¹(x) = (x + 2)/(x - 3), undefined when x = 3", type: "text", calculator: false, marks: 4 },
  ],
  A12: [
    { q: "f(x) = 2x - 1, g(x) = x² + 3. Find x when fg(x) = gf(x).", a: "x = 1 or x = -1", type: "text", calculator: false, marks: 4 },
  ],
  A16: [
    { q: "The curve y = x³ - 6x² + 9x passes through the origin. Find the coordinates of the other points where it crosses the x-axis.", a: "(3, 0)", type: "text", calculator: false, marks: 3 },
  ],
  A20: [
    { q: "Use iteration with xₙ₊₁ = ³√(20 - 3xₙ) and x₀ = 2 to find x₃ to 3 decimal places.", a: "2.366", type: "number", calculator: true, marks: 3 },
  ],
  A22: [
    { q: "Find the integer values of n that satisfy -3 < 2n - 5 ≤ 7.", a: "2, 3, 4, 5, 6", type: "text", calculator: false, marks: 3 },
  ],
  A25: [
    { q: "The nth term of a sequence is an² + bn + c. The first three terms are 4, 10, 18. Find a, b and c.", a: "a = 1, b = 3, c = 0", type: "text", calculator: false, marks: 4 },
  ],
  R13: [
    { q: "The force F between two magnets is inversely proportional to d². When d = 2, F = 20. Find F when d = 4.", a: "5", type: "number", calculator: false, marks: 3 },
  ],
  R15: [
    { q: "Two similar cones have surface areas 36π cm² and 100π cm². The smaller cone has volume 48π cm³. Find the volume of the larger cone.", a: "222.2π", type: "text", calculator: true, marks: 4 },
  ],
  R16: [
    { q: "£8000 is invested at 2.5% compound interest. After how many complete years will the investment first exceed £9000?", a: "5", type: "number", calculator: true, marks: 3 },
  ],
  G10: [
    { q: "Triangle ABC is enlarged by scale factor -2, centre P(1, 1). A(3, 2) maps to A'. Find the coordinates of A'.", a: "(-3, -1)", type: "text", calculator: false, marks: 3 },
  ],
  G12: [
    { q: "In a circle, AB is a diameter. C is a point on the circumference. Angle CAB = 35°. Find angle ACB.", a: "90", type: "number", calculator: false, marks: 2 },
  ],
  G18: [
    { q: "Prove triangles ABC and DEC are congruent given: AC = DC, BC = EC, and angle ACB = angle DCE.", a: "SAS: AC = DC, angle ACB = angle DCE, BC = EC", type: "text", calculator: false, marks: 3 },
  ],
  G21: [
    { q: "Find the exact value of (sin 60° × cos 30°) + (cos 60° × sin 30°)", a: "1", type: "number", calculator: false, marks: 3 },
  ],
  G22: [
    { q: "In triangle ABC, BC = 8cm, angle ABC = 72°, angle ACB = 53°. Find AC.", a: "8.5", type: "number", calculator: true, marks: 3 },
  ],
  G23: [
    { q: "Find the area of triangle PQR where PQ = 11cm, QR = 8cm and angle PQR = 67°.", a: "40.5", type: "number", calculator: true, marks: 3 },
  ],
  G24: [
    { q: "Vectors a = (3, -2) and b = (1, 4). Find |2a - b| giving your answer in surd form.", a: "√89", type: "text", calculator: false, marks: 3 },
  ],
  G25: [
    { q: "In triangle OAB, OA = a and OB = b. M is the midpoint of AB. Express OM in terms of a and b.", a: "½(a + b)", type: "text", calculator: false, marks: 3 },
  ],
  P9: [
    { q: "A bag contains 5 red and 3 blue counters. Two counters are taken without replacement. Find the probability they are different colours.", a: "15/28", type: "text", calculator: false, marks: 4 },
  ],
  S6: [
    { q: "A histogram shows heights. The bar for 150-160cm has frequency density 2.4. If 36 people are in this class, what is the frequency density for 160-180cm if it contains 30 people?", a: "1.5", type: "number", calculator: true, marks: 3 },
  ],
};

// Higher tier exam questions - harder multi-step problems for grades 4-9
// These replace the foundation exam questions when tier is set to Higher
const higherExamQuestions = {
  // Number - Higher exam style (multi-step, unstructured)
  N1: [
    { q: "Arrange in order from smallest to largest: 2.3 × 10⁻², √0.05, 0.02[r]3[r], 1/45. Show all working.", a: "2.3 × 10⁻², 0.02[r]3[r], 1/45, √0.05", type: "text", calculator: true, marks: 4 },
  ],
  N2: [
    { q: "Show that (-2)³ × (-3)² ÷ (-6) = 12", a: "-8 × 9 ÷ (-6) = -72 ÷ (-6) = 12", type: "text", calculator: false, marks: 3 },
  ],
  N3: [
    { q: "The mass of an atom is 3.2 × 10⁻²⁶ kg. The mass of a molecule is 5.4 × 10⁻²⁵ kg. How many atoms are in one molecule? Give your answer to 2 significant figures.", a: "17", type: "number", calculator: true, marks: 3 },
  ],
  N5: [
    { q: "Show that (2³ + 4²) × 3 - √144 ÷ 2 = 66", a: "(8 + 16) × 3 - 12 ÷ 2 = 24 × 3 - 6 = 72 - 6 = 66", type: "text", calculator: false, marks: 3 },
  ],
  N6: [
    { q: "Given that 5^x = 125 and 5^y = 1/25, find the value of 5^(2x + y)", a: "125", type: "number", calculator: false, marks: 4 },
  ],
  N7: [
    { q: "A cube has volume 343 cm³. A second cube has a surface area equal to the first cube's volume. Find the side length of the second cube to 2 d.p.", a: "7.56", type: "number", calculator: true, marks: 4 },
  ],
  N8: [
    { q: "A = 2³ × 3 × 5 and B = 2 × 3² × 7. Find (a) HCF(A, B) and (b) LCM(A, B). Hence verify that HCF × LCM = A × B.", a: "HCF = 6, LCM = 2520", type: "text", calculator: false, marks: 5 },
  ],
  N10: [
    { q: "Prove algebraically that 0.4[r]5[r] = 5/11", a: "Let x = 0.454545... Then 100x = 45.454545... So 99x = 45, x = 45/99 = 5/11", type: "text", calculator: false, marks: 4 },
  ],
  N11: [
    { q: "In a sale, prices are reduced by 15%. A dress now costs £68. Express the original price as a fraction of £100.", a: "4/5", type: "text", calculator: false, marks: 3 },
  ],
  N12: [
    { q: "A car depreciates by 18% in year 1 and 15% in year 2. Show that the total depreciation is not 33% and find the actual percentage decrease.", a: "30.3%", type: "number", calculator: true, marks: 4 },
  ],
  N14: [
    { q: "Estimate (4.8² × √99) ÷ 0.49, showing your rounding. State whether your answer is an overestimate or underestimate.", a: "≈ 500, underestimate", type: "text", calculator: false, marks: 4 },
  ],
  N15: [
    { q: "The calculation 8.745 × 3.92 gives 34.2804. Using bounds, find the greatest and least values this product could be. Round each to 3 s.f.", a: "Greatest: 34.4, Least: 34.1", type: "text", calculator: true, marks: 4 },
  ],

  // Algebra - Higher exam style
  A1: [
    { q: "Simplify fully: (27x⁶y³)^(2/3) ÷ (9x²y)^(1/2)", a: "3x³y/√y or 3x³√y", type: "text", calculator: false, marks: 4 },
  ],
  A2: [
    { q: "Expand and simplify: (2x + 3)(x - 4)(x + 1). Hence factorise 2x³ - x² - 13x - 12.", a: "2x³ - x² - 13x - 12 = (2x + 3)(x - 4)(x + 1)", type: "text", calculator: false, marks: 5 },
  ],
  A3: [
    { q: "Factorise completely: 2x³ - 8x² - 10x", a: "2x(x - 5)(x + 1)", type: "text", calculator: false, marks: 3 },
  ],
  A4: [
    { q: "Solve by factorising: 6x² - x - 15 = 0. Show your working.", a: "x = 5/3 or x = -3/2", type: "text", calculator: false, marks: 4 },
  ],
  A5: [
    { q: "Solve: (3x - 2)/4 - (x + 5)/6 = 2. Give your answer as a fraction in its simplest form.", a: "x = 46/7", type: "text", calculator: false, marks: 4 },
  ],
  A7: [
    { q: "Make x the subject of y = (2x + a)/(x - b). Show all steps.", a: "x = (a + by)/(y - 2)", type: "text", calculator: false, marks: 4 },
  ],
  A13: [
    { q: "A quadratic sequence starts 5, 12, 23, 38, ... Find the nth term and hence determine which term equals 173.", a: "2n² + 3n, 8th term", type: "text", calculator: false, marks: 5 },
  ],
  A14: [
    { q: "Line L passes through A(2, 5) and B(6, -3). Find the equation of the line perpendicular to L passing through the midpoint of AB.", a: "y = ½x + 1", type: "text", calculator: false, marks: 5 },
  ],
  A15: [
    { q: "Solve simultaneously: y = x² - 4x + 5 and y = 2x - 3. Interpret your answer geometrically.", a: "x = 2, y = 1 (one solution - line is tangent to curve)", type: "text", calculator: false, marks: 5 },
  ],
  A17: [
    { q: "Solve x² - 6x - 3 = 0 by completing the square. Give exact answers in surd form.", a: "x = 3 ± 2√3", type: "text", calculator: false, marks: 4 },
  ],
  A21: [
    { q: "Find the range of values of k for which x² + 4x + k = 0 has two distinct real roots.", a: "k < 4", type: "text", calculator: false, marks: 3 },
  ],
  A23: [
    { q: "y is inversely proportional to the square root of x. When x = 16, y = 5. Find (a) y when x = 4, (b) x when y = 2.", a: "y = 10, x = 100", type: "text", calculator: false, marks: 5 },
  ],
  A24: [
    { q: "A ball is thrown upwards. Its height h metres after t seconds is h = 20t - 5t². Find (a) the maximum height, (b) when it returns to ground level.", a: "20m at t = 2s, returns at t = 4s", type: "text", calculator: false, marks: 5 },
  ],

  // Ratio - Higher exam style
  R1: [
    { q: "Ann, Ben and Carl share £180 so that Ann gets twice as much as Ben, and Carl gets £30 less than Ann. Work out how much each person gets.", a: "Ann £84, Ben £42, Carl £54", type: "text", calculator: false, marks: 4 },
  ],
  R2: [
    { q: "12 workers can build a wall in 8 days. After 3 days, 4 workers leave. How many more days will it take to complete the wall?", a: "7.5 days", type: "number", calculator: true, marks: 4 },
  ],
  R3: [
    { q: "A shop reduces all prices by 20%. During a sale, there is a further reduction of 15%. Work out the overall percentage reduction.", a: "32%", type: "number", calculator: false, marks: 3 },
  ],
  R4: [
    { q: "£5000 is invested at r% compound interest. After 2 years it is worth £5408. Find r.", a: "4%", type: "number", calculator: true, marks: 4 },
  ],
  R5: [
    { q: "After a 12% increase followed by a 12% decrease, a price is £295.68. What was the original price?", a: "300", type: "number", calculator: true, marks: 4 },
  ],
  R7: [
    { q: "Simplify fully: (2x²/3y) ÷ (4x/9y²)", a: "3xy/2", type: "text", calculator: false, marks: 3 },
  ],
  R8: [
    { q: "A train travels 240km at an average speed of v km/h. If the train travelled 20 km/h faster, the journey would take 30 minutes less. Find v.", a: "80", type: "number", calculator: true, marks: 5 },
  ],
  R9: [
    { q: "A scale model has a scale of 1:50. The model has a surface area of 0.8 m². Find the actual surface area in m².", a: "2000", type: "number", calculator: false, marks: 3 },
  ],
  R10: [
    { q: "A solid gold sphere has radius 3 cm. Gold has density 19.3 g/cm³. Find the mass to the nearest gram.", a: "2186", type: "number", calculator: true, marks: 4 },
  ],
  R11: [
    { q: "A car travels up a hill with gradient 1:12. After travelling 650m along the road, how high has it climbed? Give your answer to 1 d.p.", a: "54.2", type: "number", calculator: true, marks: 3 },
  ],
  R12: [
    { q: "Bacteria double every 20 minutes. Starting with 500 bacteria, how many complete hours until there are more than 1 million?", a: "4", type: "number", calculator: true, marks: 4 },
  ],
  R14: [
    { q: "A swimming pool is filled by two pipes. Pipe A alone fills it in 6 hours. Pipe B alone fills it in 4 hours. How long to fill using both pipes?", a: "2.4 hours or 2h 24min", type: "text", calculator: true, marks: 4 },
  ],

  // Geometry - Higher exam style
  G1: [
    { q: "The interior angle of a regular polygon is 140°. Find the number of sides and the sum of its interior angles.", a: "9 sides, 1260°", type: "text", calculator: false, marks: 4 },
  ],
  G3: [
    { q: "A trapezium has parallel sides 8cm and 12cm. Its area is 50cm². Find the perpendicular distance between the parallel sides.", a: "5", type: "number", calculator: false, marks: 3 },
  ],
  G4: [
    { q: "A semicircle has the same perimeter as a square of side 7cm. Find the radius of the semicircle to 2 d.p.", a: "5.47", type: "number", calculator: true, marks: 4 },
  ],
  G5: [
    { q: "A cone and cylinder have the same base and height. The cylinder has volume 300π cm³. Find the volume of the cone.", a: "100π", type: "text", calculator: false, marks: 3 },
  ],
  G7: [
    { q: "Two similar triangles have areas 20cm² and 45cm². The smaller has perimeter 16cm. Find the perimeter of the larger.", a: "24", type: "number", calculator: true, marks: 4 },
  ],
  G8: [
    { q: "Triangle ABC has AB = 8cm, angle BAC = 52°, and area 20cm². Find the length BC.", a: "6.35", type: "number", calculator: true, marks: 4 },
  ],
  G9: [
    { q: "A sector has radius 12cm and arc length 15cm. Find (a) the angle in radians, (b) the area of the sector.", a: "1.25 radians, 90 cm²", type: "text", calculator: true, marks: 4 },
  ],
  G11: [
    { q: "A cuboid has dimensions 3cm by 4cm by 12cm. Find the length of the space diagonal.", a: "13", type: "number", calculator: false, marks: 4 },
  ],
  G13: [
    { q: "Point P(4, 2) is rotated 90° anticlockwise about Q(1, 1). Find the coordinates of the image.", a: "(2, 4)", type: "text", calculator: false, marks: 3 },
  ],
  G14: [
    { q: "Describe fully the single transformation that maps y = f(x) to y = 2f(x - 3) + 1", a: "Stretch scale factor 2 parallel to y-axis, translation (3, 1)", type: "text", calculator: false, marks: 4 },
  ],
  G15: [
    { q: "A hemisphere of radius 6cm is attached to a cylinder of radius 6cm and height 10cm. Find the total surface area.", a: "180π or 565.5 cm²", type: "text", calculator: true, marks: 5 },
  ],
  G19: [
    { q: "From a point 50m from the base of a building, the angle of elevation to the top is 62°. From the same point, the angle of elevation to a window is 38°. Find the height of the window above ground.", a: "39.1", type: "number", calculator: true, marks: 4 },
  ],
  G20: [
    { q: "On a 1:25000 map, a lake has area 6.4 cm². Find the actual area of the lake in km².", a: "0.4", type: "number", calculator: true, marks: 3 },
  ],

  // Probability - Higher exam style
  P1: [
    { q: "P(A) = 0.3, P(B) = 0.5. Given that A and B are independent, find P(A' ∩ B').", a: "0.35", type: "number", calculator: false, marks: 3 },
  ],
  P2: [
    { q: "A biased dice has P(6) = x. All other faces are equally likely. If P(not 6) = 0.8, find x and P(even).", a: "x = 0.2, P(even) = 0.52", type: "text", calculator: false, marks: 4 },
  ],
  P3: [
    { q: "Two dice are thrown. Find P(product is a perfect square).", a: "8/36 or 2/9", type: "text", calculator: false, marks: 4 },
  ],
  P4: [
    { q: "A bag contains 4 red and 6 blue counters. Two are taken without replacement. Find P(same colour) and P(at least one red).", a: "P(same) = 7/15, P(≥1 red) = 2/3", type: "text", calculator: false, marks: 5 },
  ],
  P5: [
    { q: "In a game, you roll a die. If you get 6, you win £10. If you get odd, you win £2. Otherwise you lose £3. Find the expected profit per game.", a: "£0.50", type: "text", calculator: false, marks: 4 },
  ],
  P6: [
    { q: "Box A: 3 red, 5 blue. Box B: 4 red, 2 blue. A ball is taken from A and put in B, then a ball is taken from B. Find P(red from B).", a: "19/56", type: "text", calculator: false, marks: 5 },
  ],
  P7: [
    { q: "In a class, 15 study French, 12 study Spanish, 5 study both. If a student is chosen at random from those studying at least one language, find P(French only | at least one language).", a: "10/22 or 5/11", type: "text", calculator: false, marks: 4 },
  ],

  // Statistics - Higher exam style
  S1: [
    { q: "Data: 12, 15, 18, 21, 24, 27, 30, 33, 36. The mean is 24. One value is removed and the new mean is 25. Which value was removed?", a: "15", type: "number", calculator: true, marks: 4 },
  ],
  S2: [
    { q: "Two box plots show exam results. Class A: median 62, IQR 15. Class B: median 58, IQR 24. Compare the distributions.", a: "Class A higher average and more consistent (smaller IQR)", type: "text", calculator: false, marks: 3 },
  ],
  S3: [
    { q: "The equation of a regression line is y = 2.3x + 15. Interpret the gradient and y-intercept in context where x = hours studied and y = mark.", a: "Each extra hour gives 2.3 more marks; 15 is the mark with 0 hours study", type: "text", calculator: false, marks: 3 },
  ],
  S4: [
    { q: "Sales data shows seasonal variation: Q1: -15, Q2: +20, Q3: +25, Q4: -30. The trend for Q3 of year 3 predicts 180 units. Find the actual predicted sales.", a: "205", type: "number", calculator: false, marks: 3 },
  ],
  S5: [
    { q: "A factory produces 40% from machine A, 60% from machine B. Defect rates are 2% (A) and 5% (B). A defective item is found. Find P(from machine A).", a: "8/38 or 4/19", type: "text", calculator: false, marks: 5 },
  ],
};

// Helper function to get appropriate exam questions based on tier
const getExamQuestionsForTier = (tier) => {
  if (tier === 'higher') {
    return new Proxy({}, {
      get(target, code) {
        // If higher version exists, use it
        if (higherExamQuestions[code] && higherExamQuestions[code].length > 0) {
          return higherExamQuestions[code];
        }
        // Fall back to regular exam questions
        return examQuestions[code] || [];
      }
    });
  }
  return examQuestions;
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
const buildSessionQueue = (allObjectives, progress, count = 5, sessionCount = 0, tier = 'foundation') => {
  const now = Date.now();
  const fsrsData = loadFsrsData();

  // Get the appropriate question bank based on tier
  const qBank = getQuestionBankForTier(tier);

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

    const questions = qBank[obj.code] || [];
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

  // Helper for randomized sorting (breaks ties randomly for variety)
  const randomizedSort = (arr, scoreFn) => {
    return [...arr].sort((a, b) => {
      const scoreA = scoreFn(a);
      const scoreB = scoreFn(b);
      // If scores are very close (within 0.01), randomize
      if (Math.abs(scoreA - scoreB) < 0.01) {
        return Math.random() - 0.5;
      }
      return scoreA - scoreB;
    });
  };

  // Shuffle array helper (Fisher-Yates)
  const shuffleArray = (arr) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Group questions by topic for balanced selection
  const questionsByTopic = {};
  allQuestions.forEach(q => {
    const topic = q.objective?.topic || 'Unknown';
    if (!questionsByTopic[topic]) questionsByTopic[topic] = [];
    questionsByTopic[topic].push(q);
  });
  const topicNames = Object.keys(questionsByTopic);

  // Separate into buckets with randomized sorting for variety
  const dueCards = randomizedSort(
    allQuestions.filter(q => q.dueScore <= 1),
    q => q.dueScore
  );
  const newCards = shuffleArray(allQuestions.filter(q => q.state === 'new' && q.dueScore > 1));
  const examReadyCards = shuffleArray(allQuestions.filter(q => q.isExamReady));
  const easyCards = shuffleArray(allQuestions.filter(q => q.difficulty < 0.4 && q.retrievability > 0.8));

  // Build session with structure
  const queue = [];
  const objectiveCount = {}; // Track how many times each objective appears
  const usedQuestionIds = new Set();
  const MAX_PER_OBJECTIVE = 1; // Maximum times same objective can appear in one session

  const addToQueue = (questionData, phase) => {
    if (!questionData?.objective?.code) return false;
    if (usedQuestionIds.has(questionData.questionId)) return false;

    // Limit same objective appearing multiple times
    const objCode = questionData.objective.code;
    const currentCount = objectiveCount[objCode] || 0;
    if (currentCount >= MAX_PER_OBJECTIVE) return false;

    usedQuestionIds.add(questionData.questionId);
    objectiveCount[objCode] = currentCount + 1;
    queue.push({ ...questionData, sessionPhase: phase });
    return true;
  };

  // Helper to check if objective can be added
  const canAddObjective = (objCode) => {
    return (objectiveCount[objCode] || 0) < MAX_PER_OBJECTIVE;
  };

  // Track topic usage for balanced distribution
  const topicCount = {};
  const getTopicCount = (topic) => topicCount[topic] || 0;
  const incrementTopicCount = (topic) => {
    topicCount[topic] = (topicCount[topic] || 0) + 1;
  };

  // Find the least-used topic among candidates
  const getLeastUsedTopicCandidate = (candidates) => {
    let minCount = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c?.objective?.code ||
          usedQuestionIds.has(c.questionId) ||
          !canAddObjective(c.objective.code)) {
        continue;
      }

      const topic = c.objective.topic;
      const count = getTopicCount(topic);

      if (count < minCount) {
        minCount = count;
        bestIdx = i;
      }
    }

    return bestIdx;
  };

  // Helper to apply discriminative interleaving with topic balancing
  const addWithInterleaving = (candidates, phase, maxCount) => {
    let added = 0;
    const candidatesCopy = [...candidates];

    while (added < maxCount && candidatesCopy.length > 0) {
      // Pick candidate from the least-used topic for better variety
      const nextIdx = getLeastUsedTopicCandidate(candidatesCopy);

      if (nextIdx === -1) break; // No more valid candidates

      const next = candidatesCopy.splice(nextIdx, 1)[0];

      if (addToQueue(next, phase)) {
        added++;
        incrementTopicCount(next.objective.topic);

        // Try to add a confusable pair immediately after (interleaving)
        if (added < maxCount && next.objective?.code && confusablePairs[next.objective.code]) {
          const confusableCodes = confusablePairs[next.objective.code];
          const confusableIdx = candidatesCopy.findIndex(c =>
            c?.objective?.code &&
            confusableCodes.includes(c.objective.code) &&
            !usedQuestionIds.has(c.questionId) &&
            canAddObjective(c.objective.code)
          );
          if (confusableIdx !== -1) {
            const confusable = candidatesCopy.splice(confusableIdx, 1)[0];
            if (addToQueue(confusable, phase)) {
              added++;
              incrementTopicCount(confusable.objective.topic);
            }
          }
        }
      }
    }
    return added;
  };

  // Phase 1: Warm-up (easy questions from different objectives, randomized for variety)
  const warmUpCandidates = easyCards.length > 0
    ? easyCards
    : shuffleArray(allQuestions.filter(q => q.difficulty < 0.5));

  // Use topic balancing for warm-up too
  addWithInterleaving(warmUpCandidates, 'warmup', SESSION_STRUCTURE.warmUp);

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

  // Phase 3: Cool-down (end on an easy success from a different objective/topic)
  const coolDownCandidates = shuffleArray(
    allQuestions.filter(q =>
      !usedQuestionIds.has(q.questionId) &&
      q.difficulty < 0.4 &&
      q?.objective?.code &&
      canAddObjective(q.objective.code)
    )
  );

  // Use topic balancing for cool-down
  addWithInterleaving(coolDownCandidates, 'cooldown', SESSION_STRUCTURE.coolDown);

  // If no cool-down was added, fall back to any unused question
  if (queue.filter(q => q.sessionPhase === 'cooldown').length === 0) {
    const fallback = shuffleArray(allQuestions.filter(q =>
      !usedQuestionIds.has(q.questionId) &&
      q?.objective?.code &&
      canAddObjective(q.objective.code)
    ));
    if (fallback.length > 0) {
      addToQueue(fallback[0], 'cooldown');
      incrementTopicCount(fallback[0].objective.topic);
    }
  }

  // Fill any remaining slots with topic-balanced questions
  const remainingSlots = count - queue.length;
  if (remainingSlots > 0) {
    const unused = shuffleArray(
      allQuestions.filter(q =>
        !usedQuestionIds.has(q.questionId) &&
        q?.objective?.code &&
        canAddObjective(q.objective.code)
      )
    );
    addWithInterleaving(unused, 'challenge', remainingSlots);
  }

  // Reorder to ensure warm-up first, cool-down last
  const warmUp = queue.filter(q => q.sessionPhase === 'warmup');
  const challenge = queue.filter(q => q.sessionPhase === 'challenge');
  const coolDown = queue.filter(q => q.sessionPhase === 'cooldown');

  // Return queue items with objective and question data
  const orderedQueue = [...warmUp, ...challenge, ...coolDown];
  return orderedQueue.map(q => ({
    objective: q.objective,
    question: q.question,
    questionId: q.questionId,
    questionIndex: q.questionIndex,
    sessionPhase: q.sessionPhase,
    dueScore: q.dueScore,
    retrievability: q.retrievability,
  }));
};

// Get question for objective based on progress and tier
const getQuestion = (objective, progressData, tier = 'foundation') => {
  const prog = progressData?.[objective.code];
  const quickCorrect = prog?.quickCorrect ?? 0;
  const examPassed = prog?.examPassed ?? false;

  // Get the appropriate question bank for this tier
  const qBank = getQuestionBankForTier(tier);

  // If already mastered, return a quick question for review
  if (examPassed) {
    const questions = qBank[objective.code];
    if (questions && questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      return { ...q, objective, questionType: 'review' };
    }
  }

  // If ready for exam (4 quick questions done), serve exam question
  if (quickCorrect >= 4 && !examPassed) {
    const examBank = getExamQuestionsForTier(tier);
    const exams = examBank[objective.code];
    if (exams && exams.length > 0) {
      const q = exams[Math.floor(Math.random() * exams.length)];
      return { ...q, objective, questionType: 'exam', isExamQuestion: true };
    }
    // Fallback to a harder quick question if no exam question available
    const questions = qBank[objective.code];
    if (questions && questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      return { ...q, objective, questionType: 'exam', isExamQuestion: true };
    }
  }

  // Otherwise, serve a quick question
  const questions = qBank[objective.code];
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

function PracticePage({ dailyObjectives, progress, setProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings, isSubscribed, FREE_DAILY_LIMIT, tier = 'foundation' }) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [questionCount, setQuestionCount] = useState(() => {
    // Free users are limited to 5 questions per session
    const requested = settings?.questionsPerSession ?? 5;
    if (!isSubscribed) return Math.min(requested, FREE_DAILY_LIMIT ?? 5);
    return requested;
  });
  const [sessionCount, setSessionCount] = useState(() => loadSessionCount());
  const [masteryGained, setMasteryGained] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [practiceMode, setPracticeMode] = useState('standard'); // 'standard', 'quickfire', or 'exam'
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  
  // Practice tips state
  const [currentTip, setCurrentTip] = useState(null);
  const shownTipsRef = useRef(loadShownTips());

  const showTip = (tipId) => {
    if (shownTipsRef.current.includes(tipId)) return;
    setCurrentTip(PRACTICE_TIPS[tipId]);
    markTipShown(tipId);
    shownTipsRef.current.push(tipId);
  };

  const dismissTip = () => setCurrentTip(null);

  // Scaffolding state
  const [failureCounts, setFailureCounts] = useState({}); // Track consecutive failures per objective
  const [currentDiagnosis, setCurrentDiagnosis] = useState(null); // AI diagnosis of error
  const [isScaffoldQuestion, setIsScaffoldQuestion] = useState(false); // Is current question a building block?
  const [scaffoldInfo, setScaffoldInfo] = useState(null); // Info about the scaffold question
  const [isAnalyzing, setIsAnalyzing] = useState(false); // AI is analyzing the error
  
  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);

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
  
  // Get the appropriate question bank based on tier
  const qBank = getQuestionBankForTier(tier);

  // Count objectives with MCQ questions for Quick Fire
  const mcqObjectiveCount = allObjectives?.filter(o => {
    const questions = qBank[o.code];
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
        const questions = qBank[obj.code];
        return questions && questions.some(q => q.type === 'mcq');
      });

      if (objectivesWithMCQ.length === 0) {
        // Fallback to standard mode if no MCQs available
        alert('No quick-fire questions available yet. Starting standard mode instead.');
        mode = 'standard';
        const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount, tier);
        questionsWithData = queue.map(item => ({
          ...(item.question || {}),
          objective: item.objective,
          questionType: 'quick',
          _fsrsQuestionId: item.questionId
        }));
      } else {
        // Build queue from MCQ-capable objectives only
        const queue = buildSessionQueue(objectivesWithMCQ, progress, questionCount, sessionCount, tier);

        // Get only MCQ questions (Quick Fire always uses quick questions, not exam)
        questionsWithData = queue.map(item => {
          // If the selected question is MCQ, use it; otherwise pick an MCQ from the objective
          if (item.question?.type === 'mcq') {
            return { ...item.question, objective: item.objective, questionType: 'quick', _fsrsQuestionId: item.questionId };
          }
          // Fallback: pick a random MCQ from the objective
          const mcqQuestions = qBank[item.objective?.code]?.filter(q => q.type === 'mcq') || [];
          const mcq = mcqQuestions[Math.floor(Math.random() * mcqQuestions.length)];
          return { ...(mcq || {}), objective: item.objective, questionType: 'quick' };
        });
      }
    } else {
      // Standard mode - includes exam questions when ready
      const queue = buildSessionQueue(allObjectives, progress, questionCount, sessionCount, tier);
      questionsWithData = queue.map(item => {
        // Use the specific question selected by buildSessionQueue
        const objProg = progress[item.objective?.code];
        const quickCorrect = objProg?.quickCorrect ?? 0;
        const examPassed = objProg?.examPassed ?? false;

        // Determine question type based on progress
        let questionType = 'quick';
        if (examPassed) {
          questionType = 'review';
        } else if (quickCorrect >= 4) {
          // Check if there's an exam question available (tier-aware)
          const examBank = getExamQuestionsForTier(tier);
          const exams = examBank[item.objective?.code];
          if (exams && exams.length > 0) {
            const examQ = exams[Math.floor(Math.random() * exams.length)];
            return { ...examQ, objective: item.objective, questionType: 'exam', isExamQuestion: true, _fsrsQuestionId: item.questionId };
          }
          questionType = 'exam';
        }

        return {
          ...(item.question || {}),
          objective: item.objective,
          questionType,
          _fsrsQuestionId: item.questionId
        };
      });
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

    // Show practice tips for new users
    if (sessionCount <= 1) {
      setTimeout(() => showTip('firstQuestion'), 800);
    } else if (sessionCount === 2) {
      setTimeout(() => showTip('secondSession'), 800);
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
      if (current.type === 'order') {
        // Check if order matches the correct order
        const userOrder = JSON.parse(userAnswer || '[]');
        correct = JSON.stringify(userOrder) === JSON.stringify(current.correctOrder);
      } else if (current.type === 'match') {
        // Check if all matches are correct
        const userMatches = JSON.parse(userAnswer || '{}');
        correct = Object.entries(current.correctMatches).every(
          ([left, right]) => userMatches[left] === right
        );
      } else {
        // Use forgiving answer checker that accepts mathematical equivalents
        correct = answersEquivalent(userAnswer, current.a);
      }
    }

    // Calculate response time for FSRS
    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : 15000;

    setIsCorrect(correct);
    setShowFeedback(true);

    // Show tips for new users on first correct/incorrect
    if (correct) {
      setTimeout(() => showTip('firstCorrect'), 600);
    } else {
      setTimeout(() => showTip('firstIncorrect'), 600);
    }

    // Track total questions answered (for AI unlock)
    const newTotal = totalQuestionsAnswered + 1;
    setTotalQuestionsAnswered(newTotal);
    saveTotalQuestions(newTotal);

    // Show AI coach tip on first session
    if (newTotal === 1) {
      setTimeout(() => showTip('aiCoach'), 1500);
    }

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
    setShowCalculator(false);

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

      // Show session complete tip for new users
      setTimeout(() => showTip('sessionComplete'), 1000);
    }
  };

  // Handle empty objectives
  if (!allObjectives || allObjectives.length === 0) {
    return (
      <div className="min-h-screen bg-void relative overflow-hidden">
        <div className="ambient-glow" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 text-center relative z-10">
          <PracticeIcon className="w-16 h-16 text-secondary-text/40 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-text">No questions available</h2>
          <p className="text-secondary-text mt-2">Go to Home to set up your objectives first.</p>
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
      <div className="min-h-screen bg-void relative overflow-hidden">
        <div className="ambient-glow" />
        <div className="orb w-64 h-64 -top-32 -right-32 opacity-30 fixed" />
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
        <div className="pt-24 pb-28 px-4 relative z-10">
          <div className="max-w-md mx-auto">
            {/* Practice Tip Banner */}
            {currentTip && (
              <div className="mb-4 p-4 glass-panel rounded-xl border border-mint/30 animate-fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">💡</span>
                  <p className="flex-1 text-sm text-secondary-text">{currentTip.text}</p>
                  <button
                    onClick={dismissTip}
                    className="text-secondary-text/60 hover:text-primary-text shrink-0 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              {/* Header */}
              <div className="text-center mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  accuracy === 100 ? 'bg-gradient-to-br from-[#FBBF24] to-orange-500 shadow-[0_0_30px_rgba(251,191,36,0.4)]' :
                  accuracy >= 80 ? 'bg-gradient-to-br from-mint to-emerald-500 shadow-glow-mint' :
                  accuracy >= 60 ? 'bg-gradient-violet shadow-glow-violet' :
                  'bg-gradient-to-br from-secondary-text/40 to-secondary-text/60'
                }`}>
                  {accuracy === 100 ? <TrophyIcon className="w-10 h-10 text-white" /> :
                   accuracy >= 80 ? <Sparkles className="w-10 h-10 text-white" /> :
                   <Target className="w-10 h-10 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-primary-text">
                  {accuracy === 100 ? 'Perfect! 🎉' :
                   accuracy >= 80 ? 'Great Work!' :
                   accuracy >= 60 ? 'Good Effort!' : 'Keep Practicing!'}
                </h2>
              </div>

              {/* Score */}
              <div className="text-center mb-6">
                <div className="text-5xl font-bold gradient-text">
                  {correctCount}/{sessionResults.length}
                </div>
                <p className="text-secondary-text mt-1">{accuracy}% accuracy</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="glass-panel rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-primary-text">{topicsSet.size}</div>
                  <div className="text-xs text-secondary-text">Topics</div>
                </div>
                <div className="glass-panel rounded-xl p-3 text-center border-mint/30">
                  <div className="text-xl font-bold text-mint">+{streakGained}</div>
                  <div className="text-xs text-mint/80">Streak pts</div>
                </div>
                <div className="glass-panel rounded-xl p-3 text-center border-violet/30">
                  <div className="text-xl font-bold text-violet-light">{masteryGained}</div>
                  <div className="text-xs text-violet-light/80">Mastered</div>
                </div>
              </div>

              {/* Question Results - prioritize showing mastery gains */}
              <div className="space-y-2 text-left mb-6 max-h-60 overflow-y-auto hide-scrollbar">
                {sessionResults.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg ${r.correct ? 'glass-panel' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <div className="flex items-center gap-3 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        r.correct ? 'bg-mint/20 text-mint' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <span className="font-medium text-primary-text">{r.code}</span>
                      {r.newMastery && (
                        <span className="ml-auto text-xs bg-violet/20 text-violet-light px-2 py-0.5 rounded-full font-semibold border border-violet/30">
                          ✓ Mastered!
                        </span>
                      )}
                    </div>
                    {!r.correct && revisionHints[r.code] && (
                      <p className="text-xs text-red-400 mt-2 ml-9">
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
      <div className="min-h-screen bg-void relative overflow-hidden">
        <div className="ambient-glow" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 relative z-10">
          <div className="max-w-md mx-auto">
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-violet rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-violet">
                  <PracticeIcon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-primary-text">Practice Session</h2>
                <p className="text-secondary-text mt-1">Build lasting maths skills</p>
              </div>

              {/* Practice Mode Selection - Quick Fire unlocks after 5 mastered OR 3-day streak */}
              {(() => {
                const quickFireUnlocked = masteredCount >= QUICKFIRE_MASTERY_THRESHOLD || dayStreak >= QUICKFIRE_STREAK_THRESHOLD;
                const examModeUnlocked = masteredCount >= 10; // Exam mode after 10 mastered

                return (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-secondary-text mb-2 block">Practice Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Standard Mode - Always available */}
                      <button
                        onClick={() => setPracticeMode('standard')}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          practiceMode === 'standard'
                            ? 'border-violet bg-violet/20'
                            : 'border-white/20 hover:border-white/40 bg-white/5'
                        }`}
                      >
                        <StandardIcon className="w-6 h-6 text-violet-light mb-1" />
                        <div className="font-semibold text-primary-text text-sm">Standard</div>
                        <div className="text-[10px] text-secondary-text">With hints</div>
                      </button>

                      {/* Quick Fire - Unlocks after 5 mastered OR 3-day streak */}
                      <button
                        onClick={() => quickFireUnlocked && mcqObjectiveCount >= 5 && setPracticeMode('quickfire')}
                        disabled={!quickFireUnlocked || mcqObjectiveCount < 5}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          !quickFireUnlocked || mcqObjectiveCount < 5
                            ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                            : practiceMode === 'quickfire'
                              ? 'border-orange-500 bg-orange-500/20'
                              : 'border-white/20 hover:border-white/40 bg-white/5'
                        }`}
                      >
                        <div className="text-lg mb-1">{quickFireUnlocked ? '⚡' : '🔒'}</div>
                        <div className="font-semibold text-primary-text text-sm">Quick Fire</div>
                        <div className="text-[10px] text-secondary-text">
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
                            ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                            : practiceMode === 'exam'
                              ? 'border-red-500 bg-red-500/20'
                              : 'border-white/20 hover:border-white/40 bg-white/5'
                        }`}
                      >
                        <div className="text-lg mb-1">{examModeUnlocked ? '🎯' : '🔒'}</div>
                        <div className="font-semibold text-primary-text text-sm">Exam</div>
                        <div className="text-[10px] text-secondary-text">
                          {!examModeUnlocked
                            ? `${10 - masteredCount} more to unlock`
                            : 'No hints'}
                        </div>
                      </button>
                    </div>

                    {/* Exam Mode explanation */}
                    {practiceMode === 'exam' && (
                      <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-sm text-red-300">
                        <strong>Exam conditions:</strong> No hints, no scaffolding, delayed feedback. Train your exam mindset.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass-panel rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-primary-text">{dueCount}</div>
                  <div className="text-xs text-secondary-text">Due now</div>
                </div>
                <div className="glass-panel rounded-xl p-3 text-center border-mint/30">
                  <div className="text-2xl font-bold text-mint">{masteredCount}</div>
                  <div className="text-xs text-mint">Mastered</div>
                </div>
              </div>

              {cooldownCount > 0 && (
                <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 mb-6">
                  <div className="flex items-center gap-2 text-amber-300">
                    <span className="text-lg">📚</span>
                    <span className="text-sm">
                      <strong>{cooldownCount}</strong> {cooldownCount === 1 ? 'objective needs' : 'objectives need'} revision
                    </span>
                  </div>
                </div>
              )}

              {/* Question count selector - simplified to 2 options */}
              <div className="mb-6">
                <label className="text-sm font-medium text-secondary-text mb-2 block">Questions</label>
                <div className="flex gap-2">
                  {[5, 10].map(n => {
                    const isLocked = !isSubscribed && n > (FREE_DAILY_LIMIT ?? 5);
                    return (
                      <button
                        key={n}
                        onClick={() => !isLocked && setQuestionCount(n)}
                        disabled={isLocked}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          isLocked
                            ? 'bg-white/5 text-secondary-text/50 cursor-not-allowed'
                            : questionCount === n
                              ? practiceMode === 'quickfire'
                                ? 'bg-orange-500 text-white'
                                : practiceMode === 'exam'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gradient-violet text-white'
                              : 'bg-white/10 text-secondary-text hover:bg-white/20'
                        }`}
                      >
                        {isLocked ? '🔒 10' : n === 5 ? '5 (Quick)' : '10 (Full)'}
                      </button>
                    );
                  })}
                </div>
                {!isSubscribed && (
                  <p className="text-xs text-amber-400 mt-2">Free plan: 5 questions per day</p>
                )}
              </div>

              {/* AI Coach Progress - shows until unlocked */}
              {!aiUnlocked && (
                <div className="mb-6 p-4 glass-panel border-violet/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet/30 rounded-full flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary-text">AI Coach</p>
                      <p className="text-xs text-secondary-text">Unlocks in {AI_UNLOCK_THRESHOLD - totalQuestionsAnswered} questions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-violet-light">{totalQuestionsAnswered}/{AI_UNLOCK_THRESHOLD}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-violet/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-violet rounded-full transition-all duration-500"
                      style={{ width: `${(totalQuestionsAnswered / AI_UNLOCK_THRESHOLD) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI Coach Active indicator - shows when unlocked */}
              {aiUnlocked && (
                <div className="mb-6 p-3 glass-panel border-violet/40 rounded-xl">
                  <div className="flex items-center gap-2 text-violet-light">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-medium">AI Coach Active</span>
                    <span className="ml-auto text-xs bg-violet/30 px-2 py-0.5 rounded-full text-primary-text">Smart feedback enabled</span>
                  </div>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={() => startSession(practiceMode)}
                className={`w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg ${
                  practiceMode === 'quickfire'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-500/25'
                    : 'btn-gradient-mint text-void shadow-glow-mint'
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
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="ambient-glow" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-lg mx-auto">
          {/* Quick Fire Timer */}
          {practiceMode === 'quickfire' && timeLeft !== null && !showFeedback && (
            <div className="mb-4">
              <div className={`text-center p-3 rounded-xl ${
                timeLeft <= 5 ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
              }`}>
                <div className="text-3xl font-bold">{timeLeft}s</div>
                <div className="text-xs">⚡ Quick Fire Mode</div>
              </div>
            </div>
          )}

          {/* Exam Mode Banner */}
          {practiceMode === 'exam' && !showFeedback && (
            <div className="mb-4">
              <div className="text-center p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300">
                <div className="font-bold">🎯 Exam Conditions</div>
                <div className="text-xs">No hints · No scaffolding · Delayed feedback</div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-secondary-text">Question {currentIndex + 1} of {sessionQueue.length}</span>
              <span className="text-sm font-bold text-mint">{sessionResults.filter(r => r.correct).length} correct</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  practiceMode === 'quickfire'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                    : practiceMode === 'exam'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500'
                      : 'bg-gradient-violet'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Session Phase Indicator (FSRS-based learning structure) */}
            {current?._sessionPhase && practiceMode === 'standard' && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  current._sessionPhase === 'warmup'
                    ? 'bg-green-500/20 text-green-300'
                    : current._sessionPhase === 'cooldown'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-violet/30 text-violet-light'
                }`}>
                  {current._sessionPhase === 'warmup' && '🌱 Warm-up'}
                  {current._sessionPhase === 'challenge' && '💪 Challenge'}
                  {current._sessionPhase === 'cooldown' && '✨ Cool-down'}
                </span>
                {current._sessionPhase === 'warmup' && (
                  <span className="text-secondary-text">Build confidence</span>
                )}
                {current._sessionPhase === 'challenge' && (
                  <span className="text-secondary-text">Main learning</span>
                )}
                {current._sessionPhase === 'cooldown' && (
                  <span className="text-secondary-text">End on a win</span>
                )}
              </div>
            )}
          </div>

          {/* Practice Tip Banner */}
          {currentTip && (
            <div className="mb-4 p-4 glass-panel rounded-xl border border-mint/30 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">💡</span>
                <p className="flex-1 text-sm text-secondary-text">{currentTip.text}</p>
                <button
                  onClick={dismissTip}
                  className="text-secondary-text/60 hover:text-primary-text shrink-0 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Question card */}
          {current && (
            <div className={`glass-panel rounded-3xl shadow-glass overflow-hidden ${
              isScaffoldQuestion ? 'border-violet/50 ring-2 ring-violet/20' :
              current.isExamQuestion ? 'border-amber-500/50 ring-2 ring-amber-500/20' : ''
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
                style={{ backgroundColor: isScaffoldQuestion ? 'rgba(110, 51, 177, 0.2)' : current.isExamQuestion ? 'rgba(245, 158, 11, 0.2)' : TOPIC_HEX[current.objective.topic] + '20' }}
              >
                <span
                  className="px-2 py-1 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: isScaffoldQuestion ? '#6E33B1' : current.isExamQuestion ? '#f59e0b' : TOPIC_HEX[current.objective.topic] }}
                >
                  {current.prerequisiteCode || current.objective.code}
                </span>
                <span className="text-xs font-medium px-2 py-1 bg-white/10 rounded-lg text-primary-text">
                  {isScaffoldQuestion ? 'Foundation Skill' : current.objective.topicName}
                </span>
                {current.objective.isHigher && !isScaffoldQuestion && (
                  <span className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-lg">Higher</span>
                )}

                {/* Progress toward mastery - show for non-scaffold questions */}
                {!isScaffoldQuestion && !current.isExamQuestion && (
                  <span className="px-2 py-1 bg-violet/30 text-violet-light text-xs font-medium rounded-lg">
                    {Math.min(progress[current.objective.code]?.quickCorrect ?? 0, 4)}/4 quick
                  </span>
                )}

                {/* Calculator badge */}
                <span className={`ml-auto px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  current.calculator ? 'bg-mint/20 text-mint' : 'bg-white/10 text-secondary-text'
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
                <h3 className="text-lg font-semibold text-primary-text mb-4">
                  {renderRecurring(current.q)}
                </h3>

                {/* Calculator indicator and button */}
                {current.calculator && !showFeedback && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mint/20 border border-mint/40 rounded-full text-sm text-mint">
                      <span>🧮</span> Calculator allowed
                    </span>
                    <button
                      onClick={() => setShowCalculator(!showCalculator)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        showCalculator
                          ? 'bg-violet text-white'
                          : 'bg-white/10 hover:bg-white/20 text-secondary-text'
                      }`}
                    >
                      {showCalculator ? 'Hide Calculator' : 'Show Calculator'}
                    </button>
                  </div>
                )}

                {/* On-screen calculator */}
                {current.calculator && showCalculator && !showFeedback && (
                  <div className="mb-4 flex justify-center">
                    <Calculator
                      onInsert={(value) => setUserAnswer(value)}
                      onClose={() => setShowCalculator(false)}
                    />
                  </div>
                )}

                {/* Hint for scaffold questions */}
                {current.hint && (settings?.showHints || isScaffoldQuestion) && (
                  <p className="text-sm text-secondary-text mb-4 italic">💡 {current.hint}</p>
                )}

                {/* Answer input */}
                {!showFeedback && (
                  <>
                    {current.type === 'self' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-secondary-text mb-4">Try this on paper, then mark yourself:</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => checkAnswer(true)}
                            className="flex-1 py-3 bg-mint hover:bg-mint/80 text-void font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Got it right
                          </button>
                          <button
                            onClick={() => checkAnswer(false)}
                            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
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
                                ? 'border-violet bg-violet/20 text-primary-text'
                                : 'border-white/20 hover:border-white/40 bg-white/5 text-primary-text'
                            }`}
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-secondary-text text-sm font-bold mr-3">
                              {['A', 'B', 'C', 'D'][i]}
                            </span>
                            {renderRecurring(option)}
                          </button>
                        ))}

                        {/* Confidence Rating for MCQ (cognitive science feature) */}
                        {userAnswer && practiceMode === 'standard' && (
                          <div className="mt-3 p-3 glass-panel rounded-xl">
                            <p className="text-xs text-secondary-text mb-2 font-medium">How confident are you? <span className="text-white/40">(optional)</span></p>
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
                                      ? 'bg-violet/30 border-2 border-violet text-violet-light'
                                      : 'bg-white/5 border border-white/20 text-secondary-text hover:border-violet/50'
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
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : current.type === 'order' ? (
                      <div className="space-y-4">
                        <p className="text-sm text-secondary-text">Drag to put in the correct order:</p>
                        <DragDropOrder
                          items={current.items}
                          onOrderChange={(newOrder) => setUserAnswer(JSON.stringify(newOrder))}
                        />
                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer}
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : current.type === 'match' ? (
                      <div className="space-y-4">
                        <DragDropMatch
                          leftItems={current.leftItems}
                          rightItems={current.rightItems}
                          onMatchChange={(pairs, matchObj) => setUserAnswer(JSON.stringify(matchObj))}
                        />
                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer || Object.keys(JSON.parse(userAnswer || '{}')).length < current.leftItems.length}
                          className="w-full mt-4 py-3 btn-gradient-mint disabled:opacity-50 disabled:bg-white/10 text-void font-semibold rounded-xl transition-all"
                        >
                          Submit Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Input mode toggle */}
                        <div className="flex rounded-xl bg-white/10 p-1">
                          <button
                            type="button"
                            onClick={() => { setInputMode('type'); clearPhoto(); }}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                              inputMode === 'type'
                                ? 'bg-violet text-white shadow-sm'
                                : 'text-secondary-text hover:text-primary-text'
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
                                ? 'text-white/30 cursor-not-allowed'
                                : inputMode === 'photo'
                                  ? 'bg-violet text-white shadow-sm'
                                  : 'text-secondary-text hover:text-primary-text'
                            }`}
                            title={aiUnlocked ? 'Photo mode' : `Unlocks after ${AI_UNLOCK_THRESHOLD - totalQuestionsAnswered} more questions`}
                          >
                            <span>{aiUnlocked ? '📷' : '🔒'}</span> Photo
                            {!aiUnlocked && (
                              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
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
                                className="w-full px-4 py-3 pr-12 border-2 border-white/20 rounded-xl focus:border-violet focus:outline-none text-lg bg-white/10 text-primary-text placeholder-secondary-text"
                                autoFocus
                              />
                              {/* Math keyboard toggle button */}
                              <button
                                type="button"
                                onClick={() => setShowMathKeyboard(!showMathKeyboard)}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                  showMathKeyboard
                                    ? 'bg-violet/30 text-violet-light ring-2 ring-violet/50'
                                    : 'bg-white/10 text-secondary-text hover:bg-white/20'
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
                                  Answer: <strong>{renderRecurring(current.a)}</strong>
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
                              The answer was: <strong>{renderRecurring(current.a)}</strong>
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
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="ambient-glow" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary-text">Progress Analytics</h1>
            <p className="text-secondary-text mt-1">Track your learning journey</p>
          </div>

          {/* Exam Readiness Card */}
          <div className="glass-panel rounded-3xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-violet rounded-2xl flex items-center justify-center shadow-glow-violet">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-primary-text">Exam Readiness</h2>
                <p className={`text-sm font-medium ${readiness.color}`}>{readiness.label}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-primary-text">{readinessScore}%</div>
              </div>
            </div>

            {/* Readiness bar */}
            <div className="h-4 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-violet rounded-full transition-all duration-1000"
                style={{ width: `${readinessScore}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-mint">{masteredCount}</div>
                <div className="text-xs text-secondary-text">Mastered</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                <div className="text-xs text-secondary-text">Learning</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-secondary-text">{totalObjectiveCount - masteredCount - learningCount}</div>
                <div className="text-xs text-secondary-text">Not Started</div>
              </div>
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-violet-light" />
                </div>
                <h2 className="font-semibold text-primary-text">Weekly Activity</h2>
              </div>
            </div>

            {/* Simple bar chart */}
            <div className="flex items-end justify-between gap-2 h-32 mt-4">
              {weeklyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    {day.questions > 0 ? (
                      <div
                        className="w-full max-w-[40px] bg-gradient-to-t from-violet to-violet-light rounded-t-lg transition-all"
                        style={{ height: `${(day.questions / maxQuestions) * 100}%`, minHeight: '8px' }}
                      />
                    ) : (
                      <div className="w-full max-w-[40px] h-2 bg-white/10 rounded-lg" />
                    )}
                  </div>
                  <span className="text-xs text-secondary-text">{day.day}</span>
                  <span className="text-xs font-medium text-primary-text">{day.questions}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-lg font-bold text-primary-text">{weeklyActivity.reduce((s, d) => s + d.sessions, 0)}</div>
                <div className="text-xs text-secondary-text">Sessions this week</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary-text">{weeklyActivity.reduce((s, d) => s + d.questions, 0)}</div>
                <div className="text-xs text-secondary-text">Questions answered</div>
              </div>
            </div>
          </div>

          {/* Streak Stats */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-500/20 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{loadStreakData().longestStreak}</div>
                <div className="text-xs text-amber-400">🏆 Longest Streak</div>
              </div>
              <div className="bg-blue-500/20 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{loadStreakData().freezesAvailable}</div>
                <div className="text-xs text-blue-400">🛡️ Streak Freezes</div>
              </div>
            </div>

            <p className="text-xs text-secondary-text mt-3 text-center">
              Earn freezes at 7, 14, 30, 60, 90, 180 & 365 day milestones
            </p>
            
            {/* Best Practice Time */}
            {getBestPracticeTime() && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary-text">🕐 Best time to practice:</span>
                  <span className="font-semibold text-primary-text">{getBestPracticeTime()}</span>
                </div>
                <p className="text-xs text-white/40 mt-1">Based on when you're most active</p>
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          {sessionHistory.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 shadow-glass">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="font-semibold text-primary-text">Recent Sessions</h2>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessionHistory.slice(-10).reverse().map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-primary-text">
                        Session #{session.sessionNumber}
                      </div>
                      <div className="text-xs text-secondary-text">
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
                        session.correct === session.total ? 'text-mint' :
                        session.correct >= session.total * 0.8 ? 'text-blue-400' :
                        'text-secondary-text'
                      }`}>
                        {session.correct}/{session.total}
                      </div>
                      <div className="text-xs text-secondary-text">
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

function SettingsPage({ currentPage, setCurrentPage, dayStreak, settings, setSettings, progress, setProgress, user, profile, isSubscribed, onSignIn, onSignUp, onSignOut, onUpgrade }) {
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
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="ambient-glow" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary-text">Settings</h1>
            <p className="text-secondary-text mt-1">Customise your learning experience</p>
          </div>

          {/* Account Section */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-text">Account</h2>
                <p className="text-sm text-secondary-text">Manage your account and subscription</p>
              </div>
            </div>

            {user && (
              <div className="space-y-4">
                {/* User info */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-violet rounded-full flex items-center justify-center text-white font-semibold">
                      {(profile?.display_name || user.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-primary-text">{profile?.display_name || 'User'}</div>
                      <div className="text-sm text-secondary-text">{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>

                {/* Subscription status */}
                <div className="flex items-center justify-between p-4 bg-violet/20 rounded-xl border border-violet/30">
                  <div>
                    <div className="text-sm text-secondary-text">Subscription</div>
                    <div className="font-semibold text-primary-text">
                      {isSubscribed ? (
                        <span className="text-mint">Premium Active</span>
                      ) : (
                        <span className="text-amber-400">Free Plan</span>
                      )}
                    </div>
                  </div>
                  {!isSubscribed && (
                    <button
                      onClick={onUpgrade}
                      className="px-4 py-2 btn-gradient-mint text-void text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                {/* Sync status */}
                <div className="flex items-center gap-2 text-sm text-mint">
                  <Check className="w-4 h-4" />
                  Progress syncing to cloud
                </div>
              </div>
            )}
          </div>

          {/* Study Preferences */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-text">Study Preferences</h2>
                <p className="text-sm text-secondary-text">Adjust your practice sessions</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Questions per session */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Questions per session</label>
                  <span className="text-sm font-bold text-violet-light bg-violet/30 px-2 py-1 rounded-lg">
                    {isSubscribed ? settings.questionsPerSession : 5}
                  </span>
                </div>
                {isSubscribed ? (
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={settings.questionsPerSession}
                    onChange={(e) => updateSetting('questionsPerSession', parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={5}
                      disabled
                      className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                    <p className="text-xs text-amber-400 mt-1">Free plan: 5 questions per day. <button onClick={onUpgrade} className="underline hover:text-amber-300">Upgrade for more</button></p>
                  </div>
                )}
                {isSubscribed && (
                  <div className="flex justify-between text-xs text-secondary-text mt-1">
                    <span>5</span>
                    <span>30</span>
                  </div>
                )}
              </div>

              {/* Show hints toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-secondary-text">Show hints</div>
                  <div className="text-xs text-white/40">Display helpful hints during practice</div>
                </div>
                <button
                  onClick={() => updateSetting('showHints', !settings.showHints)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.showHints ? 'bg-violet' : 'bg-white/20'
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
                  <div className="text-sm font-medium text-secondary-text">Include Higher tier</div>
                  <div className="text-xs text-white/40">Add Higher-only objectives to practice</div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !settings.includeHigherTier;
                    updateSetting('includeHigherTier', newVal);
                    setTier(newVal ? 'higher' : 'foundation');
                  }}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.includeHigherTier ? 'bg-violet' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.includeHigherTier ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Daily goal */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Daily question goal</label>
                  <span className="text-sm font-bold text-mint bg-mint/20 px-2 py-1 rounded-lg">
                    {isSubscribed ? (settings.dailyGoal ?? 10) : 5}
                  </span>
                </div>
                {isSubscribed ? (
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={settings.dailyGoal ?? 10}
                    onChange={(e) => updateSetting('dailyGoal', parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-mint"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={5}
                      disabled
                      className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                    <p className="text-xs text-amber-400 mt-1">Free plan: 5 questions per day. <button onClick={onUpgrade} className="underline hover:text-amber-300">Upgrade for more</button></p>
                  </div>
                )}
                {isSubscribed && (
                  <div className="flex justify-between text-xs text-secondary-text mt-1">
                    <span>5</span>
                    <span>50</span>
                  </div>
                )}
              </div>

              {/* Weekly mastery goal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-text">Weekly mastery goal</label>
                  <span className="text-sm font-bold text-amber-400 bg-amber-400/20 px-2 py-1 rounded-lg">
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
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-xs text-secondary-text mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
                <p className="text-xs text-white/40 mt-2">Objectives to master each week</p>
              </div>
            </div>
          </div>

          {/* Accessibility & Focus */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-text">Accessibility</h2>
                <p className="text-sm text-secondary-text">Customize your learning experience</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label className="text-sm font-medium text-secondary-text mb-2 block">Text Size</label>
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
                          ? 'bg-violet text-white'
                          : 'bg-white/10 text-secondary-text hover:bg-white/20'
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
                  <div className="text-sm font-medium text-secondary-text">Dyslexia-friendly font</div>
                  <div className="text-xs text-white/40">Use OpenDyslexic for easier reading</div>
                </div>
                <button
                  onClick={() => updateSetting('dyslexiaFont', !settings.dyslexiaFont)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.dyslexiaFont ? 'bg-violet' : 'bg-white/20'
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
                  <div className="text-sm font-medium text-secondary-text">High contrast</div>
                  <div className="text-xs text-white/40">Increase color contrast for visibility</div>
                </div>
                <button
                  onClick={() => updateSetting('highContrast', !settings.highContrast)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.highContrast ? 'bg-violet' : 'bg-white/20'
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
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-secondary-text" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-text">Data Management</h2>
                <p className="text-sm text-secondary-text">Backup and manage your progress</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Weekly Summary for Parents/Teachers */}
              <div className="p-4 bg-violet/20 border border-violet/30 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center flex-shrink-0">
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
                className="w-full flex items-center justify-center gap-2 py-3 glass-panel hover:bg-white/10 text-primary-text font-medium rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Progress
              </button>

              {/* Import button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 glass-panel hover:bg-white/10 text-primary-text font-medium rounded-xl transition-colors"
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
                    ? 'bg-mint/20 text-mint'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {importStatus === 'success'
                    ? '✓ Progress imported successfully!'
                    : '✗ Failed to import. Check file format.'}
                </div>
              )}

              {/* Reset button */}
              <div className="pt-4 border-t border-white/10">
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Progress
                  </button>
                ) : (
                  <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold">Are you sure?</span>
                    </div>
                    <p className="text-sm text-red-300 mb-4">
                      This will permanently delete all your progress. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-2 glass-panel hover:bg-white/10 text-primary-text font-medium rounded-lg transition-colors"
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
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-violet-light" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-text">About</h2>
                <p className="text-sm text-secondary-text">The Maths Habit v1.0</p>
              </div>
            </div>
            <p className="text-sm text-secondary-text leading-relaxed">
              A spaced repetition app designed to help GCSE students master every maths objective.
              Practice a little each day to build lasting understanding and confidence.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary-text">Objectives tracked</span>
                <span className="font-medium text-primary-text">{Object.keys(progress).length}</span>
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
    <div className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-xl">
      <StreakIcon className="w-5 h-5 text-[#FBBF24]" />
      <span className="font-bold text-[#FBBF24]">{streak}</span>
      <span className="text-sm text-secondary-text hidden sm:inline">day streak</span>
    </div>
  );
}

function NavBar({ currentPage, setCurrentPage, streak }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'practice', label: 'Practice', icon: PracticeIcon },
    { id: 'stats', label: 'Stats', icon: StatsIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-gradient-to-br from-violet to-violet-dark rounded-xl flex items-center justify-center p-1.5 shadow-glow-violet group-hover:scale-105 transition-transform">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                  {[0.3, 0.6, 0.9, 0.5, 0.2, 0.8, 0.7, 0.4, 0.95].map((opacity, i) => (
                    <div key={i} className="rounded-sm" style={{ backgroundColor: `rgba(255,255,255,${opacity})` }} />
                  ))}
                </div>
              </div>
              <span className="font-bold text-xl text-primary-text hidden sm:block">The Maths Habit</span>
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
                        ? "bg-gradient-violet text-white shadow-glow-violet"
                        : "text-secondary-text hover:text-primary-text hover:bg-white/5"
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

      {/* Mobile Bottom Nav - Floating Glass Pill */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="glass-panel-strong rounded-2xl shadow-glass mx-auto max-w-sm">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? "text-mint"
                      : "text-secondary-text hover:text-primary-text"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(56,230,162,0.5)]' : ''}`} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

// Onboarding Auth Form Component
function OnboardingAuthForm({ onSuccess }) {
  const [mode, setMode] = useState('signup'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onSuccess();
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Success will be handled by the useEffect in parent
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error/Success messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3 bg-mint/20 border border-mint/40 text-mint rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Google Sign In - Primary option */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full py-3 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-void text-secondary-text">or {mode === 'signup' ? 'create account' : 'sign in'} with email</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-primary-text placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
              placeholder="Your name"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-secondary-text mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-primary-text placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-text mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-primary-text placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 btn-gradient-violet text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </span>
          ) : (
            mode === 'signup' ? 'Create Account' : 'Sign In'
          )}
        </button>
      </form>

      {/* Mode switcher */}
      <div className="text-center text-sm">
        {mode === 'signup' ? (
          <button
            onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
            className="text-violet-light hover:text-primary-text transition-colors"
          >
            Already have an account? Sign in
          </button>
        ) : (
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            className="text-violet-light hover:text-primary-text transition-colors"
          >
            Need an account? Create one
          </button>
        )}
      </div>
    </div>
  );
}

// Onboarding Plan Selection Card (Premium)
function OnboardingPlanCard({ onSelectFree, userId, userEmail }) {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const priceId = selectedPlan === 'monthly'
        ? STRIPE_PRICES.MONTHLY
        : STRIPE_PRICES.YEARLY;

      await redirectToCheckout({
        priceId,
        userId,
        userEmail,
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Unable to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel-strong rounded-2xl p-6 border-2 border-mint/50 relative overflow-hidden">
      {/* Popular badge */}
      <div className="absolute top-0 right-0 bg-mint text-void text-xs font-bold px-3 py-1 rounded-bl-lg">
        RECOMMENDED
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary-text mb-1">Premium</h3>
          <p className="text-secondary-text text-sm">Unlimited practice, maximum results</p>
        </div>
      </div>

      {/* Plan Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedPlan('monthly')}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            selectedPlan === 'monthly'
              ? 'bg-violet text-white'
              : 'bg-white/5 text-secondary-text hover:bg-white/10'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlan('yearly')}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative ${
            selectedPlan === 'yearly'
              ? 'bg-violet text-white'
              : 'bg-white/5 text-secondary-text hover:bg-white/10'
          }`}
        >
          Yearly
          <span className="absolute -top-2 -right-2 bg-mint text-void text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Save 37%
          </span>
        </button>
      </div>

      {/* Price Display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-primary-text">
          {selectedPlan === 'monthly' ? '£3.99' : '£29.99'}
        </div>
        <div className="text-secondary-text text-sm">
          {selectedPlan === 'monthly' ? 'per month' : 'per year (£2.50/mo)'}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 text-sm mb-6">
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Unlimited daily questions
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Sync progress across all devices
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> All 700+ GCSE questions
        </li>
        <li className="flex items-center gap-2 text-secondary-text">
          <span className="text-mint">✓</span> Priority support
        </li>
      </ul>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Upgrade Button */}
      <button
        onClick={handleUpgrade}
        disabled={isLoading}
        className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          `Start Premium - ${selectedPlan === 'monthly' ? '£3.99/mo' : '£29.99/yr'}`
        )}
      </button>

      {/* Secure payment */}
      <p className="mt-3 text-xs text-secondary-text/60 flex items-center justify-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure payment via Stripe
      </p>
    </div>
  );
}

// Promo Code Input Component
function PromoCodeInput({ onSuccess }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { redeemPromoCode } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    const result = await redeemPromoCode(code);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
    } else {
      setSuccess(result.message);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  };

  if (!showInput) {
    return (
      <div className="text-center">
        <button
          onClick={() => setShowInput(true)}
          className="text-violet-light hover:text-primary-text text-sm transition-colors"
        >
          Have a class code? Enter it here
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <h4 className="text-primary-text font-medium mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Enter Class Code
      </h4>

      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-mint/20 border border-mint/40 rounded-lg text-mint text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. MATHS2024"
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-primary-text placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent uppercase tracking-wider"
          disabled={isLoading || success}
        />
        <button
          type="submit"
          disabled={isLoading || !code.trim() || success}
          className="px-5 py-2.5 bg-violet hover:bg-violet-light text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      <button
        onClick={() => { setShowInput(false); setCode(''); setError(''); }}
        className="mt-3 text-secondary-text/60 hover:text-secondary-text text-xs transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// Inner App component that uses auth context
function AppContent() {
  const [tier, setTier] = useState(() => loadSettings().includeHigherTier ? 'higher' : 'foundation');
  const [tooltip, setTooltip] = useState({ open: false, x: 0, y: 0, objective: null });
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [currentPage, setCurrentPage] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Welcome, 2: Auth, 3: Plan Selection
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');

  // Auth context
  const {
    user,
    profile,
    loading: authLoading,
    signOut,
    canPractice,
    questionsRemaining,
    incrementDailyQuestions,
    isSubscribed,
    dailyQuestionsUsed,
    FREE_DAILY_LIMIT
  } = useAuth();

  // Sync data when user logs in
  useEffect(() => {
    const syncOnLogin = async () => {
      if (user && !authLoading) {
        // Check if this is a new user (just signed up)
        const hasLocalData = localStorage.getItem('maths-habit-progress');

        if (hasLocalData) {
          // Migrate local data to cloud
          await migrateLocalToCloud(user.id);
        } else {
          // Load data from cloud
          await loadFromCloud(user.id);
          // Refresh local state
          setProgress(loadProgress());
          setSettings(loadSettings());
        }
      }
    };
    syncOnLogin();
  }, [user, authLoading]);

  // Sync progress to cloud when it changes
  useEffect(() => {
    if (user) {
      saveProgressToCloud(user.id, progress);
    }
  }, [progress, user]);

  // Sync settings to cloud when they change
  useEffect(() => {
    if (user) {
      saveSettingsToCloud(user.id, settings);
    }
  }, [settings, user]);
  
  // Handle onboarding completion
  const completeOnboarding = () => {
    setOnboardingComplete();
    setShowOnboarding(false);
    setCurrentPage('practice'); // Go straight to practice
  };

  // Move to plan selection after successful auth
  useEffect(() => {
    if (showOnboarding && onboardingStep === 2 && user) {
      // User just signed in/up, move to plan selection
      setOnboardingStep(3);
    }
  }, [user, showOnboarding, onboardingStep]);

  // Multi-step Onboarding Flow - Deep Space Glassmorphism
  if (showOnboarding) {
    // Step 1: Welcome Screen
    if (onboardingStep === 1) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb w-64 h-64 -top-20 -right-20 opacity-60" />
          <div className="orb w-48 h-48 -bottom-10 -left-10 opacity-40" />

          <div className="max-w-md w-full text-center relative z-10">
            {/* Animated Heatmap Logo */}
            <div className="w-24 h-24 glass-panel-strong rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow-violet p-3 animate-float">
              <AnimatedLogo />
            </div>

            <h1 className="text-4xl font-bold text-primary-text mb-3 tracking-tight">The Maths Habit</h1>
            <p className="text-xl text-secondary-text mb-10">
              GCSE Maths<br />
              <span className="text-violet-light">Every square counts.</span>
            </p>

            {/* Trust indicators */}
            <div className="flex justify-center gap-6 mb-10 text-secondary-text text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-mint">✓</span> 90+ objectives
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-mint">✓</span> AI-powered learning
              </div>
            </div>

            <button
              onClick={() => setOnboardingStep(2)}
              className="w-full py-5 btn-gradient-mint font-bold text-xl rounded-2xl transition-all active:scale-[0.98]"
            >
              Get Started →
            </button>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Account Creation/Sign-in
    if (onboardingStep === 2) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb w-64 h-64 -top-20 -right-20 opacity-60" />
          <div className="orb w-48 h-48 -bottom-10 -left-10 opacity-40" />

          <div className="max-w-md w-full relative z-10">
            {/* Back button */}
            <button
              onClick={() => setOnboardingStep(1)}
              className="flex items-center gap-2 text-secondary-text hover:text-primary-text mb-6 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="glass-panel rounded-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-primary-text mb-2">Create your account</h2>
                <p className="text-secondary-text">
                  Save your progress and sync across devices
                </p>
              </div>

              {/* Embedded Auth Form */}
              <OnboardingAuthForm
                onSuccess={() => setOnboardingStep(3)}
              />
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Plan Selection
    if (onboardingStep === 3) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient glow background */}
          <div className="ambient-glow" />

          {/* Floating orb decoration */}
          <div className="orb w-64 h-64 -top-20 -right-20 opacity-60" />
          <div className="orb w-48 h-48 -bottom-10 -left-10 opacity-40" />

          <div className="max-w-lg w-full relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-primary-text mb-2">Choose your plan</h2>
              <p className="text-secondary-text">
                Start with free or unlock unlimited practice
              </p>
            </div>

            <div className="space-y-4">
              {/* Free Plan Card */}
              <div className="glass-panel rounded-2xl p-6 card-hover cursor-pointer border border-transparent hover:border-violet/50"
                onClick={completeOnboarding}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-primary-text mb-1">Free Plan</h3>
                    <p className="text-secondary-text text-sm mb-4">Perfect for getting started</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> {FREE_DAILY_LIMIT} questions per day
                      </li>
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> Track your progress
                      </li>
                      <li className="flex items-center gap-2 text-secondary-text">
                        <span className="text-mint">✓</span> AI-powered explanations
                      </li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-text">£0</div>
                    <div className="text-secondary-text text-sm">Forever free</div>
                  </div>
                </div>
                <button className="w-full mt-6 py-3 border border-violet rounded-xl text-primary-text font-medium hover:bg-violet/20 transition-colors">
                  Start Free →
                </button>
              </div>

              {/* Premium Plan Card */}
              <OnboardingPlanCard
                onSelectFree={completeOnboarding}
                userId={user?.id}
                userEmail={user?.email}
              />

              {/* Promo Code Section */}
              <PromoCodeInput onSuccess={completeOnboarding} />
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
            </div>
          </div>
        </div>
      );
    }
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
  const dailyGoal = isSubscribed ? (settings.dailyGoal ?? 10) : FREE_DAILY_LIMIT;
  const dailyProgress = Math.min((todayQuestions / dailyGoal) * 100, 100);
  
  // Weekly mastery progress
  const weeklyMastery = getWeeklyMastery(progress);
  const weeklyGoal = settings.weeklyMasteryGoal ?? 3;

  const getObjectives = (topic) => tier === 'higher' ? [...topic.foundation, ...topic.higher] : topic.foundation;
  
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

  const handleTileTap = (obj) => {
    setTooltip({
      open: true,
      x: 0,
      y: 0,
      objective: obj
    });
  };

  const closeTileDetail = () => {
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
        isSubscribed={isSubscribed}
        FREE_DAILY_LIMIT={FREE_DAILY_LIMIT}
        tier={tier}
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
      <>
        <SettingsPage
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          dayStreak={dayStreak}
          settings={settings}
          setSettings={setSettings}
          progress={progress}
          setProgress={setProgress}
          user={user}
          profile={profile}
          isSubscribed={isSubscribed}
          onSignIn={() => { setAuthModalMode('signin'); setShowAuthModal(true); }}
          onSignUp={() => { setAuthModalMode('signup'); setShowAuthModal(true); }}
          onSignOut={signOut}
          onUpgrade={() => setShowUpgradePrompt(true)}
        />
        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authModalMode}
        />
        {/* Upgrade Prompt */}
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSignUp={() => {
            setShowUpgradePrompt(false);
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-void relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="ambient-glow" />

      {/* Decorative orbs */}
      <div className="orb w-96 h-96 -top-48 -right-48 opacity-30 fixed" />
      <div className="orb w-64 h-64 top-1/2 -left-32 opacity-20 fixed" />

      {/* Navigation */}
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      {/* Main Content */}
      <div className="pt-20 pb-28 md:pb-10 relative z-10">

      {/* Hero Heatmap Card - Glassmorphism */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="glass-panel rounded-3xl p-6 md:p-10 shadow-glass card-hover">

          {/* Header with stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary-text tracking-tight">Your Maths Journey</h1>
              <p className="text-secondary-text mt-1">{allObjectives.length} GCSE objectives · Click to track progress</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-mint/10 text-mint text-xs font-medium rounded-full border border-mint/30">
                  <span>✨</span> Smart Learning Active
                </span>
                <span className="text-xs text-secondary-text/60">Powered by spaced repetition</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Tier toggle */}
              <div className="flex glass-panel rounded-lg p-1">
                {['foundation', 'higher'].map(t => (
                  <button key={t} onClick={() => setTier(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                      tier === t ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-primary-text'
                    }`}>{t}</button>
                ))}
              </div>

              {/* Mastery badge */}
              <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl">
                <TrophyIcon className="w-5 h-5 text-[#FBBF24]" />
                <span className="font-bold text-[#FBBF24]">{totalMastered}</span>
                <span className="text-secondary-text text-sm">/ {allObjectives.length}</span>
              </div>
            </div>
          </div>

          {/* Topic Legend - Top */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-6 pb-6 border-b border-white/10">
            {Object.entries(TOPIC_HEX).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-sm text-secondary-text">{name}</span>
              </div>
            ))}
          </div>

          {/* Heatmap Explainer - shows for new users */}
          {!loadShownTips().includes('heatmapExplainer') && (
            <div className="mb-4 p-4 glass-panel rounded-xl border border-violet/30 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">🗺️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary-text mb-2">How the heatmap works</p>
                  <div className="space-y-1.5 text-xs text-secondary-text">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm bg-white/5 border border-white/10 shrink-0" />
                      <span>Dark = not started yet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm shrink-0" style={{backgroundColor: 'rgba(167,139,250,0.3)'}} />
                      <span>Dim glow = just started (1-2 correct)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm shrink-0" style={{backgroundColor: 'rgba(167,139,250,0.7)'}} />
                      <span>Bright = getting stronger (3-4 correct)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm border-2 border-mint/80 shrink-0" style={{backgroundColor: 'rgba(167,139,250,0.9)'}} />
                      <span>Mint border = mastered! 🎉</span>
                    </div>
                  </div>
                  <p className="text-xs text-secondary-text/60 mt-2">Tap any square to see its objective details</p>
                </div>
                <button
                  onClick={(e) => { e.currentTarget.closest('.animate-fade-in').remove(); markTipShown('heatmapExplainer'); }}
                  className="text-secondary-text/60 hover:text-primary-text shrink-0 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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
                    onClick={() => handleTileTap(obj)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: getTileColor(TOPIC_HEX[obj.topic], level, recency),
                      border: isMastered ? '2px solid rgba(255,255,255,0.9)' :
                              isExamReady ? '2px solid rgba(56,230,162,0.8)' :
                              needsRevisit ? '1px dashed rgba(255,255,255,0.2)' :
                              '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isMastered ? '0 0 10px rgba(255,255,255,0.25)' :
                                 isExamReady ? '0 0 10px rgba(56,230,162,0.3)' : 'none',
                    }}
                    className="w-full transition-all duration-200 hover:scale-110 hover:z-20 relative cursor-pointer active:scale-95"
                  >
                    {isMastered && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
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
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-secondary-text">
              {/* Readiness indicators */}
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: '#8B5CF6', border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 8px rgba(255,255,255,0.2)',
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
                    border: '2px solid rgba(56,230,162,0.8)',
                    boxShadow: '0 0 6px rgba(56,230,162,0.25)',
                  }}
                />
                <span>Exam ready</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: mixWithWhite('#8B5CF6', 0.4),
                    border: '2px dashed rgba(255,255,255,0.2)',
                  }}
                  className="flex items-center justify-center opacity-60"
                >
                  <span className="text-[8px] text-white">↻</span>
                </div>
                <span>Needs revisit</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-secondary-text/60 mt-2">
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
          <div className="mb-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 glass-panel rounded-2xl p-4 border-amber-500/30 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">🔧</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-bold text-lg text-[#FBBF24]">Repair Your Streak!</h3>
                <p className="text-secondary-text text-sm">
                  Complete 10 questions today to restore your {potentialStreak} day streak
                </p>
                <div className="mt-2 bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-[#FBBF24] rounded-full transition-all duration-500"
                    style={{ width: `${repairProgress}%` }}
                  />
                </div>
                <p className="text-xs text-secondary-text/80 mt-1">{todayQuestions}/10 questions · {Math.round(repairProgress)}% complete</p>
              </div>
              <button
                onClick={() => setCurrentPage('practice')}
                className="px-6 py-3 btn-gradient-mint font-bold rounded-xl transition-colors"
              >
                Repair Now →
              </button>
            </div>
          </div>
        )}

        {/* Regular Progress Bar */}
        <div className={`glass-panel rounded-2xl p-4 ${needsRepair ? 'border-amber-500/30' : ''}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Mini Progress Ring */}
            <div className="relative flex-shrink-0">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke={dailyProgress >= 100 ? '#38E6A2' : '#6E33B1'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${dailyProgress * 1.38} 138`}
                  className="transition-all duration-500"
                  style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-text">{todayQuestions}</span>
              </div>
            </div>

            {/* Status */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className={`text-sm font-semibold ${dailyProgress >= 100 ? 'text-mint' : 'text-primary-text'}`}>
                  {dailyProgress >= 100 ? '🎉 Goal complete!' : `${todayQuestions}/${dailyGoal} today`}
                </span>
                <span className="text-secondary-text/40">·</span>
                <span className={`text-sm flex items-center gap-1 ${needsRepair ? 'text-[#FBBF24]' : 'text-secondary-text'}`}>
                  <StreakIcon className={`w-4 h-4 ${needsRepair ? 'text-[#FBBF24]' : 'text-[#FBBF24]'}`} />
                  {needsRepair ? `${potentialStreak} day streak (needs repair)` : `${dayStreak} day streak`}
                </span>
                <span className="text-secondary-text/40">·</span>
                <span className="text-sm text-secondary-text">
                  ⭐ {weeklyMastery}/{weeklyGoal} weekly
                </span>
              </div>

              {/* Streak Freezes & Identity Message */}
              <div className="flex flex-wrap items-center gap-3 mt-2 justify-center sm:justify-start">
                <span className="text-xs px-2 py-1 glass-panel text-violet-light rounded-full flex items-center gap-1">
                  🛡️ {freezesAvailable} streak {freezesAvailable === 1 ? 'freeze' : 'freezes'}
                </span>
                {longestStreak > 0 && (
                  <span className="text-xs px-2 py-1 glass-panel text-[#FBBF24] rounded-full">
                    🏆 Best: {longestStreak} days
                  </span>
                )}
                {dayStreak >= 3 && !needsRepair && (
                  <span className="text-xs text-secondary-text/60 italic">
                    You're a person who does maths every day 💪
                  </span>
                )}
              </div>
            </div>

            {/* Start Practice Button */}
            <button
              onClick={() => setCurrentPage('practice')}
              className={`px-6 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 ${
                needsRepair
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_4px_20px_rgba(251,191,36,0.3)]'
                  : 'btn-gradient-violet'
              }`}
            >
              <PracticeIcon className="w-4 h-4" />
              {needsRepair ? 'Repair Streak' : 'Practice'}
            </button>
          </div>
        </div>
      </div>

      {/* Tile Detail Modal */}
      <TileDetailModal
        open={tooltip.open}
        objective={tooltip.objective}
        progress={tooltip.objective ? progress[tooltip.objective.code] : null}
        onClose={closeTileDetail}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Upgrade Prompt */}
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onSignUp={() => {
          setShowUpgradePrompt(false);
          setAuthModalMode('signup');
          setShowAuthModal(true);
        }}
      />
    </div>
  );
}

// Main App wrapper with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
