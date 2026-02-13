import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen, Swords, Search, School, Loader2, Trophy } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import OneVsOne from './components/OneVsOne';
import HandwritingInput from './components/HandwritingInput';
import SchoolLeaderboard from './components/SchoolLeaderboard';
import { searchSchools, createSchool, joinSchool, leaveSchool, getUserSchool } from './lib/leaderboardService';
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
            backgroundColor: `rgba(91, 127, 199, ${baseOpacity})`,
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
  const btnNum = btnBase + 'key-dark text-lg';
  const btnOp = btnBase + 'key-dark-op text-lg';
  const btnFn = btnBase + 'key-dark text-sm';
  const btnEq = btnBase + 'bg-mint hover:bg-mint/80 text-void text-lg font-bold';
  const btnClear = btnBase + 'bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm border border-red-500/30';

  return (
    <div className="bg-void/95 backdrop-blur-xl rounded-2xl p-4 w-80 shadow-2xl border border-white/10 calc-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 calc-header">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧮</span>
          <span className="text-sm font-semibold text-white/80">Scientific Calculator</span>
          {memory !== null && <span className="text-xs bg-metallic-base/20 text-metallic-shadow px-2 py-0.5 rounded-full">M</span>}
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-white/50" />
        </button>
      </div>

      {/* Display */}
      <div className="bg-white/5 rounded-xl p-4 mb-3 border border-white/10 calc-display">
        {history && (
          <div className="text-right text-xs text-white/40 mb-1 truncate h-4">
            {history}
          </div>
        )}
        <div className="text-right text-3xl font-mono text-white truncate calc-display-text">
          {display}
        </div>
      </div>

      {/* Scientific functions */}
      <div className="grid grid-cols-5 gap-1.5 mb-2 calc-row">
        <button onClick={sin} className={btnFn}>sin</button>
        <button onClick={cos} className={btnFn}>cos</button>
        <button onClick={tan} className={btnFn}>tan</button>
        <button onClick={pi} className={btnFn}>π</button>
        <button onClick={() => performOperation('^')} className={btnFn}>xʸ</button>
      </div>

      {/* Memory row */}
      <div className="grid grid-cols-5 gap-1.5 mb-2 calc-row">
        <button onClick={memoryClear} className={btnFn}>MC</button>
        <button onClick={memoryRecall} className={btnFn}>MR</button>
        <button onClick={memoryAdd} className={btnFn}>M+</button>
        <button onClick={sqrt} className={btnFn}>√</button>
        <button onClick={square} className={btnFn}>x²</button>
      </div>

      {/* Main keypad */}
      <div className="grid grid-cols-4 gap-1.5 calc-keypad">
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
        className="w-full mt-3 py-3 btn-gradient-mint text-void font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 calc-use-btn"
      >
        <Check className="w-5 h-5" />
        Use Answer
      </button>
    </div>
  );
};

// AQA GCSE Mathematics (8300) Specification - Tier Assignments
// Foundation = Basic Foundation + Additional Foundation content
// Higher = Higher content only (also includes all Foundation content)
const topics = [
  { id: 'number', name: 'Number', strand: 'Number',
    // N1-N8: Foundation (N7 roots/integer indices, N8 fractions/π)
    // N9: Additional Foundation (standard form)
    // N10: Foundation (terminating decimals), Higher (recurring decimals)
    // N16: Additional Foundation (limits of accuracy), Higher (upper/lower bounds)
    foundation: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16'],
    higher: [] },
  { id: 'algebra', name: 'Algebra', strand: 'Algebra',
    // A1-A5: Foundation (basic manipulation, formulae)
    // A6: Additional Foundation (identities/arguments), Higher (proofs)
    // A7: Foundation (functions), Higher (inverse/composite)
    // A8: Foundation (coordinates all quadrants)
    // A9: Additional Foundation (y=mx+c, parallel), Higher (perpendicular)
    // A10: Foundation (gradients and intercepts)
    // A11: Additional Foundation (quadratics graphically), Higher (completing square)
    // A12: Foundation (linear/quadratic), Additional (cubic/reciprocal), Higher (exponential/trig)
    // A13: Higher only (graph transformations)
    // A14: Foundation (graphs in context)
    // A15: Higher only (gradients of curves, areas under graphs)
    // A16: Higher only (circle equations)
    // A17: Foundation (linear equations)
    // A18: Additional Foundation (factorising quadratics), Higher (completing square/formula)
    // A19: Additional Foundation (simultaneous linear), Higher (linear/quadratic)
    // A20: Higher only (iteration)
    // A21: Additional Foundation (form equations)
    // A22: Additional Foundation (linear inequalities), Higher (quadratic inequalities)
    // A23: Foundation (sequences term-to-term/position-to-term)
    // A24: Foundation (triangular/square/cube/arithmetic), Additional (Fibonacci/quadratic/geometric)
    // A25: Foundation (nth term linear), Higher (nth term quadratic)
    foundation: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A14', 'A17', 'A18', 'A19', 'A21', 'A22', 'A23', 'A24', 'A25'],
    higher: ['A12', 'A13', 'A15', 'A16', 'A20'] },
  { id: 'ratio', name: 'Ratio', strand: 'Ratio',
    // R1-R12: Foundation
    // R13: Additional Foundation (inverse proportion concept), Higher (construct equations)
    // R14: Additional Foundation (gradient as rate of change)
    // R15: Higher only (instantaneous rate of change)
    // R16: Additional Foundation (compound interest), Higher (iterative processes)
    foundation: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R16'],
    higher: ['R15'] },
  { id: 'geometry', name: 'Geometry', strand: 'Geometry',
    // G1-G9: Foundation (G7 fractional SF = Additional, G9 tangent/arc/sector = Additional)
    // G10: Higher only (circle theorems)
    // G11: Foundation (geometrical problems on coordinates)
    // G12: Foundation (properties of 3D shapes)
    // G13: Foundation (plans and elevations)
    // G14-G16: Foundation (measures, bearings, area formulae)
    // G17: Foundation (circle formulae, perimeter, area), Additional (spheres/pyramids/cones)
    // G18: Additional Foundation (arc lengths, sectors)
    // G19: Additional Foundation (similarity lengths), Higher (area/volume ratios)
    // G20: Additional Foundation (Pythagoras/trig 2D), Higher (3D)
    // G21: Additional Foundation (exact trig values)
    // G22-G23: Higher only (sine/cosine rule, area formula)
    // G24: Higher only (vector geometry)
    // G25: Additional Foundation (vector operations), Higher (vector proofs)
    foundation: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G18', 'G19', 'G20', 'G21', 'G25'],
    higher: ['G10', 'G17', 'G22', 'G23', 'G24'] },
  { id: 'prob', name: 'Probability', strand: 'Probability',
    // P1-P7: Foundation
    // P8: Additional Foundation (independent/dependent events)
    // P9: Higher only (conditional probability)
    foundation: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    higher: ['P9'] },
  { id: 'stats', name: 'Statistics', strand: 'Statistics',
    // S1: Additional Foundation (sampling)
    // S2: Foundation (tables/charts), Additional (time series)
    // S3: Higher only (histograms with unequal class intervals, cumulative frequency)
    // S4: Foundation (averages/range), Higher (box plots, quartiles/IQR)
    // S5: Foundation (statistics to describe population)
    // S6: Foundation (scatter graphs), Additional (line of best fit, predictions)
    foundation: ['S1', 'S2', 'S4', 'S5', 'S6'],
    higher: ['S3'] }
];

const descriptions = {
  // Number
  N1: 'Order and compare decimals including recurring (e.g. circle the largest: 5.304[r], 5.344, 5.34, 5.3[r]4[r])',
  N2: 'Add, subtract, multiply and divide with integers, decimals and negatives',
  N3: 'Use inverse operations and priority of operations (BIDMAS with brackets, powers, roots, reciprocals)',
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
  A18: 'Solve quadratics by factorising (e.g. solve x² + 5x + 6 = 0)',
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
  N3: 'Revise inverse operations (square ↔ square root, cube ↔ cube root, × ↔ ÷) and reciprocals (reciprocal of n is 1/n). Use BIDMAS for priority.',
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
  A18: 'Revise solving quadratics: factorise and set each bracket = 0.',
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

const levelLabels = ['Not started', '1/5 done', '2/5 done', '3/5 done', '4/5 nearly there!', '✓ Mastered'];

const TOPIC_HEX = {
  Number: "#A78BFA",      // Soft violet
  Algebra: "#38E6A2",     // Mint green
  Ratio: "#F0ABFC",       // Light orchid
  Geometry: "#67E8F9",    // Cyan
  Probability: "#818CF8", // Indigo
  Statistics: "#C084FC",  // Purple
};

// Exponential curve — bigger jumps at higher levels so progress is visible
const INTENSITY = { 0: 0.05, 1: 0.14, 2: 0.28, 3: 0.48, 4: 0.72, 5: 1.0 };
// At higher levels, blend toward white so tiles don't just get "more saturated"
const WHITE_BLEND = { 0: 0, 1: 0, 2: 0, 3: 0.08, 4: 0.22, 5: 0.4 };

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
  const baseIntensity = INTENSITY[progressLevel] || 0.05;
  const whiteBlend = WHITE_BLEND[progressLevel] || 0;
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

  // At higher levels, blend toward white so top tiles look distinctly brighter
  if (whiteBlend > 0) {
    pr = Math.round(pr + (255 - pr) * whiteBlend);
    pg = Math.round(pg + (255 - pg) * whiteBlend);
    pb = Math.round(pb + (255 - pb) * whiteBlend);
  }

  // Apply recency (desaturate old topics toward darker)
  const dim = (c) => Math.round(c * (0.4 + 0.6 * recencyFactor));

  return `#${[dim(pr), dim(pg), dim(pb)].map(c =>
    Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")
  ).join("")}`;
}

// Mastery system: 4 quick questions + 1 exam question = mastered
function getUnderstandingLevel(progress) {
  const quickCorrect = progress?.quickCorrect ?? 0;

  // 5 questions per objective, sequential progression
  // quickCorrect tracks how many they've got right (0-5)
  if (quickCorrect >= 5) return 5; // Mastered — all 5 questions correct
  if (quickCorrect === 4) return 4; // Nearly there
  if (quickCorrect === 3) return 3;
  if (quickCorrect === 2) return 2;
  if (quickCorrect === 1) return 1;
  return 0; // Not started
}

function isReadyForExam(progress) {
  // With 5-question sequential system, "exam ready" = completed 4 of 5
  return (progress?.quickCorrect ?? 0) === 4;
}

function TileDetailModal({ open, objective, progress, onClose }) {
  if (!open || !objective) return null;

  const quickCorrect = progress?.quickCorrect ?? 0;
  const mastered = quickCorrect >= 5;
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
             level >= 4 ? '🔥 Nearly there' :
             level > 0 ? '📚 Learning' :
             '○ Not started'}
          </span>
        </div>

        {/* Progress bars */}
        <div className="space-y-3 mb-4">
          {/* Quick questions */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-secondary-text">Questions</span>
              <span className="font-medium text-primary-text">{Math.min(quickCorrect, 5)}/5</span>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map(i => (
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
  learningSteps: [10, 60],  // Minutes for learning steps (10min, then 1 hour)
  relearningSteps: [30],    // Minutes for relearning (30 min)
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

    // Estimate FSRS parameters from existing mastery data
    let stability, state, reps;
    if (quickCorrect >= 5) {
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

// Recently answered question IDs — prevents repeats across sessions
const RECENT_QUESTIONS_KEY = 'maths-habit-recent-questions';
const MAX_RECENT_QUESTIONS = 120; // Track last 120 answered questions

const loadRecentQuestions = () => {
  try {
    const saved = localStorage.getItem(RECENT_QUESTIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const saveRecentQuestions = (list) => {
  try {
    const trimmed = list.slice(-MAX_RECENT_QUESTIONS);
    localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(trimmed));
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


// Question bank - to be rewritten
const questionBank = {
};

// Higher tier question bank - to be rewritten
const higherQuestionBank = {
};

// Helper function to get appropriate question bank based on tier
// For Higher tier students, use higherQuestionBank for shared objectives (harder questions)
// Falls back to questionBank if no higher version exists
const getQuestionBankForTier = (tier) => {
  if (tier === 'higher') {
    return new Proxy({}, {
      get(target, code) {
        if (higherQuestionBank[code] && higherQuestionBank[code].length > 0) {
          return higherQuestionBank[code];
        }
        return questionBank[code] || [];
      }
    });
  }
  return questionBank;
};

// Exam-style questions - to be rewritten
const examQuestions = {
};

// Higher tier exam questions - to be rewritten
const higherExamQuestions = {
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
    .replace(/<=/g, '≤') // Normalize inequality text to symbols
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
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
    return `<img src="/images/${imageDiagrams[type]}" alt="${type}" class="w-full h-auto mx-auto rounded-lg" />`;
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
  initial: 4 * 60 * 60 * 1000,     // 4 hours (was 10 min — way too short)
  level1: 24 * 60 * 60 * 1000,     // 1 day
  level2: 3 * 24 * 60 * 60 * 1000, // 3 days
  level3: 7 * 24 * 60 * 60 * 1000, // 7 days
  level4: 21 * 24 * 60 * 60 * 1000, // 21 days
  wrong: 10 * 60 * 1000,            // 10 minutes (was 2 min)
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

const isMastered = (progress) => (progress?.quickCorrect ?? 0) >= 5;

// Build session queue with FSRS-based spaced repetition + discriminative interleaving
const buildSessionQueue = (allObjectives, progress, count = 5, sessionCount = 0, tier = 'foundation') => {
  const now = Date.now();
  const qBank = getQuestionBankForTier(tier);

  // Shuffle helper (Fisher-Yates)
  const shuffle = (arr) => {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  };

  // ── Step 1: Collect one candidate per objective (the NEXT question they need) ──
  const candidates = [];

  allObjectives.forEach(obj => {
    const objProg = progress[obj.code];
    const questions = qBank[obj.code] || [];
    if (questions.length === 0) return; // No questions written yet

    // Skip fully mastered objectives (all 5 correct)
    const qc = objProg?.quickCorrect ?? 0;
    if (qc >= 5) return;

    // Skip objectives in session cooldown
    if (objProg?.skipUntilSession && objProg.skipUntilSession >= sessionCount) return;

    // Skip objectives practiced in the last 2 hours
    if (objProg?.lastPracticed && (now - objProg.lastPracticed) < 2 * 60 * 60 * 1000) return;

    // Sequential progression: the student gets question[quickCorrect]
    const questionIdx = Math.min(qc, questions.length - 1);
    const q = questions[questionIdx];
    const questionId = getQuestionId(obj.code, questionIdx, q);

    candidates.push({
      objective: obj,
      question: q,
      questionIndex: questionIdx,
      questionId,
      level: qc,
      topic: obj.topic,
    });
  });

  // ── Step 2: Fallback — if cooldowns filtered out too many, relax the 2-hour filter ──
  if (candidates.length < count) {
    allObjectives.forEach(obj => {
      const objProg = progress[obj.code];
      const questions = qBank[obj.code] || [];
      if (questions.length === 0) return;
      const qc = objProg?.quickCorrect ?? 0;
      if (qc >= 5) return;
      if (objProg?.skipUntilSession && objProg.skipUntilSession >= sessionCount) return;
      if (candidates.some(c => c.objective.code === obj.code)) return; // Already in pool

      const questionIdx = Math.min(qc, questions.length - 1);
      const q = questions[questionIdx];
      candidates.push({
        objective: obj,
        question: q,
        questionIndex: questionIdx,
        questionId: getQuestionId(obj.code, questionIdx, q),
        level: qc,
        topic: obj.topic,
      });
    });
  }

  // ── Step 3: Pick `count` questions, balanced across topics ──
  // Group by topic then round-robin pick from least-used topic
  const byTopic = {};
  candidates.forEach(c => {
    if (!byTopic[c.topic]) byTopic[c.topic] = [];
    byTopic[c.topic].push(c);
  });
  // Shuffle within each topic for variety
  Object.keys(byTopic).forEach(t => { byTopic[t] = shuffle(byTopic[t]); });

  const queue = [];
  const usedObjectives = new Set();
  const topicCount = {};

  while (queue.length < count) {
    // Find the topic with the least questions added so far that still has candidates
    let bestTopic = null;
    let bestCount = Infinity;
    for (const [topic, arr] of Object.entries(byTopic)) {
      const available = arr.filter(c => !usedObjectives.has(c.objective.code));
      if (available.length === 0) continue;
      const tc = topicCount[topic] || 0;
      if (tc < bestCount) {
        bestCount = tc;
        bestTopic = topic;
      }
    }

    if (!bestTopic) break; // No more candidates available

    // Pick first available from this topic
    const topicCandidates = byTopic[bestTopic];
    const nextIdx = topicCandidates.findIndex(c => !usedObjectives.has(c.objective.code));
    if (nextIdx === -1) break;

    const next = topicCandidates.splice(nextIdx, 1)[0];
    usedObjectives.add(next.objective.code);
    topicCount[next.topic] = (topicCount[next.topic] || 0) + 1;
    queue.push(next);
  }

  // Shuffle the final queue so topics are interleaved, not grouped
  return shuffle(queue).map(q => ({
    objective: q.objective,
    question: q.question,
    questionId: q.questionId,
    questionIndex: q.questionIndex,
  }));
};

// Get question for objective based on progress and tier
const getQuestion = (objective, progressData, tier = 'foundation') => {
  const prog = progressData?.[objective.code];
  const quickCorrect = prog?.quickCorrect ?? 0;

  // Get the appropriate question bank for this tier
  const qBank = getQuestionBankForTier(tier);
  const questions = qBank[objective.code];
  if (questions && questions.length > 0) {
    // Sequential progression: pick the question at the student's current level
    const questionIndex = Math.min(quickCorrect, questions.length - 1);
    const q = questions[questionIndex];
    const questionType = quickCorrect >= 5 ? 'review' : 'quick';
    return { ...q, objective, questionType };
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

function PracticePage({ dailyObjectives, progress, setProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings, isSubscribed, FREE_DAILY_LIMIT, tier = 'foundation', setRecentSessionCodes, setSessionToastData, setShowOneVsOne, setShowCelebration, setCelebrationIndex }) {
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
  const [inputMode, setInputMode] = useState('handwriting'); // 'type' or 'handwriting'
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
    return prog?.skipUntilSession && prog.skipUntilSession >= sessionCount;
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
        const questionType = quickCorrect >= 5 ? 'review' : 'quick';

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
    setInputMode('handwriting');
    
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
  const checkAnswer = (selfAssessedCorrect = null, answerOverride = null) => {
    // Stop Quick Fire timer
    if (timerRef.current) clearInterval(timerRef.current);

    const current = sessionQueue[currentIndex];
    const answerToCheck = answerOverride || userAnswer;
    let correct = selfAssessedCorrect;

    if (current.type !== 'self' && selfAssessedCorrect === null) {
      if (current.type === 'order') {
        // Check if order matches the correct order
        const userOrder = JSON.parse(answerToCheck || '[]');
        correct = JSON.stringify(userOrder) === JSON.stringify(current.correctOrder);
      } else if (current.type === 'match') {
        // Check if all matches are correct
        const userMatches = JSON.parse(answerToCheck || '{}');
        correct = Object.entries(current.correctMatches).every(
          ([left, right]) => userMatches[left] === right
        );
      } else {
        // Use forgiving answer checker that accepts mathematical equivalents
        correct = answersEquivalent(answerToCheck, current.a);
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
      const wasMastered = oldQuickCorrect >= 5;

      let newQuickCorrect = oldQuickCorrect;

      if (correct) {
        // Correct: advance to next question (max 5 = mastered)
        newQuickCorrect = Math.min(oldQuickCorrect + 1, 5);
      } else {
        // Wrong: drop back one level (can't go below 0)
        newQuickCorrect = Math.max(0, oldQuickCorrect - 1);
      }

      const nowMastered = newQuickCorrect >= 5;
      
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
            lastPracticed: Date.now(),
            nextDue: getNextDueTime(newQuickCorrect, correct),
            // Skip objective for a few sessions so the student sees variety
            skipUntilSession: correct
              ? sessionCount + (
                  newQuickCorrect >= 5 ? 10 : // Mastered — long break
                  newQuickCorrect >= 4 ? 3 :  // Nearly there
                  newQuickCorrect >= 2 ? 2 :  // Making progress
                  1                            // Just started
                )
              : sessionCount + 3,
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
        questionType: 'quick',
        oldQuickCorrect,
        newQuickCorrect,
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

      // Track this question as recently answered so it won't repeat soon
      const recentList = loadRecentQuestions();
      recentList.push(questionId);
      saveRecentQuestions(recentList);
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
    setInputMode('handwriting');

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
      
      // Extract practiced objective codes with full data for celebration
      const allResults = [...sessionResults, { correct: isCorrect, code: current.prerequisiteCode || current.objective.code, topic: current.objective.topic }];
      const practicedCodes = [...new Set(allResults.map(r => r.code))];

      // Build rich data for each practiced objective
      const practicedObjectives = practicedCodes.map(code => {
        const obj = allObjectives.find(o => o.code === code);
        const prog = progress[code];
        const level = getUnderstandingLevel(prog);
        const resultsForCode = allResults.filter(r => r.code === code);
        const correctForCode = resultsForCode.filter(r => r.correct).length;
        return {
          code,
          title: obj?.title || code,
          topic: obj?.topic || 'Unknown',
          level,
          quickCorrect: prog?.quickCorrect ?? 0,
          mastered: (prog?.quickCorrect ?? 0) >= 5,
          correctInSession: correctForCode,
          totalInSession: resultsForCode.length,
        };
      });

      // Set celebration data BEFORE navigating (all batched in one render)
      setRecentSessionCodes(practicedCodes);
      setCelebrationIndex(0);
      setShowCelebration(true);
      setSessionToastData({
        correctCount,
        totalQuestions,
        accuracy: Math.round((correctCount / totalQuestions) * 100),
        achievements: newAchievements,
        practicedObjectives,
      });

      // Navigate to home — celebration overlay will show immediately
      setSessionResults([]);
      setSessionStarted(false);
      setCurrentPage('home');
    }
  };

  // Handle empty objectives
  if (!allObjectives || allObjectives.length === 0) {
    return (
      <div className="min-h-screen bg-void relative overflow-hidden">
        <div className="ambient-glow" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 text-center relative z-10 page-content">
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
        <div className="orb-purple w-64 h-64 -top-32 -right-32 opacity-70 fixed pointer-events-none" />
        <div className="orb-cyan w-48 h-48 bottom-20 -left-20 opacity-60 fixed pointer-events-none" />
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
        <div className="pt-24 pb-28 px-4 relative z-10 page-content">
          <div className="max-w-md mx-auto content-container">
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
        <div className="orb-mint w-56 h-56 -top-28 -right-28 opacity-70 fixed pointer-events-none" />
        <div className="orb-pink w-40 h-40 bottom-32 -left-16 opacity-60 fixed pointer-events-none" />
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-24 px-4 relative z-10 page-content">
          <div className="max-w-md mx-auto content-container">
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-violet rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-violet">
                  <PracticeIcon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-primary-text">Practice Session</h2>
                <p className="text-secondary-text mt-1">Build lasting maths skills</p>
              </div>

              {/* Mode buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => { setPracticeMode('standard'); startSession('standard'); }}
                  className="w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg btn-gradient-mint text-void shadow-glow-mint"
                >
                  Start Practice
                </button>

                <button
                  onClick={() => { setCurrentPage('home'); setShowOneVsOne(true); }}
                  className="w-full py-4 font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 text-white btn-gradient-violet"
                >
                  <Swords className="w-5 h-5" />
                  1v1 Challenge
                </button>
              </div>
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
      <LandscapePrompt />
      <div className="ambient-glow" />
      <div className="orb-purple w-72 h-72 -top-36 -right-36 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-56 h-56 bottom-10 -left-28 opacity-60 fixed pointer-events-none" />
      <div className="orb-pink w-40 h-40 top-1/3 right-0 opacity-50 fixed pointer-events-none" />

      <div className="pt-2 pb-0 px-4 relative z-10 page-content">
        <div className="max-w-lg mx-auto content-container">
          {/* Question card */}
          {current && (
            <div className="glass-panel-dark rounded-3xl shadow-glass overflow-hidden relative">

              {/* Combined header bar: Exit · Topic · Progress · Score */}
              <div
                className="px-3 py-2 flex items-center gap-2 question-card-header"
                style={{ backgroundColor: TOPIC_HEX[current.objective.topic] + '20' }}
              >
                {/* Exit button */}
                <button
                  onClick={() => setCurrentPage('home')}
                  className="flex items-center gap-0.5 text-secondary-text hover:text-primary-text text-xs transition-colors shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>

                {/* Topic code badge */}
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: TOPIC_HEX[current.objective.topic] }}
                >
                  {current.prerequisiteCode || current.objective.code}
                </span>

                {/* Topic name */}
                <span className="text-xs font-medium text-white/80 truncate">
                  {current.objective.topicName}
                </span>

                {current.objective.isHigher && (
                  <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-md shrink-0">H</span>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Progress bar (inline) */}
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      background: practiceMode === 'quickfire'
                        ? 'linear-gradient(to right, #f97316, #ef4444)'
                        : practiceMode === 'exam'
                          ? 'linear-gradient(to right, #ef4444, #f43f5e)'
                          : 'linear-gradient(180deg, #8BA8D9, #5B7FC7, #3D5A8A)'
                    }}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Question count */}
                <span className="text-xs text-secondary-text shrink-0">
                  {currentIndex + 1}/{sessionQueue.length}
                </span>

                {/* Correct count */}
                <span className="text-xs font-bold text-mint shrink-0">
                  {sessionResults.filter(r => r.correct).length}✓
                </span>
              </div>

              {/* Question content */}
              <div className="p-6 question-card">
                <div className="question-card-layout">
                <div className="question-side">
                {/* Diagram if applicable */}
                {current.diagram && (
                  <div className="mb-4" dangerouslySetInnerHTML={{ __html: generateDiagram(current.diagram) }} />
                )}

                {/* Question text */}
                <h3 className="text-lg font-semibold text-white/90 mb-4 question-text">
                  {renderRecurring(current.q)}
                </h3>
                </div>
                <div className="answer-side">

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

                {/* On-screen calculator — fixed overlay in landscape */}
                {current.calculator && showCalculator && !showFeedback && (
                  <div className="mb-4 flex justify-center calc-overlay-container">
                    <Calculator
                      onInsert={(value) => { setUserAnswer(value); setShowCalculator(false); }}
                      onClose={() => setShowCalculator(false)}
                    />
                  </div>
                )}


                {/* Answer input */}
                {!showFeedback && (
                  <>
                    {current.type === 'self' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-white/50 mb-4">Try this on paper, then mark yourself:</p>
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
                        <p className="text-sm text-white/50">Drag to put in the correct order:</p>
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
                      <div className="space-y-3 answer-section">
                        {/* Input mode toggle */}
                        <div className="flex glass-panel rounded-lg p-1">
                          {['handwriting', 'type'].map(mode => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setInputMode(mode)}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                inputMode === mode
                                  ? 'bg-gradient-violet text-white shadow-glow-violet'
                                  : 'text-secondary-text hover:text-primary-text'
                              }`}
                            >
                              {mode === 'handwriting' ? '✏️ Write' : '⌨️ Type'}
                            </button>
                          ))}
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
                              <div className="bg-white/5 border border-white/10 rounded-xl p-2 shadow-lg backdrop-blur-sm">
                                {/* Keyboard tabs */}
                                <div className="flex gap-1 mb-2 pb-2 border-b border-white/10">
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
                                          ? 'bg-violet/20 text-violet-light'
                                          : 'text-white/50 hover:bg-white/10'
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
                                        key ? 'key-dark' : ''
                                      } ${['×', '÷', '+', '−', '='].includes(key) ? 'key-dark-op' : ''}`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {/* Fraction button - inserts / for typing fractions like 3/4 */}
                                  <button
                                    type="button"
                                    onClick={() => insertSymbol('/')}
                                    className="p-2 rounded-lg text-center font-medium transition-all key-dark-special"
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
                                        key ? 'key-dark' : ''
                                      } ${['×', '÷', '+', '−', '='].includes(key) ? 'key-dark-op' : ''}`}
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {/* Mixed number button - inserts space then / for typing like 1 3/4 */}
                                  <button
                                    type="button"
                                    onClick={() => insertSymbol(' /')}
                                    className="p-2 rounded-lg text-center font-medium transition-all key-dark-special"
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
                                        key === '⌫' ? 'key-dark-special' :
                                        'key-dark'
                                      } ${['×', '÷', '+', '−', '=', '≠'].includes(key) ? 'key-dark-op' : ''}`}
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
                                        key === '↵' ? 'bg-violet text-white hover:bg-violet/80 shadow-glow-violet' :
                                        'key-dark'
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
                                      className="p-2 rounded-lg text-center text-sm font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['θ', 'α', 'β', 'Δ', '∞', 'Σ', '∫', 'λ', 'μ', 'σ'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₀'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
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
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
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
                                        key === '⌫' ? 'key-dark-special' :
                                        key.trim() ? 'key-dark' : ''
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
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['→', '←', '↔', '⇒', '⇔', '∧', '∨', '⊕', '≡', '≈'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
                                    >
                                      {key}
                                    </button>
                                  ))}
                                  {['£', '$', '€', '¢', '‰', '′', '″', '…', '·', '×'].map((key, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => insertSymbol(key)}
                                      className="p-2 rounded-lg text-center font-medium key-dark transition-all"
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

                        {/* Handwriting mode */}
                        {inputMode === 'handwriting' && (
                          <HandwritingInput
                            onSubmit={(recognizedAnswer) => {
                              setUserAnswer(recognizedAnswer);
                              // Auto-check the answer immediately — no keyboard popup
                              setTimeout(() => checkAnswer(null, recognizedAnswer), 100);
                            }}
                            onCancel={() => setInputMode('type')}
                            placeholder="Write your answer here..."
                            mathpixAppId={import.meta.env.VITE_MATHPIX_APP_ID}
                            mathpixAppKey={import.meta.env.VITE_MATHPIX_APP_KEY}
                          />
                        )}

                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer || isProcessingImage}
                          className="w-full py-3 btn-gradient-mint text-void font-semibold rounded-xl transition-all disabled:opacity-30 check-btn"
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
                          ? 'feedback-correct-dark'
                          : 'feedback-incorrect-dark'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <>
                              <Check className="w-5 h-5 text-emerald-400" />
                              <span className="font-semibold text-emerald-400">Correct</span>
                            </>
                          ) : (
                            <>
                              <X className="w-5 h-5 text-red-400" />
                              <span className="font-semibold text-red-400">Incorrect</span>
                              {current.a && (
                                <span className="text-sm text-white/60 ml-2">
                                  Answer: <strong>{renderRecurring(current.a)}</strong>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`p-4 rounded-xl ${
                          isCorrect
                            ? 'feedback-correct-dark'
                            : 'feedback-incorrect-dark'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {isCorrect ? (
                              <>
                                <Check className="w-5 h-5 text-emerald-400" />
                                <span className="font-semibold text-emerald-400">
                                  Correct!
                                </span>
                              </>
                            ) : (
                              <>
                                <X className="w-5 h-5 text-red-400" />
                                <span className="font-semibold text-red-400">Not quite</span>
                              </>
                            )}
                          </div>
                          {current.a && !isCorrect && (
                            <p className="text-sm text-white/60 mb-2">
                              The answer was: <strong className="text-white/80">{renderRecurring(current.a)}</strong>
                            </p>
                          )}
                        </div>

                        {/* AI Analyzing Indicator - only when AI is unlocked */}
                        {!isCorrect && isAnalyzing && aiUnlocked && !currentDiagnosis?.isAI && (
                          <div className="p-4 bg-gradient-to-br from-purple-500/15 to-indigo-500/15 border border-purple-500/30 rounded-xl animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <span className="text-xl animate-spin">🤖</span>
                              </div>
                              <div>
                                <h4 className="font-semibold text-purple-300">AI Coach is analyzing your answer...</h4>
                                <p className="text-sm text-purple-400">Finding what went wrong</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Diagnosis - different style for AI vs pattern matching */}
                        {!isCorrect && currentDiagnosis?.hasDiagnosis && (
                          <div className={`p-4 rounded-xl ${
                            currentDiagnosis.isAI
                              ? 'bg-gradient-to-br from-purple-500/15 to-indigo-500/15 border border-purple-500/30'
                              : 'bg-amber-500/10 border border-amber-500/30'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                currentDiagnosis.isAI ? 'bg-purple-500/20' : 'bg-amber-500/20'
                              }`}>
                                <span className="text-xl">🤖</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`font-semibold ${currentDiagnosis.isAI ? 'text-purple-300' : 'text-amber-300'}`}>
                                    What went wrong?
                                  </h4>
                                  {currentDiagnosis.isAI && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/30 text-purple-300 rounded-full font-medium">
                                      AI Coach
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm mb-2 ${currentDiagnosis.isAI ? 'text-purple-200/80' : 'text-amber-200/80'}`}>
                                  {currentDiagnosis.diagnosis}
                                </p>
                                {currentDiagnosis.encouragement && currentDiagnosis.isAI && (
                                  <p className="text-xs text-purple-400 mt-2 italic">
                                    {currentDiagnosis.encouragement}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                    

                        {/* Worked Example - only show when incorrect and no diagnosis */}
                        {!isCorrect && !currentDiagnosis?.hasDiagnosis && workedExamples[current.objective.code] && (
                          <details className="bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden">
                            <summary className="p-4 cursor-pointer font-semibold text-blue-300 hover:bg-blue-500/15 transition-colors flex items-center gap-2">
                              <BookOpen className="w-5 h-5" />
                              View Worked Example: {workedExamples[current.objective.code].title}
                            </summary>
                            <div className="p-4 pt-0 space-y-4">
                              {/* Steps */}
                              <div>
                                <h4 className="font-semibold text-blue-300 mb-2">Method:</h4>
                                <ol className="text-sm text-blue-200/80 space-y-1 list-decimal list-inside">
                                  {workedExamples[current.objective.code].steps.map((step, i) => (
                                    <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                                  ))}
                                </ol>
                              </div>

                              {/* Worked Example */}
                              <div className="bg-white/5 rounded-lg p-3">
                                <h4 className="font-semibold text-blue-300 mb-2">Example: {workedExamples[current.objective.code].example.q}</h4>
                                <div className="text-sm text-blue-200/80 space-y-1">
                                  {workedExamples[current.objective.code].example.solution.map((line, i) => (
                                    <p key={i} className={line.startsWith('Answer') || line.startsWith('=') ? 'font-semibold' : ''}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </div>
                          
                            </div>
                          </details>
                        )}
                    

                      </>
                    )}

                    <button
                      onClick={nextQuestion}
                      className="w-full py-3 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 btn-gradient-mint text-void"
                    >
                      {currentIndex < sessionQueue.length - 1 ? (
                        <>Continue <ChevronRight className="w-5 h-5" /></>
                      ) : (
                        <>See Results <ChevronRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </div>
                )}
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mini-Lesson Modal */}
      {showMiniLesson && currentMiniLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-void/95 backdrop-blur-xl rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10">
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
              <div className="bg-violet/10 border border-violet/20 rounded-xl p-4">
                <h3 className="font-bold text-violet-light mb-3 flex items-center gap-2">
                  <span>📌</span> Key Points
                </h3>
                <ul className="space-y-2">
                  {currentMiniLesson.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/80">
                      <span className="w-6 h-6 bg-violet/30 rounded-full flex items-center justify-center text-sm font-bold text-violet-light flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Worked Example */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <span>✏️</span> Worked Example
                </h3>
                <div className="bg-white/5 rounded-lg p-4 mb-3">
                  <p className="font-semibold text-white/90 mb-2">{currentMiniLesson.example.problem}</p>
                  <div className="space-y-1">
                    {currentMiniLesson.example.steps.map((step, i) => (
                      <p key={i} className={`text-sm ${
                        i === currentMiniLesson.example.steps.length - 1
                          ? 'font-bold text-emerald-400'
                          : 'text-white/60'
                      }`}>
                        {step}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Common Mistakes */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                  <span>⚠️</span> Common Mistakes to Avoid
                </h3>
                <ul className="space-y-2">
                  {currentMiniLesson.commonMistakes.map((mistake, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-red-400">✗</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>


              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
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
                      className="px-6 py-4 bg-white/10 text-white/70 font-medium rounded-xl hover:bg-white/20 transition-all"
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-white/50 text-sm mb-2">Take a moment to read through the lesson...</p>
                    <button
                      onClick={() => { setMiniLessonTimer(0); setMiniLessonComplete(true); }}
                      className="text-violet-light hover:text-white text-sm font-medium"
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
                Let's Go!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STATS PAGE ====================

function StatsPage({ currentPage, setCurrentPage, dayStreak, progress, allObjectives, userSchool, user }) {
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
      const qc = prog?.quickCorrect ?? 0;
      return qc >= 4 && qc < 5;
    }).length;
    const learning = topicObjectives.filter(o => {
      const prog = progress[o.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      return quickCorrect > 0 && quickCorrect < 4;
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
    const qc = prog?.quickCorrect ?? 0;
    return qc >= 4 && qc < 5;
  }).length ?? 0;
  const learningCount = allObjectives?.filter(o => {
    const prog = progress[o.code];
    const quickCorrect = prog?.quickCorrect ?? 0;
    return quickCorrect > 0 && quickCorrect < 4;
  }).length ?? 0;
  
  // Weighted readiness: mastered = 100%, exam ready = 80%, learning = 40%, not started = 0%
  const readinessScore = totalObjectiveCount > 0 
    ? Math.round(((masteredCount * 100) + (examReadyCount * 80) + (learningCount * 40)) / totalObjectiveCount)
    : 0;
  
  const getReadinessLabel = (score) => {
    if (score >= 80) return { label: 'Exam Ready', color: 'text-emerald-600' };
    if (score >= 60) return { label: 'Almost There', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Making Progress', color: 'text-amber-600' };
    if (score >= 20) return { label: 'Getting Started', color: 'text-orange-600' };
    return { label: 'Just Beginning', color: 'text-slate-600' };
  };
  
  const readiness = getReadinessLabel(readinessScore);
  
  // Max for chart scaling
  const maxQuestions = Math.max(...weeklyActivity.map(d => d.questions), 1);

  return (
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="ambient-glow" />
      <div className="orb-purple w-80 h-80 -top-40 -right-40 opacity-70 fixed pointer-events-none" />
      <div className="orb-mint w-56 h-56 bottom-20 -left-24 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-44 h-44 top-1/2 right-0 opacity-50 fixed pointer-events-none" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text-celebration">Progress Analytics</h1>
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

          {/* School Leaderboard */}
          {userSchool && user ? (
            <div className="glass-panel rounded-2xl p-6 shadow-glass">
              <SchoolLeaderboard
                schoolId={userSchool.id}
                schoolName={userSchool.name}
                currentUserId={user.id}
                compact={false}
              />
            </div>
          ) : user ? (
            <div className="glass-panel rounded-2xl p-6 shadow-glass text-center">
              <Trophy className="w-8 h-8 text-[#FBBF24] mx-auto mb-2" />
              <h3 className="font-semibold text-primary-text mb-1">School Leaderboard</h3>
              <p className="text-sm text-secondary-text mb-3">Join your school to compete with classmates</p>
              <button
                onClick={() => setCurrentPage('settings')}
                className="px-5 py-2 btn-gradient-violet text-white text-sm font-medium rounded-xl"
              >
                Join a School
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ==================== SETTINGS PAGE ====================

function SettingsPage({ currentPage, setCurrentPage, dayStreak, settings, setSettings, progress, setProgress, user, profile, isSubscribed, onSignIn, onSignUp, onSignOut, onUpgrade, userSchool, setUserSchool }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  const [schoolResults, setSchoolResults] = useState([]);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [schoolJoining, setSchoolJoining] = useState(false);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolTown, setNewSchoolTown] = useState('');
  
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
    const masteredCount = allObjectives.filter(o => isMastered(progress[o.code])).length;
    
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

  // Search schools server-side with debounce
  useEffect(() => {
    if (!schoolFilter.trim() || schoolFilter.trim().length < 2) {
      setSchoolResults([]);
      setSchoolSearching(false);
      return;
    }
    setSchoolSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchSchools(schoolFilter);
      setSchoolResults(results);
      setSchoolSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [schoolFilter]);

  // Handle joining a school
  const handleJoinSchool = async (school) => {
    if (!user) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      await joinSchool(user.id, school.id);
      setUserSchool(school);
      setSchoolDropdownOpen(false);
      setSchoolFilter('');
    } catch (err) {
      setSchoolError(err.message || 'Failed to join school');
    } finally {
      setSchoolJoining(false);
    }
  };

  // Handle creating + joining a new school (with town)
  const handleCreateSchool = async () => {
    if (!user || !newSchoolName.trim() || !newSchoolTown.trim()) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      const school = await createSchool(newSchoolName.trim(), newSchoolTown.trim(), user.id);
      await joinSchool(user.id, school.id);
      setUserSchool(school);
      setShowAddSchool(false);
      setNewSchoolName('');
      setNewSchoolTown('');
      setSchoolResults([]);
    } catch (err) {
      setSchoolError(err.message || 'Failed to create school');
    } finally {
      setSchoolJoining(false);
    }
  };

  // Handle leaving school
  const handleLeaveSchool = async () => {
    if (!user) return;
    setSchoolError('');
    try {
      await leaveSchool(user.id);
      setUserSchool(null);
    } catch (err) {
      setSchoolError(err.message || 'Failed to leave school');
    }
  };

  return (
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="ambient-glow" />
      <div className="orb-pink w-72 h-72 -top-36 -right-36 opacity-70 fixed pointer-events-none" />
      <div className="orb-purple w-48 h-48 bottom-24 -left-20 opacity-60 fixed pointer-events-none" />
      <div className="orb-mint w-36 h-36 top-1/3 right-0 opacity-60 fixed pointer-events-none" />
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      <div className="pt-24 pb-24 px-4 relative z-10">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text-celebration">Settings</h1>
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

          {/* Your School */}
          {user && (
            <div className="glass-panel rounded-2xl p-6 shadow-glass mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5 text-violet-light" />
                </div>
                <div>
                  <h2 className="font-semibold text-primary-text">Your School</h2>
                  <p className="text-sm text-secondary-text">Join your school to see the leaderboard</p>
                </div>
              </div>

              {userSchool ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-metallic-base/10 rounded-xl border border-metallic-base/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-violet rounded-full flex items-center justify-center text-white font-semibold">
                        {userSchool.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-primary-text">{userSchool.name}</div>
                        {userSchool.town && <div className="text-xs text-secondary-text">{userSchool.town}</div>}
                      </div>
                    </div>
                    <button
                      onClick={handleLeaveSchool}
                      className="px-3 py-1.5 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ) : showAddSchool ? (
                /* Add new school form */
                <div className="space-y-3">
                  <p className="text-sm text-secondary-text">Add your school to the list:</p>
                  <input
                    type="text"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="School name..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-primary-text placeholder-secondary-text/60"
                  />
                  <input
                    type="text"
                    value={newSchoolTown}
                    onChange={(e) => setNewSchoolTown(e.target.value)}
                    placeholder="Town / region..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-primary-text placeholder-secondary-text/60"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSchool}
                      disabled={schoolJoining || !newSchoolName.trim() || !newSchoolTown.trim()}
                      className="flex-1 py-3 btn-gradient-mint text-void font-semibold rounded-xl disabled:opacity-50"
                    >
                      {schoolJoining ? 'Adding...' : 'Add & Join'}
                    </button>
                    <button
                      onClick={() => { setShowAddSchool(false); setNewSchoolName(''); setNewSchoolTown(''); }}
                      className="px-4 py-3 text-secondary-text hover:text-primary-text bg-white/5 rounded-xl transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                /* School dropdown selector */
                <div className="space-y-3">
                  <button
                    onClick={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-primary-text"
                  >
                    <span className="text-secondary-text/60">Select your school...</span>
                    <svg className={`w-4 h-4 text-secondary-text transition-transform ${schoolDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {schoolDropdownOpen && (
                    <div className="rounded-xl border border-white/10 bg-void/95 backdrop-blur overflow-hidden">
                      {/* Search input */}
                      <div className="p-2 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                          <input
                            type="text"
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            placeholder="Type your school name..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-primary-text placeholder-secondary-text/60"
                          />
                          {schoolSearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text animate-spin" />
                          )}
                        </div>
                      </div>

                      {/* School results */}
                      <div className="max-h-56 overflow-y-auto">
                        {schoolFilter.trim().length < 2 ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">
                            Start typing to search schools...
                          </div>
                        ) : schoolSearching ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">
                            Searching...
                          </div>
                        ) : schoolResults.length > 0 ? schoolResults.map(school => (
                          <button
                            key={school.id}
                            onClick={() => handleJoinSchool(school)}
                            disabled={schoolJoining}
                            className="w-full text-left px-4 py-3 hover:bg-metallic-base/10 transition-colors flex items-center justify-between disabled:opacity-50 border-b border-white/5 last:border-b-0"
                          >
                            <div>
                              <div className="text-sm text-primary-text">{school.name}</div>
                              {school.town && <div className="text-xs text-secondary-text">{school.town}</div>}
                            </div>
                            <span className="text-xs text-metallic-base font-medium shrink-0 ml-3">Join</span>
                          </button>
                        )) : (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">
                            No schools found for "{schoolFilter}"
                          </div>
                        )}
                      </div>

                      {/* Can't find school option */}
                      <div className="p-2 border-t border-white/10">
                        <button
                          onClick={() => { setSchoolDropdownOpen(false); setShowAddSchool(true); }}
                          className="w-full py-2 text-sm text-metallic-base hover:text-mint font-medium transition-colors"
                        >
                          Can't find your school? Add it
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {schoolError && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {schoolError}
                </div>
              )}
            </div>
          )}

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
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 top-nav-bar">
        <div className="max-w-4xl mx-auto px-4 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-gradient-to-br from-[#A78BFA] via-[#38E6A2] to-[#67E8F9] rounded-xl flex items-center justify-center p-1.5 shadow-glow-celebration group-hover:scale-105 transition-transform nav-logo">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                  {[0.3, 0.6, 0.9, 0.5, 0.2, 0.8, 0.7, 0.4, 0.95].map((opacity, i) => (
                    <div key={i} className="rounded-sm" style={{ backgroundColor: `rgba(255,255,255,${opacity})` }} />
                  ))}
                </div>
              </div>
              <span className="font-bold text-xl hidden sm:block gradient-text-celebration">The Maths Habit</span>
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
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden bottom-nav">
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
  const [recentSessionCodes, setRecentSessionCodes] = useState([]);
  const [sessionToastData, setSessionToastData] = useState(null);
  const [celebrationIndex, setCelebrationIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Welcome, 2: Auth, 3: Plan Selection
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');
  const [showOneVsOne, setShowOneVsOne] = useState(false);
  const [userSchool, setUserSchool] = useState(null); // { id, name } or null

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

  // Fetch user's school on login
  useEffect(() => {
    if (user && !authLoading) {
      getUserSchool(user.id).then(school => setUserSchool(school));
    } else if (!user) {
      setUserSchool(null);
    }
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
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

          <div className="max-w-md w-full text-center relative z-10">
            {/* Animated Heatmap Logo */}
            <div className="w-24 h-24 glass-panel-strong rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow-violet p-3 animate-float">
              <AnimatedLogo />
            </div>

            <h1 className="text-4xl font-bold mb-3 tracking-tight gradient-text-celebration">The Maths Habit</h1>
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
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

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
          <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
          <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
          <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />
          <div className="orb-pink w-52 h-52 top-10 -left-20 opacity-70 pointer-events-none" />

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
    // Load recent daily selections to avoid repeating same objectives
    let recentCodes = [];
    try {
      const stored = localStorage.getItem('maths_habit_recent_daily');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Keep last 3 days of selections
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        recentCodes = parsed.filter(e => e.ts > threeDaysAgo).flatMap(e => e.codes);
      }
    } catch (e) { /* ignore */ }

    return allObjectives.map(obj => {
      const prog = progress[obj.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      const lastPracticed = prog?.lastPracticed ?? 0;
      const neverPractised = !prog || (!quickCorrect && !lastPracticed);
      const daysSince = lastPracticed ? Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24)) : 999;

      // Never-practised objectives get a massive boost
      if (neverPractised) {
        return { ...obj, weight: 50 };
      }

      // Weight: lower progress = higher weight, longer time since practice = higher weight
      let progressWeight;
      if (quickCorrect >= 5) {
        progressWeight = 1; // Mastered - low priority
      } else if (quickCorrect >= 4) {
        progressWeight = 3; // Nearly there - medium priority
      } else {
        progressWeight = Math.max(5 - quickCorrect, 2); // Learning - higher priority
      }

      const timeWeight = Math.min(daysSince + 1, 7); // 1-7 based on days
      let weight = progressWeight * timeWeight;

      // Penalise objectives that appeared in recent days to force rotation
      if (recentCodes.includes(obj.code)) {
        weight = Math.max(weight * 0.3, 1);
      }

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

    // GUARANTEE: Pick at least 2 never-practised objectives first (if available)
    const neverPractised = available.filter(o => o.weight === 50);
    const shuffledNever = [...neverPractised].sort((a, b) => {
      return seededRandom(a.code.charCodeAt(0)) - seededRandom(b.code.charCodeAt(0));
    });
    for (let i = 0; i < Math.min(2, shuffledNever.length) && selected.length < 5; i++) {
      const idx = available.findIndex(a => a.code === shuffledNever[i].code);
      if (idx !== -1) {
        selected.push(available[idx]);
        available.splice(idx, 1);
      }
    }

    // Fill remaining slots with weighted random
    for (let i = selected.length; i < 5 && available.length > 0; i++) {
      const totalWeight = available.reduce((sum, obj) => sum + obj.weight, 0);
      let rand = seededRandom(i + 100) * totalWeight;

      for (let j = 0; j < available.length; j++) {
        rand -= available[j].weight;
        if (rand <= 0) {
          selected.push(available[j]);
          available.splice(j, 1);
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

    // Save today's selection for rotation tracking
    try {
      let stored = [];
      try {
        stored = JSON.parse(localStorage.getItem('maths_habit_recent_daily') || '[]');
      } catch (e) { /* ignore */ }
      const todayStr = new Date().toDateString();
      // Only add if not already saved today
      if (!stored.find(e => new Date(e.ts).toDateString() === todayStr)) {
        stored.push({ ts: Date.now(), codes: selected.map(s => s.code) });
        // Keep only last 5 days
        const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
        stored = stored.filter(e => e.ts > fiveDaysAgo);
        localStorage.setItem('maths_habit_recent_daily', JSON.stringify(stored));
      }
    } catch (e) { /* ignore */ }

    return selected;
  };

  // Get today's seed (changes daily)
  const todaySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  let dailyObjectives = selectDailyObjectives(todaySeed);
  
  // Fallback if selection returned empty
  if (!dailyObjectives || dailyObjectives.length === 0) {
    dailyObjectives = allObjectives.slice(0, 5);
  }

  // 1v1 Battle Mode
  if (showOneVsOne) {
    if (!user) {
      // Need to be logged in for 1v1
      setShowAuthModal(true);
      setAuthModalMode('signin');
      setShowOneVsOne(false);
      return null;
    }
    return (
      <OneVsOne
        user={user}
        questionBank={questionBank}
        onClose={() => setShowOneVsOne(false)}
        answersEquivalent={answersEquivalent}
      />
    );
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
        setRecentSessionCodes={setRecentSessionCodes}
        setSessionToastData={setSessionToastData}
        setShowOneVsOne={setShowOneVsOne}
        setShowCelebration={setShowCelebration}
        setCelebrationIndex={setCelebrationIndex}
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
        userSchool={userSchool}
        user={user}
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
          userSchool={userSchool}
          setUserSchool={setUserSchool}
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

      {/* Celebration-colored decorative orbs */}
      <div className="orb-purple w-96 h-96 -top-48 -right-48 opacity-70 fixed pointer-events-none" />
      <div className="orb-mint w-64 h-64 top-1/2 -left-32 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-72 h-72 bottom-20 right-10 opacity-60 fixed pointer-events-none" />
      <div className="orb-pink w-48 h-48 top-1/4 left-1/3 opacity-50 fixed pointer-events-none" />

      {/* Portrait Prompt — shown after practice when still in landscape */}
      {recentSessionCodes.length > 0 && !showCelebration && (
        <PortraitPrompt onDismiss={() => {}} />
      )}

      {/* Navigation */}
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      {/* Full-screen celebration carousel */}
      <CelebrationCarousel
        show={showCelebration}
        objectives={sessionToastData?.practicedObjectives || []}
        currentIndex={celebrationIndex}
        onAdvance={() => {
          const objs = sessionToastData?.practicedObjectives || [];
          if (celebrationIndex >= objs.length - 1) {
            setShowCelebration(false);
            setCelebrationIndex(0);
            setTimeout(() => {
              setSessionToastData(null);
              setRecentSessionCodes([]);
            }, 5000);
          } else {
            setCelebrationIndex(prev => prev + 1);
          }
        }}
      />

      {/* Main Content */}
      <div className="pt-20 pb-28 md:pb-10 relative z-10">

      {/* Hero Heatmap Card - Glassmorphism */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="glass-panel rounded-3xl p-6 md:p-10 shadow-glass card-hover">

          {/* Header with stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight gradient-text-celebration">Your Maths Journey</h1>
              <p className="text-secondary-text mt-1">{allObjectives.length} GCSE objectives · Click to track progress</p>
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-6 pb-6 border-b-2" style={{borderImage: 'linear-gradient(90deg, transparent, #A78BFA, #38E6A2, #67E8F9, #F0ABFC, transparent) 1'}}>
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
                    {/* Gentle glow on recently practiced tiles (after celebration) */}
                    {recentSessionCodes.includes(obj.code) && (
                      <div className="heatmap-glow-afterpulse" style={{
                        position: 'absolute', inset: -1, borderRadius: 10, pointerEvents: 'none',
                        zIndex: 9,
                      }} />
                    )}
                    {(isMastered || isExamReady) && (
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
                  className="flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
                <span>Nearly there</span>
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
            <div className="flex items-center gap-3">
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

              {/* 1v1 Battle Button */}
              <button
                onClick={() => setShowOneVsOne(true)}
                className="px-6 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 text-white btn-gradient-violet"
              >
                <Swords className="w-4 h-4" />
                1v1 Battle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* School Leaderboard Card */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {user && userSchool ? (
          <div className="glass-panel rounded-2xl p-5 shadow-glass">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-[#FBBF24]" />
              <h2 className="font-bold text-primary-text">{userSchool.name}{userSchool.town ? `, ${userSchool.town}` : ''}</h2>
            </div>
            <SchoolLeaderboard
              schoolId={userSchool.id}
              schoolName={userSchool.name}
              currentUserId={user.id}
              compact={true}
            />
            <button
              onClick={() => setCurrentPage('stats')}
              className="w-full mt-3 py-2 text-sm text-metallic-base font-medium hover:bg-metallic-base/10 rounded-xl transition-colors"
            >
              View Full Leaderboard →
            </button>
          </div>
        ) : user ? (
          <div className="glass-panel rounded-2xl p-5 shadow-glass">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-[#FBBF24]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-text text-sm">School Leaderboard</h3>
                <p className="text-xs text-secondary-text">Join your school to compete with classmates</p>
              </div>
              <button
                onClick={() => setCurrentPage('settings')}
                className="px-4 py-2 btn-gradient-violet text-white text-sm font-medium rounded-xl"
              >
                Join
              </button>
            </div>
          </div>
        ) : null}
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

// Landscape prompt — asks mobile users to rotate to landscape
function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024 && window.innerHeight > window.innerWidth;
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 1024;
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    const onOrientationChange = () => setTimeout(checkOrientation, 150);
    window.addEventListener('orientationchange', onOrientationChange);

    // Try to lock orientation in PWA / fullscreen mode
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  if (!isPortrait || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999, backgroundColor: '#0a0a1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', textAlign: 'center'
    }}>
      {/* Phone rotation animation */}
      <div style={{ marginBottom: '1.5rem' }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Phone in portrait */}
          <rect x="24" y="8" width="32" height="50" rx="5" stroke="#5B7FC7" strokeWidth="2.5" fill="none" opacity="0.3" />
          {/* Phone rotated to landscape */}
          <rect x="8" y="28" width="50" height="32" rx="5" stroke="#5B7FC7" strokeWidth="2.5" fill="none" />
          <circle cx="54" cy="44" r="2" fill="#5B7FC7" />
          {/* Arrow showing rotation */}
          <path d="M52 14 C60 14, 66 20, 66 28" stroke="#38E6A2" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M63 26 L66 28 L68 25" stroke="#38E6A2" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
        Turn your phone sideways
      </h2>
      <p style={{ fontSize: '1rem', color: '#9CA3AF', marginBottom: '2rem', maxWidth: '280px', lineHeight: 1.5 }}>
        The Maths Habit is designed for landscape mode
      </p>
      <button
        onClick={() => setDismissed(true)}
        style={{
          padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#9CA3AF',
          backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.75rem',
          cursor: 'pointer'
        }}
      >
        Continue in portrait
      </button>
    </div>
  );
}

function CelebrationCarousel({ show, objectives, currentIndex, onAdvance }) {
  if (!show || !objectives || objectives.length === 0) return null;

  const current = objectives[currentIndex];
  if (!current) return null;

  const topicColor = TOPIC_HEX[current.topic] || '#A78BFA';
  const levelLabels = ['Not started', 'Getting started', 'Building knowledge', 'Good progress', 'Nearly there', 'Mastered!'];
  const levelLabel = levelLabels[current.level] || 'Learning';
  const progressPct = (current.level / 5) * 100;
  const isLast = currentIndex >= objectives.length - 1;

  return (
    <div
      onClick={onAdvance}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(10, 10, 20, 0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {/* Animated card */}
      <div
        key={current.code}
        className="celebration-card"
        style={{
          width: 'min(85vw, 340px)',
          aspectRatio: '1',
          borderRadius: 24,
          background: `linear-gradient(135deg, ${topicColor}40, ${topicColor}20)`,
          border: `3px solid ${topicColor}`,
          boxShadow: `0 0 40px ${topicColor}60, 0 0 80px ${topicColor}30, 0 0 120px ${topicColor}15`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* White glow pulse */}
        <div className="celebration-glow" style={{
          position: 'absolute', inset: -8, borderRadius: 32,
          border: '2px solid rgba(255,255,255,0.6)',
          boxShadow: '0 0 30px rgba(255,255,255,0.3), inset 0 0 30px rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }} />

        <span style={{ color: topicColor, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          {current.topic}
        </span>

        <span style={{ color: 'white', fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          {current.code}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', fontWeight: 500, textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.3, maxWidth: '90%' }}>
          {current.title}
        </span>

        <span style={{
          color: current.correctInSession === current.totalInSession ? '#38E6A2' : 'rgba(255,255,255,0.7)',
          fontSize: '1rem', fontWeight: 600, marginBottom: '1rem',
        }}>
          {current.correctInSession}/{current.totalInSession} correct this session
        </span>

        {/* Progress bar */}
        <div style={{ width: '80%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginBottom: '0.5rem' }}>
          <div className="celebration-progress-fill" style={{
            height: '100%', width: `${progressPct}%`, borderRadius: 6,
            background: `linear-gradient(90deg, ${topicColor}, ${topicColor}CC)`,
            boxShadow: `0 0 12px ${topicColor}80`,
          }} />
        </div>

        <span style={{ color: current.level >= 5 ? '#FFD700' : 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: current.level >= 5 ? 700 : 500 }}>
          {current.level >= 5 ? '⭐ ' : ''}{levelLabel}
        </span>
      </div>

      {/* Dots */}
      <div style={{ position: 'fixed', bottom: '3rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
        {objectives.map((_, i) => (
          <div key={i} style={{
            width: i === currentIndex ? 24 : 8, height: 8, borderRadius: 4,
            background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <p style={{ position: 'fixed', bottom: '1.2rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
        {isLast ? 'Tap to finish' : 'Tap to continue'}
      </p>
    </div>
  );
}

function PortraitPrompt({ onDismiss }) {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024 && window.innerWidth > window.innerHeight;
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsLandscape(mobile && window.innerWidth > window.innerHeight);
    };
    check();
    window.addEventListener('resize', check);
    const onOr = () => setTimeout(check, 150);
    window.addEventListener('orientationchange', onOr);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', onOr);
    };
  }, []);

  if (!isLandscape || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999, backgroundColor: '#0a0a1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', textAlign: 'center'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Phone in landscape */}
          <rect x="8" y="28" width="50" height="32" rx="5" stroke="#5B7FC7" strokeWidth="2.5" fill="none" opacity="0.3" />
          {/* Phone rotated to portrait */}
          <rect x="24" y="8" width="32" height="50" rx="5" stroke="#5B7FC7" strokeWidth="2.5" fill="none" />
          <circle cx="40" cy="52" r="2" fill="#5B7FC7" />
          {/* Arrow showing rotation back */}
          <path d="M14 20 C14 12, 20 6, 28 6" stroke="#38E6A2" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M26 3 L28 6 L25 8" stroke="#38E6A2" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
        Rotate back to portrait
      </h2>
      <p style={{ fontSize: '1rem', color: '#9CA3AF', marginBottom: '2rem', maxWidth: '280px', lineHeight: 1.5 }}>
        Turn your phone upright to see your progress on the heatmap
      </p>
      <button
        onClick={() => setDismissed(true)}
        style={{
          padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#9CA3AF',
          backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.75rem',
          cursor: 'pointer'
        }}
      >
        Continue in landscape
      </button>
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
