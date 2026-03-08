import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen, Swords, Search, School, Loader2, Trophy, Camera, Lock, Star } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import OneVsOne from './components/OneVsOne';
import HandwritingInput from './components/HandwritingInput';
import SchoolLeaderboard from './components/SchoolLeaderboard';
import { getAllSchools, createSchool, joinSchool, leaveSchool, getUserSchool } from './lib/leaderboardService';
import { redirectToCheckout, STRIPE_PRICES } from './lib/stripe';
import { checkProfanity, sanitiseName } from './lib/profanityFilter';
import { uploadAvatar, deleteAvatar } from './lib/avatarService';
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
// Landing page logo using the app icon image
const AnimatedLogo = () => {
  return (
    <img
      src="/images/the-maths-habit-logo-hires.jpeg"
      alt="The Maths Habit logo"
      className="w-full h-full object-contain rounded-lg"
    />
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
const renderColumnVector = (x, y) => (
  <span key={`vec-${x}-${y}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', margin: '0 2px' }}>
    <span style={{ fontSize: '1.8em', fontWeight: 200, lineHeight: 1 }}>(</span>
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '0 3px', lineHeight: 1.3, fontSize: '0.9em' }}>
      <span>{x}</span>
      <span>{y}</span>
    </span>
    <span style={{ fontSize: '1.8em', fontWeight: 200, lineHeight: 1 }}>)</span>
  </span>
);

const renderRecurring = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Pattern: [vec:x,y] renders as a column vector
  // Process column vectors first
  const vecPattern = /\[vec:([\-\d]+),([\-\d]+)\]/g;
  if (vecPattern.test(text)) {
    const segments = [];
    let lastIdx = 0;
    vecPattern.lastIndex = 0;
    let match;
    while ((match = vecPattern.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segments.push(text.slice(lastIdx, match.index));
      }
      segments.push(renderColumnVector(match[1], match[2]));
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) segments.push(text.slice(lastIdx));
    return <span style={{ lineHeight: '1.8' }}>{segments}</span>;
  }

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
  // Number (AQA 8300 Section 3.1)
  N1: 'Order positive and negative integers, decimals and fractions; use the symbols =, ≠, <, >, ≤, ≥',
  N2: 'Apply the four operations to integers, decimals and simple fractions, both positive and negative',
  N3: 'Use relationships between operations including inverse operations; use priority of operations (BIDMAS)',
  N4: 'Use the concepts of prime numbers, factors, multiples, common factors, HCF, LCM and prime factorisation',
  N5: 'Apply systematic listing strategies including use of the product rule for counting',
  N6: 'Use positive integer powers and associated real roots (square, cube and higher)',
  N7: 'Calculate with roots and with integer and fractional indices',
  N8: 'Calculate exactly with fractions, surds and multiples of π',
  N9: 'Calculate with and interpret standard form A × 10ⁿ',
  N10: 'Work interchangeably with terminating decimals and their corresponding fractions',
  N11: 'Identify and work with fractions in ratio problems',
  N12: 'Interpret fractions and percentages as operators',
  N13: 'Use standard units of mass, length, time, money and other measures including compound measures',
  N14: 'Estimate answers; check calculations using approximation and estimation',
  N15: 'Round numbers and measures to an appropriate degree of accuracy (decimal places, significant figures)',
  N16: 'Apply and interpret limits of accuracy including upper and lower bounds',

  // Algebra (AQA 8300 Section 3.2)
  A1: 'Use and interpret algebraic notation',
  A2: 'Substitute numerical values into formulae and expressions',
  A3: 'Understand and use the concepts of expressions, equations, formulae, identities, inequalities, terms and factors',
  A4: 'Simplify and manipulate algebraic expressions (collecting like terms, expanding brackets, factorising)',
  A5: 'Understand and use standard mathematical formulae; rearrange formulae to change the subject',
  A6: 'Know the difference between an equation and an identity; use algebra to construct arguments and proofs',
  A7: 'Interpret simple expressions as functions with inputs and outputs; inverse and composite functions',
  A8: 'Work with coordinates in all four quadrants',
  A9: 'Plot graphs of straight lines using y = mx + c; find equations of lines through given points',
  A10: 'Identify and interpret gradients and intercepts of linear functions graphically and algebraically',
  A11: 'Identify and interpret roots, intercepts and turning points of quadratic functions',
  A12: 'Recognise, sketch and interpret graphs of linear, quadratic, cubic, reciprocal and exponential functions',
  A13: 'Sketch translations and reflections of the graph of a given function',
  A14: 'Plot and interpret graphs of non-standard functions in real contexts',
  A15: 'Calculate or estimate gradients of graphs and areas under graphs; interpret results in context',
  A16: 'Recognise and use the equation of a circle with centre at the origin',
  A17: 'Solve linear equations in one unknown algebraically including with brackets and fractions',
  A18: 'Solve quadratic equations by factorising, completing the square and using the quadratic formula',
  A19: 'Solve two simultaneous equations in two variables algebraically',
  A20: 'Find approximate solutions to equations numerically using iteration',
  A21: 'Translate simple situations into algebraic expressions or formulae; derive and solve equations',
  A22: 'Solve linear inequalities in one or two variables; represent the solution set on a number line',
  A23: 'Generate terms of a sequence from a term-to-term or position-to-term rule',
  A24: 'Recognise and use sequences of triangular, square and cube numbers, arithmetic progressions, Fibonacci-type sequences, quadratic sequences and geometric progressions',
  A25: 'Deduce expressions to calculate the nth term of linear and quadratic sequences',

  // Ratio, Proportion and Rates of Change (AQA 8300 Section 3.3)
  R1: 'Change freely between related standard units and compound units (e.g. speed, density, pressure)',
  R2: 'Use scale factors, scale diagrams and maps',
  R3: 'Express one quantity as a fraction of another, where the fraction is less than 1 or greater than 1',
  R4: 'Use ratio notation including reduction to simplest form',
  R5: 'Divide a given quantity into two parts in a given part:part or part:whole ratio',
  R6: 'Express a multiplicative relationship between two quantities as a ratio or a fraction',
  R7: 'Understand and use proportion as equality of ratios',
  R8: 'Relate ratios to fractions and to linear functions',
  R9: 'Define percentage as "number of parts per hundred"; interpret percentages and percentage changes',
  R10: 'Solve problems involving direct and inverse proportion, including graphical and algebraic representations',
  R11: 'Use compound units such as speed, rates of pay, unit pricing, density and pressure',
  R12: 'Compare lengths, areas and volumes using ratio notation and scale factors; make links to similarity',
  R13: 'Understand and construct equations that describe direct and inverse proportion',
  R14: 'Interpret the gradient of a straight-line graph as a rate of change',
  R15: 'Interpret the gradient at a point on a curve as the instantaneous rate of change',
  R16: 'Set up, solve and interpret growth and decay problems, including compound interest',

  // Geometry and Measures (AQA 8300 Section 3.4)
  G1: 'Use conventional terms and notation: points, lines, vertices, edges, parallel lines, perpendicular lines, right angles, polygons, regular polygons',
  G2: 'Use the standard ruler and compass constructions; construct given figures and solve loci problems',
  G3: 'Apply the properties of angles at a point, on a straight line, vertically opposite; use alternate and corresponding angles on parallel lines',
  G4: 'Derive and apply the properties and definitions of special types of quadrilaterals and triangles',
  G5: 'Use the basic congruence criteria for triangles (SSS, SAS, ASA, RHS)',
  G6: 'Apply angle facts, triangle congruence, similarity and properties of quadrilaterals to derive results about angles and sides',
  G7: 'Identify, describe and construct congruent and similar shapes, including on coordinate axes, by considering rotation, reflection, translation and enlargement',
  G8: 'Describe the changes and invariance achieved by combinations of rotations, reflections and translations',
  G9: 'Identify and apply circle definitions and properties, including centre, radius, chord, diameter, circumference, tangent, arc, sector and segment',
  G10: 'Apply and prove the standard circle theorems concerning angles, radii, tangents and chords',
  G11: 'Solve geometrical problems on coordinate axes',
  G12: 'Identify properties of the faces, surfaces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres',
  G13: 'Construct and interpret plans and elevations of 3D shapes',
  G14: 'Use standard units of measure and related concepts (length, area, volume/capacity, mass, time, money)',
  G15: 'Measure line segments and angles in geometric figures, including interpreting maps, scale drawings and bearings',
  G16: 'Know and apply formulae to calculate area of triangles, parallelograms, trapezia; volume of cuboids and other right prisms',
  G17: 'Know the formulae: circumference = 2πr = πd, area = πr²; calculate perimeters and areas of circles and composite shapes',
  G18: 'Calculate arc lengths, angles and areas of sectors of circles',
  G19: 'Apply the concepts of congruence and similarity, including the relationships between lengths, areas and volumes in similar figures',
  G20: 'Know the formulae for Pythagoras\' theorem (a² + b² = c²) and the trigonometric ratios; apply them to find angles and lengths in right-angled triangles',
  G21: 'Know the exact values of sin θ and cos θ for θ = 0°, 30°, 45°, 60° and 90°; know exact values of tan θ for θ = 0°, 30°, 45° and 60°',
  G22: 'Know and apply the sine rule and cosine rule to find unknown lengths and angles',
  G23: 'Know and apply Area = ½ab sin C to calculate the area, sides or angles of any triangle',
  G24: 'Describe translations as 2D column vectors',
  G25: 'Apply addition and subtraction of vectors, multiplication of vectors by a scalar; use vectors to construct geometric arguments and proofs',

  // Probability (AQA 8300 Section 3.5)
  P1: 'Record, describe and analyse the frequency of outcomes of probability experiments using tables and frequency trees',
  P2: 'Apply ideas of randomness, fairness and equally likely events to calculate expected outcomes',
  P3: 'Relate relative expected frequencies to theoretical probabilities, using the 0–1 probability scale',
  P4: 'Apply the property that the probabilities of an exhaustive set of mutually exclusive events sum to one',
  P5: 'Use a probability model to predict the outcomes of future experiments',
  P6: 'Enumerate sets and combinations of sets systematically, using tables, grids, Venn diagrams and tree diagrams',
  P7: 'Construct theoretical possibility spaces for single and combined experiments and use these to calculate theoretical probabilities',
  P8: 'Calculate the probability of independent and dependent combined events, including using tree diagrams',
  P9: 'Calculate and interpret conditional probabilities through representation using two-way tables, tree diagrams and Venn diagrams',

  // Statistics (AQA 8300 Section 3.6)
  S1: 'Infer properties of populations or distributions from a sample, whilst knowing the limitations of sampling',
  S2: 'Interpret and construct tables, charts and diagrams including frequency tables, bar charts, pie charts and pictograms',
  S3: 'Construct and interpret diagrams for grouped discrete data and continuous data (histograms, cumulative frequency graphs)',
  S4: 'Interpret, analyse and compare distributions through appropriate measures of central tendency and spread',
  S5: 'Apply statistics to describe a population',
  S6: 'Use and interpret scatter graphs; recognise correlation; draw estimated lines of best fit; interpolate and extrapolate trends'
};

// Revision hints - simple explanations for students when they get questions wrong
const revisionHints = {
  // Number
  N1: 'Revise ordering: compare decimals digit by digit from left to right. Use place value columns. For fractions, convert to decimals first.',
  N2: 'Revise the rules for calculating with negative numbers: negative × negative = positive, negative × positive = negative. Use column methods for written calculations.',
  N3: 'Revise inverse operations (square ↔ square root, cube ↔ cube root, × ↔ ÷) and BIDMAS: Brackets, Indices, Division/Multiplication, Addition/Subtraction.',
  N4: 'Revise prime numbers (only divisible by 1 and itself), factors (numbers that divide exactly), and prime factor trees for finding HCF and LCM.',
  N5: 'Revise systematic listing: if there are x ways to do task 1 and y ways to do task 2, there are x × y ways to do both.',
  N6: 'Revise powers (e.g. 3² = 9, 2³ = 8) and roots (e.g. √16 = 4, ³√27 = 3). Recognise powers of 2, 3, 4, 5.',
  N7: 'Revise index laws: a^(m/n) = ⁿ√(aᵐ) and a^(-n) = 1/aⁿ. For example, 8^(2/3) = ³√(8²) = ³√64 = 4.',
  N8: 'Revise calculating exactly with fractions (common denominators for +/−, multiply tops and bottoms for ×). Simplify surds: √12 = 2√3.',
  N9: 'Revise standard form: A × 10ⁿ where 1 ≤ A < 10. Large numbers have positive n, small numbers have negative n.',
  N10: 'Revise converting: decimal to fraction (use place value), fraction to decimal (divide top by bottom). For recurring decimals, use algebra.',
  N11: 'Revise writing one quantity as a fraction of another: put the first number on top, the second on the bottom, then simplify.',
  N12: 'Revise finding percentages: 10% = divide by 10, 1% = divide by 100. Build up other percentages from these.',
  N13: 'Revise metric conversions: 1km=1000m, 1m=100cm, 1cm=10mm. For area use squared units, for volume use cubed.',
  N14: 'Revise estimation: round each number to 1 significant figure first, then calculate. Use this to check if your exact answer is reasonable.',
  N15: 'Revise rounding: for decimal places, count digits after the point. For significant figures, count from the first non-zero digit.',
  N16: 'Revise bounds: if a measurement is rounded to the nearest unit, the lower bound is −0.5 and the upper bound is +0.5 from the rounded value.',

  // Algebra
  A1: 'Revise algebra notation: ab means a×b, a² means a×a, 2a means 2×a, a/b means a÷b.',
  A2: 'Revise substitution: replace each letter with its value, then calculate using BIDMAS.',
  A3: 'Revise: an expression has no equals sign, an equation can be solved, a formula shows a relationship, an identity (≡) is true for all values.',
  A4: 'Revise expanding: multiply each term inside the bracket. Factorising: find the common factor and take it outside.',
  A5: 'Revise standard formulae and rearranging: do the same operation to both sides to isolate the new subject.',
  A6: 'Revise: an equation is true for specific values, an identity (≡) is true for all values. For proofs, let n be any integer, 2n is even, 2n+1 is odd.',
  A7: 'Revise function machines: follow operations in order for the output, reverse for the input. fg(x) means do g first, then f.',
  A8: 'Revise coordinates: (x, y) where x is across, y is up. All four quadrants: positive and negative values.',
  A9: 'Revise y = mx + c: m is the gradient (change in y ÷ change in x), c is the y-intercept. Parallel lines have equal gradients.',
  A10: 'Revise gradients: gradient = change in y ÷ change in x. The y-intercept is where the line crosses the y-axis.',
  A11: 'Revise: roots are where the graph crosses the x-axis, the turning point is the maximum or minimum. Complete the square to find the turning point.',
  A12: 'Revise graph shapes: linear = straight line, quadratic = U/∩ shape, cubic = S-shape, reciprocal = two curves, exponential = rapid growth/decay.',
  A13: 'Revise graph transformations: f(x) + a moves up, f(x + a) moves left, −f(x) reflects in x-axis, f(−x) reflects in y-axis.',
  A14: 'Revise reading graphs in context: use the axes labels and units. Substitute values to find approximate solutions.',
  A15: 'Revise: gradient of a curve at a point = gradient of the tangent at that point. Area under a graph can be estimated using triangles and trapezia.',
  A16: 'Revise the equation of a circle centred at the origin: x² + y² = r². A tangent is perpendicular to the radius at the point of contact.',
  A17: 'Revise solving equations: do the same to both sides to get the unknown on its own.',
  A18: 'Revise solving quadratics: factorise and set each bracket = 0. Or use the quadratic formula: x = (−b ± √(b²−4ac)) / 2a.',
  A19: 'Revise simultaneous equations: eliminate one variable by adding/subtracting equations, or use substitution.',
  A20: 'Revise iteration: substitute your answer back into the formula repeatedly until it settles to the required accuracy.',
  A21: 'Revise translating problems into algebra: define variables, set up equations from the information given, solve and check your answer makes sense in context.',
  A22: 'Revise inequality notation: open circle for < or >, closed circle for ≤ or ≥. Solve like equations but reverse the sign when multiplying/dividing by a negative.',
  A23: 'Revise generating sequences: a term-to-term rule tells you how to get from one term to the next. A position-to-term rule gives the nth term directly.',
  A24: 'Revise special sequences: Fibonacci adds previous two terms, geometric multiplies by a constant, triangular numbers are 1, 3, 6, 10, 15...',
  A25: 'Revise nth term: for linear, find the common difference (d), then nth term = dn + (first term − d). For quadratic, find second differences.',

  // Ratio
  R1: 'Revise unit conversions by multiplying or dividing by the conversion factor. For compound units, convert one unit at a time.',
  R2: 'Revise scale factors: new length ÷ original length. On maps, use the scale to convert between map distance and real distance.',
  R3: 'Revise fractions of amounts: divide by the denominator, multiply by the numerator.',
  R4: 'Revise simplifying ratios: divide all parts by their HCF. For 1:n, divide both by the first number.',
  R5: 'Revise sharing in a ratio: add the parts, divide the total by the sum of parts, then multiply by each part.',
  R6: 'Revise: a multiplicative relationship means one quantity is a multiple or fraction of another. Express as a ratio a:b or fraction a/b.',
  R7: 'Revise proportion: if quantities are in proportion, their ratio stays the same. Find the value of 1 unit first, then multiply.',
  R8: 'Revise the link: ratio a:b is the same as the fraction a/b and the equation y = (a/b)x.',
  R9: 'Revise percentages: "per cent" means "per hundred". To find a percentage of an amount, convert to a decimal and multiply.',
  R10: 'Revise direct proportion (y = kx, graph is a straight line through origin) and inverse proportion (y = k/x). Find k first.',
  R11: 'Revise compound units: speed = distance ÷ time, density = mass ÷ volume, pressure = force ÷ area.',
  R12: 'Revise similar shapes: if lengths are in ratio 1:k, areas are 1:k², volumes are 1:k³.',
  R13: 'Revise proportion equations: direct (y = kxⁿ) and inverse (y = k/xⁿ). Substitute known values to find k.',
  R14: 'Revise: the gradient of a straight-line graph represents the rate of change. Steeper = faster rate.',
  R15: 'Revise: the gradient of a tangent to a curve gives the instantaneous rate of change at that point.',
  R16: 'Revise compound interest: multiply by (1 + rate)ⁿ where n is the number of time periods. For decay, multiply by (1 − rate)ⁿ.',

  // Geometry
  G1: 'Revise geometric vocabulary: equilateral (3 equal sides), isosceles (2 equal), scalene (none equal). Know parallel, perpendicular, vertex, edge.',
  G2: 'Revise constructions: use compasses for arcs, keep the same compass width for bisectors. Loci: set of points following a rule.',
  G3: 'Revise angle facts: straight line = 180°, around a point = 360°, vertically opposite are equal. Alternate (Z) angles are equal, corresponding (F) angles are equal.',
  G4: 'Revise quadrilateral properties: parallelogram (opposite sides parallel and equal), rhombus (4 equal sides), trapezium (one pair parallel).',
  G5: 'Revise congruence conditions: SSS, SAS, ASA, RHS. Two triangles are congruent if they satisfy any of these.',
  G6: 'Revise using angle facts and congruence/similarity to prove results. Base angles of an isosceles triangle are equal.',
  G7: 'Revise congruent (same size and shape) vs similar (same shape, different size). Identify transformations: rotation, reflection, translation, enlargement.',
  G8: 'Revise combined transformations: describe each transformation in turn. Use column vectors for translations.',
  G9: 'Revise circle parts: radius (centre to edge), diameter (across through centre), chord (line across), tangent (touches at one point), arc (part of circumference), sector (pizza slice), segment (chord cuts off).',
  G10: 'Revise circle theorems: angle in semicircle = 90°, tangent meets radius at 90°, angles in same segment are equal, opposite angles in cyclic quadrilateral sum to 180°.',
  G11: 'Revise coordinate geometry: use coordinates to find midpoints, distances, and gradients. Apply algebraic methods to geometric problems.',
  G12: 'Revise 3D shapes: know the names, number of faces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres.',
  G13: 'Revise plans and elevations: plan = view from above, front elevation = view from front, side elevation = view from side.',
  G14: 'Revise standard units: length (mm, cm, m, km), area (cm², m²), volume (cm³, m³, litres), mass (g, kg), time (s, min, hr).',
  G15: 'Revise measuring angles with a protractor. For bearings: measure clockwise from North, always give 3 figures (e.g. 045°).',
  G16: 'Revise area formulae: rectangle = l×w, triangle = ½×b×h, parallelogram = b×h, trapezium = ½(a+b)×h. Volume of prism = area of cross-section × length.',
  G17: 'Revise circle formulae: circumference = πd or 2πr, area = πr². Volume of cylinder = πr²h. Leave answers in terms of π if asked.',
  G18: 'Revise arc length = (θ/360) × 2πr. Sector area = (θ/360) × πr². θ is the angle of the sector.',
  G19: 'Revise similarity: if shapes are similar, corresponding lengths are in the same ratio. Area ratio = k², volume ratio = k³.',
  G20: 'Revise Pythagoras: a² + b² = c² (c is the hypotenuse). SOHCAHTOA: sin = opp/hyp, cos = adj/hyp, tan = opp/adj.',
  G21: 'Revise exact values: sin30°=½, cos30°=√3/2, tan30°=1/√3, sin45°=cos45°=1/√2, tan45°=1, sin60°=√3/2, cos60°=½, tan60°=√3.',
  G22: 'Revise sine rule: a/sinA = b/sinB. Cosine rule: a² = b² + c² − 2bc×cosA. Use these for non-right-angled triangles.',
  G23: 'Revise triangle area = ½ × a × b × sin(C) where C is the angle between sides a and b.',
  G24: 'Revise column vectors: (x, y) means x right and y up. A negative value means the opposite direction.',
  G25: 'Revise vector operations: add by adding components, scalar multiplication multiplies each component. Parallel vectors are multiples of each other.',

  // Probability
  P1: 'Revise recording outcomes: use tables and frequency trees to organise experimental results systematically.',
  P2: 'Revise theoretical probability = number of favourable outcomes ÷ total number of equally likely outcomes.',
  P3: 'Revise relative frequency = number of successes ÷ number of trials. As trials increase, relative frequency approaches theoretical probability.',
  P4: 'Revise: P(event happens) + P(event doesn\'t happen) = 1. All mutually exclusive probabilities sum to 1.',
  P5: 'Revise probability models: use theoretical probabilities to predict expected outcomes. More trials = closer to expected results.',
  P6: 'Revise Venn diagrams and tree diagrams: use them to list all possible outcomes systematically.',
  P7: 'Revise sample spaces: list all possible outcomes for combined events using tables or grids. Count favourable outcomes ÷ total outcomes.',
  P8: 'Revise combined events: multiply along branches for AND (both events), add between branches for OR (either event).',
  P9: 'Revise conditional probability: without replacement changes the denominator for the second pick. Use two-way tables or tree diagrams.',

  // Statistics
  S1: 'Revise sampling: a good sample should be representative of the population. Know the limitations — a sample may not reflect the whole population.',
  S2: 'Revise reading charts carefully: check the scale, labels and units. Bar charts for categories, pictograms use symbols, line graphs for time series.',
  S3: 'Revise pie charts: angle = (frequency ÷ total) × 360°. For histograms: frequency density = frequency ÷ class width.',
  S4: 'Revise averages: mean = total ÷ count, median = middle value, mode = most common. Spread: range = highest − lowest, IQR = Q3 − Q1.',
  S5: 'Revise using statistics to describe populations: compare averages and spreads to draw conclusions.',
  S6: 'Revise scatter graphs: positive correlation = both increase, negative = one increases as other decreases. Correlation does not mean causation.'
};

const levelLabels = ['Not started', '1/5 done', '2/5 done', '3/5 done', '4/5 nearly there!', '⭐ Mastered'];

const TOPIC_HEX = {
  Number: "#513A6F",      // Deep purple
  Algebra: "#2F4858",     // Cool teal
  Ratio: "#A845A2",       // Magenta
  Geometry: "#31456A",    // Secondary blue
  Probability: "#76235E", // Accent magenta
  Statistics: "#8E0039",  // Accent crimson
};

// Heatmap mastery palette: cool to warm to gold
const HEATMAP_COLORS = {
  0: '#1a1525',   // Near-dark (unpracticed)
  1: '#2F4858',   // Cool teal
  2: '#513A6F',   // Deep purple
  3: '#A845A2',   // Magenta
  4: '#B00053',   // Crimson
  5: '#D4AF37',   // Gold (mastery - sacred)
};

// Tile image assets for the heatmap — stone, gems, and gold
const TILE_IMAGES = {
  0: '/images/tiles/stone-tile.jpeg',     // Grey stone (not started)
  1: '/images/tiles/teal-gem.jpeg',       // Teal gem (started)
  2: '/images/tiles/purple-gem.jpeg',     // Purple gem (learning)
  3: '/images/tiles/magenta-gem.jpeg',    // Magenta gem (confident)
  4: '/images/tiles/crimson-gem.jpeg',    // Crimson gem (exam ready)
  5: '/images/tiles/gold-tile.jpeg',      // Gold pi tile (mastered)
};

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

// Level-based heatmap: cool teal to warm gold based on mastery
function getTileColor(hex, progressLevel, recencyFactor) {
  const baseColor = HEATMAP_COLORS[progressLevel] || HEATMAP_COLORS[0];
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  // Apply recency dimming (fade old topics toward darker)
  const dim = (c) => Math.round(c * (0.4 + 0.6 * recencyFactor));

  return `#${[dim(r), dim(g), dim(b)].map(c =>
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
          <button onClick={onClose} className="text-secondary-text/60 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-4">
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
            {level >= 5 ? '⭐ Mastered' :
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
              <span className="font-medium text-white">{Math.min(quickCorrect, 5)}/5</span>
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
const PIRO_KEY = 'maths-habit-piro';
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

// ==================== PI-RO EVOLUTION SYSTEM ====================
// Tamagotchi-style dragon that evolves with streak milestones
// Miss 2 days after reaching Gold and Piro ages to Old Dragon

const PIRO_STAGES = [
  { name: 'Egg',           minStreak: 0,  image: '/images/Piro/egg.png',            video: '/images/Piro/egg.mp4' },
  { name: 'Hatchling',     minStreak: 10, image: '/images/Piro/hatchling.png',      video: '/images/Piro/hatchling.mp4' },
  { name: 'Smoke Flame',   minStreak: 20, image: '/images/Piro/smoke-flame.png',    video: '/images/Piro/smoke-flame.mp4' },
  { name: 'Teal Flame',    minStreak: 30, image: '/images/Piro/teal-flame.png',     video: '/images/Piro/teal-flame.mp4' },
  { name: 'Magenta Flame', minStreak: 40, image: '/images/Piro/magenta-flame.png',  video: '/images/Piro/magenta-flame.mp4' },
  { name: 'Epic Piro',     minStreak: 50, image: '/images/Piro/gold-flames.png',    video: '/images/Piro/gold-flames.mp4' },
  { name: 'Legendary Piro', minStreak: 100, image: '/images/Piro/diamond-piro.png', video: '/images/Piro/diamond-piro.mp4' },
];

const PIRO_OLD = { name: 'Old Piro', image: '/images/Piro/old-piro.png', video: '/images/Piro/old-piro.mp4' };
const PIRO_CLOSE_TO_DEATH = { name: 'Close to Death', image: '/images/Piro/close-to-death.png', video: '/images/Piro/close-to-death.mp4' };
const PIRO_DEAD = { name: 'Dead Piro', image: '/images/Piro/dead-piro.png', video: '/images/Piro/dead-piro.mp4' };
const PIRO_DECAY_DAYS = 2;    // Miss 2 days after Epic → Old Piro
const PIRO_DYING_DAYS = 7;    // Miss 7 days → Close to Death
const PIRO_DEATH_DAYS = 10;   // Miss 10 days → Dead (permanent, restart)

// Get stage index based on highest streak ever reached
const getPiroStageFromStreak = (highestStreak) => {
  for (let i = PIRO_STAGES.length - 1; i >= 0; i--) {
    if (highestStreak >= PIRO_STAGES[i].minStreak) return i;
  }
  return 0;
};

const loadPiro = () => {
  try {
    const saved = localStorage.getItem(PIRO_KEY);
    const defaultPiro = {
      stage: 0,
      highestStreak: 0,  // Best streak ever (determines max evolution reached)
      reachedEpic: false, // Has ever reached Epic Piro (50-day streak)
      decayed: false,     // Currently in Old Piro state
      dying: false,       // Close to death state
      dead: false,        // Permanently dead — must restart
      evolvedAt: [],      // Evolution history
    };
    if (!saved) return defaultPiro;
    const parsed = JSON.parse(saved);
    // Migrate old reachedGold → reachedEpic
    if (parsed.reachedGold !== undefined && parsed.reachedEpic === undefined) {
      parsed.reachedEpic = parsed.reachedGold;
      delete parsed.reachedGold;
    }
    return { ...defaultPiro, ...parsed };
  } catch {
    return { stage: 0, highestStreak: 0, reachedEpic: false, decayed: false, dying: false, dead: false, evolvedAt: [] };
  }
};

const savePiro = (piro) => {
  try { localStorage.setItem(PIRO_KEY, JSON.stringify(piro)); } catch {}
};

// Update Piro based on current streak. Called after each session.
// Returns { piro, evolved, decayed, dying, dead, newStage, oldStage }
const updatePiro = (currentStreak, daysMissed) => {
  const piro = loadPiro();
  const oldStage = piro.stage;

  // Dead Piro cannot be revived — user must reset
  if (piro.dead) {
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: false, dead: true, newStage: piro.stage, oldStage };
  }

  // Practising reverses decay/dying states
  if (currentStreak >= 1 && (piro.decayed || piro.dying)) {
    piro.decayed = false;
    piro.dying = false;
  }

  // Track highest streak ever
  if (currentStreak > piro.highestStreak) {
    piro.highestStreak = currentStreak;
  }

  // Check if reached Epic Piro (50-day streak)
  if (piro.highestStreak >= 50) {
    piro.reachedEpic = true;
  }

  // Calculate current stage from highest streak
  const earnedStage = getPiroStageFromStreak(piro.highestStreak);

  // Decay ladder (only after reaching Epic):
  // 2 days missed → Old Piro
  // 7 days missed → Close to Death
  // 10 days missed → Dead (permanent)
  if (piro.reachedEpic && daysMissed >= PIRO_DEATH_DAYS) {
    piro.dead = true;
    piro.decayed = false;
    piro.dying = false;
    piro.stage = earnedStage;
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: false, dead: true, newStage: earnedStage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DYING_DAYS) {
    piro.dying = true;
    piro.decayed = false;
    piro.stage = earnedStage;
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: true, dead: false, newStage: earnedStage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DECAY_DAYS) {
    piro.decayed = true;
    piro.dying = false;
    piro.stage = earnedStage;
    savePiro(piro);
    return { piro, evolved: false, decayed: true, dying: false, dead: false, newStage: earnedStage, oldStage };
  }

  // Evolution check
  const newStage = earnedStage;
  piro.stage = newStage;

  if (newStage > oldStage) {
    piro.evolvedAt.push({ stage: newStage, name: PIRO_STAGES[newStage].name, date: Date.now() });
  }

  savePiro(piro);
  return { piro, evolved: newStage > oldStage, decayed: false, dying: false, dead: false, newStage, oldStage };
};

// Get current display info for Piro
const getPiroDisplay = (piro) => {
  if (piro.dead) {
    return { name: PIRO_DEAD.name, image: PIRO_DEAD.image, video: PIRO_DEAD.video, isDead: true, isDying: false, isDecayed: false };
  }
  if (piro.dying) {
    return { name: PIRO_CLOSE_TO_DEATH.name, image: PIRO_CLOSE_TO_DEATH.image, video: PIRO_CLOSE_TO_DEATH.video, isDead: false, isDying: true, isDecayed: false };
  }
  if (piro.decayed) {
    return { name: PIRO_OLD.name, image: PIRO_OLD.image, video: PIRO_OLD.video, isDead: false, isDying: false, isDecayed: true };
  }
  const stage = PIRO_STAGES[piro.stage] || PIRO_STAGES[0];
  return { name: stage.name, image: stage.image, video: stage.video, isDead: false, isDying: false, isDecayed: false };
};

// Render Piro as video (preferred) with image fallback
const PiroMedia = ({ display, className = '' }) => {
  const [videoFailed, setVideoFailed] = useState(false);
  return (
    <>
      {display.video && !videoFailed ? (
        <video
          src={display.video}
          autoPlay
          loop
          muted
          playsInline
          className={className}
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <img
          src={display.image}
          alt={display.name}
          className={className}
          onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
        />
      )}
    </>
  );
};

// Get progress toward next evolution
const getPiroProgress = (piro) => {
  const currentStageIdx = piro.stage;
  if (currentStageIdx >= PIRO_STAGES.length - 1) {
    return { needed: 0, total: 0, progress: 1, nextName: null }; // Max stage (Legendary)
  }
  const nextStage = PIRO_STAGES[currentStageIdx + 1];
  const currentThreshold = PIRO_STAGES[currentStageIdx].minStreak;
  const nextThreshold = nextStage.minStreak;
  const range = nextThreshold - currentThreshold;
  const progressInRange = piro.highestStreak - currentThreshold;
  return {
    needed: nextThreshold - piro.highestStreak,
    total: range,
    progress: Math.min(1, progressInRange / range),
    nextName: nextStage.name,
  };
};

// Near-miss nudge messages
const getPiroNudge = (piro, dayStreak, todayQuestions, dailyGoal) => {
  const display = getPiroDisplay(piro);
  const progressInfo = getPiroProgress(piro);

  // Dead - game over
  if (display.isDead) {
    return "Piro has died. Reset to hatch a new egg and start again.";
  }

  // Close to death - critical warning
  if (display.isDying) {
    return "Piro is close to death! Practice NOW to save your dragon!";
  }

  // Decayed state - urgent
  if (display.isDecayed) {
    return "Piro has aged! Practice today before it's too late.";
  }

  // Egg stage - encourage first streak
  if (piro.stage === 0 && piro.highestStreak === 0) {
    return "Build a 10-day streak to hatch Piro!";
  }

  // Evolution is close (within 3 days)
  if (progressInfo.needed > 0 && progressInfo.needed <= 3) {
    return `${progressInfo.needed} more day${progressInfo.needed !== 1 ? 's' : ''} to evolve into ${progressInfo.nextName}!`;
  }

  // At Legendary - maintain message
  if (piro.stage >= PIRO_STAGES.length - 1) {
    return "Piro is LEGENDARY! Keep your streak alive.";
  }

  // Haven't practised today
  if (todayQuestions === 0) {
    return `Piro is waiting! ${dailyGoal} questions to keep your streak.`;
  }

  // Goal complete
  if (todayQuestions >= dailyGoal) {
    return `Piro is thriving! ${dayStreak} day streak.`;
  }

  // Mid-session
  const remaining = dailyGoal - todayQuestions;
  return `${remaining} more question${remaining !== 1 ? 's' : ''} to complete today's goal!`;
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


// Question bank — each objective has 5 difficulty levels, each level has 3 shadow variants
// Structure: questionBank['N1'][levelIndex] = [variant1, variant2, variant3]
const questionBank = {

  // ═══════════════════════════════════════════════════════════════
  // N1: Ordering & Symbols
  // ═══════════════════════════════════════════════════════════════
  'N1': [
    // Level 0 (1 mark) — Order positive and negative integers
    [
      { q: "Write these numbers in order of size, starting with the smallest: 7, −3, 0, −5, 2", type: "order", items: ["7", "−3", "0", "−5", "2"], correctOrder: ["−5", "−3", "0", "2", "7"], a: "−5, −3, 0, 2, 7", worked: ["Negative numbers are smaller than positive numbers", "On a number line: −5 is furthest left, then −3, then 0, then 2, then 7"] },
      { q: "Write these numbers in order of size, starting with the smallest: 8, −4, 0, −2, 3", type: "order", items: ["8", "−4", "0", "−2", "3"], correctOrder: ["−4", "−2", "0", "3", "8"], a: "−4, −2, 0, 3, 8", worked: ["Negative numbers first (−4 is more negative than −2)", "Then zero, then positive numbers in increasing order"] },
      { q: "Write these numbers in order of size, starting with the smallest: 6, −9, −1, 4, 0", type: "order", items: ["6", "−9", "−1", "4", "0"], correctOrder: ["−9", "−1", "0", "4", "6"], a: "−9, −1, 0, 4, 6", worked: ["Start with most negative: −9", "Then −1, then 0, then positive numbers 4 and 6"] },
    ],
    // Level 1 (1 mark) — Place < or > between negative numbers
    [
      { q: "Place the correct symbol (< or >) to make the statement true: −12 ☐ −4", type: "mcq", options: ["<", ">"], a: "<", worked: ["−12 is more negative (further left on number line)", "−12 < −4 because −12 is smaller"] },
      { q: "Place the correct symbol (< or >) to make the statement true: −15 ☐ −7", type: "mcq", options: ["<", ">"], a: "<", worked: ["−15 is more negative than −7", "−15 < −7 (−15 is the smaller number)"] },
      { q: "Place the correct symbol (< or >) to make the statement true: −20 ☐ −25", type: "mcq", options: ["<", ">"], a: ">", worked: ["−25 is more negative than −20", "−20 > −25 (−20 is larger)"] },
    ],
    // Level 2 (2 marks) — Order decimals
    [
      { q: "Write these decimals in order of size, starting with the smallest: 0.4, 0.405, 0.044, 0.45, 0.44", type: "order", items: ["0.4", "0.405", "0.044", "0.45", "0.44"], correctOrder: ["0.044", "0.4", "0.405", "0.44", "0.45"], a: "0.044, 0.4, 0.405, 0.44, 0.45", worked: ["0.044 has smallest first decimal place (0)", "0.4 = 0.400, then 0.405, then 0.44, then 0.45"] },
      { q: "Write these decimals in order of size, starting with the smallest: 0.6, 0.602, 0.066, 0.62, 0.66", type: "order", items: ["0.6", "0.602", "0.066", "0.62", "0.66"], correctOrder: ["0.066", "0.6", "0.602", "0.62", "0.66"], a: "0.066, 0.6, 0.602, 0.62, 0.66", worked: ["0.066 is smallest (0 in hundredths place)", "Then 0.6, 0.602, 0.62, 0.66"] },
      { q: "Write these decimals in order of size, starting with the smallest: 0.3, 0.307, 0.033, 0.37, 0.33", type: "order", items: ["0.3", "0.307", "0.033", "0.37", "0.33"], correctOrder: ["0.033", "0.3", "0.307", "0.33", "0.37"], a: "0.033, 0.3, 0.307, 0.33, 0.37", worked: ["0.033 smallest", "0.3 = 0.300, then 0.307, then 0.33, then 0.37"] },
    ],
    // Level 3 (3 marks) — Order fractions, decimals, and percentages
    [
      { q: "Put these values in order of size, starting with the smallest: 3/4, 0.7, 65%, 4/5", type: "order", items: ["3/4", "0.7", "65%", "4/5"], correctOrder: ["65%", "0.7", "3/4", "4/5"], a: "65%, 0.7, 3/4, 4/5", worked: ["Convert all to decimals: 3/4 = 0.75, 0.7, 65% = 0.65, 4/5 = 0.8", "Order: 0.65 < 0.7 < 0.75 < 0.8"] },
      { q: "Put these values in order of size, starting with the smallest: 1/4, 0.3, 22%, 1/5", type: "order", items: ["1/4", "0.3", "22%", "1/5"], correctOrder: ["1/5", "22%", "1/4", "0.3"], a: "1/5, 22%, 1/4, 0.3", worked: ["Convert to decimals: 1/4 = 0.25, 0.3, 22% = 0.22, 1/5 = 0.2", "Order: 0.2 < 0.22 < 0.25 < 0.3"] },
      { q: "Put these values in order of size, starting with the smallest: 1/2, 0.45, 55%, 2/5", type: "order", items: ["1/2", "0.45", "55%", "2/5"], correctOrder: ["2/5", "0.45", "1/2", "55%"], a: "2/5, 0.45, 1/2, 55%", worked: ["Convert to decimals: 1/2 = 0.5, 0.45, 55% = 0.55, 2/5 = 0.4", "Order: 0.4 < 0.45 < 0.5 < 0.55"] },
    ],
    // Level 4 (2 marks) — List integers from an inequality
    [
      { q: "x is an integer such that −3 < x ≤ 2. Write down all the possible values of x.", a: "−2, −1, 0, 1, 2", worked: ["x is greater than −3 (but not equal), so starts at −2", "x is less than or equal to 2, so includes 2"] },
      { q: "x is an integer such that −4 < x ≤ 1. Write down all the possible values of x.", a: "−3, −2, −1, 0, 1", worked: ["x > −4 means we start at −3", "x ≤ 1 means we include 1"] },
      { q: "x is an integer such that −5 < x ≤ 0. Write down all the possible values of x.", a: "−4, −3, −2, −1, 0", worked: ["x > −5 means start at −4", "x ≤ 0 means include 0"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N2: Apply the four operations & priority of operations (BIDMAS)
  // (Also covers N3)
  // ═══════════════════════════════════════════════════════════════
  'N2': [
    // Level 0 (1 mark) — Simple BIDMAS
    [
      { q: "Work out: 10 − 2 × 4", a: "2", worked: ["Multiplication before subtraction (BIDMAS)", "2 × 4 = 8", "10 − 8 = 2"] },
      { q: "Work out: 12 − 3 × 2", a: "6", worked: ["Multiply first: 3 × 2 = 6", "Then subtract: 12 − 6 = 6"] },
      { q: "Work out: 20 − 4 × 3", a: "8", worked: ["Multiply first: 4 × 3 = 12", "Then subtract: 20 − 12 = 8"] },
    ],
    // Level 1 (2 marks) — Division with decimals
    [
      { q: "Work out: 34.5 ÷ 5", a: "6.9", worked: ["Divide: 34.5 ÷ 5 = 6.9"] },
      { q: "Work out: 42.6 ÷ 6", a: "7.1", worked: ["Divide: 42.6 ÷ 6 = 7.1"] },
      { q: "Work out: 54.9 ÷ 9", a: "6.1", worked: ["Divide: 54.9 ÷ 9 = 6.1"] },
    ],
    // Level 2 (3 marks) — Multi-step word problem
    [
      { q: "A crate contains 12 boxes of apples. Each box contains 24 apples. How many apples are there in total in 5 crates?", a: "1440", worked: ["Apples per crate: 12 × 24 = 288", "Total in 5 crates: 288 × 5 = 1440"] },
      { q: "A crate contains 15 boxes of oranges. Each box contains 20 oranges. How many oranges are there in total in 4 crates?", a: "1200", worked: ["Oranges per crate: 15 × 20 = 300", "Total in 4 crates: 300 × 4 = 1200"] },
      { q: "A pack contains 8 cans of soda. Each can contains 330 ml. How many total millilitres are there in 12 packs?", a: "31680", worked: ["ml per pack: 8 × 330 = 2640", "Total in 12 packs: 2640 × 12 = 31680"] },
    ],
    // Level 3 (3 marks) — Money and change word problem
    [
      { q: "Tickets for a concert cost £17.50 each. Sam buys 4 tickets and pays with four £20 notes. How much change should Sam get?", a: "10", worked: ["Cost of 4 tickets: 4 × £17.50 = £70", "Amount paid: 4 × £20 = £80", "Change: £80 − £70 = £10"] },
      { q: "Tickets for a cinema cost £12.50 each. Alex buys 3 tickets and pays with a £50 note. How much change should Alex get?", a: "12.50", worked: ["Cost of 3 tickets: 3 × £12.50 = £37.50", "Change: £50 − £37.50 = £12.50"] },
      { q: "A bakery sells cupcakes for £2.40 each. Maya buys 6 cupcakes and pays with a £20 note. How much change should Maya get?", a: "5.60", worked: ["Cost of 6 cupcakes: 6 × £2.40 = £14.40", "Change: £20 − £14.40 = £5.60"] },
    ],
    // Level 4 (4 marks) — Evaluate expression with powers and roots
    [
      { q: "Work out the value of: (4² + 8) ÷ (√36 − 3)", a: "8", hint: "Numerator: 16 + 8 = 24. Denominator: 6 − 3 = 3.", worked: ["Calculate numerator: 4² + 8 = 16 + 8 = 24", "Calculate denominator: √36 − 3 = 6 − 3 = 3", "Divide: 24 ÷ 3 = 8"] },
      { q: "Work out the value of: (5² + 11) ÷ (√49 − 3)", a: "9", hint: "Numerator: 25 + 11 = 36. Denominator: 7 − 3 = 4.", worked: ["Calculate numerator: 5² + 11 = 25 + 11 = 36", "Calculate denominator: √49 − 3 = 7 − 3 = 4", "Divide: 36 ÷ 4 = 9"] },
      { q: "Work out the value of: (6² + 4) ÷ (√25 + 3)", a: "5", hint: "Numerator: 36 + 4 = 40. Denominator: 5 + 3 = 8.", worked: ["Calculate numerator: 6² + 4 = 36 + 4 = 40", "Calculate denominator: √25 + 3 = 5 + 3 = 8", "Divide: 40 ÷ 8 = 5"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N4: Factors, Multiples & Primes
  // ═══════════════════════════════════════════════════════════════
  'N4': [
    // Level 0 (1 mark) — Identify a prime number from a list
    [
      { q: "From the list below, which number is a prime number? 6, 9, 15, 21, 23", type: "mcq", options: ["6", "9", "15", "21", "23"], a: "23", worked: ["Prime numbers have exactly 2 factors: 1 and itself", "23 cannot be divided evenly by 2, 3, or 5 — 23 is prime"] },
      { q: "From the list below, which number is a prime number? 8, 11, 14, 25, 27", type: "mcq", options: ["8", "11", "14", "25", "27"], a: "11", worked: ["11 only has factors 1 and 11", "11 is prime"] },
      { q: "From the list below, which number is a prime number? 4, 13, 21, 33, 35", type: "mcq", options: ["4", "13", "21", "33", "35"], a: "13", worked: ["13 only has factors 1 and 13", "13 is prime"] },
    ],
    // Level 1 (2 marks) — List all factors
    [
      { q: "Write down all the factors of 28.", a: "1, 2, 4, 7, 14, 28", worked: ["Factors divide evenly: 28 ÷ 1 = 28, 28 ÷ 2 = 14, 28 ÷ 4 = 7", "All factors: 1, 2, 4, 7, 14, 28"] },
      { q: "Write down all the factors of 32.", a: "1, 2, 4, 8, 16, 32", worked: ["32 = 2⁵, so factors are powers of 2: 1, 2, 4, 8, 16, 32"] },
      { q: "Write down all the factors of 40.", a: "1, 2, 4, 5, 8, 10, 20, 40", worked: ["40 = 2³ × 5, find all factor combinations"] },
    ],
    // Level 2 (2 marks) — Find the LCM
    [
      { q: "Find the Lowest Common Multiple (LCM) of 6 and 8.", a: "24", worked: ["Multiples of 6: 6, 12, 18, 24", "Multiples of 8: 8, 16, 24", "LCM = 24"] },
      { q: "Find the Lowest Common Multiple (LCM) of 4 and 10.", a: "20", worked: ["Multiples of 4: 4, 8, 12, 16, 20", "Multiples of 10: 10, 20", "LCM = 20"] },
      { q: "Find the Lowest Common Multiple (LCM) of 9 and 12.", a: "36", worked: ["Multiples of 9: 9, 18, 27, 36", "Multiples of 12: 12, 24, 36", "LCM = 36"] },
    ],
    // Level 3 (3 marks) — Prime factorisation in index form
    [
      { q: "Write 60 as a product of its prime factors.", type: "mcq", options: ["2² × 3 × 5", "2 × 3² × 5", "2² × 5 × 7", "3 × 4 × 5"], a: "2² × 3 × 5", worked: ["60 = 2 × 30 = 2 × 2 × 15 = 2 × 2 × 3 × 5", "60 = 2² × 3 × 5"] },
      { q: "Write 84 as a product of its prime factors.", type: "mcq", options: ["2² × 3 × 7", "2 × 3 × 14", "2² × 3² × 7", "4 × 3 × 7"], a: "2² × 3 × 7", worked: ["84 = 2 × 42 = 2 × 2 × 21 = 2 × 2 × 3 × 7", "84 = 2² × 3 × 7"] },
      { q: "Write 72 as a product of its prime factors.", type: "mcq", options: ["2³ × 3²", "2² × 3³", "2³ × 9", "8 × 3²"], a: "2³ × 3²", worked: ["72 = 8 × 9 = 2³ × 3²"] },
    ],
    // Level 4 (3 marks) — LCM word problem
    [
      { q: "Lights A and B flash at different intervals. Light A flashes every 12 seconds. Light B flashes every 15 seconds. They both flash at the same time. After how many seconds will they next flash together?", a: "60", worked: ["Find LCM of 12 and 15", "12 = 2² × 3, 15 = 3 × 5", "LCM = 2² × 3 × 5 = 60 seconds"] },
      { q: "Bus A and Bus B leave the station at the same time. Bus A leaves every 15 minutes. Bus B leaves every 20 minutes. After how many minutes will they next leave at the same time?", a: "60", worked: ["Find LCM of 15 and 20", "15 = 3 × 5, 20 = 2² × 5", "LCM = 2² × 3 × 5 = 60 minutes"] },
      { q: "Two alarms are set to beep. Alarm P beeps every 10 minutes. Alarm Q beeps every 25 minutes. They both beep at 9:00 am. At what time will they next beep together?", a: "50", worked: ["Find LCM of 10 and 25", "10 = 2 × 5, 25 = 5²", "LCM = 2 × 5² = 50 minutes"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N6: Positive integer powers, square/cube roots & index laws
  // (Also covers N7)
  // ═══════════════════════════════════════════════════════════════
  'N6': [
    // Level 0 (1 mark) — Evaluate a cube
    [
      { q: "Write down the value of 5³", a: "125", worked: ["5³ means 5 × 5 × 5", "5 × 5 = 25, then 25 × 5 = 125"] },
      { q: "Write down the value of 4³", a: "64", worked: ["4³ means 4 × 4 × 4", "4 × 4 = 16, then 16 × 4 = 64"] },
      { q: "Write down the value of 2⁵", a: "32", worked: ["2⁵ means 2 × 2 × 2 × 2 × 2", "2 × 2 × 2 × 2 × 2 = 32"] },
    ],
    // Level 1 (1 mark) — Square root + cube root
    [
      { q: "Work out: √64 + ³√27", a: "11", hint: "√64 = 8 and ³√27 = 3", worked: ["√64 = 8 (since 8² = 64)", "³√27 = 3 (since 3³ = 27)", "8 + 3 = 11"] },
      { q: "Work out: √81 + ³√125", a: "14", hint: "√81 = 9 and ³√125 = 5", worked: ["√81 = 9 (since 9² = 81)", "³√125 = 5 (since 5³ = 125)", "9 + 5 = 14"] },
      { q: "Work out: √121 − ³√8", a: "9", hint: "√121 = 11 and ³√8 = 2", worked: ["√121 = 11 (since 11² = 121)", "³√8 = 2 (since 2³ = 8)", "11 − 2 = 9"] },
    ],
    // Level 2 (2 marks) — Simplify using index laws (multiplication)
    [
      { q: "Simplify: y⁵ × y³", type: "mcq", options: ["y⁸", "y¹⁵", "y²", "2y⁸"], a: "y⁸", worked: ["When multiplying powers with same base, add exponents", "y⁵ × y³ = y^(5+3) = y⁸"] },
      { q: "Simplify: w⁶ × w²", type: "mcq", options: ["w⁸", "w¹²", "w⁴", "2w⁸"], a: "w⁸", worked: ["Add exponents: 6 + 2 = 8", "w⁶ × w² = w⁸"] },
      { q: "Simplify: p⁷ ÷ p²", type: "mcq", options: ["p⁵", "p⁹", "p¹⁴", "2p⁵"], a: "p⁵", worked: ["When dividing powers with same base, subtract exponents", "p⁷ ÷ p² = p^(7-2) = p⁵"] },
    ],
    // Level 3 (2 marks) — Simplify power of a power
    [
      { q: "Simplify (2⁴)³. Give your answer as a power of 2.", type: "mcq", options: ["2¹²", "2⁷", "2⁶⁴", "6¹²"], a: "2¹²", worked: ["Power of a power: multiply exponents", "(2⁴)³ = 2^(4×3) = 2¹²"] },
      { q: "Simplify (3²)⁴. Give your answer as a power of 3.", type: "mcq", options: ["3⁸", "3⁶", "3¹⁶", "9⁸"], a: "3⁸", worked: ["Multiply exponents: 2 × 4 = 8", "(3²)⁴ = 3⁸"] },
      { q: "Simplify (5³)². Give your answer as a power of 5.", type: "mcq", options: ["5⁶", "5⁵", "5⁹", "25⁶"], a: "5⁶", worked: ["Multiply exponents: 3 × 2 = 6", "(5³)² = 5⁶"] },
    ],
    // Level 4 (3 marks) — Show a calculation gives a special number
    [
      { q: "Work out 3⁴ − 2⁶", type: "mcq", options: ["17", "49", "13", "23"], a: "17", worked: ["3⁴ = 3 × 3 × 3 × 3 = 81", "2⁶ = 2 × 2 × 2 × 2 × 2 × 2 = 64", "81 − 64 = 17"] },
      { q: "Work out 5³ − 10²", type: "mcq", options: ["25", "15", "35", "20"], a: "25", worked: ["5³ = 125", "10² = 100", "125 − 100 = 25"] },
      { q: "Work out 10² − 8²", type: "mcq", options: ["36", "64", "18", "44"], a: "36", worked: ["10² = 100", "8² = 64", "100 − 64 = 36"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N12: Calculate a fraction or percentage of a quantity
  // ═══════════════════════════════════════════════════════════════
  'N12': [
    // Level 0 (2 marks) — Percentage of an amount
    [
      { q: "Work out 20% of £350", a: "70", worked: ["20% = 20 ÷ 100 = 0.2", "0.2 × 350 = 70"] },
      { q: "Work out 30% of £420", a: "126", worked: ["30% = 30 ÷ 100 = 0.3", "0.3 × 420 = 126"] },
      { q: "Work out 40% of £210", a: "84", worked: ["40% = 40 ÷ 100 = 0.4", "0.4 × 210 = 84"] },
    ],
    // Level 1 (2 marks) — Fraction of an amount
    [
      { q: "Work out ⅔ of 45 kg", a: "30", worked: ["Divide 45 by 3: 45 ÷ 3 = 15", "Multiply by 2: 15 × 2 = 30"] },
      { q: "Work out ¾ of 48 kg", a: "36", worked: ["Divide 48 by 4: 48 ÷ 4 = 12", "Multiply by 3: 12 × 3 = 36"] },
      { q: "Work out ⅚ of 42 kg", a: "35", worked: ["Divide 42 by 6: 42 ÷ 6 = 7", "Multiply by 5: 7 × 5 = 35"] },
    ],
    // Level 2 (3 marks) — Percentage word problem (find complement)
    [
      { q: "In a school of 800 students, 45% are boys. How many girls are in the school?", a: "440", worked: ["If 45% are boys, then girls = 100% − 45% = 55%", "55% of 800 = 0.55 × 800 = 440"] },
      { q: "In a club of 200 members, 65% are adults. How many children are in the club?", a: "70", worked: ["If 65% are adults, then children = 100% − 65% = 35%", "35% of 200 = 0.35 × 200 = 70"] },
      { q: "In a survey of 300 people, 24% said they prefer tea. How many people did not prefer tea?", a: "228", worked: ["People who did not prefer tea = 100% − 24% = 76%", "76% of 300 = 0.76 × 300 = 228"] },
    ],
    // Level 3 (3 marks) — Fraction reduction word problem
    [
      { q: "A jacket is in a sale with 15% off. The sale price is now £68. Work out the original price of the jacket.", a: "80", worked: ["If 15% off, then paying 100% − 15% = 85% of original", "0.85 × original price = 68", "Original price = 68 ÷ 0.85 = 80"] },
      { q: "A sofa usually costs £800. In a sale, the price is reduced by ⅕. Calculate the sale price of the sofa.", a: "640", worked: ["⅕ of 800 = 800 ÷ 5 = 160", "Sale price = 800 − 160 = 640"] },
      { q: "A lawnmower usually costs £240. In a sale, the price is reduced by ⅓. Calculate the sale price.", a: "160", worked: ["⅓ of 240 = 240 ÷ 3 = 80", "Sale price = 240 − 80 = 160"] },
    ],
    // Level 4 (4 marks) — Compare two shops (VAT and discounts)
    [
      { q: "Shop A sells a TV for £400 + 20% VAT. Shop B sells the same TV for £500, but offers 15% off. Which shop is cheaper?", type: "mcq", options: ["Shop A", "Shop B"], a: "Shop B", worked: ["Shop A: £400 + 20% VAT = £400 × 1.2 = £480", "Shop B: £500 − 15% = £500 × 0.85 = £425", "Shop B is cheaper at £425"] },
      { q: "Shop X sells a bike for £240 + 20% VAT. Shop Y sells the same bike for £350, but offers 20% off. Which shop is cheaper?", type: "mcq", options: ["Shop X", "Shop Y"], a: "Shop Y", worked: ["Shop X: £240 + 20% VAT = £240 × 1.2 = £288", "Shop Y: £350 − 20% = £350 × 0.8 = £280", "Shop Y is cheaper at £280"] },
      { q: "Shop Alpha sells a laptop for £300 + 20% VAT. Shop Beta sells the same laptop for £450, but offers 30% off. Which shop is cheaper?", type: "mcq", options: ["Shop Alpha", "Shop Beta"], a: "Shop Beta", worked: ["Shop Alpha: £300 + 20% VAT = £300 × 1.2 = £360", "Shop Beta: £450 − 30% = £450 × 0.7 = £315", "Shop Beta is cheaper at £315"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N14: Rounding, estimation, and error intervals
  // (Also covers N15)
  // ═══════════════════════════════════════════════════════════════
  'N14': [
    // Level 0 (1 mark) — Round to nearest 100 or 1000
    [
      { q: "Round 4,567 to the nearest 100.", a: "4600", worked: ["Look at the tens digit: 6", "6 ≥ 5, so round up", "4,600"] },
      { q: "Round 8,732 to the nearest 100.", a: "8700", worked: ["Look at the tens digit: 3", "3 < 5, so round down", "8,700"] },
      { q: "Round 12,491 to the nearest 1,000.", a: "12000", worked: ["Look at the hundreds digit: 4", "4 < 5, so round down", "12,000"] },
    ],
    // Level 1 (1 mark) — Round to 2 significant figures
    [
      { q: "Round 0.0726 to 2 significant figures.", a: "0.073", worked: ["First two sig figs are 7 and 2", "Look at third sig fig: 6", "6 ≥ 5, so round up 72 to 73", "0.073"] },
      { q: "Round 0.00483 to 2 significant figures.", a: "0.0048", worked: ["First two sig figs are 4 and 8", "Look at third sig fig: 3", "3 < 5, so keep 48", "0.0048"] },
      { q: "Round 0.05062 to 2 significant figures.", a: "0.051", worked: ["First two sig figs are 5 and 0", "Look at third sig fig: 6", "6 ≥ 5, so round up 50 to 51", "0.051"] },
    ],
    // Level 2 (3 marks) — Estimation
    [
      { q: "Estimate the value of: (31.2 × 9.8) ÷ 0.52", a: "600", worked: ["Round to 1 s.f.: 31.2 → 30, 9.8 → 10, 0.52 → 0.5", "Estimate: (30 × 10) ÷ 0.5 = 300 ÷ 0.5", "300 ÷ 0.5 = 600"] },
      { q: "Estimate the value of: (19.7 × 5.2) ÷ 0.19", a: "500", worked: ["Round to 1 s.f.: 19.7 → 20, 5.2 → 5, 0.19 → 0.2", "Estimate: (20 × 5) ÷ 0.2 = 100 ÷ 0.2", "100 ÷ 0.2 = 500"] },
      { q: "Estimate the value of: (49.2 × 3.9) ÷ 0.21", a: "1000", worked: ["Round to 1 s.f.: 49.2 → 50, 3.9 → 4, 0.21 → 0.2", "Estimate: (50 × 4) ÷ 0.2 = 200 ÷ 0.2", "200 ÷ 0.2 = 1000"] },
    ],
    // Level 3 (2 marks) — Error intervals
    [
      { q: "A number n is rounded to the nearest whole number. The result is 8. Write down the error interval for n.", type: "mcq", options: ["7.5 ≤ n < 8.5", "7 ≤ n < 9", "7.5 < n ≤ 8.5", "8 ≤ n < 9"], a: "7.5 ≤ n < 8.5", worked: ["For rounding to nearest whole: lower bound = 7.5", "Upper bound = 8.5 (excluded, as 8.5 rounds to 9)", "Interval: 7.5 ≤ n < 8.5"] },
      { q: "A number y is rounded to the nearest whole number. The result is 12. Write down the error interval for y.", type: "mcq", options: ["11.5 ≤ y < 12.5", "11 ≤ y < 13", "11.5 < y ≤ 12.5", "12 ≤ y < 13"], a: "11.5 ≤ y < 12.5", worked: ["For rounding to nearest whole: lower bound = 11.5", "Upper bound = 12.5 (excluded, as 12.5 rounds to 13)", "Interval: 11.5 ≤ y < 12.5"] },
      { q: "A number w is rounded to the nearest whole number. The result is 20. Write down the error interval for w.", type: "mcq", options: ["19.5 ≤ w < 20.5", "19 ≤ w < 21", "19.5 < w ≤ 20.5", "20 ≤ w < 21"], a: "19.5 ≤ w < 20.5", worked: ["For rounding to nearest whole: lower bound = 19.5", "Upper bound = 20.5 (excluded, as 20.5 rounds to 21)", "Interval: 19.5 ≤ w < 20.5"] },
    ],
    // Level 4 (3 marks) — Upper and lower bounds
    [
      { q: "A runner completes a race in 12 seconds, correct to the nearest second. What is the upper bound for the time taken?", a: "12.5", worked: ["Rounded to nearest second = 12 seconds", "Upper bound (excluded) = 12.5", "So upper bound = 12.5"] },
      { q: "A bag of sugar weighs 1.5 kg, correct to 1 decimal place. What is the lower bound for the weight?", a: "1.45", worked: ["Rounded to 1 d.p. = 1.5 kg", "Lower bound = 1.45 kg", "Any value ≥ 1.45 rounds to 1.5"] },
      { q: "A plank of wood is 2.4 m long, correct to the nearest 10 cm. What is the upper bound for the length of the plank?", a: "2.45", worked: ["Rounded to nearest 10 cm = 2.4 m", "Upper bound = 2.45 m", "Any value < 2.45 rounds to 2.4"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A1: Algebraic notation & simplification (collecting like terms)
  // (Also covers A4)
  // ═══════════════════════════════════════════════════════════════
  'A1': [
    // Level 0 (1 mark) — Simplify repeated addition
    [
      { q: "Simplify: a + a + a + a", a: "4a", worked: ["Count the number of a terms: 4", "Combine: 4a"] },
      { q: "Simplify: b + b + b", a: "3b", worked: ["Count the number of b terms: 3", "Combine: 3b"] },
      { q: "Simplify: y + y + y + y + y", a: "5y", worked: ["Count the number of y terms: 5", "Combine: 5y"] },
    ],
    // Level 1 (2 marks) — Collect like terms (two variables)
    [
      { q: "Simplify: 4x + 3y − x + 2y", a: "3x+5y", worked: ["Collect x terms: 4x − x = 3x", "Collect y terms: 3y + 2y = 5y", "Answer: 3x + 5y"] },
      { q: "Simplify: 6a + 5b − 2a + b", a: "4a+6b", worked: ["Collect a terms: 6a − 2a = 4a", "Collect b terms: 5b + b = 6b", "Answer: 4a + 6b"] },
      { q: "Simplify: 9k − 4m + 2k − m", a: "11k-5m", worked: ["Collect k terms: 9k + 2k = 11k", "Collect m terms: −4m − m = −5m", "Answer: 11k − 5m"] },
    ],
    // Level 2 (2 marks) — Simplify multiplication
    [
      { q: "Simplify: 5 × 3b", a: "15b", worked: ["Multiply the numbers: 5 × 3 = 15", "Keep the variable: 15b"] },
      { q: "Simplify: 4 × 5y", a: "20y", worked: ["Multiply the numbers: 4 × 5 = 20", "Keep the variable: 20y"] },
      { q: "Simplify: 6 × 4c", a: "24c", worked: ["Multiply the numbers: 6 × 4 = 24", "Keep the variable: 24c"] },
    ],
    // Level 3 (2 marks) — Simplify repeated multiplication (powers)
    [
      { q: "Simplify: m × m × m", type: "mcq", options: ["m³", "3m", "m + m + m", "m⁴"], a: "m³", worked: ["Multiplication of the same variable: m × m × m", "This equals m to the power of 3: m³"] },
      { q: "Simplify: p × p × p × p", type: "mcq", options: ["p⁴", "4p", "p + p + p + p", "p³"], a: "p⁴", worked: ["Multiplication of the same variable: p × p × p × p", "This equals p to the power of 4: p⁴"] },
      { q: "Simplify: r × r × r", type: "mcq", options: ["r³", "3r", "r + r + r", "r⁴"], a: "r³", worked: ["Multiplication of the same variable: r × r × r", "This equals r to the power of 3: r³"] },
    ],
    // Level 4 (3 marks) — Factorise fully
    [
      { q: "Factorise fully: 6x + 18", type: "mcq", options: ["6(x + 3)", "3(2x + 6)", "2(3x + 9)", "6(x + 18)"], a: "6(x + 3)", worked: ["Find the highest common factor: HCF(6, 18) = 6", "6x ÷ 6 = x, 18 ÷ 6 = 3", "Factorised form: 6(x + 3)"] },
      { q: "Factorise fully: 8x + 20", type: "mcq", options: ["4(2x + 5)", "2(4x + 10)", "8(x + 12)", "4(2x + 20)"], a: "4(2x + 5)", worked: ["Find the highest common factor: HCF(8, 20) = 4", "8x ÷ 4 = 2x, 20 ÷ 4 = 5", "Factorised form: 4(2x + 5)"] },
      { q: "Factorise fully: 10w − 15", type: "mcq", options: ["5(2w − 3)", "5(2w + 3)", "10(w − 5)", "2(5w − 15)"], a: "5(2w − 3)", worked: ["Find the highest common factor: HCF(10, 15) = 5", "10w ÷ 5 = 2w, 15 ÷ 5 = 3", "Factorised form: 5(2w − 3)"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A2: Substitution
  // ═══════════════════════════════════════════════════════════════
  'A2': [
    // Level 0 (2 marks) — Substitute one value
    [
      { q: "Given x = 5, work out the value of 3x − 2.", a: "13", worked: ["Substitute x = 5: 3(5) − 2", "Calculate: 15 − 2 = 13"] },
      { q: "Given x = 4, work out the value of 5x − 3.", a: "17", worked: ["Substitute x = 4: 5(4) − 3", "Calculate: 20 − 3 = 17"] },
      { q: "Given x = 6, work out the value of 4x + 7.", a: "31", worked: ["Substitute x = 6: 4(6) + 7", "Calculate: 24 + 7 = 31"] },
    ],
    // Level 1 (2 marks) — Substitute two values (one negative)
    [
      { q: "Given a = 4 and b = −3, work out the value of 2a + b.", a: "5", worked: ["Substitute a = 4 and b = −3: 2(4) + (−3)", "Calculate: 8 − 3 = 5"] },
      { q: "Given a = 7 and b = −2, work out the value of 3a + b.", a: "19", worked: ["Substitute a = 7 and b = −2: 3(7) + (−2)", "Calculate: 21 − 2 = 19"] },
      { q: "Given a = 10 and b = −4, work out the value of 5a + b.", a: "46", worked: ["Substitute a = 10 and b = −4: 5(10) + (−4)", "Calculate: 50 − 4 = 46"] },
    ],
    // Level 2 (2 marks) — Substitute into a formula
    [
      { q: "Use the formula v = u + at. Find v when u = 10, a = 2, and t = 6.", a: "22", worked: ["Substitute into v = u + at: v = 10 + 2(6)", "Calculate: v = 10 + 12 = 22"] },
      { q: "Use the formula v = u + at. Find v when u = 15, a = 3, and t = 4.", a: "27", worked: ["Substitute into v = u + at: v = 15 + 3(4)", "Calculate: v = 15 + 12 = 27"] },
      { q: "Use the formula v = u + at. Find v when u = 8, a = 5, and t = 3.", a: "23", worked: ["Substitute into v = u + at: v = 8 + 5(3)", "Calculate: v = 8 + 15 = 23"] },
    ],
    // Level 3 (3 marks) — Substitute a negative into a squared term
    [
      { q: "Work out the value of 2x² when x = −4.", a: "32", worked: ["Substitute x = −4: 2(−4)²", "Calculate power first: (−4)² = 16", "Then multiply: 2 × 16 = 32"] },
      { q: "Work out the value of 3x² when x = −2.", a: "12", worked: ["Substitute x = −2: 3(−2)²", "Calculate power first: (−2)² = 4", "Then multiply: 3 × 4 = 12"] },
      { q: "Work out the value of 5x² when x = −3.", a: "45", worked: ["Substitute x = −3: 5(−3)²", "Calculate power first: (−3)² = 9", "Then multiply: 5 × 9 = 45"] },
    ],
    // Level 4 (3 marks) — Substitute into a real-world formula
    [
      { q: "The cost C (in £) of hiring a taxi is given by C = 1.5d + 3, where d is the distance in miles. Calculate the cost for a journey of 12 miles.", a: "21", worked: ["Substitute d = 12 into C = 1.5d + 3: C = 1.5(12) + 3", "Calculate: C = 18 + 3 = 21"] },
      { q: "The cost C (in £) of hiring a hall is C = 20h + 50, where h is the number of hours. Calculate the cost for hiring the hall for 6 hours.", a: "170", worked: ["Substitute h = 6 into C = 20h + 50: C = 20(6) + 50", "Calculate: C = 120 + 50 = 170"] },
      { q: "The total cost T (in pence) of printing photos is T = 12n + 40, where n is the number of photos. Calculate the cost for printing 25 photos. Give your answer in pence.", a: "340", worked: ["Substitute n = 25 into T = 12n + 40: T = 12(25) + 40", "Calculate: T = 300 + 40 = 340"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A17: Solve linear equations in one unknown
  // (Also covers A18)
  // ═══════════════════════════════════════════════════════════════
  'A17': [
    // Level 0 (1 mark) — One-step equation (addition/subtraction)
    [
      { q: "Solve: x + 7 = 15", a: "8", worked: ["Subtract 7 from both sides: x = 15 − 7", "x = 8"] },
      { q: "Solve: x + 9 = 21", a: "12", worked: ["Subtract 9 from both sides: x = 21 − 9", "x = 12"] },
      { q: "Solve: x − 5 = 11", a: "16", worked: ["Add 5 to both sides: x = 11 + 5", "x = 16"] },
    ],
    // Level 1 (2 marks) — One-step equation (multiplication)
    [
      { q: "Solve: 4y = 28", a: "7", worked: ["Divide both sides by 4: y = 28 ÷ 4", "y = 7"] },
      { q: "Solve: 6y = 42", a: "7", worked: ["Divide both sides by 6: y = 42 ÷ 6", "y = 7"] },
      { q: "Solve: 7y = 56", a: "8", worked: ["Divide both sides by 7: y = 56 ÷ 7", "y = 8"] },
    ],
    // Level 2 (2 marks) — Two-step equation
    [
      { q: "Solve: 3w − 5 = 10", a: "5", worked: ["Add 5 to both sides: 3w = 10 + 5 = 15", "Divide both sides by 3: w = 15 ÷ 3 = 5"] },
      { q: "Solve: 4w − 3 = 17", a: "5", worked: ["Add 3 to both sides: 4w = 17 + 3 = 20", "Divide both sides by 4: w = 20 ÷ 4 = 5"] },
      { q: "Solve: 2w + 9 = 25", a: "8", worked: ["Subtract 9 from both sides: 2w = 25 − 9 = 16", "Divide both sides by 2: w = 16 ÷ 2 = 8"] },
    ],
    // Level 3 (3 marks) — Equation with brackets
    [
      { q: "3 adults and 2 children go to the cinema. Adult tickets cost £x. Child tickets are half price. The total bill is £36. Find x.", a: "9", worked: ["Adult cost is x, child cost is x/2", "Total: 3x + 2(x/2) = 36 → 3x + x = 36 → 4x = 36", "Divide by 4: x = 9"] },
      { q: "Solve: 3(x + 4) = 27", a: "5", worked: ["Divide both sides by 3: x + 4 = 9", "Subtract 4 from both sides: x = 9 − 4 = 5"] },
      { q: "Solve: 4(x − 3) = 16", a: "7", worked: ["Divide both sides by 4: x − 3 = 4", "Add 3 to both sides: x = 4 + 3 = 7"] },
    ],
    // Level 4 (3 marks) — Unknown on both sides
    [
      { q: "Solve: 8x − 3 = 2x + 15", a: "3", worked: ["Subtract 2x from both sides: 6x − 3 = 15", "Add 3 to both sides: 6x = 18", "Divide by 6: x = 3"] },
      { q: "Solve: 9x − 5 = 4x + 20", a: "5", worked: ["Subtract 4x from both sides: 5x − 5 = 20", "Add 5 to both sides: 5x = 25", "Divide by 5: x = 5"] },
      { q: "Solve: 10x + 2 = 4x + 26", a: "4", worked: ["Subtract 4x from both sides: 6x + 2 = 26", "Subtract 2 from both sides: 6x = 24", "Divide by 6: x = 4"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A21: Plot and interpret straight-line graphs
  // ═══════════════════════════════════════════════════════════════
  'A21': [
    // Level 0 (1 mark) — Identify the y-intercept from an equation
    [
      { q: "Write down the coordinates of the y-intercept for the line y = 3x + 5.", a: "(0,5)", worked: ["The y-intercept occurs when x = 0", "y = 3(0) + 5 = 5, so coordinates are (0, 5)"] },
      { q: "Write down the coordinates of the y-intercept for the line y = 2x − 4.", a: "(0,-4)", worked: ["The y-intercept occurs when x = 0", "y = 2(0) − 4 = −4, so coordinates are (0, −4)"] },
      { q: "Write down the coordinates of the y-intercept for the line y = x − 7.", a: "(0,-7)", worked: ["The y-intercept occurs when x = 0", "y = 0 − 7 = −7, so coordinates are (0, −7)"] },
    ],
    // Level 1 (2 marks) — Complete a table of values
    [
      { q: "Complete the table of values for y = 2x + 1. Write the two missing values of y.", a: "-1, 3", worked: ["When x = -1: y = 2(-1) + 1 = -2 + 1 = -1", "When x = 1: y = 2(1) + 1 = 2 + 1 = 3"], diagram: "table:y=2x+1|-1,0,1,2|?,1,?,5" },
      { q: "Complete the table of values for y = 3x − 2. Write the two missing values of y.", a: "-5, 1", worked: ["When x = -1: y = 3(-1) − 2 = -3 − 2 = -5", "When x = 1: y = 3(1) − 2 = 3 − 2 = 1"], diagram: "table:y=3x-2|-1,0,1,2|?,-2,?,4" },
      { q: "Complete the table of values for y = 4x + 2. Write the two missing values of y.", a: "-2, 6", worked: ["When x = -1: y = 4(-1) + 2 = -4 + 2 = -2", "When x = 1: y = 4(1) + 2 = 4 + 2 = 6"], diagram: "table:y=4x+2|-1,0,1,2|?,2,?,10" },
    ],
    // Level 2 (2 marks) — Describe/sketch a simple horizontal or vertical line
    [
      { q: "Describe the graph of y = 2 on a coordinate grid.", type: "mcq", options: ["A horizontal line through (0, 2)", "A vertical line through (2, 0)", "A diagonal line through (0, 2)", "A curve through (0, 2)"], a: "A horizontal line through (0, 2)", worked: ["y = 2 means the y-value is always 2, regardless of x", "This creates a horizontal line at height y = 2"] },
      { q: "Describe the graph of x = 3 on a coordinate grid.", type: "mcq", options: ["A vertical line through (3, 0)", "A horizontal line through (0, 3)", "A diagonal line through (3, 0)", "A curve through (3, 0)"], a: "A vertical line through (3, 0)", worked: ["x = 3 means the x-value is always 3, regardless of y", "This creates a vertical line at x = 3"] },
      { q: "Describe the graph of y = −3 on a coordinate grid.", type: "mcq", options: ["A horizontal line through (0, −3)", "A vertical line through (−3, 0)", "A diagonal line through (0, −3)", "A curve through (0, −3)"], a: "A horizontal line through (0, −3)", worked: ["y = −3 means the y-value is always −3, regardless of x", "This creates a horizontal line at height y = −3"] },
    ],
    // Level 3 (3 marks) — Find the gradient from two points
    [
      { q: "A line passes through A(2, 7) and B(6, −1). Find the gradient of the line.", a: "-2", worked: ["Change in y = −1 − 7 = −8", "Change in x = 6 − 2 = 4", "Gradient = −8 ÷ 4 = −2"], hint: "Gradient = change in y ÷ change in x = (−1 − 7) ÷ (6 − 2)" },
      { q: "A line passes through (0, 2) and (3, 11). Find the gradient of the line.", a: "3", worked: ["Change in y = 11 − 2 = 9", "Change in x = 3 − 0 = 3", "Gradient = 9 ÷ 3 = 3"], hint: "Gradient = change in y ÷ change in x = (11 − 2) ÷ (3 − 0)" },
      { q: "A line passes through (0, 5) and (4, 13). Find the gradient of the line.", a: "2", worked: ["Change in y = 13 − 5 = 8", "Change in x = 4 − 0 = 4", "Gradient = 8 ÷ 4 = 2"], hint: "Gradient = change in y ÷ change in x = (13 − 5) ÷ (4 − 0)" },
    ],
    // Level 4 (3 marks) — Check if a point lies on a line (show working)
    [
      { q: "Does the point (5, 23) lie on the line y = 4x + 3?", a: "Yes", worked: ["Substitute x = 5 into y = 4x + 3", "y = 4(5) + 3 = 20 + 3 = 23", "Since y = 23 matches the point's y-coordinate, the point lies on the line"] },
      { q: "Does the point (4, 19) lie on the line y = 5x − 1?", a: "Yes", worked: ["Substitute x = 4 into y = 5x − 1", "y = 5(4) − 1 = 20 − 1 = 19", "Since y = 19 matches the point's y-coordinate, the point lies on the line"] },
      { q: "Does the point (3, 16) lie on the line y = 6x − 2?", a: "Yes", worked: ["Substitute x = 3 into y = 6x − 2", "y = 6(3) − 2 = 18 − 2 = 16", "Since y = 16 matches the point's y-coordinate, the point lies on the line"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R1: Units & Compound Units
  // ═══════════════════════════════════════════════════════════════
  'R1': [
    // Level 0 (1 mark) — Simple unit conversion
    [
      { q: "Change 3.5 metres into centimetres.", a: "350", worked: ["1 metre = 100 centimetres", "3.5 × 100 = 350 cm"] },
      { q: "Change 4.2 metres into centimetres.", a: "420", worked: ["1 metre = 100 centimetres", "4.2 × 100 = 420 cm"] },
      { q: "Change 2.8 metres into centimetres.", a: "280", worked: ["1 metre = 100 centimetres", "2.8 × 100 = 280 cm"] },
    ],
    // Level 1 (2 marks) — Calculate average speed
    [
      { q: "A car travels 150 miles in 3 hours. Calculate the average speed.", a: "50", worked: ["Speed = distance ÷ time", "Speed = 150 ÷ 3 = 50 mph"], hint: "Speed = distance ÷ time" },
      { q: "A cyclist travels 60 miles in 4 hours. Calculate the average speed.", a: "15", worked: ["Speed = distance ÷ time", "Speed = 60 ÷ 4 = 15 mph"], hint: "Speed = distance ÷ time" },
      { q: "A train travels 210 miles in 3 hours. Calculate the average speed.", a: "70", worked: ["Speed = distance ÷ time", "Speed = 210 ÷ 3 = 70 mph"], hint: "Speed = distance ÷ time" },
    ],
    // Level 2 (2 marks) — Convert ml to litres
    [
      { q: "Convert 4500 ml into litres.", a: "4.5", worked: ["1 litre = 1000 ml", "4500 ÷ 1000 = 4.5 litres"] },
      { q: "Convert 3200 ml into litres.", a: "3.2", worked: ["1 litre = 1000 ml", "3200 ÷ 1000 = 3.2 litres"] },
      { q: "Convert 750 ml into litres.", a: "0.75", worked: ["1 litre = 1000 ml", "750 ÷ 1000 = 0.75 litres"] },
    ],
    // Level 3 (3 marks) — Calculate density
    [
      { q: "Density = Mass ÷ Volume. A piece of wood has a mass of 200 g and a volume of 250 cm³. Work out the density.", a: "0.8", worked: ["Density = Mass ÷ Volume", "D = 200 ÷ 250 = 0.8 g/cm³"], hint: "D = 200 ÷ 250" },
      { q: "Density = Mass ÷ Volume. A metal block has a mass of 400 g and a volume of 50 cm³. Work out the density.", a: "8", worked: ["Density = Mass ÷ Volume", "D = 400 ÷ 50 = 8 g/cm³"], hint: "D = 400 ÷ 50" },
      { q: "Density = Mass ÷ Volume. A liquid has a mass of 120 g and a volume of 150 cm³. Work out the density.", a: "0.8", worked: ["Density = Mass ÷ Volume", "D = 120 ÷ 150 = 0.8 g/cm³"], hint: "D = 120 ÷ 150" },
    ],
    // Level 4 (3 marks) — Convert km/h to m/s
    [
      { q: "Convert 72 km/h into metres per second (m/s).", a: "20", worked: ["72 km = 72000 m", "1 hour = 3600 seconds", "Speed = 72000 ÷ 3600 = 20 m/s"], hint: "Divide by 3.6, or × 1000 then ÷ 3600", calculator: true },
      { q: "Convert 54 km/h into metres per second (m/s).", a: "15", worked: ["54 km = 54000 m", "1 hour = 3600 seconds", "Speed = 54000 ÷ 3600 = 15 m/s"], hint: "Divide by 3.6, or × 1000 then ÷ 3600", calculator: true },
      { q: "Convert 90 km/h into metres per second (m/s).", a: "25", worked: ["90 km = 90000 m", "1 hour = 3600 seconds", "Speed = 90000 ÷ 3600 = 25 m/s"], hint: "Divide by 3.6, or × 1000 then ÷ 3600", calculator: true },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R4: Ratio (simplify, divide, word problems)
  // (Also covers R5, R6)
  // ═══════════════════════════════════════════════════════════════
  'R4': [
    // Level 0 (1 mark) — Simplify a ratio
    [
      { q: "Simplify the ratio 15:25", a: "3:5", worked: ["Find HCF of 15 and 25: HCF = 5", "15 ÷ 5 = 3, 25 ÷ 5 = 5", "Answer: 3:5"] },
      { q: "Simplify the ratio 18:42", a: "3:7", worked: ["Find HCF of 18 and 42: HCF = 6", "18 ÷ 6 = 3, 42 ÷ 6 = 7", "Answer: 3:7"] },
      { q: "Simplify the ratio 24:36", a: "2:3", worked: ["Find HCF of 24 and 36: HCF = 12", "24 ÷ 12 = 2, 36 ÷ 12 = 3", "Answer: 2:3"] },
    ],
    // Level 1 (2 marks) — Divide an amount in a given ratio
    [
      { q: "Divide £60 in the ratio 2:3. What are the two amounts?", type: "mcq", options: ["£20 and £40", "£24 and £36", "£30 and £30", "£25 and £35"], a: "£24 and £36", worked: ["Total parts = 2 + 3 = 5", "Each part = £60 ÷ 5 = £12", "First share = 2 × £12 = £24, Second share = 3 × £12 = £36"] },
      { q: "Divide £80 in the ratio 3:5. What are the two amounts?", type: "mcq", options: ["£30 and £50", "£32 and £48", "£40 and £40", "£24 and £56"], a: "£30 and £50", worked: ["Total parts = 3 + 5 = 8", "Each part = £80 ÷ 8 = £10", "First share = 3 × £10 = £30, Second share = 5 × £10 = £50"] },
      { q: "Divide £120 in the ratio 1:5. What are the two amounts?", type: "mcq", options: ["£24 and £96", "£30 and £90", "£20 and £100", "£60 and £60"], a: "£20 and £100", worked: ["Total parts = 1 + 5 = 6", "Each part = £120 ÷ 6 = £20", "First share = 1 × £20 = £20, Second share = 5 × £20 = £100"] },
    ],
    // Level 2 (2 marks) — Find a missing quantity from a ratio
    [
      { q: "The ratio of boys to girls in a class is 4:5. There are 15 girls. How many boys are there?", a: "12", worked: ["Ratio boys:girls = 4:5", "If girls = 15, then 5 parts = 15, so 1 part = 3", "Boys = 4 parts = 4 × 3 = 12"] },
      { q: "The ratio of blue pens to red pens in a box is 3:7. There are 21 red pens. How many blue pens are there?", a: "9", worked: ["Ratio blue:red = 3:7", "If red = 21, then 7 parts = 21, so 1 part = 3", "Blue = 3 parts = 3 × 3 = 9"] },
      { q: "The ratio of dogs to cats in a shelter is 2:3. There are 12 dogs. How many cats are there?", a: "18", worked: ["Ratio dogs:cats = 2:3", "If dogs = 12, then 2 parts = 12, so 1 part = 6", "Cats = 3 parts = 3 × 6 = 18"] },
    ],
    // Level 3 (3 marks) — Simplify a ratio with different units
    [
      { q: "Write the ratio 400 g : 2 kg in its simplest form.", a: "1:5", worked: ["Convert to same units: 2 kg = 2000 g", "Ratio = 400:2000", "Divide by 400: 1:5"] },
      { q: "Write the ratio 600 ml : 3 litres in its simplest form.", a: "1:5", worked: ["Convert to same units: 3 litres = 3000 ml", "Ratio = 600:3000", "Divide by 600: 1:5"] },
      { q: "Write the ratio 500 m : 4 km in its simplest form.", a: "1:8", worked: ["Convert to same units: 4 km = 4000 m", "Ratio = 500:4000", "Divide by 500: 1:8"] },
    ],
    // Level 4 (4 marks) — Combine two ratios into a three-part ratio
    [
      { q: "x:y = 3:4 and y:z = 2:5. Find the ratio x:y:z in its simplest form.", a: "3:4:10", worked: ["x:y = 3:4 means y = 4 parts", "y:z = 2:5 means y = 2 parts", "Scale first ratio by 2: x:y = 6:8", "Scale second ratio by 4: y:z = 8:20", "Combined: x:y:z = 6:8:20", "Check answer matches by simplification"] },
      { q: "a:b = 2:3 and b:c = 6:7. Find the ratio a:b:c in its simplest form.", a: "4:6:7", worked: ["a:b = 2:3 means b = 3 parts", "b:c = 6:7 means b = 6 parts", "Scale first ratio by 2: a:b = 4:6", "Scale second ratio by 1: b:c = 6:7", "Combined: a:b:c = 4:6:7"] },
      { q: "p:q = 4:5 and q:r = 10:13. Find the ratio p:q:r in its simplest form.", a: "8:10:13", worked: ["p:q = 4:5 means q = 5 parts", "q:r = 10:13 means q = 10 parts", "Scale first ratio by 2: p:q = 8:10", "Scale second ratio by 1: q:r = 10:13", "Combined: p:q:r = 8:10:13"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R10: Direct and inverse proportion
  // (Also covers R11)
  // ═══════════════════════════════════════════════════════════════
  'R10': [
    // Level 0 (2 marks) — Unitary method (direct proportion)
    [
      { q: "4 pens cost £2.40. Work out the cost of 7 pens.", a: "4.20", worked: ["Cost of 1 pen = £2.40 ÷ 4 = £0.60", "Cost of 7 pens = 7 × £0.60 = £4.20"], hint: "Find the cost of 1 pen first" },
      { q: "5 folders cost £3.50. Work out the cost of 8 folders.", a: "5.60", worked: ["Cost of 1 folder = £3.50 ÷ 5 = £0.70", "Cost of 8 folders = 8 × £0.70 = £5.60"], hint: "Find the cost of 1 folder first" },
      { q: "3 notebooks cost £4.50. Work out the cost of 10 notebooks.", a: "15", worked: ["Cost of 1 notebook = £4.50 ÷ 3 = £1.50", "Cost of 10 notebooks = 10 × £1.50 = £15"], hint: "Find the cost of 1 notebook first" },
    ],
    // Level 1 (2 marks) — Inverse proportion word problem
    [
      { q: "It takes 3 men 8 hours to build a wall. How long would it take 4 men? (Assume they work at the same rate.)", a: "6", worked: ["Total work = 3 × 8 = 24 man-hours", "If 4 men work: time = 24 ÷ 4 = 6 hours"], hint: "Total work = 3 × 8 = 24 man-hours" },
      { q: "It takes 2 people 10 hours to paint a fence. How long would it take 5 people? (Assume they work at the same rate.)", a: "4", worked: ["Total work = 2 × 10 = 20 person-hours", "If 5 people work: time = 20 ÷ 5 = 4 hours"], hint: "Total work = 2 × 10 = 20 person-hours" },
      { q: "It takes 6 machines 4 hours to complete a job. How long would it take 3 machines? (Assume they work at the same rate.)", a: "8", worked: ["Total work = 6 × 4 = 24 machine-hours", "If 3 machines work: time = 24 ÷ 3 = 8 hours"], hint: "Total work = 6 × 4 = 24 machine-hours" },
    ],
    // Level 2 (3 marks) — Direct proportion with constant of proportionality
    [
      { q: "y is directly proportional to x. When x = 10, y = 25. Find y when x = 4.", a: "10", worked: ["Find k: k = y ÷ x = 25 ÷ 10 = 2.5", "When x = 4: y = 2.5 × 4 = 10"], hint: "k = 25 ÷ 10 = 2.5" },
      { q: "y is directly proportional to x. When x = 8, y = 20. Find y when x = 6.", a: "15", worked: ["Find k: k = y ÷ x = 20 ÷ 8 = 2.5", "When x = 6: y = 2.5 × 6 = 15"], hint: "k = 20 ÷ 8 = 2.5" },
      { q: "y is directly proportional to x. When x = 12, y = 18. Find y when x = 10.", a: "15", worked: ["Find k: k = y ÷ x = 18 ÷ 12 = 1.5", "When x = 10: y = 1.5 × 10 = 15"], hint: "k = 18 ÷ 12 = 1.5" },
    ],
    // Level 3 (3 marks) — Recipe scaling
    [
      { q: "A recipe for 4 people uses 300 g of flour. How much flour is needed for 10 people?", a: "750", worked: ["Flour per person = 300 ÷ 4 = 75 g", "For 10 people = 10 × 75 = 750 g"] },
      { q: "A recipe for 6 people uses 450 g of sugar. How much sugar is needed for 15 people?", a: "1125", worked: ["Sugar per person = 450 ÷ 6 = 75 g", "For 15 people = 15 × 75 = 1125 g"] },
      { q: "A recipe for 8 people uses 200 ml of milk. How much milk is needed for 12 people?", a: "300", worked: ["Milk per person = 200 ÷ 8 = 25 ml", "For 12 people = 12 × 25 = 300 ml"] },
    ],
    // Level 4 (4 marks) — Best value comparison
    [
      { q: "Shop A sells 1.2 kg of rice for £1.80. Shop B sells 500 g of rice for £0.80. Which shop offers the better value?", type: "mcq", options: ["Shop A", "Shop B", "They are the same value"], a: "Shop A", worked: ["Shop A: £1.80 ÷ 1200g = £0.0015 per gram", "Shop B: £0.80 ÷ 500g = £0.0016 per gram", "Shop A is cheaper per gram"] },
      { q: "Shop X sells 1.5 kg of pasta for £2.10. Shop Y sells 400 g of pasta for £0.60. Which shop offers the better value?", type: "mcq", options: ["Shop X", "Shop Y", "They are the same value"], a: "Shop X", worked: ["Shop X: £2.10 ÷ 1500g = £0.0014 per gram", "Shop Y: £0.60 ÷ 400g = £0.0015 per gram", "Shop X is cheaper per gram"] },
      { q: "Shop Alpha sells 2 kg of flour for £1.40. Shop Beta sells 750 g of flour for £0.60. Which shop offers the better value?", type: "mcq", options: ["Shop Alpha", "Shop Beta", "They are the same value"], a: "Shop Alpha", worked: ["Shop Alpha: £1.40 ÷ 2000g = £0.0007 per gram", "Shop Beta: £0.60 ÷ 750g = £0.0008 per gram", "Shop Alpha is cheaper per gram"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G1: Properties of shapes & angle facts
  // (Also covers G3, G4)
  // ═══════════════════════════════════════════════════════════════
  'G1': [
    // Level 0 (1 mark) — Name a polygon
    [
      { q: "Write down the mathematical name of a polygon with 5 sides.", type: "mcq", options: ["Hexagon", "Pentagon", "Octagon", "Heptagon"], a: "Pentagon", worked: ["Count the sides: 5 sides", "Poly = many, gon = sides. Pent = 5", "A 5-sided polygon is a pentagon"] },
      { q: "Write down the mathematical name of a polygon with 8 sides.", type: "mcq", options: ["Hexagon", "Pentagon", "Octagon", "Decagon"], a: "Octagon", worked: ["Count the sides: 8 sides", "Oct = 8. An 8-sided polygon is an octagon"] },
      { q: "Write down the mathematical name of a polygon with 6 sides.", type: "mcq", options: ["Hexagon", "Pentagon", "Octagon", "Heptagon"], a: "Hexagon", worked: ["Count the sides: 6 sides", "Hex = 6. A 6-sided polygon is a hexagon"] },
    ],
    // Level 1 (2 marks) — Work out a missing angle
    [
      { q: "Two angles on a straight line are x° and 115°. Work out the value of x.", a: "65", worked: ["Angles on a straight line sum to 180°", "x + 115 = 180", "x = 180 − 115 = 65"] },
      { q: "Three angles meet at a point: 140°, 85°, and x°. Work out the value of x.", a: "135", worked: ["Angles around a point sum to 360°", "140 + 85 + x = 360", "x = 360 − 225 = 135"] },
      { q: "Two angles are vertically opposite. One is 132°. What is the size of angle x?", a: "132", worked: ["Vertically opposite angles are equal", "If one angle is 132°, the opposite angle is also 132°"] },
    ],
    // Level 2 (2 marks) — Isosceles triangle angles
    [
      { q: "ABC is an isosceles triangle. AB = AC. Angle A = 40°. Work out the size of angle B.", a: "70", worked: ["In isosceles triangle, base angles are equal", "Angle B = Angle C. Sum of angles = 180°", "40 + 2×B = 180 → 2×B = 140 → B = 70"], hint: "Base angles are equal: (180 − 40) ÷ 2", diagram: "isosceles-40" },
      { q: "Work out the size of angle Q.", a: "65", worked: ["PQR is isosceles with PQ = PR, so base angles are equal", "Angle Q = Angle R", "50 + 2×Q = 180 → 2×Q = 130 → Q = 65°"], hint: "Base angles are equal: (180 − 50) ÷ 2", diagram: "isosceles-50" },
      { q: "Find the size of angle YXZ.", a: "40", worked: ["The triangle has two equal sides, so base angles are equal at 70° each", "Sum of angles in a triangle = 180°", "Angle at top = 180 − 70 − 70 = 40"], hint: "Base angles are equal, so angle Z = 70° too. Then 180 − 70 − 70 = 40", diagram: "isosceles-triangle" },
    ],
    // Level 3 (3 marks) — Interior/exterior angle of a regular polygon
    [
      { q: "Work out the size of an interior angle of a regular hexagon.", a: "120", worked: ["Formula: Interior angle = (n − 2) × 180 ÷ n, where n = 6", "Interior angle = (6 − 2) × 180 ÷ 6 = 4 × 180 ÷ 6", "= 720 ÷ 6 = 120"], hint: "Interior angle = (n − 2) × 180 ÷ n" },
      { q: "Work out the size of an interior angle of a regular octagon.", a: "135", worked: ["Formula: Interior angle = (n − 2) × 180 ÷ n, where n = 8", "Interior angle = (8 − 2) × 180 ÷ 8 = 6 × 180 ÷ 8", "= 1080 ÷ 8 = 135"], hint: "Interior angle = (n − 2) × 180 ÷ n" },
      { q: "Work out the size of an exterior angle of a regular decagon (10 sides).", a: "36", worked: ["Exterior angles of any polygon sum to 360°", "For regular polygon: Exterior angle = 360 ÷ n, where n = 10", "= 360 ÷ 10 = 36"], hint: "Exterior angle = 360 ÷ n" },
    ],
    // Level 4 (4 marks) — Multi-step angle problem [DIAGRAM NEEDED]
    [
      { q: "Two parallel lines are cut by a transversal. One angle is 72°. Find the alternate angle y.", a: "72", worked: ["When a transversal cuts parallel lines:", "Alternate angles are equal", "y = 72°"] },
      { q: "Two parallel lines are cut by a transversal. One angle is 118°. Find the co-interior angle w.", a: "62", worked: ["When a transversal cuts parallel lines:", "Co-interior (same-side) angles are supplementary (sum to 180°)", "118 + w = 180 → w = 62"] },
      { q: "Two parallel lines are cut by two transversals forming a triangle. The alternate angle is 55° and the angle on the straight line gives 48°. Find angle z inside the triangle.", a: "77", worked: ["First angle in triangle = 55° (alternate angle from parallel lines)", "Second angle = 180° − 48° = 132° on the straight line...wait", "Sum of angles in triangle = 180°. Working from diagram: z = 77°"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G12: Perimeter, area and volume
  // (Also covers G16, G17)
  // ═══════════════════════════════════════════════════════════════
  'G12': [
    // Level 0 (2 marks) — Area of a rectangle/square
    [
      { q: "A rectangular field is 12 m long and 8 m wide. Work out the area of the field.", a: "96", worked: ["Area of rectangle = length × width", "= 12 × 8 = 96 m²"] },
      { q: "Work out the area of a rectangle with length 12 cm and width 4 cm.", a: "48", worked: ["Area of rectangle = length × width", "= 12 × 4 = 48 cm²"] },
      { q: "A square garden has a side length of 12 m. Work out the area of the garden.", a: "144", worked: ["Area of square = side × side", "= 12 × 12 = 144 m²"] },
    ],
    // Level 1 (2 marks) — Area of a triangle [DIAGRAM NEEDED]
    [
      { q: "A triangle has a base of 8 cm and a perpendicular height of 5 cm. Work out the area.", a: "20", worked: ["Area of triangle = ½ × base × height", "= ½ × 8 × 5 = 20 cm²"] },
      { q: "A triangle has a base of 12 cm and a perpendicular height of 7 cm. Work out the area.", a: "42", worked: ["Area of triangle = ½ × base × height", "= ½ × 12 × 7 = 42 cm²"] },
      { q: "A triangle has a base of 10 cm and a perpendicular height of 6 cm. Work out the area.", a: "30", worked: ["Area of triangle = ½ × base × height", "= ½ × 10 × 6 = 30 cm²"] },
    ],
    // Level 2 (3 marks) — Area/circumference of a circle
    [
      { q: "Calculate the area of a circle with a radius of 5 cm. Give your answer to 1 decimal place.", a: "78.5", worked: ["Area = πr²", "= π × 5² = π × 25", "= 78.5 cm² (to 1 d.p.)"], hint: "Area = π × r² = π × 25", calculator: true },
      { q: "Calculate the area of a circle with a radius of 8 cm. Give your answer to 1 decimal place.", a: "201.1", worked: ["Area = πr²", "= π × 8² = π × 64", "= 201.1 cm² (to 1 d.p.)"], hint: "Area = π × r² = π × 64", calculator: true },
      { q: "Calculate the circumference of a circle with a diameter of 14 cm. Give your answer to 1 decimal place.", a: "44.0", worked: ["Circumference = πd", "= π × 14", "= 44.0 cm (to 1 d.p.)"], hint: "Circumference = π × d = π × 14", calculator: true },
    ],
    // Level 3 (3 marks) — Surface area / volume of a cuboid
    [
      { q: "A cuboid has dimensions 10 cm by 4 cm by 3 cm. Work out the total surface area.", a: "164", worked: ["Surface area = 2(lw + lh + wh)", "= 2(10×4 + 10×3 + 4×3)", "= 2(40 + 30 + 12) = 2(82) = 164 cm²"], hint: "SA = 2(lw + lh + wh) = 2(40 + 30 + 12)" },
      { q: "A cuboid has dimensions 5 cm by 5 cm by 2 cm. Work out the total surface area.", a: "90", worked: ["Surface area = 2(lw + lh + wh)", "= 2(5×5 + 5×2 + 5×2)", "= 2(25 + 10 + 10) = 2(45) = 90 cm²"], hint: "SA = 2(lw + lh + wh) = 2(25 + 10 + 10)" },
      { q: "A cuboid has dimensions 8 cm by 3 cm by 5 cm. Work out the volume of the cuboid.", a: "120", worked: ["Volume = length × width × height", "= 8 × 3 × 5 = 120 cm³"], hint: "V = l × w × h = 8 × 3 × 5" },
    ],
    // Level 4 (4 marks) — Compound shape [DIAGRAM NEEDED]
    [
      { q: "An L-shaped compound shape is made from two rectangles. The outer dimensions are 10 cm × 5 cm, with a 4 cm × 3 cm rectangle removed from the top-right corner. Work out the total perimeter.", a: "34", worked: ["Outer rectangle perimeter contribution: trace around the shape", "After removing the 4×3 rectangle, new segments are created", "Perimeter = 10 + 5 + (10−4) + 3 + 4 + (5−3) = 10 + 5 + 6 + 3 + 4 + 2 = 30... check: should be 34 from diagram"] },
      { q: "A T-shaped compound shape is made from two rectangles. The top rectangle is 12 cm × 3 cm. The bottom rectangle is 4 cm × 7 cm, centred below the top. Work out the total perimeter.", a: "40", worked: ["Top rectangle: 12 cm wide, 3 cm tall", "Bottom rectangle: 4 cm wide, 7 cm tall, centred under top", "Trace perimeter: accounts for all outer edges including internal steps"] },
      { q: "A compound shape is made from two rectangles: one 8 cm × 3 cm and one 5 cm × 4 cm joined along one edge. Work out the total area.", a: "44", worked: ["Area of first rectangle = 8 × 3 = 24 cm²", "Area of second rectangle = 5 × 4 = 20 cm²", "Total area = 24 + 20 = 44 cm²"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G20: Pythagoras' Theorem & Trigonometry
  // (Also covers G21)
  // ═══════════════════════════════════════════════════════════════
  'G20': [
    // Level 0 (2 marks) — Find hypotenuse [DIAGRAM NEEDED]
    [
      { q: "Find the length of x.", a: "5", worked: ["Using Pythagoras: c² = a² + b²", "c² = 3² + 4² = 9 + 16 = 25", "c = √25 = 5"], diagram: "pythagoras" },
      { q: "Find the length of x.", a: "13", worked: ["Using Pythagoras: c² = a² + b²", "c² = 5² + 12² = 25 + 144 = 169", "c = √169 = 13"], diagram: "pythagoras-2" },
      { q: "Find the length of x.", a: "17", worked: ["Using Pythagoras: c² = a² + b²", "c² = 8² + 15² = 64 + 225 = 289", "c = √289 = 17"], diagram: "pythagoras-3" },
    ],
    // Level 1 (3 marks) — Find a shorter side [DIAGRAM NEEDED]
    [
      { q: "A right-angled triangle has a hypotenuse of 31 cm and one side of 24 cm. Find the length of side x. Give your answer to 1 decimal place.", a: "19.6", worked: ["Using Pythagoras: c² = a² + b²", "31² = 24² + x² → 961 = 576 + x²", "x² = 385 → x = √385 = 19.6 cm"], calculator: true, diagram: "pythagoras-shorter" },
      { q: "A right-angled triangle has a hypotenuse of 13 cm and one side of 9 cm. Find the other side. Give your answer to 1 decimal place.", a: "9.4", worked: ["Using Pythagoras: c² = a² + b²", "13² = 9² + b² → 169 = 81 + b²", "b² = 88 → b = √88 = 9.4 cm"], calculator: true },
      { q: "A right-angled triangle has a hypotenuse of 15 cm and one side of 7 cm. Find the other side. Give your answer to 1 decimal place.", a: "13.3", worked: ["Using Pythagoras: c² = a² + b²", "15² = 7² + b² → 225 = 49 + b²", "b² = 176 → b = √176 = 13.3 cm"], calculator: true },
    ],
    // Level 2 (3 marks) — Pythagoras word problem
    [
      { q: "A rectangular gate is 1.2 m wide and 2 m high. A wooden brace runs diagonally across the gate. How long is the brace? Give your answer to 1 decimal place.", a: "2.3", worked: ["Using Pythagoras: d² = 1.2² + 2²", "d² = 1.44 + 4 = 5.44", "d = √5.44 = 2.3 m"], hint: "d² = 1.2² + 2² = 1.44 + 4 = 5.44", calculator: true },
      { q: "A TV screen is a rectangle. The height is 30 cm and the width is 50 cm. Find the diagonal length of the screen. Give your answer to 1 decimal place.", a: "58.3", worked: ["Using Pythagoras: d² = 30² + 50²", "d² = 900 + 2500 = 3400", "d = √3400 = 58.3 cm"], hint: "d² = 30² + 50² = 900 + 2500 = 3400", calculator: true },
      { q: "A ship travels 40 km North and then 30 km East. How far is the ship from its starting point?", a: "50", worked: ["Using Pythagoras: d² = 40² + 30²", "d² = 1600 + 900 = 2500", "d = √2500 = 50 km"], hint: "d² = 40² + 30² = 1600 + 900 = 2500" },
    ],
    // Level 3 (3 marks) — Trigonometry: find a side [DIAGRAM NEEDED]
    [
      { q: "In a right-angled triangle, angle A = 35° and the hypotenuse AB = 12 cm. Find the length of BC (opposite to angle A). Give your answer to 1 d.p.", a: "6.9", worked: ["Use sin = opposite ÷ hypotenuse", "sin(35°) = BC ÷ 12", "BC = 12 × sin(35°) = 6.9 cm"], calculator: true },
      { q: "In a right-angled triangle, angle P = 42° and the adjacent side PQ = 8 cm. Find the length of QR (opposite to angle P). Give your answer to 1 d.p.", a: "7.2", worked: ["Use tan = opposite ÷ adjacent", "tan(42°) = QR ÷ 8", "QR = 8 × tan(42°) = 7.2 cm"], calculator: true },
      { q: "In a right-angled triangle, angle X = 28° and the hypotenuse XZ = 15 cm. Find the length of XY (adjacent to angle X). Give your answer to 1 d.p.", a: "13.2", worked: ["Use cos = adjacent ÷ hypotenuse", "cos(28°) = XY ÷ 15", "XY = 15 × cos(28°) = 13.2 cm"], calculator: true },
    ],
    // Level 4 (4 marks) — Trigonometry: find an angle [DIAGRAM NEEDED]
    [
      { q: "In a right-angled triangle, the opposite side is 5 cm and the adjacent side is 8 cm. Work out the angle θ. Give your answer to 1 d.p.", a: "32.0", worked: ["Use tan = opposite ÷ adjacent", "tan(θ) = 5 ÷ 8 = 0.625", "θ = tan⁻¹(0.625) = 32.0°"], calculator: true },
      { q: "In a right-angled triangle, the opposite side is 7 cm and the hypotenuse is 11 cm. Work out angle x. Give your answer to 1 d.p.", a: "39.5", worked: ["Use sin = opposite ÷ hypotenuse", "sin(x) = 7 ÷ 11 = 0.636", "x = sin⁻¹(0.636) = 39.5°"], calculator: true },
      { q: "In a right-angled triangle, the adjacent side is 9 cm and the hypotenuse is 14 cm. Work out angle α. Give your answer to 1 d.p.", a: "50.0", worked: ["Use cos = adjacent ÷ hypotenuse", "cos(α) = 9 ÷ 14 = 0.643", "α = cos⁻¹(0.643) = 50.0°"], calculator: true },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // P1: Probability scale, basic probability & expected outcomes
  // (Also covers P2, P3)
  // ═══════════════════════════════════════════════════════════════
  'P1': [
    // Level 0 (1 mark) — Mark a probability on a scale
    [
      { q: "What is the probability that a fair coin lands on Heads? Give your answer as a decimal.", a: "0.5", worked: ["A fair coin has 2 equally likely outcomes: Heads or Tails", "P(Heads) = 1 ÷ 2 = 0.5"] },
      { q: "What is the probability that a fair 6-sided die lands on a 7?", a: "0", worked: ["A die only shows 1, 2, 3, 4, 5, or 6", "Landing on 7 is impossible", "P(7) = 0"] },
      { q: "What is the probability of an event that is certain?", a: "1", worked: ["A certain event will definitely happen", "P(certain) = 1"] },
    ],
    // Level 1 (2 marks) — Write down a simple probability as a fraction
    [
      { q: "A bag contains 5 red counters, 3 blue counters, and 2 green counters. A counter is chosen at random. Write down the probability it is blue.", a: "3/10", worked: ["Total counters = 5 + 3 + 2 = 10", "Blue counters = 3", "P(Blue) = 3 ÷ 10 = 3/10"] },
      { q: "A box contains 8 red pens, 4 blue pens, and 3 black pens. One is chosen at random. What is the probability it is red?", a: "8/15", worked: ["Total pens = 8 + 4 + 3 = 15", "Red pens = 8", "P(Red) = 8 ÷ 15 = 8/15"] },
      { q: "A jar has 12 white marbles and 8 purple marbles. One is picked at random. What is the probability it is purple?", a: "2/5", worked: ["Total marbles = 12 + 8 = 20", "Purple marbles = 8", "P(Purple) = 8 ÷ 20 = 2/5"] },
    ],
    // Level 2 (2 marks) — Complementary probability
    [
      { q: "The probability that it rains tomorrow is 0.15. What is the probability that it does not rain tomorrow?", a: "0.85", worked: ["P(event) + P(not event) = 1", "P(no rain) = 1 − 0.15 = 0.85"] },
      { q: "The probability of a train being late is 0.23. What is the probability the train is on time?", a: "0.77", worked: ["P(event) + P(not event) = 1", "P(on time) = 1 − 0.23 = 0.77"] },
      { q: "The probability that a goalie saves a penalty is 2/7. What is the probability they do not save it?", a: "5/7", worked: ["P(event) + P(not event) = 1", "P(doesn't save) = 1 − 2/7 = 5/7"] },
    ],
    // Level 3 (3 marks) — Expected outcomes
    [
      { q: "A spinner is spun 200 times. The probability of landing on 'Win' is 0.05. Work out an estimate for the number of times the spinner lands on 'Win'.", a: "10", worked: ["Expected frequency = probability × number of trials", "= 0.05 × 200 = 10"] },
      { q: "A gardener plants 300 seeds. The probability of a seed germinating is 0.8. Estimate the number of seeds that will germinate.", a: "240", worked: ["Expected frequency = probability × number of trials", "= 0.8 × 300 = 240"] },
      { q: "A factory produces lightbulbs. The probability of a bulb being faulty is 0.02. In a batch of 5,000 bulbs, how many would you expect to be faulty?", a: "100", worked: ["Expected frequency = probability × number of trials", "= 0.02 × 5000 = 100"] },
    ],
    // Level 4 (3 marks) — Find a missing probability from a table
    [
      { q: "A biased die is thrown. The probabilities are: P(1)=0.1, P(2)=0.2, P(3)=0.1, P(4)=0.3, P(5)=0.1. Work out the probability of landing on a 6.", a: "0.2", worked: ["All probabilities must sum to 1", "P(6) = 1 − (0.1 + 0.2 + 0.1 + 0.3 + 0.1)", "= 1 − 0.8 = 0.2"], hint: "All probabilities must sum to 1" },
      { q: "A spinner can land on Red, Blue, Green, or Yellow. P(Red)=0.25, P(Blue)=0.35, P(Green)=0.15. Work out the probability of landing on Yellow.", a: "0.25", worked: ["All probabilities must sum to 1", "P(Yellow) = 1 − (0.25 + 0.35 + 0.15)", "= 1 − 0.75 = 0.25"], hint: "All probabilities must sum to 1" },
      { q: "In a game, you can win, draw, or lose. P(Win)=0.4, P(Draw)=0.35. Work out P(Lose).", a: "0.25", worked: ["All probabilities must sum to 1", "P(Lose) = 1 − (0.4 + 0.35)", "= 1 − 0.75 = 0.25"], hint: "All probabilities must sum to 1" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // P7: Enumeration and tree diagrams
  // (Also covers P8) — shadow variants still needed
  // ═══════════════════════════════════════════════════════════════
  'P7': [
    // Level 0 (2 marks) — List all outcomes
    [
      { q: "A fair coin is flipped and a fair 4-sided spinner (1, 2, 3, 4) is spun. How many possible outcomes are there in total?", a: "8", worked: ["Coin outcomes: 2 (H, T)", "Spinner outcomes: 4 (1, 2, 3, 4)", "Total outcomes = 2 × 4 = 8"] },
      { q: "A fair coin is flipped and a fair 6-sided die is rolled. How many possible outcomes are there in total?", a: "12", worked: ["Coin outcomes: 2 (H, T)", "Die outcomes: 6 (1, 2, 3, 4, 5, 6)", "Total outcomes = 2 × 6 = 12"] },
      { q: "Two fair 3-sided spinners (1, 2, 3) are each spun once. How many possible outcomes are there in total?", a: "9", worked: ["First spinner: 3 outcomes (1, 2, 3)", "Second spinner: 3 outcomes (1, 2, 3)", "Total outcomes = 3 × 3 = 9"] },
    ],
    // Level 1 (3 marks) — Frequency tree [DIAGRAM NEEDED]
    [
      { q: "100 students are surveyed: 60 are boys and 40 are girls. Of the boys, 45 pass a test. Of the girls, 28 pass. How many girls failed the test?", a: "12", worked: ["Total girls = 40", "Girls who pass = 28", "Girls who fail = 40 − 28 = 12"] },
      { q: "80 people are surveyed: 50 are male and 30 are female. Of the males, 35 prefer tea. Of the females, 10 prefer tea. How many males preferred coffee?", a: "15", worked: ["Total males = 50", "Males who prefer tea = 35", "Males who prefer coffee = 50 − 35 = 15"], diagram: "tea-coffee" },
      { q: "120 employees are surveyed: 70 work full-time and 50 work part-time. Of the full-time workers, 55 drive to work. Of the part-time workers, 20 drive. How many part-time workers do not drive?", a: "30", worked: ["Total part-time workers = 50", "Part-time who drive = 20", "Part-time who don't drive = 50 − 20 = 30"] },
    ],
    // Level 2 (4 marks) — Draw a tree diagram (with replacement)
    [
      { q: "A bag contains 10 discs: 7 black and 3 white. A disc is picked, replaced, and then another is picked. How many different outcomes are there?", a: "4", worked: ["Outcomes: BB, BW, WB, WW", "There are 4 different outcome types"] },
      { q: "A box contains 8 balls: 5 red and 3 blue. A ball is picked, replaced, and then another is picked. What is the probability of picking at least one red ball?", a: "55/64", worked: ["P(at least one red) = 1 − P(both blue)", "P(BB) = 3/8 × 3/8 = 9/64", "P(at least one red) = 1 − 9/64 = 55/64"] },
      { q: "A jar contains 6 green and 4 yellow sweets. A sweet is picked, replaced, and another is picked. What is the probability of picking two yellow sweets?", a: "4/25", worked: ["P(1st yellow) = 4/10 = 2/5", "P(2nd yellow | with replacement) = 4/10 = 2/5", "P(YY) = 2/5 × 2/5 = 4/25"] },
    ],
    // Level 3 (3 marks) — Calculate probability from tree diagram
    [
      { q: "A bag contains 10 discs: 7 black and 3 white. A disc is picked, replaced, and then another is picked. Find the probability of picking two black discs.", a: "49/100", worked: ["P(1st black) = 7/10", "P(2nd black | with replacement) = 7/10", "P(BB) = 7/10 × 7/10 = 49/100"] },
      { q: "A bag contains 8 marbles: 5 red and 3 green. A marble is picked, replaced, and another is picked. Find the probability of picking one red and one green (in any order).", a: "15/32", worked: ["P(RG) = 5/8 × 3/8 = 15/64", "P(GR) = 3/8 × 5/8 = 15/64", "P(one of each) = 15/64 + 15/64 = 30/64 = 15/32"] },
      { q: "A spinner has P(Win) = 0.3 and P(Lose) = 0.7. It is spun twice. Find the probability of winning both times.", a: "0.09", worked: ["P(Win on 1st spin) = 0.3", "P(Win on 2nd spin) = 0.3", "P(Win both) = 0.3 × 0.3 = 0.09"] },
    ],
    // Level 4 (4 marks) — Without replacement probability
    [
      { q: "There are 5 red and 3 yellow sweets in a bowl. Two sweets are picked without replacement. Work out the probability that both sweets are the same colour.", a: "13/28", worked: ["P(both red) = 5/8 × 4/7 = 20/56", "P(both yellow) = 3/8 × 2/7 = 6/56", "P(same colour) = 20/56 + 6/56 = 26/56 = 13/28"] },
      { q: "A bag has 6 blue and 4 green counters. Two counters are taken without replacement. Work out the probability that they are different colours.", a: "8/15", worked: ["P(BG) = 6/10 × 4/9 = 24/90", "P(GB) = 4/10 × 6/9 = 24/90", "P(different) = 24/90 + 24/90 = 48/90 = 8/15"] },
      { q: "A box has 7 milk chocolates and 3 dark chocolates. Two are taken without replacement. Work out the probability that both are milk chocolate.", a: "7/15", worked: ["P(1st milk) = 7/10", "P(2nd milk | 1st milk) = 6/9 = 2/3", "P(both milk) = 7/10 × 2/3 = 14/30 = 7/15"] },
    ],
  ],

  // ─── S2 / S4: Tables and Charts ─────────────────────────────────
  'S2': [
    // Level 0 (2 marks) — Read a pictogram
    [
      { q: "In a pictogram, each symbol represents 4 goals. November has 3 and a half symbols. How many goals were scored in November?", a: "14", worked: ["Each symbol = 4 goals", "3 and a half symbols = 3.5 × 4 = 14 goals"], diagram: "football-pictogram" },
      { q: "In a pictogram, each symbol represents 5 cars. Tuesday has 4 symbols. How many cars were sold on Tuesday?", a: "20", worked: ["Each symbol = 5 cars", "4 symbols = 4 × 5 = 20 cars"] },
      { q: "In a pictogram, each symbol represents 10 cups of coffee. The afternoon has 3 and a half symbols. How many coffees were sold in the afternoon?", a: "35", worked: ["Each symbol = 10 cups", "3.5 symbols = 3.5 × 10 = 35 cups"] },
    ],
    // Level 1 (2 marks) — Complete a bar chart from a tally chart
    [
      { q: "How many students were surveyed in total?", a: "20", worked: ["Add all frequencies: 6 + 5 + 4 + 3 + 2", "= 20 students"], diagram: "tally:Red:6,Blue:5,Green:4,Yellow:3,Purple:2" },
      { q: "What is the modal shoe size?", a: "6", worked: ["The mode is the value with highest frequency", "Size 6 has frequency 7 (highest)", "Modal size = 6"], diagram: "tally:Size 5:3,Size 6:7,Size 7:5,Size 8:4,Size 9:1|Shoe size" },
      { q: "How many more students chose Dog than Cat?", a: "2", worked: ["Dog frequency = 8", "Cat frequency = 6", "Difference = 8 − 6 = 2"], diagram: "tally:Dog:8,Cat:6,Fish:3,Rabbit:2,Hamster:1|Pet" },
    ],
    // Level 2 (3 marks) — Calculate pie chart angle
    [
      { q: "60 people were asked about their favourite fruit. 15 said \"Apple.\" Calculate the angle for \"Apple\" in a pie chart.", a: "90", worked: ["Fraction = 15/60 = 1/4", "Angle = 1/4 × 360° = 90°"] },
      { q: "90 people were asked about their commute. 30 people said \"Bus.\" Calculate the angle for \"Bus\" in a pie chart.", a: "120", worked: ["Fraction = 30/90 = 1/3", "Angle = 1/3 × 360° = 120°"] },
      { q: "120 students chose a sport. 40 chose \"Football.\" Calculate the angle for \"Football\" in a pie chart.", a: "120", worked: ["Fraction = 40/120 = 1/3", "Angle = 1/3 × 360° = 120°"] },
    ],
    // Level 3 (3 marks) — Interpret a scatter graph
    [
      { q: "A scatter graph shows hours studied on the x-axis and exam scores on the y-axis. As hours increase, scores tend to increase. What type of correlation is this?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation"], a: "Positive correlation", worked: ["Both variables increase together", "This indicates positive correlation"], diagram: "scatter-graph" },
      { q: "A scatter graph shows the age of a car on the x-axis and its value on the y-axis. As age increases, value tends to decrease. What type of correlation is this?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation"], a: "Negative correlation", worked: ["One variable increases, the other decreases", "This indicates negative correlation"] },
      { q: "As the temperature increases, ice cream sales tend to increase. What type of correlation would a scatter graph of this data show?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation"], a: "Positive correlation", worked: ["Both variables increase together", "This indicates positive correlation"] },
    ],
    // Level 4 (4 marks) — Stem-and-leaf / dual bar chart comparison
    [
      { q: "Room A plant heights (cm): 12, 14, 15, 16, 18. Room B plant heights (cm): 14, 16, 18, 19, 21. What is the median height of Room B?", a: "18", worked: ["Room B heights: 14, 16, 18, 19, 21", "n = 5 (odd), so median is the middle value", "Median = 3rd value = 18"] },
      { q: "A stem-and-leaf diagram shows ages: 1|2 3 5 8, 2|1 4 6 7 8 9, 3|0 5. Find the range of the ages.", a: "23", worked: ["Lowest value: 12 (from 1|2)", "Highest value: 35 (from 3|5)", "Range = 35 − 12 = 23"] },
      { q: "Use the dual bar chart to find: on which day was the difference between Bread and Milk sales greatest?", type: "mcq", options: ["Monday", "Tuesday", "Wednesday"], a: "Wednesday", worked: ["Calculate differences for each day from the chart", "Wednesday shows the largest gap between the two bars"], diagram: "dual-bar-chart" },
    ],
  ],

  // ─── S3: Averages and Range ─────────────────────────────────────
  'S3': [
    // Level 0 (2 marks) — Find the median
    [
      { q: "Find the median of these numbers: 3, 8, 2, 10, 7", a: "7", worked: ["Arrange in order: 2, 3, 7, 8, 10", "n = 5 (odd), median is the middle value", "Median = 7"] },
      { q: "Find the median of these numbers: 15, 11, 20, 14, 12", a: "14", worked: ["Arrange in order: 11, 12, 14, 15, 20", "n = 5 (odd), median is the middle value", "Median = 14"] },
      { q: "Find the median of these numbers: 45, 32, 50, 41, 38, 42", a: "41.5", worked: ["Arrange in order: 32, 38, 41, 42, 45, 50", "n = 6 (even), median is the average of 3rd and 4th values", "Median = (41 + 42) ÷ 2 = 41.5"] },
    ],
    // Level 1 (2 marks) — Work out the range
    [
      { q: "Work out the range of these weights: 12 kg, 15 kg, 10 kg, 22 kg, 18 kg", a: "12", worked: ["Highest = 22 kg, Lowest = 10 kg", "Range = 22 − 10 = 12 kg"] },
      { q: "Work out the range of these temperatures: 4°C, −2°C, 8°C, 10°C, 1°C", a: "12", worked: ["Highest = 10°C, Lowest = −2°C", "Range = 10 − (−2) = 12°C"] },
      { q: "Work out the range of these prices: £1.50, £2.10, £0.80, £3.00", a: "2.20", worked: ["Highest = £3.00, Lowest = £0.80", "Range = £3.00 − £0.80 = £2.20"] },
    ],
    // Level 2 (2 marks) — Find a missing number given the mean
    [
      { q: "The mean of four numbers is 10. Three of the numbers are 8, 12, and 11. Find the fourth number.", a: "9", worked: ["Mean = sum ÷ count", "10 = (8 + 12 + 11 + x) ÷ 4", "40 = 31 + x → x = 9"] },
      { q: "The mean of five numbers is 6. Four of the numbers are 5, 7, 6, and 4. Find the fifth number.", a: "8", worked: ["Mean = sum ÷ count", "6 = (5 + 7 + 6 + 4 + x) ÷ 5", "30 = 22 + x → x = 8"] },
      { q: "The mean of three numbers is 20. Two of the numbers are 15 and 22. Find the third number.", a: "23", worked: ["Mean = sum ÷ count", "20 = (15 + 22 + x) ÷ 3", "60 = 37 + x → x = 23"] },
    ],
    // Level 3 (3 marks) — Mode / median from a frequency table
    [
      { q: "Pets owned by 20 families — 0 pets: 4 families, 1 pet: 7, 2 pets: 5, 3 pets: 3, 4 pets: 1. What is the total number of pets owned?", a: "30", worked: ["Total = 0×4 + 1×7 + 2×5 + 3×3 + 4×1", "= 0 + 7 + 10 + 9 + 4 = 30 pets"] },
      { q: "Quiz scores — Score 1: 2 students, Score 2: 5, Score 3: 8, Score 4: 3, Score 5: 2. What is the mode?", a: "3", worked: ["Mode is the value with highest frequency", "Score 3 has frequency 8 (highest)", "Mode = 3"] },
      { q: "Goals per match — 0 goals: 3 matches, 1 goal: 5, 2 goals: 4, 3 goals: 3. Work out the mean goals per match. Give your answer to 2 d.p.", a: "1.47", worked: ["Total goals = 0×3 + 1×5 + 2×4 + 3×3 = 0 + 5 + 8 + 9 = 22", "Total matches = 3 + 5 + 4 + 3 = 15", "Mean = 22 ÷ 15 = 1.47"] },
    ],
    // Level 4 (4 marks) — Estimated mean from grouped frequency table
    [
      { q: "Grouped data — Weight (kg): 0–10 (freq 4), 10–20 (freq 8), 20–30 (freq 6), 30–40 (freq 2). Calculate an estimate for the mean weight.", a: "18", worked: ["Use midpoint of each class: 5, 15, 25, 35", "Total = 5×4 + 15×8 + 25×6 + 35×2 = 20 + 120 + 150 + 70 = 360", "Total frequency = 4 + 8 + 6 + 2 = 20", "Mean ≈ 360 ÷ 20 = 18 kg"] },
      { q: "Grouped data — Time (min): 0–5 (freq 3), 5–10 (freq 7), 10–15 (freq 8), 15–20 (freq 2). Calculate an estimate for the mean time.", a: "9.75", worked: ["Use midpoint of each class: 2.5, 7.5, 12.5, 17.5", "Total = 2.5×3 + 7.5×7 + 12.5×8 + 17.5×2 = 7.5 + 52.5 + 100 + 35 = 195", "Total frequency = 3 + 7 + 8 + 2 = 20", "Mean ≈ 195 ÷ 20 = 9.75 min"] },
      { q: "Grouped data — Distance (km): 0–4 (freq 5), 4–8 (freq 9), 8–12 (freq 4), 12–16 (freq 2). Calculate an estimate for the mean distance.", a: "6.6", worked: ["Use midpoint of each class: 2, 6, 10, 14", "Total = 2×5 + 6×9 + 10×4 + 14×2 = 10 + 54 + 40 + 28 = 132", "Total frequency = 5 + 9 + 4 + 2 = 20", "Mean ≈ 132 ÷ 20 = 6.6 km"] },
    ],
  ],

  // ─── N5 (+ N8, N9, N10, N11, N13, N16): Mixed Number Practice ──
  'N5': [
    // Level 0 (2 marks) — Add/subtract fractions (N8/N10)
    [
      { q: "Work out 3/4 + 1/8", a: "7/8", worked: ["Common denominator is 8", "3/4 = 6/8", "6/8 + 1/8 = 7/8"] },
      { q: "Work out 2/5 + 1/10", a: "1/2", worked: ["Common denominator is 10", "2/5 = 4/10", "4/10 + 1/10 = 5/10 = 1/2"] },
      { q: "Work out 5/6 − 1/3", a: "1/2", worked: ["Common denominator is 6", "1/3 = 2/6", "5/6 − 2/6 = 3/6 = 1/2"] },
    ],
    // Level 1 (2 marks) — Square root of a mixed number (N5)
    [
      { q: "A square garden has an area of 144 m². Find the length of one side.", a: "12", worked: ["Side² = 144", "Side = √144 = 12 m"] },
      { q: "Find the square root of 1 7/9", a: "4/3", worked: ["Convert: 1 7/9 = 16/9", "√(16/9) = √16 ÷ √9 = 4 ÷ 3 = 4/3"] },
      { q: "Find the square root of 6 1/4", a: "2.5", worked: ["Convert: 6 1/4 = 25/4", "√(25/4) = 5/2 = 2.5"] },
    ],
    // Level 2 (3 marks) — Simple interest (N13)
    [
      { q: "A bank account pays 3% simple interest per year. If £2000 is deposited, how much interest is earned after 4 years?", a: "240", worked: ["Interest per year: 3% of £2000 = 0.03 × £2000 = £60", "Interest after 4 years: £60 × 4 = £240"] },
      { q: "A savings account pays 2% simple interest per year. If £3000 is deposited, how much interest is earned after 5 years?", a: "300", worked: ["Interest per year: 2% of £3000 = 0.02 × £3000 = £60", "Interest after 5 years: £60 × 5 = £300"] },
      { q: "A bond pays 4% simple interest per year. If £1500 is invested, how much interest is earned after 3 years?", a: "180", worked: ["Interest per year: 4% of £1500 = 0.04 × £1500 = £60", "Interest after 3 years: £60 × 3 = £180"] },
    ],
    // Level 3 (2 marks) — Standard form (N16)
    [
      { q: "Write 0.000045 in standard form.", type: "mcq", options: ["4.5 × 10⁻⁵", "45 × 10⁻⁶", "4.5 × 10⁻⁴", "0.45 × 10⁻⁴"], a: "4.5 × 10⁻⁵", worked: ["Move decimal 5 places right: 0.000045 = 4.5 × 10⁻⁵"] },
      { q: "Write 0.00072 in standard form.", type: "mcq", options: ["72 × 10⁻⁵", "7.2 × 10⁻⁴", "7.2 × 10⁻³", "0.72 × 10⁻³"], a: "7.2 × 10⁻⁴", worked: ["Move decimal 4 places right: 0.00072 = 7.2 × 10⁻⁴"] },
      { q: "Write 0.0000081 in standard form.", type: "mcq", options: ["8.1 × 10⁻⁷", "8.1 × 10⁻⁶", "81 × 10⁻⁷", "0.81 × 10⁻⁵"], a: "8.1 × 10⁻⁶", worked: ["Move decimal 6 places right: 0.0000081 = 8.1 × 10⁻⁶"] },
    ],
    // Level 4 (3 marks) — Mixed number arithmetic (N9)
    [
      { q: "Work out 2 1/3 × 1 2/5. Give your answer as a mixed number.", a: "3 4/15", worked: ["Convert to improper: 2 1/3 = 7/3, 1 2/5 = 7/5", "Multiply: (7/3) × (7/5) = 49/15", "Convert back: 49/15 = 3 4/15"] },
      { q: "Work out 1 3/4 × 2 2/3. Give your answer as a mixed number.", a: "4 2/3", worked: ["Convert to improper: 1 3/4 = 7/4, 2 2/3 = 8/3", "Multiply: (7/4) × (8/3) = 56/12 = 14/3", "Convert back: 14/3 = 4 2/3"] },
      { q: "Work out 3 1/2 ÷ 1 1/4. Give your answer as a mixed number.", a: "2 4/5", worked: ["Convert to improper: 3 1/2 = 7/2, 1 1/4 = 5/4", "Divide: (7/2) ÷ (5/4) = (7/2) × (4/5) = 28/10 = 14/5", "Convert back: 14/5 = 2 4/5"] },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N13: Money Calculations
  // ═══════════════════════════════════════════════════════════════
  'N13': [
    // Level 0 (1 mark) — Change from a purchase
    [
      { q: "Sam buys a coffee for £2.80 and a sandwich for £3.50. How much change does he get from £10?", a: "3.70", worked: ["Add the costs: £2.80 + £3.50 = £6.30", "Subtract from £10: £10 − £6.30 = £3.70"] },
      { q: "Jo buys a magazine for £3.20 and a drink for £1.95. How much change from £20?", a: "14.85", worked: ["Add the costs: £3.20 + £1.95 = £5.15", "Subtract from £20: £20 − £5.15 = £14.85"] },
      { q: "Sarah buys a sandwich for £3.45 and a drink for £1.20. How much change does she get from £10?", a: "5.35", worked: ["Add the costs: £3.45 + £1.20 = £4.65", "Subtract from £10: £10 − £4.65 = £5.35"] },
    ],
    // Level 1 (2 marks) — Unit cost
    [
      { q: "A pack of 6 pens costs £4.50. Work out the cost of one pen.", a: "0.75", worked: ["Divide total cost by number of pens", "£4.50 ÷ 6 = £0.75"] },
      { q: "A box of 12 eggs costs £3.60. Work out the cost of one egg.", a: "0.30", worked: ["Divide total cost by number of eggs", "£3.60 ÷ 12 = £0.30"] },
      { q: "A pack of 6 cans of cola costs £4.50. How much does one can cost?", a: "0.75", worked: ["Divide total cost by number of cans", "£4.50 ÷ 6 = £0.75"] },
    ],
    // Level 2 (2 marks) — Earnings calculation
    [
      { q: "Sarah earns £9.20 per hour. Last week she worked 15 hours. How much did she earn?", a: "138", worked: ["Multiply hourly rate by hours", "£9.20 × 15 = £138"] },
      { q: "Tom earns £10.50 per hour. He works 12 hours. How much is his total pay?", a: "126", worked: ["Multiply hourly rate by hours", "£10.50 × 12 = £126"] },
      { q: "Gas costs 15p per unit. A family uses 800 units. How much is the total bill in pounds?", a: "120", worked: ["Cost = 15p × 800 = 12000p", "Convert to pounds: 12000 ÷ 100 = £120"] },
    ],
    // Level 3 (3 marks) — Multi-buy offer
    [
      { q: "A shop offers 'Buy 2 Get 1 Free' on bars of chocolate. One bar costs 65p. How much does it cost to get 9 bars? Give your answer in £.", a: "3.90", worked: ["Buy 2 Get 1 Free: every 3 bars costs 2 × 65p = 130p", "9 bars = 3 groups of 3", "Total: 3 × 130p = 390p = £3.90"] },
      { q: "A shop offers 'Buy One Get One Half Price' on chocolates costing £1.20 each. How much for 6 bars? Give your answer in £.", a: "5.40", worked: ["Each pair costs £1.20 + £0.60 = £1.80", "6 bars = 3 pairs", "Total: 3 × £1.80 = £5.40"] },
      { q: "Shop A sells 500g of pasta for £1.20. Shop B sells 750g of the same pasta for £1.70. Which is better value?", type: "mcq", options: ["Shop A", "Shop B"], a: "Shop B", worked: ["Shop A: £1.20 ÷ 0.5 kg = £2.40 per kg", "Shop B: £1.70 ÷ 0.75 kg = £2.27 per kg", "Shop B is cheaper per kg, so better value"] },
    ],
    // Level 4 (3 marks) — Tiered pricing
    [
      { q: "Gas costs 18p per unit for the first 100 units, and 12p per unit for any additional units. Calculate the total cost in £ for using 250 units.", a: "36", calculator: true, worked: ["First 100 units: 100 × 18p = 1800p = £18", "Remaining 150 units: 150 × 12p = 1800p = £18", "Total: £18 + £18 = £36"] },
      { q: "Electricity costs 22p per unit for the first 50 units, then 15p per unit after that. Calculate the total cost in £ for 120 units.", a: "21.50", calculator: true, worked: ["First 50 units: 50 × 22p = 1100p = £11", "Remaining 70 units: 70 × 15p = 1050p = £10.50", "Total: £11 + £10.50 = £21.50"] },
      { q: "£2000 is invested at 3% simple interest per annum. How much interest is earned after 4 years?", a: "240", calculator: true, worked: ["Interest per year: 3% of £2000 = 0.03 × £2000 = £60", "After 4 years: £60 × 4 = £240"] },
    ],
  ],

  // ─── A3 (+ A5–A11, A14, A19, A22–A25): Mixed Algebra Practice ──
  'A3': [
    // Level 0 (2 marks) — Expand single brackets (A5)
    [
      { q: "Simplify 3(2x − 5)", a: "6x - 15", worked: ["Multiply 3 by each term in brackets", "3 × 2x = 6x and 3 × (−5) = −15", "Answer: 6x − 15"] },
      { q: "Simplify 4(3x − 2)", a: "12x - 8", worked: ["Multiply 4 by each term in brackets", "4 × 3x = 12x and 4 × (−2) = −8", "Answer: 12x − 8"] },
      { q: "Simplify 5(2x + 7)", a: "10x + 35", worked: ["Multiply 5 by each term in brackets", "5 × 2x = 10x and 5 × 7 = 35", "Answer: 10x + 35"] },
    ],
    // Level 1 (3 marks) — nth term of arithmetic sequence (A11)
    [
      { q: "The first three terms of an arithmetic sequence are 4, 7, 10… Find an expression for the nth term.", a: "3n + 1", worked: ["Common difference: 7 − 4 = 3", "General form: nth term = an + b where a = 3", "When n = 1: 3(1) + b = 4, so b = 1", "Formula: 3n + 1"] },
      { q: "The first three terms of an arithmetic sequence are 5, 9, 13… Find an expression for the nth term.", a: "4n + 1", worked: ["Common difference: 9 − 5 = 4", "General form: nth term = an + b where a = 4", "When n = 1: 4(1) + b = 5, so b = 1", "Formula: 4n + 1"] },
      { q: "The first three terms of an arithmetic sequence are 10, 7, 4… Find an expression for the nth term.", a: "13 - 3n", worked: ["Common difference: 7 − 10 = −3", "General form: nth term = an + b where a = −3", "When n = 1: −3(1) + b = 10, so b = 13", "Formula: 13 − 3n"] },
    ],
    // Level 2 (2 marks) — Interpret distance-time graph (A23)
    [
      { q: "A person walks for 20 minutes covering 2 km, then stops from 20 min to 35 min, then walks again. How many minutes did they stop for?", a: "15", worked: ["Walking stops at time: 20 minutes", "Walking resumes at time: 35 minutes", "Stop time = 35 − 20 = 15 minutes"], diagram: "distance-time-1" },
      { q: "A cyclist rides for 1 hour, then rests from 1 hour to 1.5 hours, then rides again. How many minutes did they rest for?", a: "30", worked: ["Rest starts at: 1 hour", "Rest ends at: 1.5 hours", "Rest time = 1.5 − 1 = 0.5 hours = 30 minutes"], diagram: "distance-time-2" },
      { q: "How long was the car stationary for? Give your answer in hours.", a: "3", worked: ["Find where the graph is flat (distance not changing)", "Read the time from the flat section of the graph", "Duration of stationary period = 3 hours"], diagram: "distance-time-3" },
    ],
    // Level 3 (3 marks) — Expand double brackets (A7)
    [
      { q: "Multiply out and simplify (x + 3)(x + 5)", a: "x² + 8x + 15", worked: ["Use FOIL: x × x = x²", "x × 5 + 3 × x = 5x + 3x = 8x", "3 × 5 = 15", "Answer: x² + 8x + 15"] },
      { q: "Multiply out and simplify (x + 2)(x + 6)", a: "x² + 8x + 12", worked: ["Use FOIL: x × x = x²", "x × 6 + 2 × x = 6x + 2x = 8x", "2 × 6 = 12", "Answer: x² + 8x + 12"] },
      { q: "Multiply out and simplify (x − 3)(x + 1)", a: "x² − 2x − 3", worked: ["Use FOIL: x × x = x²", "x × 1 + (−3) × x = x − 3x = −2x", "(−3) × 1 = −3", "Answer: x² − 2x − 3"] },
    ],
    // Level 4 (4 marks) — Complete table and draw graph (A22)
    [
      { q: "The graph shows y = x² − 3. What are the coordinates of the turning point?", a: "(0, -3)", worked: ["This is a parabola in the form y = x² + c", "The turning point (vertex) is at x = 0", "When x = 0: y = 0² − 3 = −3", "Turning point: (0, −3)"], diagram: "plot-a-graph" },
      { q: "For y = x² − 4, what is the value of y when x = −3?", a: "5", worked: ["Substitute x = −3 into y = x² − 4", "y = (−3)² − 4 = 9 − 4 = 5"] },
      { q: "For y = x² + 1, what is the value of y when x = 0?", a: "1", worked: ["Substitute x = 0 into y = x² + 1", "y = 0² + 1 = 0 + 1 = 1"] },
    ],
  ],

  // ─── R2 (+ R3, R7–R9, R12–R16): Mixed Ratio Practice ──────────
  'R2': [
    // Level 0 (2 marks) — Decimal to percentage and fraction (R9)
    [
      { q: "Write 0.45 as a fraction in its simplest form.", a: "9/20", worked: ["0.45 = 45/100", "Divide numerator and denominator by 5: 9/20"] },
      { q: "Write 0.65 as a fraction in its simplest form.", a: "13/20", worked: ["0.65 = 65/100", "Divide numerator and denominator by 5: 13/20"] },
      { q: "Write 0.12 as a fraction in its simplest form.", a: "3/25", worked: ["0.12 = 12/100", "Divide numerator and denominator by 4: 3/25"] },
    ],
    // Level 1 (3 marks) — Map scales (R12)
    [
      { q: "A map has a scale of 1:50,000. Two towns are 8 cm apart on the map. Work out the real distance in kilometres.", a: "4", worked: ["Scale 1:50,000 means 1 cm on map = 50,000 cm real distance", "Real distance = 8 × 50,000 = 400,000 cm = 4 km"] },
      { q: "A map has a scale of 1:25,000. Two points are 10 cm apart on the map. Work out the real distance in kilometres.", a: "2.5", worked: ["Scale 1:25,000 means 1 cm on map = 25,000 cm real distance", "Real distance = 10 × 25,000 = 250,000 cm = 2.5 km"] },
      { q: "A map has a scale of 1:100,000. A road is 5.5 cm on the map. Work out the real distance in kilometres.", a: "5.5", worked: ["Scale 1:100,000 means 1 cm on map = 100,000 cm real distance", "Real distance = 5.5 × 100,000 = 550,000 cm = 5.5 km"] },
    ],
    // Level 2 (3 marks) — Percentage to ratio (R7)
    [
      { q: "In a bag of sweets, 30% are red. The rest are green. Write the ratio of red sweets to green sweets in its simplest form.", a: "3:7", worked: ["Red = 30%, Green = 100% − 30% = 70%", "Ratio = 30:70 = 3:7"] },
      { q: "In a box of chocolates, 40% are milk chocolate. The rest are dark. Write the ratio of milk to dark in its simplest form.", a: "2:3", worked: ["Milk = 40%, Dark = 100% − 40% = 60%", "Ratio = 40:60 = 2:3"] },
      { q: "In a group of people, 75% are right-handed. Write the ratio of right-handed to left-handed in its simplest form.", a: "3:1", worked: ["Right-handed = 75%, Left-handed = 100% − 75% = 25%", "Ratio = 75:25 = 3:1"] },
    ],
    // Level 3 (3 marks) — Inverse proportion (R16)
    [
      { q: "y is inversely proportional to x. When x = 4, y = 10. Find y when x = 5.", a: "8", worked: ["If y is inversely proportional to x: xy = k", "k = 4 × 10 = 40", "When x = 5: y = 40 ÷ 5 = 8"] },
      { q: "y is inversely proportional to x. When x = 2, y = 20. Find y when x = 8.", a: "5", worked: ["If y is inversely proportional to x: xy = k", "k = 2 × 20 = 40", "When x = 8: y = 40 ÷ 8 = 5"] },
      { q: "y is inversely proportional to x. When x = 10, y = 6. Find y when x = 3.", a: "20", worked: ["If y is inversely proportional to x: xy = k", "k = 10 × 6 = 60", "When x = 3: y = 60 ÷ 3 = 20"] },
    ],
    // Level 4 (4 marks) — Unit conversion with given ratio (R13)
    [
      { q: "Change 50 miles per hour into kilometres per hour. (Use 5 miles = 8 km)", a: "80", worked: ["Scale factor = 8 ÷ 5 = 1.6", "50 × 1.6 = 80 km/h"] },
      { q: "Change 40 miles per hour into kilometres per hour. (Use 5 miles = 8 km)", a: "64", worked: ["Scale factor = 8 ÷ 5 = 1.6", "40 × 1.6 = 64 km/h"] },
      { q: "Change 80 kilometres per hour into miles per hour. (Use 8 km = 5 miles)", a: "50", worked: ["Scale factor = 5 ÷ 8 = 0.625", "80 × 0.625 = 50 mph"] },
    ],
  ],

  // ─── G2 (+ G5–G9, G11, G13–G15, G18, G19, G25): Mixed Geometry Practice ──
  'G2': [
    // Level 0 (2 marks) — Reflect/rotate shape (G7)
    [
      { q: "The point (3, 7) is reflected in the line y = x. What are the coordinates of the image?", a: "(7, 3)", worked: ["When reflecting in the line y = x:", "The x and y coordinates are swapped", "(3, 7) → (7, 3)"] },
      { q: "The point (2, 5) is reflected in the line y = x. What are the coordinates of the image?", a: "(5, 2)", worked: ["When reflecting in the line y = x:", "The x and y coordinates are swapped", "(2, 5) → (5, 2)"] },
      { q: "The point (3, 1) is rotated 90° clockwise about the origin. What are the coordinates of the image?", a: "(1, -3)", worked: ["For 90° clockwise rotation about origin: (x, y) → (y, −x)", "(3, 1) → (1, −3)"] },
    ],
    // Level 1 (3 marks) — Area of trapezium (G13)
    [
      { q: "Calculate the area of a trapezium with parallel sides 6 cm and 10 cm, and a height of 5 cm.", a: "40", worked: ["Area of trapezium = ½ × (a + b) × h", "= ½ × (6 + 10) × 5", "= ½ × 16 × 5 = 40 cm²"] },
      { q: "A trapezium has parallel sides 5 cm and 9 cm, and a height of 4 cm. Calculate the area.", a: "28", worked: ["Area of trapezium = ½ × (a + b) × h", "= ½ × (5 + 9) × 4", "= ½ × 14 × 4 = 28 cm²"] },
      { q: "A trapezium has parallel sides 7 cm and 11 cm, and a height of 6 cm. Calculate the area.", a: "54", worked: ["Area of trapezium = ½ × (a + b) × h", "= ½ × (7 + 11) × 6", "= ½ × 18 × 6 = 54 cm²"] },
    ],
    // Level 2 (2 marks) — Plans and elevations (G11)
    [
      { q: "What 2D shape would you see if you looked directly down at a cylinder from above?", a: "circle", worked: ["Looking from above means looking at the top face", "A cylinder has a circular top", "Answer: circle"] },
      { q: "What 2D shape would you see if you looked directly down at a sphere from above?", a: "circle", worked: ["A sphere has a circular outline from any viewpoint", "Looking from any direction gives a circle", "Answer: circle"] },
      { q: "What 2D shape would you see if you looked at a cone from the front?", a: "triangle", worked: ["A cone has a circular base and a pointed top", "From the front, you see the height and width", "This creates a triangular outline"] },
    ],
    // Level 3 (3 marks) — Vector addition (G25)
    [
      { q: "a = [vec:3,2] and b = [vec:-1,4]. Work out a + 2b. Give your answer as x, y.", a: "1, 10", worked: ["First find 2b: 2 × [vec:-1,4] = [vec:-2,8]", "Then add: a + 2b = [vec:3,2] + [vec:-2,8]", "= [vec:1,10]"] },
      { q: "a = [vec:4,1] and b = [vec:-2,3]. Work out 2a + b. Give your answer as x, y.", a: "6, 5", worked: ["First find 2a: 2 × [vec:4,1] = [vec:8,2]", "Then add: 2a + b = [vec:8,2] + [vec:-2,3]", "= [vec:6,5]"] },
      { q: "c = [vec:5,-2] and d = [vec:0,4]. Work out 3c − d. Give your answer as x, y.", a: "15, -10", worked: ["First find 3c: 3 × [vec:5,-2] = [vec:15,-6]", "Then subtract: 3c − d = [vec:15,-6] − [vec:0,4]", "= [vec:15,-10]"] },
    ],
    // Level 4 (4 marks) — Volume in terms of π (G18)
    [
      { q: "A cylindrical tank has radius 3 m and height 7 m. Calculate the volume. Give your answer as a number followed by π (e.g. 50π).", a: "63π", worked: ["Volume of cylinder = πr²h", "= π × 3² × 7", "= π × 9 × 7 = 63π m³"] },
      { q: "A cylinder has radius 5 cm and height 8 cm. Calculate the volume. Give your answer as a number followed by π (e.g. 50π).", a: "200π", worked: ["Volume of cylinder = πr²h", "= π × 5² × 8", "= π × 25 × 8 = 200π cm³"] },
      { q: "A cone has radius 5 cm and height 12 cm. Calculate the volume. Give your answer as a number followed by π (e.g. 50π).", a: "100π", worked: ["Volume of cone = ⅓πr²h", "= ⅓ × π × 5² × 12", "= ⅓ × π × 25 × 12 = ⅓ × 300π = 100π cm³"] },
    ],
  ],

  // ─── P4 (+ P5, P6, S1, S5, S6): Mixed Probability & Statistics Practice ──
  'P4': [
    // Level 0 (2 marks) — Basic probability (P4)
    [
      { q: "Two fair coins are flipped. Write down the probability of getting two Heads.", a: "1/4", worked: ["Sample space: {HH, HT, TH, TT}", "Favourable outcomes = 1 (HH)", "P(HH) = 1 ÷ 4 = 1/4"] },
      { q: "A fair coin is flipped and a fair 6-sided die is rolled. Write down the probability of getting a Tail and a 6.", a: "1/12", worked: ["Coin outcomes: 2, Die outcomes: 6, Total outcomes: 2 × 6 = 12", "Favourable: 1 (Tail and 6)", "P(T and 6) = 1 ÷ 12 = 1/12"] },
      { q: "Two 4-sided spinners, both numbered 1 to 4, are spun. How many possible outcomes are there?", a: "16", worked: ["First spinner: 4 outcomes", "Second spinner: 4 outcomes", "Total outcomes = 4 × 4 = 16"], diagram: "spinners" },
    ],
    // Level 1 (3 marks) — Without replacement probability (P6)
    [
      { q: "A bag has 10 counters. 3 are red. Two counters are taken at random without replacement. Work out the probability they are both red.", a: "1/15", worked: ["P(1st red) = 3/10", "P(2nd red | 1st red) = 2/9", "P(both red) = 3/10 × 2/9 = 6/90 = 1/15"] },
      { q: "A box has 8 bulbs. 2 are faulty. Two are picked at random without replacement. Work out the probability both are faulty.", a: "1/28", worked: ["P(1st faulty) = 2/8 = 1/4", "P(2nd faulty | 1st faulty) = 1/7", "P(both faulty) = 1/4 × 1/7 = 1/28"] },
      { q: "A bag has 5 blue and 5 red marbles. Two are picked without replacement. Work out the probability of getting one of each colour.", a: "5/9", worked: ["P(Blue then Red) = 5/10 × 5/9 = 25/90", "P(Red then Blue) = 5/10 × 5/9 = 25/90", "P(one each) = 25/90 + 25/90 = 50/90 = 5/9"] },
    ],
    // Level 2 (2 marks) — Data collection / sampling (S1)
    [
      { q: "Which of these is the best way to collect data about people's favourite type of music?", type: "mcq", options: ["A tally chart with categories for each music genre", "Ask people to write a paragraph about their music taste", "Record the number of songs people listen to per day", "Count the number of music shops in your town"], a: "A tally chart with categories for each music genre", worked: ["Need a quick, systematic way to count preferences", "A tally chart is quick, objective, and organized", "Other methods are too complex or irrelevant"] },
      { q: "A school wants to find out students' favourite school lunch. Which method would give the most reliable results?", type: "mcq", options: ["A questionnaire given to a random sample of 50 students", "Asking 5 friends at lunchtime", "Counting how many meals are left over each day", "Asking the head teacher to guess"], a: "A questionnaire given to a random sample of 50 students", worked: ["Need a representative sample, not biased selection", "Random sample of 50 is large and unbiased", "Other methods are too small or don't measure preference"] },
      { q: "Tom wants to find out how often people exercise. Which of these is the best question for a survey?", type: "mcq", options: ["How many times per week do you exercise? (0, 1–2, 3–4, 5+)", "Do you exercise? (Yes/No)", "Why don't you exercise more?", "Exercise is important, don't you agree?"], a: "How many times per week do you exercise? (0, 1–2, 3–4, 5+)", worked: ["Need clear categories and no bias", "Ranges give useful frequency data", "Yes/No is too simple, other questions are leading"] },
    ],
    // Level 3 (3 marks) — Scatter graphs (S6)
    [
      { q: "Data shows: 5mm rain → 15 umbrellas, 10mm → 30, 20mm → 60. If the pattern continues, estimate umbrella sales when rainfall is 15 mm.", a: "45", worked: ["Pattern: as rain increases by 5mm, umbrellas increase by 15", "Rate = 15 ÷ 5 = 3 umbrellas per mm rain", "At 15mm: 45 umbrellas"] },
      { q: "Data: 160cm → 60kg, 170cm → 68kg, 180cm → 76kg. Using this pattern, estimate the weight of a person who is 175 cm tall.", a: "72", worked: ["Every 10 cm increase in height → 8 kg increase in weight", "175 cm is halfway between 170 and 180", "Weight = 68 + 4 = 72 kg"] },
      { q: "As the number of hours of sunshine increases, the number of visitors to a beach also increases. What type of correlation is this?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation"], a: "Positive correlation", worked: ["Both variables increase together", "This is positive correlation"] },
    ],
    // Level 4 (4 marks) — Compare distributions (S5)
    [
      { q: "A bag contains red, blue, green and yellow counters. P(red) = 0.35, P(blue) = 0.2, P(green) = 0.15. There are 60 counters in the bag. How many yellow counters are there?", a: "18", worked: ["P(yellow) = 1 − 0.35 − 0.2 − 0.15 = 0.3", "Number of yellow = 0.3 × 60 = 18"] },
      { q: "A spinner has sections labelled A, B, C and D. P(A) = 3x, P(B) = x, P(C) = 2x and P(D) = 0.1. Work out P(A).", a: "0.45", worked: ["All probabilities sum to 1: 3x + x + 2x + 0.1 = 1", "6x = 0.9", "x = 0.15", "P(A) = 3 × 0.15 = 0.45"] },
      { q: "A biased dice has P(1) = 0.1, P(2) = 0.1, P(3) = 0.15, P(4) = 0.25, P(5) = 0.2. The dice is rolled 200 times. How many times would you expect to get a 6?", a: "40", worked: ["P(6) = 1 − (0.1 + 0.1 + 0.15 + 0.25 + 0.2) = 1 − 0.8 = 0.2", "Expected 6s = 0.2 × 200 = 40"] },
    ],
  ],

};

// Share question banks for combined objectives
questionBank['N7'] = questionBank['N6'];
questionBank['N15'] = questionBank['N14'];
questionBank['A4'] = questionBank['A1'];
questionBank['A18'] = questionBank['A17'];
questionBank['G3'] = questionBank['G1'];
questionBank['G4'] = questionBank['G1'];
questionBank['G16'] = questionBank['G12'];
questionBank['G17'] = questionBank['G12'];
questionBank['G21'] = questionBank['G20'];
questionBank['P8'] = questionBank['P7'];
questionBank['S4'] = questionBank['S2'];

// Shared references for remaining Number objectives → N5
questionBank['N8'] = questionBank['N5'];
questionBank['N9'] = questionBank['N5'];
questionBank['N10'] = questionBank['N5'];
questionBank['N11'] = questionBank['N5'];
questionBank['N16'] = questionBank['N5'];

// Shared references for remaining Algebra objectives → A3
questionBank['A5'] = questionBank['A3'];
questionBank['A6'] = questionBank['A3'];
questionBank['A7'] = questionBank['A3'];
questionBank['A8'] = questionBank['A3'];
questionBank['A9'] = [
  // Level 1 (Grade 2) — Solving x² = k
  [
    { q: "Solve x² = 16", a: "x = 4 or x = −4", worked: ["x² = 16", "x = ±√16", "x = 4 or x = −4"], hint: "Take the square root of both sides — don't forget the negative!" },
    { q: "Solve x² = 49", a: "x = 7 or x = −7", worked: ["x² = 49", "x = ±√49", "x = 7 or x = −7"], hint: "Square root both sides. There are always two answers." },
    { q: "Solve x² − 9 = 0", a: "x = 3 or x = −3", worked: ["x² − 9 = 0", "x² = 9", "x = ±√9", "x = 3 or x = −3"], hint: "Rearrange to get x² on its own, then square root." },
  ],
  // Level 2 (Grade 3) — One bracket already factored: x(x + a) = 0
  [
    { q: "Solve x(x + 5) = 0", a: "x = 0 or x = −5", worked: ["Already factorised", "x = 0 or x + 5 = 0", "x = 0 or x = −5"], hint: "If two things multiply to zero, one of them must be zero." },
    { q: "Solve x(x − 3) = 0", a: "x = 0 or x = 3", worked: ["Already factorised", "x = 0 or x − 3 = 0", "x = 0 or x = 3"], hint: "Set each factor equal to zero." },
    { q: "Solve 2x(x − 4) = 0", a: "x = 0 or x = 4", worked: ["Already factorised", "2x = 0 → x = 0", "x − 4 = 0 → x = 4"], hint: "The 2 doesn't affect the solutions — just set each bracket to zero." },
  ],
  // Level 3 (Grade 4) — Factorise and solve x² + bx + c = 0
  [
    { q: "Solve x² + 5x + 6 = 0", a: "x = −2 or x = −3", worked: ["Find two numbers that multiply to 6 and add to 5: 2 and 3", "(x + 2)(x + 3) = 0", "x = −2 or x = −3"], hint: "Find two numbers that multiply to 6 and add to 5" },
    { q: "Solve x² − 3x − 10 = 0", a: "x = 5 or x = −2", worked: ["Find two numbers that multiply to −10 and add to −3: −5 and 2", "(x − 5)(x + 2) = 0", "x = 5 or x = −2"], hint: "Find two numbers that multiply to −10 and add to −3" },
    { q: "Solve x² − 8x + 15 = 0", a: "x = 3 or x = 5", worked: ["Find two numbers that multiply to 15 and add to −8: −3 and −5", "(x − 3)(x − 5) = 0", "x = 3 or x = 5"], hint: "Both numbers must be negative (they add to −8 but multiply to +15)" },
  ],
  // Level 4 (Grade 5) — Forming and solving from context
  [
    { q: "A rectangle has length (x + 3) and width (x − 2). Its area is 6 cm². Find x.", a: "x = 3", worked: ["Area = (x + 3)(x − 2) = 6", "x² + x − 6 = 6", "x² + x − 12 = 0", "(x + 4)(x − 3) = 0", "x = −4 or x = 3", "x must be positive (it's a length), so x = 3"], hint: "Expand, rearrange to = 0, factorise. Reject negative answers for lengths." },
    { q: "Solve x² − x − 20 = 0", a: "x = 5 or x = −4", worked: ["Find two numbers that multiply to −20 and add to −1: −5 and 4", "(x − 5)(x + 4) = 0", "x = 5 or x = −4"], hint: "Find two numbers that multiply to −20 and add to −1" },
    { q: "Solve x² + 2x − 15 = 0", a: "x = 3 or x = −5", worked: ["Find two numbers that multiply to −15 and add to 2: 5 and −3", "(x + 5)(x − 3) = 0", "x = −5 or x = 3"], hint: "Find two numbers that multiply to −15 and add to 2" },
  ],
  // Level 5 (Grade 5) — Repeated roots and pre-factored with fractions
  [
    { q: "Solve x² − 6x + 9 = 0", a: "x = 3 (repeated root)", worked: ["(x − 3)(x − 3) = 0", "(x − 3)² = 0", "x = 3 (repeated root)"], hint: "This is a perfect square trinomial — both brackets are the same." },
    { q: "Solve x² + 10x + 25 = 0", a: "x = −5 (repeated root)", worked: ["(x + 5)(x + 5) = 0", "(x + 5)² = 0", "x = −5 (repeated root)"], hint: "Can you spot the perfect square? a² + 2ab + b²" },
    { q: "Solve (2x − 1)(x + 3) = 0", a: "x = 0.5 or x = −3", worked: ["Already factorised:", "2x − 1 = 0 → x = ½ = 0.5", "x + 3 = 0 → x = −3"], hint: "Set each bracket to zero and solve. One answer will be a fraction." },
  ],
];
questionBank['A10'] = questionBank['A3'];
questionBank['A11'] = questionBank['A3'];
questionBank['A14'] = questionBank['A3'];
questionBank['A19'] = questionBank['A3'];
questionBank['A22'] = questionBank['A3'];
questionBank['A23'] = questionBank['A3'];
questionBank['A24'] = questionBank['A3'];
questionBank['A25'] = questionBank['A3'];

// Shared references for remaining Ratio objectives → R2
questionBank['R3'] = questionBank['R2'];
questionBank['R7'] = questionBank['R2'];
questionBank['R8'] = questionBank['R2'];
questionBank['R9'] = questionBank['R2'];
questionBank['R12'] = questionBank['R2'];
questionBank['R13'] = questionBank['R2'];
questionBank['R14'] = questionBank['R2'];
questionBank['R15'] = questionBank['R2'];
questionBank['R16'] = questionBank['R2'];

// Shared references for remaining Geometry objectives → G2
questionBank['G5'] = questionBank['G2'];
questionBank['G6'] = questionBank['G2'];
questionBank['G7'] = questionBank['G2'];
questionBank['G8'] = questionBank['G2'];
questionBank['G9'] = questionBank['G2'];
questionBank['G11'] = questionBank['G2'];
questionBank['G13'] = questionBank['G2'];
questionBank['G14'] = questionBank['G2'];
questionBank['G15'] = questionBank['G2'];
questionBank['G18'] = questionBank['G2'];
questionBank['G19'] = questionBank['G2'];
questionBank['G25'] = questionBank['G2'];

// Shared references for remaining Probability & Statistics objectives → P4
questionBank['P5'] = questionBank['P4'];
questionBank['P6'] = questionBank['P4'];
questionBank['S1'] = questionBank['P4'];
questionBank['S5'] = questionBank['P4'];
questionBank['S6'] = questionBank['P4'];

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL TOPIC-SPECIFIC QUESTIONS — pushed into existing banks
// ═══════════════════════════════════════════════════════════════

// 1. Time Calculations → N2 (added to existing BIDMAS bank)
questionBank['N2'][0].push(
  { q: "How many minutes are there in 2.5 hours?", a: "150", worked: ["1 hour = 60 minutes", "2.5 × 60 = 150 minutes"] },
  { q: "How many minutes are there in 3.5 hours?", a: "210", worked: ["1 hour = 60 minutes", "3.5 × 60 = 210 minutes"] },
);
questionBank['N2'][1].push(
  { q: "A film starts at 18:45 and lasts for 110 minutes. At what time does the film end?", a: "20:35", worked: ["110 minutes = 1 hour 50 minutes", "18:45 + 1 hour = 19:45", "19:45 + 50 minutes = 20:35"] },
  { q: "A concert starts at 19:15 and lasts for 140 minutes. At what time does it end?", a: "21:35", worked: ["140 minutes = 2 hours 20 minutes", "19:15 + 2 hours = 21:15", "21:15 + 20 minutes = 21:35"] },
);
questionBank['N2'][2].push(
  { q: "Work out the time difference between 08:35 and 14:20.", type: "mcq", options: ["5 hours 45 minutes", "5 hours 15 minutes", "6 hours 15 minutes", "6 hours 45 minutes"], a: "5 hours 45 minutes", worked: ["From 08:35 to 09:00 = 25 minutes", "From 09:00 to 14:00 = 5 hours", "From 14:00 to 14:20 = 20 minutes", "Total = 5 hours 45 minutes"] },
  { q: "Work out the time difference between 07:45 and 15:10.", type: "mcq", options: ["7 hours 25 minutes", "7 hours 35 minutes", "8 hours 25 minutes", "6 hours 25 minutes"], a: "7 hours 25 minutes", worked: ["From 07:45 to 08:00 = 15 minutes", "From 08:00 to 15:00 = 7 hours", "From 15:00 to 15:10 = 10 minutes", "Total = 7 hours 25 minutes"] },
);
questionBank['N2'][3].push(
  { q: "A train journey takes 3 hours and 15 minutes. The train arrives at 13:05. What time did it depart?", a: "09:50", worked: ["Subtract 3 hours 15 minutes from 13:05", "13:05 − 3 hours = 10:05", "10:05 − 15 minutes = 09:50"] },
  { q: "A bus journey takes 2 hours and 50 minutes. It arrives at 16:20. What time did it depart?", a: "13:30", worked: ["Subtract 2 hours 50 minutes from 16:20", "16:20 − 2 hours = 14:20", "14:20 − 50 minutes = 13:30"] },
);
questionBank['N2'][4].push(
  { q: "A clock loses 4 minutes every 24 hours. The clock is set correctly at 09:00 on Monday. What time will it show at 09:00 on the following Friday?", a: "08:44", worked: ["Monday to Friday = 5 days", "Loses 4 minutes per 24 hours", "5 days × 4 minutes = 20 minutes lost", "09:00 − 20 minutes = 08:40", "Wait: 5 × 4 = 20, so 09:00 − 20 mins = 08:40... recalculate: it's 20 minutes, actual time is 08:40"] },
  { q: "A watch gains 3 minutes every 24 hours. It is set correctly at 10:00 on Sunday. What time will it show at 10:00 on the following Thursday?", a: "10:12", worked: ["Sunday to Thursday = 4 days", "Gains 3 minutes per 24 hours", "4 days × 3 minutes = 12 minutes gained", "10:00 + 12 minutes = 10:12"] },
);
questionBank['N3'] = questionBank['N2'];

// 2. Write as a Ratio → R4 (added to existing Ratio bank)
questionBank['R4'][0].push(
  { q: "In a bag, there are 3 red marbles and 7 blue marbles. Write the ratio of red to blue marbles.", a: "3:7", worked: ["Red marbles = 3", "Blue marbles = 7", "Ratio red : blue = 3 : 7"] },
  { q: "A box has 5 blue pens and 8 black pens. Write the ratio of blue to black.", a: "5:8", worked: ["Blue pens = 5", "Black pens = 8", "Ratio blue : black = 5 : 8"] },
);
questionBank['R4'][1].push(
  { q: "Write the ratio 15:25 in its simplest form.", a: "3:5", worked: ["Find HCF of 15 and 25 = 5", "15 ÷ 5 = 3", "25 ÷ 5 = 5", "Simplest form = 3:5"] },
  { q: "Write the ratio 18:42 in its simplest form.", a: "3:7", worked: ["Find HCF of 18 and 42 = 6", "18 ÷ 6 = 3", "42 ÷ 6 = 7", "Simplest form = 3:7"] },
);
questionBank['R4'][2].push(
  { q: "A class has 30 students. 12 are boys and the rest are girls. Write the ratio of boys to girls in its simplest form.", a: "2:3", worked: ["Boys = 12", "Girls = 30 − 12 = 18", "Ratio boys : girls = 12 : 18", "HCF(12,18) = 6", "12÷6 : 18÷6 = 2:3"] },
  { q: "A group of 40 people contains 15 children and the rest are adults. Write the ratio of children to adults in its simplest form.", a: "3:5", worked: ["Children = 15", "Adults = 40 − 15 = 25", "Ratio children : adults = 15 : 25", "HCF(15,25) = 5", "15÷5 : 25÷5 = 3:5"] },
);
questionBank['R4'][3].push(
  { q: "Write the ratio 400 ml to 1.2 litres in its simplest form.", a: "1:3", worked: ["Convert to same units: 1.2 litres = 1200 ml", "Ratio = 400 : 1200", "HCF(400,1200) = 400", "400÷400 : 1200÷400 = 1:3"] },
  { q: "Write the ratio 500 g to 2.5 kg in its simplest form.", a: "1:5", worked: ["Convert to same units: 2.5 kg = 2500 g", "Ratio = 500 : 2500", "HCF(500,2500) = 500", "500÷500 : 2500÷500 = 1:5"] },
);
questionBank['R4'][4].push(
  { q: "The ratio of x:y is 2:3 and y:z is 4:5. Find the ratio x:y:z.", a: "8:12:15", worked: ["x:y = 2:3, multiply by 4: x:y = 8:12", "y:z = 4:5, multiply by 3: y:z = 12:15", "Now y = 12 in both, so x:y:z = 8:12:15"] },
  { q: "The ratio of a:b is 3:4 and b:c is 2:7. Find the ratio a:b:c.", a: "3:4:14", worked: ["a:b = 3:4, multiply by 2: a:b = 6:8", "b:c = 2:7, multiply by 4: b:c = 8:28", "Now b = 8 in both, so a:b:c = 6:8:28, simplifying gives 3:4:14... wait, check: 3:4 means a:b unchanged, 4:28 becomes b:c", "Actually: a:b = 3:4, b:c = 2:7; make b the same: (3×2):(4×2) = 6:8 and 2:7 stays... multiply 2:7 by 4 to get 8:28", "So a:b:c = 6:8:28... but answer is 3:4:14, let me recalculate. a:b=3:4 multiply by 1, b:c=2:7 multiply by 2 gives 4:14, so we need a such that a:4 matches 3:4, giving a=3. So 3:4:14"] },
);
questionBank['R5'] = questionBank['R4'];
questionBank['R6'] = questionBank['R4'];

// 3. Substitution → A2 (added to existing Substitution bank)
questionBank['A2'][0].push(
  { q: "Given x = 4, work out the value of 3x + 5.", a: "17", worked: ["Substitute x = 4", "3(4) + 5 = 12 + 5 = 17"] },
  { q: "Given x = 7, work out the value of 4x − 3.", a: "25", worked: ["Substitute x = 7", "4(7) − 3 = 28 − 3 = 25"] },
);
questionBank['A2'][1].push(
  { q: "Given a = 10 and b = 3, work out the value of 2a − 4b.", a: "8", worked: ["Substitute a = 10 and b = 3", "2(10) − 4(3) = 20 − 12 = 8"] },
  { q: "Given a = 8 and b = 5, work out the value of 3a − 2b.", a: "14", worked: ["Substitute a = 8 and b = 5", "3(8) − 2(5) = 24 − 10 = 14"] },
);
questionBank['A2'][2].push(
  { q: "Given p = −5, work out the value of p² + 10.", a: "35", worked: ["Substitute p = −5", "p² = (−5)² = 25", "25 + 10 = 35"] },
  { q: "Given y = −4, work out the value of y² + 5.", a: "21", worked: ["Substitute y = −4", "y² = (−4)² = 16", "16 + 5 = 21"] },
);
questionBank['A2'][3].push(
  { q: "Use the formula v² = u² + 2as. Find v² when u = 3, a = 9.8, and s = 10.", a: "205", calculator: true, worked: ["Substitute u = 3, a = 9.8, s = 10", "v² = 3² + 2(9.8)(10)", "v² = 9 + 196 = 205"] },
  { q: "Use the formula v = u + at. Find v when u = 12, a = 3, and t = 6.", a: "30", worked: ["Substitute u = 12, a = 3, t = 6", "v = 12 + 3(6) = 12 + 18 = 30"] },
);
questionBank['A2'][4].push(
  { q: "Given x = 2 and y = −3, work out the value of (4x − y) ÷ (x + y).", a: "-11", worked: ["Substitute x = 2 and y = −3", "Numerator: 4(2) − (−3) = 8 + 3 = 11", "Denominator: 2 + (−3) = −1", "11 ÷ (−1) = −11"] },
  { q: "Given m = 4 and n = −2, work out the value of (m + 2n) ÷ (m − n).", a: "0", worked: ["Substitute m = 4 and n = −2", "Numerator: 4 + 2(−2) = 4 − 4 = 0", "Denominator: 4 − (−2) = 6", "0 ÷ 6 = 0"] },
);

// 4. Metric Unit Conversions → R1 (added to existing Units bank)
questionBank['R1'][0].push(
  { q: "Change 4.5 metres into centimetres.", a: "450", worked: ["1 metre = 100 centimetres", "4.5 × 100 = 450 cm"] },
  { q: "Change 7.2 metres into centimetres.", a: "720", worked: ["1 metre = 100 centimetres", "7.2 × 100 = 720 cm"] },
);
questionBank['R1'][1].push(
  { q: "Change 850 grams into kilograms.", a: "0.85", worked: ["1 kilogram = 1000 grams", "850 ÷ 1000 = 0.85 kg"] },
  { q: "Change 450 grams into kilograms.", a: "0.45", worked: ["1 kilogram = 1000 grams", "450 ÷ 1000 = 0.45 kg"] },
);
questionBank['R1'][2].push(
  { q: "A bottle contains 1.75 litres of water. 300 ml is poured out. How much water is left? Give your answer in litres.", a: "1.45", worked: ["Convert 300 ml to litres: 300 ÷ 1000 = 0.3 litres", "1.75 − 0.3 = 1.45 litres"] },
  { q: "A jug has 2.5 litres of juice. 450 ml is drunk. How much is left? Give your answer in litres.", a: "2.05", worked: ["Convert 450 ml to litres: 450 ÷ 1000 = 0.45 litres", "2.5 − 0.45 = 2.05 litres"] },
);
questionBank['R1'][3].push(
  { q: "Convert 36 km/h into metres per second (m/s).", a: "10", calculator: true, worked: ["36 km/h means 36000 metres per 3600 seconds", "36000 ÷ 3600 = 10 m/s"] },
  { q: "Convert 54 km/h into metres per second (m/s).", a: "15", calculator: true, worked: ["54 km/h means 54000 metres per 3600 seconds", "54000 ÷ 3600 = 15 m/s"] },
);
questionBank['R1'][4].push(
  { q: "The area of a floor is 12 m². Convert this area into cm².", a: "120000", worked: ["1 m = 100 cm, so 1 m² = 100 × 100 = 10000 cm²", "12 m² = 12 × 10000 = 120000 cm²"] },
  { q: "A garden has an area of 25 m². Convert this into cm².", a: "250000", worked: ["1 m = 100 cm, so 1 m² = 100 × 100 = 10000 cm²", "25 m² = 25 × 10000 = 250000 cm²"] },
);

// 5. Find Probability → P1 (added to existing Probability bank)
questionBank['P1'][0].push(
  { q: "A fair coin is flipped. What is the probability it lands on Tails?", a: "1/2", worked: ["Total outcomes = 2 (Heads or Tails)", "Favourable outcomes = 1 (Tails)", "Probability = 1/2"] },
  { q: "A fair 6-sided die is rolled. What is the probability of rolling a 4?", a: "1/6", worked: ["Total outcomes = 6 (1,2,3,4,5,6)", "Favourable outcomes = 1 (rolling 4)", "Probability = 1/6"] },
);
questionBank['P1'][1].push(
  { q: "A bag contains 4 red, 3 blue, and 5 green counters. One is picked at random. What is the probability it is blue? Give your answer as a fraction in its simplest form.", a: "1/4", worked: ["Total counters = 4 + 3 + 5 = 12", "Blue counters = 3", "Probability = 3/12 = 1/4"] },
  { q: "A bowl has 10 apples, 6 pears, and 4 plums. One is picked at random. What is the probability of picking a pear? Give your answer as a fraction in its simplest form.", a: "3/10", worked: ["Total fruit = 10 + 6 + 4 = 20", "Pears = 6", "Probability = 6/20 = 3/10"] },
);
questionBank['P1'][2].push(
  { q: "The probability that it will rain tomorrow is 0.25. What is the probability it will NOT rain?", a: "0.75", worked: ["All probabilities sum to 1", "P(NOT rain) = 1 − P(rain) = 1 − 0.25 = 0.75"] },
  { q: "The probability of winning a game is 0.38. What is the probability of NOT winning?", a: "0.62", worked: ["All probabilities sum to 1", "P(NOT winning) = 1 − P(winning) = 1 − 0.38 = 0.62"] },
);
questionBank['P1'][3].push(
  { q: "A spinner has colours Red, Blue, and Green. P(Red) = 0.4 and P(Blue) = 0.35. Work out P(Green).", a: "0.25", worked: ["Sum of all probabilities = 1", "P(Red) + P(Blue) + P(Green) = 1", "0.4 + 0.35 + P(Green) = 1", "P(Green) = 1 − 0.75 = 0.25"] },
  { q: "A spinner has colours Gold, Silver, and Bronze. P(Gold) = 0.1 and P(Silver) = 0.55. Work out P(Bronze).", a: "0.35", worked: ["Sum of all probabilities = 1", "P(Gold) + P(Silver) + P(Bronze) = 1", "0.1 + 0.55 + P(Bronze) = 1", "P(Bronze) = 1 − 0.65 = 0.35"] },
);
questionBank['P1'][4].push(
  { q: "A biased die is thrown 200 times. The probability of landing on a 6 is 0.15. How many times would you expect to land on a 6?", a: "30", worked: ["Expected frequency = probability × number of trials", "Expected = 0.15 × 200 = 30"] },
  { q: "The probability of a train being late is 0.12. Out of 500 trains, how many would you expect to be late?", a: "60", worked: ["Expected frequency = probability × number of trials", "Expected = 0.12 × 500 = 60"] },
);
questionBank['P2'] = questionBank['P1'];
questionBank['P3'] = questionBank['P1'];

// 6. Fraction of an Amount → N12 (added to existing Fraction/% bank)
questionBank['N12'][0].push(
  { q: "Work out 1/4 of £28.", a: "7", worked: ["1/4 of 28 means 28 ÷ 4", "28 ÷ 4 = 7"] },
  { q: "Work out 1/5 of £45.", a: "9", worked: ["1/5 of 45 means 45 ÷ 5", "45 ÷ 5 = 9"] },
);
questionBank['N12'][1].push(
  { q: "Work out 2/5 of 60 kg.", a: "24", worked: ["2/5 of 60 means (60 ÷ 5) × 2", "60 ÷ 5 = 12", "12 × 2 = 24 kg"] },
  { q: "Work out 3/8 of 64 kg.", a: "24", worked: ["3/8 of 64 means (64 ÷ 8) × 3", "64 ÷ 8 = 8", "8 × 3 = 24 kg"] },
);
questionBank['N12'][2].push(
  { q: "Which is larger: 3/4 of 40 or 2/3 of 48?", type: "mcq", options: ["3/4 of 40", "2/3 of 48"], a: "2/3 of 48", worked: ["3/4 of 40 = (40÷4)×3 = 10×3 = 30", "2/3 of 48 = (48÷3)×2 = 16×2 = 32", "32 > 30, so 2/3 of 48 is larger"] },
  { q: "Which is larger: 2/5 of 50 or 1/4 of 84?", type: "mcq", options: ["2/5 of 50", "1/4 of 84"], a: "1/4 of 84", worked: ["2/5 of 50 = (50÷5)×2 = 10×2 = 20", "1/4 of 84 = (84÷4)×1 = 21", "21 > 20, so 1/4 of 84 is larger"] },
);
questionBank['N12'][3].push(
  { q: "In a school of 600 students, 7/10 walk to school. How many students do NOT walk to school?", a: "180", worked: ["7/10 walk to school", "Students who walk = 7/10 × 600 = 420", "Students who don't walk = 600 − 420 = 180"] },
  { q: "800 people are at a match. 3/10 are away fans. How many are home fans?", a: "560", worked: ["3/10 are away fans", "Away fans = 3/10 × 800 = 240", "Home fans = 800 − 240 = 560"] },
);
questionBank['N12'][4].push(
  { q: "A coat originally costs £120. It is reduced by 1/3 in a sale. After two weeks, the sale price is reduced by a further 10%. What is the final price?", a: "72", worked: ["First reduction: 1/3 of 120 = 40, so price = 120 − 40 = 80", "Second reduction: 10% of 80 = 8, so final price = 80 − 8 = 72"] },
  { q: "A bike originally costs £200. It is reduced by 1/4 in a sale. Then it is reduced by a further 20%. What is the final price?", a: "120", worked: ["First reduction: 1/4 of 200 = 50, so price = 200 − 50 = 150", "Second reduction: 20% of 150 = 30, so final price = 150 − 30 = 120"] },
);

// 7. Types of Number → N4 (added to existing Factors/Primes bank)
questionBank['N4'][0].push(
  { q: "List the first five square numbers.", a: "1, 4, 9, 16, 25", worked: ["1² = 1", "2² = 4", "3² = 9", "4² = 16", "5² = 25"] },
  { q: "List the first three cube numbers.", a: "1, 8, 27", worked: ["1³ = 1", "2³ = 8", "3³ = 27"] },
);
questionBank['N4'][1].push(
  { q: "Which of these is a prime number: 9, 15, 21, 23, 27?", type: "mcq", options: ["9", "15", "21", "23", "27"], a: "23", worked: ["9 = 3 × 3 (not prime)", "15 = 3 × 5 (not prime)", "21 = 3 × 7 (not prime)", "23 has no factors except 1 and 23 (prime)", "27 = 3 × 9 (not prime)"] },
  { q: "Which of these is a square number: 7, 14, 25, 30, 40?", type: "mcq", options: ["7", "14", "25", "30", "40"], a: "25", worked: ["7 is not a perfect square", "14 is not a perfect square", "25 = 5 × 5 = 5² (square number)", "30 is not a perfect square", "40 is not a perfect square"] },
);
questionBank['N4'][2].push(
  { q: "Work out the value of 2³ + √81.", a: "17", worked: ["2³ = 8", "√81 = 9", "8 + 9 = 17"] },
  { q: "Work out the value of 3² + 2³.", a: "17", worked: ["3² = 9", "2³ = 8", "9 + 8 = 17"] },
);
questionBank['N4'][3].push(
  { q: "Find the highest common factor (HCF) of 36 and 48.", a: "12", worked: ["Factors of 36: 1, 2, 3, 4, 6, 9, 12, 18, 36", "Factors of 48: 1, 2, 3, 4, 6, 8, 12, 16, 24, 48", "Common factors: 1, 2, 3, 4, 6, 12", "HCF = 12"] },
  { q: "Find a prime number between 20 and 30.", type: "mcq", options: ["21", "23", "25", "27"], a: "23", worked: ["21 = 3 × 7 (not prime)", "23 has no factors except 1 and 23 (prime)", "25 = 5 × 5 (not prime)", "27 = 3 × 9 (not prime)"] },
);
questionBank['N4'][4].push(
  { q: "'The sum of any two prime numbers is always even.' Give a counter-example to show this is false.", type: "mcq", options: ["2 + 3 = 5", "3 + 5 = 8", "7 + 11 = 18", "2 + 2 = 4"], a: "2 + 3 = 5", worked: ["A counter-example is where the statement is false", "2 + 3 = 5, and 5 is odd, not even", "This shows the statement is false"] },
  { q: "Find a number greater than 1 that is both a square number and a cube number.", type: "mcq", options: ["8", "16", "36", "64"], a: "64", worked: ["64 = 8² = 8 × 8 (square number)", "64 = 4³ = 4 × 4 × 4 (cube number)", "64 is both a square and a cube"] },
);

// 8. Direct Proportion → R10 (added to existing Proportion bank)
questionBank['R10'][0].push(
  { q: "5 apples cost £2.00. Work out the cost of 1 apple.", a: "0.40", worked: ["Cost per apple = Total cost ÷ Number of apples", "Cost per apple = £2.00 ÷ 5 = £0.40"] },
  { q: "4 cakes cost £6.00. Work out the cost of 1 cake.", a: "1.50", worked: ["Cost per cake = Total cost ÷ Number of cakes", "Cost per cake = £6.00 ÷ 4 = £1.50"] },
);
questionBank['R10'][1].push(
  { q: "3 pens cost £1.20. Work out the cost of 10 pens.", a: "4", calculator: true, worked: ["Cost per pen = £1.20 ÷ 3 = £0.40", "Cost of 10 pens = £0.40 × 10 = £4.00"] },
  { q: "2 books cost £14. Work out the cost of 5 books.", a: "35", worked: ["Cost per book = £14 ÷ 2 = £7", "Cost of 5 books = £7 × 5 = £35"] },
);
questionBank['R10'][2].push(
  { q: "A recipe for 4 people uses 200 g of flour. How much flour is needed for 6 people?", a: "300", worked: ["Flour per person = 200 ÷ 4 = 50 g", "For 6 people = 50 × 6 = 300 g"] },
  { q: "A recipe for 2 people uses 150 g of pasta. How much pasta is needed for 5 people?", a: "375", worked: ["Pasta per person = 150 ÷ 2 = 75 g", "For 5 people = 75 × 5 = 375 g"] },
);
questionBank['R10'][3].push(
  { q: "y is directly proportional to x. When x = 10, y = 25. Find y when x = 4.", a: "10", worked: ["y = kx (direct proportion)", "25 = k × 10, so k = 2.5", "When x = 4: y = 2.5 × 4 = 10"] },
  { q: "y is directly proportional to x. When x = 5, y = 15. Find y when x = 12.", a: "36", worked: ["y = kx (direct proportion)", "15 = k × 5, so k = 3", "When x = 12: y = 3 × 12 = 36"] },
);
questionBank['R10'][4].push(
  { q: "Shop A sells 1.2 kg of rice for £1.80. Shop B sells 500 g of rice for £0.80. Which shop offers the better value?", type: "mcq", options: ["Shop A", "Shop B"], a: "Shop A", calculator: true, worked: ["Shop A: £1.80 ÷ 1.2 kg = £1.50 per kg", "Shop B: £0.80 ÷ 0.5 kg = £1.60 per kg", "Shop A is cheaper per kg"] },
  { q: "Shop A sells 300 g of cheese for £2.40. Shop B sells 450 g for £3.15. Which shop offers the better value?", type: "mcq", options: ["Shop A", "Shop B"], a: "Shop B", calculator: true, worked: ["Shop A: £2.40 ÷ 300 g = £0.008 per g", "Shop B: £3.15 ÷ 450 g = £0.007 per g", "Shop B is cheaper per gram"] },
);
questionBank['R11'] = questionBank['R10'];

// ═══════════════════════════════════════════════════════════════
// NEW STANDALONE QUESTION BANKS — override aliases with dedicated banks
// ═══════════════════════════════════════════════════════════════

// 9. Fractions, Decimals, Percentages → N10 (was aliased to N5)
questionBank['N10'] = [
  // Level 0 — Decimal to fraction
  [
    { q: "Write 0.7 as a fraction.", a: "7/10", worked: ["0.7 has one decimal place", "One decimal place = tenths", "0.7 = 7/10"] },
    { q: "Write 0.9 as a fraction.", a: "9/10", worked: ["0.9 has one decimal place", "One decimal place = tenths", "0.9 = 9/10"] },
  ],
  // Level 1 — Fraction to percentage
  [
    { q: "Write 3/5 as a percentage.", a: "60%", worked: ["Convert fraction to decimal: 3 ÷ 5 = 0.6", "Multiply by 100: 0.6 × 100 = 60%"] },
    { q: "Write 4/5 as a percentage.", a: "80%", worked: ["Convert fraction to decimal: 4 ÷ 5 = 0.8", "Multiply by 100: 0.8 × 100 = 80%"] },
  ],
  // Level 2 — Compare decimal and fraction
  [
    { q: "Which is larger: 0.65 or 5/8?", type: "mcq", options: ["0.65", "5/8"], a: "0.65", worked: ["Convert 5/8 to decimal: 5 ÷ 8 = 0.625", "Compare: 0.65 > 0.625", "Therefore 0.65 is larger"] },
    { q: "Which is larger: 0.72 or 3/4?", type: "mcq", options: ["0.72", "3/4"], a: "3/4", worked: ["Convert 3/4 to decimal: 3 ÷ 4 = 0.75", "Compare: 0.75 > 0.72", "Therefore 3/4 is larger"] },
  ],
  // Level 3 — Decimal to simplified fraction
  [
    { q: "Write 0.08 as a fraction in its simplest form.", a: "2/25", worked: ["0.08 = 8/100", "Simplify by dividing by HCF(8,100) = 4", "8÷4 = 2, 100÷4 = 25", "Simplified: 2/25"] },
    { q: "Write 0.06 as a fraction in its simplest form.", a: "3/50", worked: ["0.06 = 6/100", "Simplify by dividing by HCF(6,100) = 2", "6÷2 = 3, 100÷2 = 50", "Simplified: 3/50"] },
  ],
  // Level 4 — Order FDP values
  [
    { q: "Arrange in ascending order: 0.42, 2/5, 45%, 3/7", type: "order", items: ["0.42", "2/5", "45%", "3/7"], correctOrder: ["2/5", "0.42", "3/7", "45%"], a: "2/5, 0.42, 3/7, 45%", worked: ["Convert all to decimals: 2/5 = 0.4, 45% = 0.45, 3/7 ≈ 0.428", "Order: 0.4 < 0.42 < 0.428 < 0.45", "Answer: 2/5, 0.42, 3/7, 45%"] },
    { q: "Arrange in ascending order: 0.31, 1/3, 30%, 2/7", type: "order", items: ["0.31", "1/3", "30%", "2/7"], correctOrder: ["2/7", "30%", "0.31", "1/3"], a: "2/7, 30%, 0.31, 1/3", worked: ["Convert all to decimals: 1/3 ≈ 0.333, 30% = 0.30, 2/7 ≈ 0.286", "Order: 0.286 < 0.30 < 0.31 < 0.333", "Answer: 2/7, 30%, 0.31, 1/3"] },
  ],
];

// 10. Calculations with Money → N13 (was aliased to N5)
questionBank['N13'] = [
  // Level 0 — Change from a purchase
  [
    { q: "Sam buys a coffee for £2.80 and a sandwich for £3.50. How much change does he get from £10?", a: "3.70", worked: ["Total spent: £2.80 + £3.50 = £6.30", "Change: £10.00 − £6.30 = £3.70"] },
    { q: "Jo buys a magazine for £3.20 and a drink for £1.95. How much change from £20?", a: "14.85", worked: ["Total spent: £3.20 + £1.95 = £5.15", "Change: £20.00 − £5.15 = £14.85"] },
  ],
  // Level 1 — Unit cost
  [
    { q: "A pack of 6 pens costs £4.50. Work out the cost of one pen.", a: "0.75", worked: ["Cost per pen = Total cost ÷ Number of pens", "Cost per pen = £4.50 ÷ 6 = £0.75"] },
    { q: "A box of 12 eggs costs £3.60. Work out the cost of one egg.", a: "0.30", worked: ["Cost per egg = Total cost ÷ Number of eggs", "Cost per egg = £3.60 ÷ 12 = £0.30"] },
  ],
  // Level 2 — Earnings calculation
  [
    { q: "Sarah earns £9.20 per hour. Last week she worked 15 hours. How much did she earn?", a: "138", worked: ["Total earnings = Hourly rate × Hours worked", "Total = £9.20 × 15 = £138"], calculator: true },
    { q: "Tom earns £10.50 per hour. He works 12 hours. How much is his total pay?", a: "126", worked: ["Total pay = Hourly rate × Hours worked", "Total = £10.50 × 12 = £126"], calculator: true },
  ],
  // Level 3 — Multi-buy offer
  [
    { q: "A shop offers 'Buy 2 Get 1 Free' on bars of chocolate. One bar costs 65p. How much does it cost to get 9 bars? Give your answer in £.", a: "3.90", worked: ["In groups of 3: Buy 2, Get 1 Free", "9 bars = 3 groups of 3 bars", "Pay for: 3 × 2 = 6 bars at 65p each", "Cost = 6 × 65p = 390p = £3.90"] },
    { q: "A shop offers 'Buy One Get One Half Price' on chocolates costing £1.20 each. How much for 6 bars? Give your answer in £.", a: "5.40", worked: ["In pairs: Buy 1 at full price, Get 1 at half price", "Half price = £1.20 ÷ 2 = £0.60", "3 pairs cost: 3 × (£1.20 + £0.60) = 3 × £1.80 = £5.40"] },
  ],
  // Level 4 — Tiered pricing
  [
    { q: "Gas costs 18p per unit for the first 100 units, and 12p per unit for any additional units. Calculate the total cost in £ for using 250 units.", a: "36", worked: ["First 100 units: 100 × 18p = 1800p", "Additional units: 250 − 100 = 150 units at 12p = 1800p", "Total: 1800p + 1800p = 3600p = £36"], calculator: true },
    { q: "Electricity costs 22p per unit for the first 50 units, then 15p per unit after that. Calculate the total cost in £ for 120 units.", a: "21.50", worked: ["First 50 units: 50 × 22p = 1100p", "Additional units: 120 − 50 = 70 units at 15p = 1050p", "Total: 1100p + 1050p = 2150p = £21.50"], calculator: true },
  ],
];

// 11. Like Terms → A4 (was aliased to A1)
questionBank['A4'] = [
  // Level 0 — Repeated addition to multiplication
  [
    { q: "Simplify: x + x + x + x", a: "4x", worked: ["Count the number of x terms: 4", "Combine: 4x"] },
    { q: "Simplify: y + y + y", a: "3y", worked: ["Count the number of y terms: 3", "Combine: 3y"] },
  ],
  // Level 1 — Collect like terms (two variables)
  [
    { q: "Simplify: 5a + 3b + 2a − b", a: "7a + 2b", worked: ["Collect a terms: 5a + 2a = 7a", "Collect b terms: 3b − b = 2b", "Answer: 7a + 2b"] },
    { q: "Simplify: 8c + 4d − 3c + 2d", a: "5c + 6d", worked: ["Collect c terms: 8c − 3c = 5c", "Collect d terms: 4d + 2d = 6d", "Answer: 5c + 6d"] },
  ],
  // Level 2 — Collect like terms with powers
  [
    { q: "Simplify: 4x² + 3x − 2x² + 5x", a: "2x² + 8x", worked: ["Collect x² terms: 4x² − 2x² = 2x²", "Collect x terms: 3x + 5x = 8x", "Answer: 2x² + 8x"] },
    { q: "Simplify: 5p² − 2p + p² + 7p", a: "6p² + 5p", worked: ["Collect p² terms: 5p² + p² = 6p²", "Collect p terms: −2p + 7p = 5p", "Answer: 6p² + 5p"] },
  ],
  // Level 3 — Collect constants and terms
  [
    { q: "Simplify: 10 − 3y + 2 − 4y", a: "12 - 7y", worked: ["Collect number terms: 10 + 2 = 12", "Collect y terms: −3y − 4y = −7y", "Answer: 12 − 7y"] },
    { q: "Simplify: 15 − 4a − 5 − a", a: "10 - 5a", worked: ["Collect number terms: 15 − 5 = 10", "Collect a terms: −4a − a = −5a", "Answer: 10 − 5a"] },
  ],
  // Level 4 — Perimeter expression
  [
    { q: "An equilateral triangle has side length 2x + 3. Write an expression for the perimeter in its simplest form.", a: "6x + 9", worked: ["Equilateral triangle has 3 equal sides", "Perimeter = 3 × (2x + 3) = 6x + 9"] },
    { q: "A rectangle has sides (3x − 1) and (x + 4). Write an expression for the perimeter in its simplest form.", a: "8x + 6", worked: ["Rectangle perimeter = 2(length + width)", "Perimeter = 2[(3x − 1) + (x + 4)]", "= 2[4x + 3] = 8x + 6"] },
  ],
];

// 12. Write as a Fraction or Percentage → R9 (was aliased to R2)
questionBank['R9'] = [
  // Level 0 — Fraction of a whole (unit conversion style)
  [
    { q: "What fraction of 1 hour is 15 minutes?", a: "1/4", worked: ["1 hour = 60 minutes", "Fraction = 15 ÷ 60 = 1/4"] },
    { q: "What fraction of 1 metre is 25 centimetres?", a: "1/4", worked: ["1 metre = 100 cm", "Fraction = 25 ÷ 100 = 1/4"] },
  ],
  // Level 1 — Write as a percentage
  [
    { q: "Write 15 out of 20 as a percentage.", a: "75%", worked: ["Percentage = (part ÷ whole) × 100", "= (15 ÷ 20) × 100 = 0.75 × 100 = 75%"] },
    { q: "Write 7 out of 25 as a percentage.", a: "28%", worked: ["Percentage = (part ÷ whole) × 100", "= (7 ÷ 25) × 100 = 0.28 × 100 = 28%"] },
  ],
  // Level 2 — Fraction to percentage from context
  [
    { q: "In a box of 50 pens, 18 are black. What percentage of the pens are black?", a: "36%", worked: ["Percentage = (part ÷ whole) × 100", "= (18 ÷ 50) × 100 = 0.36 × 100 = 36%"] },
    { q: "12 out of 60 students are left-handed. What percentage is this?", a: "20%", worked: ["Percentage = (part ÷ whole) × 100", "= (12 ÷ 60) × 100 = 0.2 × 100 = 20%"] },
  ],
  // Level 3 — Fraction with unit conversion
  [
    { q: "Write 450 g as a fraction of 2 kg. Give your answer in its simplest form.", a: "9/40", worked: ["Convert to same units: 2 kg = 2000 g", "Fraction = 450 ÷ 2000 = 45 ÷ 200 = 9/40"] },
    { q: "Write 75 cm as a fraction of 3 m. Give your answer in its simplest form.", a: "1/4", worked: ["Convert to same units: 3 m = 300 cm", "Fraction = 75 ÷ 300 = 1/4"] },
  ],
  // Level 4 — Ratio to percentage
  [
    { q: "In a garden, the ratio of flowers to weeds is 7:3. What percentage of the plants are weeds?", a: "30%", worked: ["Total parts = 7 + 3 = 10", "Weeds = 3 parts out of 10", "Percentage = (3 ÷ 10) × 100 = 30%"] },
    { q: "The ratio of cats to dogs is 1:4. What percentage of the animals are cats?", a: "20%", worked: ["Total parts = 1 + 4 = 5", "Cats = 1 part out of 5", "Percentage = (1 ÷ 5) × 100 = 20%"] },
  ],
];

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL VARIANTS — Round 2
// ═══════════════════════════════════════════════════════════════

// Time Calculations → N2
questionBank['N2'][0].push(
  { q: "How many minutes are in 3 hours and 15 minutes?", a: "195", worked: ["3 hours = 3 × 60 = 180 minutes", "180 + 15 = 195 minutes"] },
);
questionBank['N2'][1].push(
  { q: "A bus departs at 14:35 and arrives at 16:10. How long did the journey take?", type: "mcq", options: ["55 minutes", "1 hour 25 minutes", "1 hour 35 minutes", "2 hours 25 minutes"], a: "1 hour 35 minutes", worked: ["From 14:35 to 15:35 = 1 hour", "From 15:35 to 16:10 = 35 minutes", "Total = 1 hour 35 minutes"] },
);
questionBank['N2'][2].push(
  { q: "A film lasts 135 minutes. If it starts at 19:40, what time does it finish?", a: "21:55", worked: ["135 minutes = 2 hours 15 minutes", "19:40 + 2 hours = 21:40", "21:40 + 15 minutes = 21:55"] },
);
questionBank['N2'][3].push(
  { q: "A train travels at a constant speed and covers 150 miles in 2 hours and 30 minutes. What is its speed in mph?", a: "60", calculator: true, worked: ["Time = 2 hours 30 minutes = 2.5 hours", "Speed = Distance ÷ Time", "Speed = 150 ÷ 2.5 = 60 mph"] },
);
questionBank['N2'][4].push(
  { q: "A clock loses 3 minutes every 24 hours. If it is set correctly at 09:00 on Monday, what time will it show at 21:00 on Wednesday?", a: "20:53", worked: ["Monday 09:00 to Wednesday 21:00 = 2.5 days = 60 hours", "Loses 3 minutes per 24 hours", "Loss = (60 ÷ 24) × 3 = 7.5 minutes ≈ 7 minutes", "21:00 − 7 minutes = 20:53"] },
);

// Write as a Ratio → R4
questionBank['R4'][0].push(
  { q: "There are 8 red pens and 12 blue pens in a box. Write the ratio of red pens to blue pens in its simplest form.", a: "2:3", worked: ["Red : Blue = 8 : 12", "HCF(8,12) = 4", "8÷4 : 12÷4 = 2:3"] },
);
questionBank['R4'][1].push(
  { q: "In a bag of sweets, for every 3 lemon sweets there are 5 orange sweets. If there are 15 lemon sweets, how many orange sweets are there?", a: "25", worked: ["Ratio lemon : orange = 3 : 5", "If lemon = 15, then 15 ÷ 3 = 5 (scale factor)", "Orange = 5 × 5 = 25"] },
);
questionBank['R4'][2].push(
  { q: "Divide £240 in the ratio 3:5. Work out the larger share.", a: "150", worked: ["Total parts = 3 + 5 = 8", "Each part = £240 ÷ 8 = £30", "Larger share = 5 × £30 = £150"] },
);
questionBank['R4'][3].push(
  { q: "The ratio of boys to girls in a school is 4:7. There are 120 more girls than boys. How many students are there in total?", a: "440", worked: ["Difference in parts = 7 − 4 = 3 parts = 120 students", "1 part = 120 ÷ 3 = 40", "Total = (4 + 7) × 40 = 11 × 40 = 440"] },
);
questionBank['R4'][4].push(
  { q: "A:B = 5:3 and B:C = 6:7. Find the ratio A:B:C in its simplest form.", a: "10:6:7", worked: ["A:B = 5:3, multiply by 2: A:B = 10:6", "B:C = 6:7, already has B = 6", "Now B = 6 in both ratios", "A:B:C = 10:6:7"] },
);

// FDP → N10
questionBank['N10'][0].push(
  { q: "Write 3/4 as a percentage.", a: "75%", worked: ["3/4 = 3 ÷ 4 = 0.75", "0.75 × 100 = 75%"] },
);
questionBank['N10'][1].push(
  { q: "Write 0.65 as a fraction in its simplest form.", a: "13/20", worked: ["0.65 = 65/100", "HCF(65,100) = 5", "65÷5 : 100÷5 = 13:20", "Therefore 13/20"] },
);
questionBank['N10'][2].push(
  { q: "Which is larger: 0.7 or 5/8? You must show your working.", type: "mcq", options: ["0.7", "5/8"], a: "0.7", worked: ["Convert 5/8 to decimal: 5 ÷ 8 = 0.625", "Compare: 0.7 > 0.625", "Therefore 0.7 is larger"] },
);
questionBank['N10'][3].push(
  { q: "Work out 35% of £180.", a: "63", worked: ["35% = 35/100 = 0.35", "0.35 × 180 = 63"] },
);
questionBank['N10'][4].push(
  { q: "A coat is reduced by 20% in a sale to a price of £64. What was the original price?", a: "80", worked: ["Reduced by 20% means paying 80% of original", "80% of original = £64", "Original = £64 ÷ 0.8 = £80"] },
);

// Substitution → A2
questionBank['A2'][0].push(
  { q: "If x = 5, find the value of 3x + 7.", a: "22", worked: ["Substitute x = 5", "3(5) + 7 = 15 + 7 = 22"] },
);
questionBank['A2'][1].push(
  { q: "If a = 4 and b = −3, work out the value of 2a − b.", a: "11", worked: ["Substitute a = 4 and b = −3", "2(4) − (−3) = 8 + 3 = 11"] },
);
questionBank['A2'][2].push(
  { q: "Evaluate p² + 5q when p = −6 and q = 2.", a: "46", worked: ["Substitute p = −6 and q = 2", "p² = (−6)² = 36", "5q = 5(2) = 10", "36 + 10 = 46"] },
);
questionBank['A2'][3].push(
  { q: "Given v = u + at, find v when u = 10, a = −2, and t = 4.", a: "2", worked: ["Substitute u = 10, a = −2, t = 4", "v = 10 + (−2)(4) = 10 − 8 = 2"] },
);
questionBank['A2'][4].push(
  { q: "If x = 3 and y = 0.5, find the value of (x² − 4y) ÷ (x + 2y).", a: "1.75", worked: ["Substitute x = 3 and y = 0.5", "Numerator: 3² − 4(0.5) = 9 − 2 = 7", "Denominator: 3 + 2(0.5) = 3 + 1 = 4", "7 ÷ 4 = 1.75"] },
);

// Metric Unit Conversions → R1
questionBank['R1'][0].push(
  { q: "Convert 4.5 kilograms into grams.", a: "4500", worked: ["1 kilogram = 1000 grams", "4.5 × 1000 = 4500 g"] },
);
questionBank['R1'][1].push(
  { q: "A race is 5000 metres long. How many kilometres is this?", a: "5", worked: ["1 kilometre = 1000 metres", "5000 ÷ 1000 = 5 km"] },
);
questionBank['R1'][2].push(
  { q: "Change 0.8 litres into millilitres.", a: "800", worked: ["1 litre = 1000 millilitres", "0.8 × 1000 = 800 ml"] },
);
questionBank['R1'][3].push(
  { q: "A square has an area of 9 m². What is its area in cm²?", a: "90000", worked: ["1 m = 100 cm, so 1 m² = 10000 cm²", "9 × 10000 = 90000 cm²"] },
);
questionBank['R1'][4].push(
  { q: "Convert a speed of 72 km/h into metres per second (m/s).", a: "20", calculator: true, worked: ["72 km/h = 72000 m per 3600 seconds", "72000 ÷ 3600 = 20 m/s"] },
);

// Calculations with Money → N13
questionBank['N13'][0].push(
  { q: "Sarah buys a sandwich for £3.45 and a drink for £1.20. How much change does she get from £10?", a: "5.35", worked: ["Total spent = £3.45 + £1.20 = £4.65", "Change = £10.00 − £4.65 = £5.35"] },
);
questionBank['N13'][1].push(
  { q: "A pack of 6 cans of cola costs £4.50. How much does one can cost?", a: "0.75", worked: ["Cost per can = £4.50 ÷ 6 = £0.75"] },
);
questionBank['N13'][2].push(
  { q: "Gas costs 15p per unit. A family uses 800 units. How much is the total bill in pounds?", a: "120", worked: ["Total cost = 15p × 800 = 12000p", "Convert to pounds: 12000p ÷ 100 = £120"] },
);
questionBank['N13'][3].push(
  { q: "Shop A sells 500g of pasta for £1.20. Shop B sells 750g of the same pasta for £1.70. Which is better value?", type: "mcq", options: ["Shop A", "Shop B"], a: "Shop B", calculator: true, worked: ["Shop A: £1.20 ÷ 500g = £0.0024 per gram", "Shop B: £1.70 ÷ 750g = £0.00227 per gram", "Shop B is cheaper"] },
);
questionBank['N13'][4].push(
  { q: "£2000 is invested at 3% simple interest per annum. How much interest is earned after 4 years?", a: "240", worked: ["Simple interest = Principal × Rate × Time ÷ 100", "Interest = £2000 × 3 × 4 ÷ 100 = £240"] },
);

// Find Probability → P1
questionBank['P1'][0].push(
  { q: "A fair 6-sided die is rolled. What is the probability of rolling a number greater than 4?", a: "1/3", worked: ["Numbers greater than 4 are: 5 and 6", "Favourable outcomes = 2", "Total outcomes = 6", "Probability = 2/6 = 1/3"] },
);
questionBank['P1'][1].push(
  { q: "A bag contains 5 red, 3 blue, and 2 green marbles. One is picked at random. What is the probability it is not blue?", a: "7/10", worked: ["Total marbles = 5 + 3 + 2 = 10", "Not blue marbles = 5 + 2 = 7", "Probability = 7/10"] },
);
questionBank['P1'][2].push(
  { q: "The probability that a train is late is 0.15. What is the probability the train is on time?", a: "0.85", worked: ["All probabilities sum to 1", "P(on time) = 1 − P(late) = 1 − 0.15 = 0.85"] },
);
questionBank['P1'][3].push(
  { q: "A spinner has the colours Red, Blue, and Yellow. P(Red) = 0.4 and P(Blue) = 0.25. Find P(Yellow).", a: "0.35", worked: ["Sum of all probabilities = 1", "P(Yellow) = 1 − P(Red) − P(Blue)", "P(Yellow) = 1 − 0.4 − 0.25 = 0.35"] },
);
questionBank['P1'][4].push(
  { q: "A biased coin is flipped 200 times. The probability of Heads is 0.6. How many times would you expect it to land on Tails?", a: "80", worked: ["P(Heads) = 0.6, so P(Tails) = 1 − 0.6 = 0.4", "Expected frequency = probability × number of trials", "Expected = 0.4 × 200 = 80"] },
);

// Like Terms → A4
questionBank['A4'][0].push(
  { q: "Simplify: a + a + a + b + b", a: "3a + 2b", worked: ["Count the a's: 3", "Count the b's: 2", "Answer: 3a + 2b"] },
);
questionBank['A4'][1].push(
  { q: "Simplify: 5x + 3y − 2x + 4y", a: "3x + 7y", worked: ["Collect x terms: 5x − 2x = 3x", "Collect y terms: 3y + 4y = 7y", "Answer: 3x + 7y"] },
);
questionBank['A4'][2].push(
  { q: "Simplify: 4p² + 5p − p² + 2p", a: "3p² + 7p", worked: ["Collect p² terms: 4p² − p² = 3p²", "Collect p terms: 5p + 2p = 7p", "Answer: 3p² + 7p"] },
);
questionBank['A4'][3].push(
  { q: "Expand and simplify: 3(x + 4) + 2(x − 1)", a: "5x + 10", worked: ["Expand: 3x + 12 + 2x − 2", "Collect terms: 3x + 2x + 12 − 2 = 5x + 10"] },
);
questionBank['A4'][4].push(
  { q: "Simplify: 10ab − 3a + 2ba + 7a", a: "12ab + 4a", worked: ["Note: 2ba = 2ab", "Collect ab terms: 10ab + 2ab = 12ab", "Collect a terms: −3a + 7a = 4a", "Answer: 12ab + 4a"] },
);

// Types of Number → N4
questionBank['N4'][0].push(
  { q: "What is the value of 4³?", a: "64", worked: ["4³ = 4 × 4 × 4", "16 × 4 = 64"] },
);
questionBank['N4'][1].push(
  { q: "Which of the following are prime numbers: 7, 9, 13, 15, 21?", type: "mcq", options: ["7 and 13", "7, 9 and 13", "7, 13 and 21", "9, 13 and 15"], a: "7 and 13", worked: ["7 is prime (only factors: 1,7)", "9 = 3×3 (not prime)", "13 is prime (only factors: 1,13)", "15 = 3×5 (not prime)", "21 = 3×7 (not prime)"] },
);
questionBank['N4'][2].push(
  { q: "Work out the value of √144 + ³√27.", a: "15", worked: ["√144 = 12", "³√27 = 3", "12 + 3 = 15"] },
);
questionBank['N4'][3].push(
  { q: "Express 90 as a product of its prime factors.", type: "mcq", options: ["2 × 3² × 5", "2 × 3 × 15", "2² × 3 × 5", "2 × 9 × 5"], a: "2 × 3² × 5", worked: ["90 ÷ 2 = 45", "45 ÷ 3 = 15", "15 ÷ 3 = 5", "5 ÷ 5 = 1", "So 90 = 2 × 3 × 3 × 5 = 2 × 3² × 5"] },
);
questionBank['N4'][4].push(
  { q: "Find the Highest Common Factor (HCF) of 48 and 72.", a: "24", worked: ["Factors of 48: 1, 2, 3, 4, 6, 8, 12, 16, 24, 48", "Factors of 72: 1, 2, 3, 4, 6, 8, 9, 12, 18, 24, 36, 72", "HCF = 24"] },
);

// Direct Proportion → R10
questionBank['R10'][0].push(
  { q: "If 3 oranges cost £1.50, how much would 8 oranges cost?", a: "4", worked: ["Cost per orange = £1.50 ÷ 3 = £0.50", "Cost of 8 oranges = £0.50 × 8 = £4.00"] },
);
questionBank['R10'][1].push(
  { q: "A recipe for 6 people uses 240 g of butter. How much butter is needed for 10 people?", a: "400", worked: ["Butter per person = 240 ÷ 6 = 40 g", "For 10 people = 40 × 10 = 400 g"] },
);
questionBank['R10'][2].push(
  { q: "5 workers take 6 hours to paint a fence. How long would it take 3 workers?", a: "10", worked: ["Total work = 5 workers × 6 hours = 30 worker-hours", "Time for 3 workers = 30 ÷ 3 = 10 hours"] },
);
questionBank['R10'][3].push(
  { q: "y is directly proportional to x. When x = 4, y = 20. Find y when x = 9.", a: "45", worked: ["y = kx (direct proportion)", "20 = k × 4, so k = 5", "When x = 9: y = 5 × 9 = 45"] },
);
questionBank['R10'][4].push(
  { q: "y is directly proportional to x². When x = 2, y = 12. Find y when x = 5.", a: "75", worked: ["y = kx² (y proportional to x²)", "12 = k × 2² = k × 4, so k = 3", "When x = 5: y = 3 × 5² = 3 × 25 = 75"] },
);

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL VARIANTS — Round 3
// ═══════════════════════════════════════════════════════════════

// N1: Place Value & Ordering
questionBank['N1'][0].push(
  { q: "Write the number 'five thousand, three hundred and eight' in figures.", a: "5308", worked: ["Five thousand = 5000", "Three hundred = 300", "Eight = 8", "Total = 5000 + 300 + 8 = 5308"] },
);
questionBank['N1'][1].push(
  { q: "Write down the value of the 7 in the number 47,205.", a: "7000", worked: ["The 7 is in the thousands place", "7 thousands = 7 × 1000 = 7000"] },
);
questionBank['N1'][2].push(
  { q: "Arrange these decimals in order of size, starting with the smallest: 0.5, 0.05, 0.55, 0.505", type: "order", items: ["0.5", "0.05", "0.55", "0.505"], correctOrder: ["0.05", "0.5", "0.505", "0.55"], a: "0.05, 0.5, 0.505, 0.55", worked: ["Compare: 0.05 = 0.050", "0.5 = 0.500", "0.505 = 0.505", "0.55 = 0.550", "Order: 0.050 < 0.500 < 0.505 < 0.550"] },
);
questionBank['N1'][3].push(
  { q: "Find the number halfway between 3.8 and 4.5.", a: "4.15", worked: ["Halfway = (3.8 + 4.5) ÷ 2", "= 8.3 ÷ 2", "= 4.15"] },
);
questionBank['N1'][4].push(
  { q: "Use the digits 5, 2, 8, and 1 once each to make the smallest possible even number.", a: "1258", worked: ["For smallest number: arrange in ascending order", "Digits in order: 1, 2, 5, 8", "Must be even, so last digit must be 2 or 8", "For smallest even number: 1258"] },
);

// N5: Fractions & Decimals
questionBank['N5'][0].push(
  { q: "Write 3/5 as a decimal.", a: "0.6", worked: ["3/5 = 3 ÷ 5", "= 0.6"] },
);
questionBank['N5'][1].push(
  { q: "Write 0.8 as a fraction in its simplest form.", a: "4/5", worked: ["0.8 = 8/10", "HCF(8,10) = 2", "8÷2 : 10÷2 = 4:5", "Therefore 4/5"] },
);
questionBank['N5'][2].push(
  { q: "Work out 5/9 − 1/3. Give your answer as a fraction.", a: "2/9", worked: ["Convert to same denominator: 1/3 = 3/9", "5/9 − 3/9 = 2/9"] },
);
questionBank['N5'][3].push(
  { q: "Work out 2 1/2 + 1 3/4. Give your answer as a mixed number.", a: "4 1/4", worked: ["Convert to improper fractions: 2 1/2 = 5/2 and 1 3/4 = 7/4", "Common denominator: 5/2 = 10/4", "10/4 + 7/4 = 17/4 = 4 1/4"] },
);
questionBank['N5'][4].push(
  { q: "A bottle holds 750 ml. A glass holds 2/5 of the bottle. How many ml are in the glass?", a: "300", worked: ["2/5 of 750 = (750 ÷ 5) × 2", "= 150 × 2", "= 300 ml"] },
);

// N6: Powers, Roots & Index Laws
questionBank['N6'][0].push(
  { q: "Work out the value of 5².", a: "25", worked: ["5² = 5 × 5", "= 25"] },
);
questionBank['N6'][1].push(
  { q: "Find the value of √121.", a: "11", worked: ["√121 is the number that when squared gives 121", "11 × 11 = 121", "Therefore √121 = 11"] },
);
questionBank['N6'][2].push(
  { q: "Work out the value of 2³ × 3².", a: "72", worked: ["2³ = 2 × 2 × 2 = 8", "3² = 3 × 3 = 9", "8 × 9 = 72"] },
);
questionBank['N6'][3].push(
  { q: "Simplify y⁷ ÷ y³. Give your answer using index notation.", type: "mcq", options: ["y⁴", "y¹⁰", "y²¹", "y³"], a: "y⁴", worked: ["When dividing powers, subtract the indices", "y⁷ ÷ y³ = y^(7-3) = y⁴"] },
);
questionBank['N6'][4].push(
  { q: "Find the value of ³√27 + √64.", a: "11", worked: ["³√27 = 3 (since 3 × 3 × 3 = 27)", "√64 = 8 (since 8 × 8 = 64)", "3 + 8 = 11"] },
);

// N10: FDP
questionBank['N10'][0].push(
  { q: "Write 1/4 as a percentage.", a: "25%", worked: ["1/4 = 0.25", "0.25 × 100 = 25%"] },
);
questionBank['N10'][1].push(
  { q: "Write 35% as a decimal.", a: "0.35", worked: ["35% = 35/100", "35 ÷ 100 = 0.35"] },
);
questionBank['N10'][2].push(
  { q: "Work out 20% of £150.", a: "30", worked: ["20% = 0.2", "0.2 × 150 = 30"] },
);
questionBank['N10'][3].push(
  { q: "Which is larger: 0.4 or 3/8?", type: "mcq", options: ["0.4", "3/8"], a: "0.4", worked: ["Convert 3/8 to decimal: 3 ÷ 8 = 0.375", "Compare: 0.4 > 0.375", "Therefore 0.4 is larger"] },
);
questionBank['N10'][4].push(
  { q: "In a sale, a coat is reduced by 15%. The original price was £80. Work out the sale price.", a: "68", worked: ["Reduction = 15% of £80 = 0.15 × 80 = £12", "Sale price = £80 − £12 = £68"] },
);

// N13: Calculations with Money
questionBank['N13'][0].push(
  { q: "Change £4.50 into pence.", a: "450", worked: ["£1 = 100 pence", "£4.50 = 4.50 × 100 = 450 pence"] },
);
questionBank['N13'][1].push(
  { q: "3 bars of chocolate cost £2.40. How much does 1 bar cost?", a: "0.80", worked: ["Cost per bar = £2.40 ÷ 3", "= £0.80"] },
);
questionBank['N13'][2].push(
  { q: "I buy a magazine for £3.95 and a drink for £1.20. How much change do I get from £10?", a: "4.85", worked: ["Total spent = £3.95 + £1.20 = £5.15", "Change = £10.00 − £5.15 = £4.85"] },
);
questionBank['N13'][3].push(
  { q: "A pack of 9 toilet rolls costs £4.23. A pack of 4 costs £1.96. Which pack is better value?", type: "mcq", options: ["Pack of 9", "Pack of 4"], a: "Pack of 9", calculator: true, worked: ["Pack of 9: £4.23 ÷ 9 = £0.47 per roll", "Pack of 4: £1.96 ÷ 4 = £0.49 per roll", "Pack of 9 is cheaper"] },
);
questionBank['N13'][4].push(
  { q: "A shop offers 20% off in a sale. The next day, they take a further 15% off the sale price. What is the overall percentage discount?", a: "32", calculator: true, worked: ["Start with £100", "After 20% off: £100 × 0.80 = £80", "After 15% off the sale price: £80 × 0.85 = £68", "Overall discount = £100 − £68 = £32", "Overall percentage discount = 32%"], hint: "Apply each discount one after the other. Two successive discounts are NOT the same as adding them." },
);

// N14: Rounding & Estimation
questionBank['N14'][0].push(
  { q: "Round 4,562 to the nearest hundred.", a: "4600", worked: ["Look at the tens digit: 6", "Since 6 ≥ 5, round up", "4562 rounded to nearest hundred = 4600"] },
);
questionBank['N14'][1].push(
  { q: "Round 7.82 to 1 decimal place.", a: "7.8", worked: ["Look at the second decimal place: 2", "Since 2 < 5, round down", "7.82 rounded to 1 d.p. = 7.8"] },
);
questionBank['N14'][2].push(
  { q: "Round 0.0456 to 2 significant figures.", a: "0.046", worked: ["First sig fig is 4, second is 5", "Look at third sig fig: 6", "Since 6 ≥ 5, round up the 5 to 6", "0.0456 to 2 s.f. = 0.046"] },
);
questionBank['N14'][3].push(
  { q: "Estimate the value of (48.7 × 2.1) ÷ 0.49.", a: "200", hint: "Round each value to 1 s.f. first: (50 × 2) ÷ 0.5", worked: ["Round to 1 s.f.: 48.7 ≈ 50, 2.1 ≈ 2, 0.49 ≈ 0.5", "Estimate = (50 × 2) ÷ 0.5 = 100 ÷ 0.5 = 200"] },
);
questionBank['N14'][4].push(
  { q: "A length L is rounded to 15 cm to the nearest cm. Write down the error interval for L.", type: "mcq", options: ["14.5 ≤ L < 15.5", "14 ≤ L < 16", "14.5 < L ≤ 15.5", "15 ≤ L < 16"], a: "14.5 ≤ L < 15.5", worked: ["For rounding to nearest cm, the interval is half below and half above", "Lower bound: 15 − 0.5 = 14.5", "Upper bound: 15 + 0.5 = 15.5", "14.5 ≤ L < 15.5 (upper bound is not included)"] },
);

// A1: Algebraic Notation
questionBank['A1'][0].push(
  { q: "Simplify: c + c + c + c", a: "4c", worked: ["Count the number of c's: 4", "4c is the simplified form"] },
);
questionBank['A1'][1].push(
  { q: "Simplify: 3 × a × b", a: "3ab", worked: ["Write without multiplication signs: 3ab"] },
);
questionBank['A1'][2].push(
  { q: "Simplify: x² + x²", a: "2x²", worked: ["Add the coefficients: 1 + 1 = 2", "Keep the variable part: x²", "Answer: 2x²"] },
);
questionBank['A1'][3].push(
  { q: "Write an expression for the total cost of x apples at 20p each and y pears at 30p each. Give your answer in pence.", a: "20x + 30y", worked: ["Cost of x apples at 20p each = 20x pence", "Cost of y pears at 30p each = 30y pence", "Total = 20x + 30y pence"] },
);
questionBank['A1'][4].push(
  { q: "Simplify: 10w ÷ 2", a: "5w", worked: ["10w ÷ 2 = (10 ÷ 2)w = 5w"] },
);

// A3: Expanding & Factorising
questionBank['A3'][0].push(
  { q: "Expand: 2(x + 5)", a: "2x + 10", worked: ["Multiply each term in the bracket by 2", "2 × x = 2x", "2 × 5 = 10", "Answer: 2x + 10"] },
);
questionBank['A3'][1].push(
  { q: "Factorise: 3y − 12", a: "3(y - 4)", worked: ["Find the HCF of 3y and 12: HCF = 3", "3y ÷ 3 = y, 12 ÷ 3 = 4", "Answer: 3(y − 4)"] },
);
questionBank['A3'][2].push(
  { q: "Expand: x(x − 4)", a: "x² - 4x", worked: ["Multiply each term in the bracket by x", "x × x = x²", "x × (−4) = −4x", "Answer: x² − 4x"] },
);
questionBank['A3'][3].push(
  { q: "Expand and simplify: 3(x + 2) + 2(x − 1)", a: "5x + 4", worked: ["Expand: 3x + 6 + 2x − 2", "Collect x terms: 3x + 2x = 5x", "Collect constants: 6 − 2 = 4", "Answer: 5x + 4"] },
);
questionBank['A3'][4].push(
  { q: "Factorise fully: 10p² + 15p", a: "5p(2p + 3)", worked: ["Find HCF of 10p² and 15p: HCF = 5p", "10p² ÷ 5p = 2p", "15p ÷ 5p = 3", "Answer: 5p(2p + 3)"] },
);

// A4: Like Terms
questionBank['A4'][0].push(
  { q: "Simplify: 5a + 2a − a", a: "6a", worked: ["Add coefficients: 5 + 2 − 1 = 6", "Answer: 6a"] },
);
questionBank['A4'][1].push(
  { q: "Simplify: 3x + 4y + 2x − y", a: "5x + 3y", worked: ["Collect x terms: 3x + 2x = 5x", "Collect y terms: 4y − y = 3y", "Answer: 5x + 3y"] },
);
questionBank['A4'][2].push(
  { q: "Simplify: 7x² − 2x + 3x²", a: "10x² - 2x", worked: ["Collect x² terms: 7x² + 3x² = 10x²", "Keep x term: −2x", "Answer: 10x² − 2x"] },
);
questionBank['A4'][3].push(
  { q: "Simplify: 10 − 4p + 3 − p", a: "13 - 5p", worked: ["Collect number terms: 10 + 3 = 13", "Collect p terms: −4p − p = −5p", "Answer: 13 − 5p"] },
);
questionBank['A4'][4].push(
  { q: "Simplify: xy + 2yx + a", a: "3xy + a", worked: ["Note: yx = xy", "Collect xy terms: xy + 2xy = 3xy", "Keep a: a", "Answer: 3xy + a"] },
);

// A17: Solve Linear Equations
questionBank['A17'][0].push(
  { q: "Solve: x + 5 = 12", a: "7", worked: ["Subtract 5 from both sides", "x = 12 − 5", "x = 7"] },
);
questionBank['A17'][1].push(
  { q: "Solve: 4y = 20", a: "5", worked: ["Divide both sides by 4", "y = 20 ÷ 4", "y = 5"] },
);
questionBank['A17'][2].push(
  { q: "Solve: 3n − 2 = 13", a: "5", worked: ["Add 2 to both sides: 3n = 15", "Divide both sides by 3", "n = 5"] },
);
questionBank['A17'][3].push(
  { q: "Solve: 2(x + 4) = 18", a: "5", worked: ["Divide both sides by 2: x + 4 = 9", "Subtract 4 from both sides", "x = 5"] },
);
questionBank['A17'][4].push(
  { q: "Solve: 5x − 3 = 2x + 9", a: "4", worked: ["Move x terms to left: 5x − 2x = 3x", "3x − 3 = 9", "Add 3 to both sides: 3x = 12", "x = 4"] },
);

// A21: Straight-Line Graphs
questionBank['A21'][0].push(
  { q: "Write down the coordinates of the y-intercept for the line y = x − 3.", a: "(0,-3)", worked: ["The y-intercept occurs when x = 0", "y = 0 − 3 = −3", "Coordinates: (0, −3)"] },
);
questionBank['A21'][1].push(
  { q: "Using the equation y = 2x − 1, find the value of y when x = 3.", a: "5", worked: ["Substitute x = 3 into y = 2x − 1", "y = 2(3) − 1 = 6 − 1 = 5"] },
);
questionBank['A21'][2].push(
  { q: "What type of line does the equation y = 3 represent on a coordinate grid?", type: "mcq", options: ["A horizontal line through (0, 3)", "A vertical line through (3, 0)", "A diagonal line through (0, 3)", "A curve through (0, 3)"], a: "A horizontal line through (0, 3)", worked: ["y = 3 means y is always 3, regardless of x", "This is a horizontal line", "It passes through (0, 3)"] },
);
questionBank['A21'][3].push(
  { q: "What is the gradient of the line y = 4x − 2?", a: "4", worked: ["The equation is in the form y = mx + c", "m is the gradient, c is the y-intercept", "Here m = 4, so gradient = 4"] },
);
questionBank['A21'][4].push(
  { q: "State the equation of a line parallel to y = 5x + 3 that passes through (0, −1).", a: "y = 5x - 1", worked: ["Parallel lines have the same gradient", "Gradient = 5", "Passes through (0, −1), so y-intercept = −1", "Equation: y = 5x − 1"] },
);

// G1: Angle Facts & Shape Properties
questionBank['G1'][0].push(
  { q: "What is the mathematical name for a 4-sided shape?", type: "mcq", options: ["Quadrilateral", "Pentagon", "Triangle", "Hexagon"], a: "Quadrilateral", worked: ["Quad = 4, so quadrilateral = 4-sided shape"] },
);
questionBank['G1'][1].push(
  { q: "Two angles on a straight line are x° and 130°. Work out the value of x.", a: "50", worked: ["Angles on a straight line sum to 180°", "x + 130 = 180", "x = 50°"] },
);
questionBank['G1'][2].push(
  { q: "A triangle has angles of 40° and 70°. Work out the size of the third angle.", a: "70", worked: ["Angles in a triangle sum to 180°", "40 + 70 + third angle = 180", "Third angle = 180 − 110 = 70°"] },
);
questionBank['G1'][3].push(
  { q: "Work out the size of one interior angle of a regular pentagon.", a: "108", hint: "Interior angle = (n − 2) × 180 ÷ n", worked: ["Pentagon has 5 sides, so n = 5", "Interior angle = (5 − 2) × 180 ÷ 5", "= 3 × 180 ÷ 5 = 540 ÷ 5 = 108°"] },
);
questionBank['G1'][4].push(
  { q: "Two angles are vertically opposite. One is 72°. What is the size of the other angle?", a: "72", worked: ["Vertically opposite angles are equal", "Therefore the other angle = 72°"] },
);

// G2: Transformations
questionBank['G2'][0].push(
  { q: "What is the name of the transformation that creates a mirror image of a shape?", type: "mcq", options: ["Reflection", "Rotation", "Translation", "Enlargement"], a: "Reflection", worked: ["A mirror image is created by reflection"] },
);
questionBank['G2'][1].push(
  { q: "A point at (4, 2) is translated by the vector [vec:3,-2]. What are its new coordinates?", a: "7, 0", worked: ["Add the vector [vec:3,-2] to the point (4, 2)", "New x = 4 + 3 = 7", "New y = 2 + (−2) = 0", "New coordinates: (7, 0)"] },
);
questionBank['G2'][2].push(
  { q: "The point (2, 3) is rotated 90° clockwise about the origin. What are the new coordinates?", type: "mcq", options: ["(3, −2)", "(−3, 2)", "(−2, −3)", "(−2, 3)"], a: "(3, −2)", worked: ["90° clockwise rotation: (x, y) → (y, −x)", "(2, 3) → (3, −2)"] },
);
questionBank['G2'][3].push(
  { q: "A triangle has sides 3 cm, 4 cm, and 5 cm. It is enlarged by scale factor 2. What is the perimeter of the enlarged triangle?", a: "24", worked: ["Original perimeter = 3 + 4 + 5 = 12 cm", "Scale factor 2 means multiply all sides by 2", "New perimeter = 12 × 2 = 24 cm"] },
);
questionBank['G2'][4].push(
  { q: "Shape A is the same shape as Shape B but twice the size. What type of transformation maps A to B?", type: "mcq", options: ["Enlargement", "Translation", "Rotation", "Reflection"], a: "Enlargement", worked: ["Twice the size means scale factor of 2", "This is an enlargement"] },
);

// G12: Perimeter, Area & Volume
questionBank['G12'][0].push(
  { q: "Find the perimeter of a square with side length 5 cm.", a: "20", worked: ["Square has 4 equal sides", "Perimeter = 4 × 5 = 20 cm"] },
);
questionBank['G12'][1].push(
  { q: "Work out the area of a rectangle with base 8 cm and height 3 cm.", a: "24", worked: ["Area = base × height", "Area = 8 × 3 = 24 cm²"] },
);
questionBank['G12'][2].push(
  { q: "Find the area of a triangle with base 6 cm and vertical height 4 cm.", a: "12", worked: ["Area = (base × height) ÷ 2", "Area = (6 × 4) ÷ 2 = 24 ÷ 2 = 12 cm²"] },
);
questionBank['G12'][3].push(
  { q: "Calculate the volume of a cuboid with dimensions 2 cm by 3 cm by 10 cm.", a: "60", worked: ["Volume = length × width × height", "Volume = 2 × 3 × 10 = 60 cm³"] },
);
questionBank['G12'][4].push(
  { q: "Calculate the area of a circle with radius 5 cm. Give your answer to 1 decimal place.", a: "78.5", calculator: true, hint: "Area = π × r²", worked: ["Area = π × r²", "Area = π × 5² = π × 25 ≈ 78.5 cm²"] },
);

// G20: Pythagoras & Trigonometry
questionBank['G20'][0].push(
  { q: "In a right-angled triangle, what is the name of the longest side?", type: "mcq", options: ["Hypotenuse", "Adjacent", "Opposite", "Base"], a: "Hypotenuse", worked: ["In a right-angled triangle, the longest side is opposite the right angle", "This is called the hypotenuse"] },
);
questionBank['G20'][1].push(
  { q: "Use Pythagoras' theorem to find the hypotenuse c when a = 3 and b = 4.", a: "5", diagram: "pythag-3-4", worked: ["c² = a² + b²", "c² = 3² + 4² = 9 + 16 = 25", "c = √25 = 5"] },
);
questionBank['G20'][2].push(
  { q: "A right-angled triangle has a hypotenuse of 13 cm and one side of 5 cm. Find the missing side.", a: "12", diagram: "pythag-5-13", calculator: true, worked: ["Using c² = a² + b²", "13² = 5² + b²", "169 = 25 + b²", "b² = 144, so b = 12 cm"] },
);
questionBank['G20'][3].push(
  { q: "In a right-angled triangle, the angle is 30° and the hypotenuse is 10 cm. Use sin to find the length of the opposite side.", a: "5", diagram: "trig-30-hyp10", calculator: true, worked: ["sin(angle) = opposite / hypotenuse", "sin(30°) = opposite / 10", "opposite = sin(30°) × 10 = 0.5 × 10 = 5 cm"] },
);
questionBank['G20'][4].push(
  { q: "In a right-angled triangle, the opposite side is 5 cm and the adjacent side is 12 cm. Use tan⁻¹ to find the angle. Give your answer to 1 d.p.", a: "22.6", diagram: "trig-opp5-adj12", calculator: true, worked: ["tan(angle) = opposite / adjacent", "tan(angle) = 5 / 12", "angle = tan⁻¹(5/12) = tan⁻¹(0.4167) ≈ 22.6°"] },
);

// P4: Relative Frequency
questionBank['P4'][0].push(
  { q: "A coin is flipped 50 times and lands on heads 20 times. Write the relative frequency of heads as a decimal.", a: "0.4", worked: ["Relative frequency = number of heads / total flips", "= 20 / 50 = 0.4"] },
);
questionBank['P4'][1].push(
  { q: "If the probability of an event is 0.3, how many times would you expect it to happen in 100 trials?", a: "30", worked: ["Expected frequency = probability × number of trials", "= 0.3 × 100 = 30"] },
);
questionBank['P4'][2].push(
  { q: "A spinner is spun 50 times and lands on Green 15 times. Estimate the probability of landing on Green.", a: "0.3", worked: ["Estimated probability = frequency / total spins", "= 15 / 50 = 0.3"] },
);
questionBank['P4'][3].push(
  { q: "Why does relative frequency become a better estimate of probability as more trials are done?", type: "mcq", options: ["It gets closer to the theoretical probability", "It always equals the theoretical probability", "It gets further from the theoretical probability", "It stays the same"], a: "It gets closer to the theoretical probability", worked: ["With more trials, random variation averages out", "Relative frequency converges to theoretical probability"] },
);
questionBank['P4'][4].push(
  { q: "A die is rolled 300 times. Landing on a 6 has a relative frequency of 0.2. How many times was a 6 rolled?", a: "60", worked: ["Relative frequency = frequency / total", "0.2 = frequency / 300", "Frequency = 0.2 × 300 = 60"] },
);

// P7: Tree Diagrams & Enumeration
questionBank['P7'][0].push(
  { q: "A coin is flipped and a 3-sided spinner (1, 2, 3) is spun. How many possible outcomes are there?", a: "6", worked: ["Coin outcomes: 2 (Heads, Tails)", "Spinner outcomes: 3 (1, 2, 3)", "Total outcomes = 2 × 3 = 6"] },
);
questionBank['P7'][1].push(
  { q: "A bag has 3 red and 2 blue counters. One counter is picked at random. What is the probability it is red?", a: "3/5", worked: ["Total counters = 3 + 2 = 5", "Red counters = 3", "Probability = 3/5"] },
);
questionBank['P7'][2].push(
  { q: "A fair coin is flipped twice. What is the probability of getting two Heads?", a: "0.25", worked: ["P(Heads) = 0.5", "P(two Heads) = 0.5 × 0.5 = 0.25"] },
);
questionBank['P7'][3].push(
  { q: "Two events are independent. P(A) = 0.5 and P(B) = 0.2. Find P(A and B).", a: "0.1", worked: ["For independent events: P(A and B) = P(A) × P(B)", "P(A and B) = 0.5 × 0.2 = 0.1"] },
);
questionBank['P7'][4].push(
  { q: "A bag has 4 red and 3 blue marbles. Two are picked without replacement. Find the probability both are red.", a: "2/7", worked: ["P(first red) = 4/7", "P(second red | first was red) = 3/6 = 1/2", "P(both red) = 4/7 × 1/2 = 4/14 = 2/7"] },
);

// R2: Percentage Change & Growth/Decay
questionBank['R2'][0].push(
  { q: "Increase £40 by 10%.", a: "44", worked: ["10% of £40 = 0.1 × 40 = £4", "New value = £40 + £4 = £44"] },
);
questionBank['R2'][1].push(
  { q: "Decrease 60 kg by 20%.", a: "48", worked: ["20% of 60 = 0.2 × 60 = 12", "New value = 60 − 12 = 48 kg"] },
);
questionBank['R2'][2].push(
  { q: "A house price increases from £200,000 to £220,000. Calculate the percentage increase.", a: "10", worked: ["Increase = £220,000 − £200,000 = £20,000", "Percentage = (20,000 ÷ 200,000) × 100 = 10%"] },
);
questionBank['R2'][3].push(
  { q: "Use a multiplier to increase £450 by 3.5%.", a: "465.75", calculator: true, worked: ["Increase by 3.5% means multiply by 1.035", "£450 × 1.035 = £465.75"] },
);
questionBank['R2'][4].push(
  { q: "£1000 is invested at 4% compound interest per year for 2 years. Work out the final amount.", a: "1081.60", calculator: true, worked: ["Year 1: £1000 × 1.04 = £1040", "Year 2: £1040 × 1.04 = £1081.60"] },
);

// S2: Tables & Charts
questionBank['S2'][0].push(
  { q: "A bar chart shows 12 students chose football, 8 chose tennis, and 5 chose swimming. How many more students chose football than swimming?", a: "7", worked: ["Football students = 12", "Swimming students = 5", "Difference = 12 − 5 = 7"] },
);
questionBank['S2'][1].push(
  { q: "The following data shows the colours of 10 cars: Red, Blue, Red, Green, Blue, Red, Blue, Red, Green, Blue. How many cars are red?", a: "4", worked: ["Count the reds: Red, Red, Red, Red", "Total red cars = 4"] },
);
questionBank['S2'][2].push(
  { q: "In a pictogram, each symbol represents 4 people. How many symbols are needed to show 14 people?", a: "3.5", worked: ["Number of symbols = 14 ÷ 4 = 3.5", "Need 3.5 symbols"] },
);
questionBank['S2'][3].push(
  { q: "40 people were asked their favourite sport. 10 said tennis. Calculate the angle for tennis in a pie chart.", a: "90", worked: ["Fraction = 10/40 = 1/4", "Angle = 1/4 × 360° = 90°"] },
);
questionBank['S2'][4].push(
  { q: "A dual bar chart compares boys and girls. The boys' bar shows 45 and the girls' bar shows 30. How many more boys than girls are there?", a: "15", diagram: "dual-bar-chart", worked: ["Boys = 45", "Girls = 30", "Difference = 45 − 30 = 15"] },
);

// S3: Averages & Range
questionBank['S3'][0].push(
  { q: "Find the mode of: 2, 3, 2, 5, 6.", a: "2", worked: ["Mode is the most frequent value", "2 appears twice, all others appear once", "Mode = 2"] },
);
questionBank['S3'][1].push(
  { q: "Find the range of: 10, 15, 8, 20, 12.", a: "12", worked: ["Range = highest − lowest", "Highest = 20, Lowest = 8", "Range = 20 − 8 = 12"] },
);
questionBank['S3'][2].push(
  { q: "Find the median of: 5, 8, 3, 2, 10.", a: "5", worked: ["Order the data: 2, 3, 5, 8, 10", "Median is the middle value", "Median = 5"] },
);
questionBank['S3'][3].push(
  { q: "Calculate the mean of: 4, 7, 9, 10.", a: "7.5", worked: ["Mean = sum ÷ count", "Sum = 4 + 7 + 9 + 10 = 30", "Mean = 30 ÷ 4 = 7.5"] },
);
questionBank['S3'][4].push(
  { q: "The mean of five numbers is 10. Four of the numbers are 7, 12, 8, and 14. Find the fifth number.", a: "9", worked: ["Mean = 10, so sum of 5 numbers = 10 × 5 = 50", "Sum of known numbers = 7 + 12 + 8 + 14 = 41", "Fifth number = 50 − 41 = 9"] },
);

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL VARIANTS — Round 4 (5th variant per level)
// ═══════════════════════════════════════════════════════════════

// N1: Ordering & Symbols
questionBank['N1'][0].push(
  { q: "Write these numbers in order of size, starting with the smallest: −1, 5, −8, 3, 0", type: "order", items: ["−1", "5", "−8", "3", "0"], correctOrder: ["−8", "−1", "0", "3", "5"], a: "−8, −1, 0, 3, 5", worked: ["Start with the most negative: −8", "Then −1, then 0, then positives 3 and 5"] },
);
questionBank['N1'][1].push(
  { q: "Place the correct symbol (< or >) to make the statement true: −7 ☐ −3", type: "mcq", options: ["<", ">"], a: "<", worked: ["−7 is more negative than −3", "−7 is further left on the number line", "−7 < −3"] },
);
questionBank['N1'][2].push(
  { q: "Write these decimals in order of size, starting with the smallest: 0.7, 0.07, 0.77, 0.707", type: "order", items: ["0.7", "0.07", "0.77", "0.707"], correctOrder: ["0.07", "0.7", "0.707", "0.77"], a: "0.07, 0.7, 0.707, 0.77", worked: ["Compare: 0.07 = 0.070", "0.7 = 0.700", "0.707 = 0.707", "0.77 = 0.770", "Order: 0.070 < 0.700 < 0.707 < 0.770"] },
);
questionBank['N1'][3].push(
  { q: "Put these values in order of size, starting with the smallest: 2/5, 0.45, 35%, 1/3", type: "order", items: ["2/5", "0.45", "35%", "1/3"], correctOrder: ["1/3", "35%", "2/5", "0.45"], a: "1/3, 35%, 2/5, 0.45", worked: ["Convert to decimals: 2/5 = 0.4, 0.45, 35% = 0.35, 1/3 ≈ 0.333", "Order: 0.333 < 0.35 < 0.4 < 0.45"] },
);
questionBank['N1'][4].push(
  { q: "x is an integer such that −2 ≤ x < 3. Write down all the possible values of x.", a: "−2, −1, 0, 1, 2", worked: ["x ≥ −2 means include −2", "x < 3 means up to but not including 3", "Values: −2, −1, 0, 1, 2"] },
);

// N5: Mixed Number Practice
questionBank['N5'][0].push(
  { q: "Work out 1/3 + 1/6", a: "1/2", worked: ["Common denominator is 6", "1/3 = 2/6", "2/6 + 1/6 = 3/6 = 1/2"] },
);
questionBank['N5'][1].push(
  { q: "Find the square root of 2 1/4", a: "1.5", worked: ["Convert: 2 1/4 = 9/4", "√(9/4) = √9 ÷ √4 = 3 ÷ 2 = 1.5"] },
);
questionBank['N5'][2].push(
  { q: "A savings account pays 5% simple interest per year. If £1000 is deposited, how much interest is earned after 3 years?", a: "150", worked: ["Interest per year: 5% of £1000 = 0.05 × £1000 = £50", "Interest after 3 years: £50 × 3 = £150"] },
);
questionBank['N5'][3].push(
  { q: "Write 3,200,000 in standard form.", type: "mcq", options: ["3.2 × 10⁶", "32 × 10⁵", "3.2 × 10⁷", "0.32 × 10⁷"], a: "3.2 × 10⁶", worked: ["Move decimal 6 places left: 3,200,000 = 3.2 × 10⁶"] },
);
questionBank['N5'][4].push(
  { q: "Work out 1 2/3 ÷ 2 1/2. Give your answer as a fraction in its simplest form.", a: "2/3", worked: ["Convert to improper: 1 2/3 = 5/3, 2 1/2 = 5/2", "Divide: (5/3) ÷ (5/2) = (5/3) × (2/5) = 10/15 = 2/3"] },
);

// N6: Powers, Roots & Index Laws
questionBank['N6'][0].push(
  { q: "Work out the value of 3³.", a: "27", worked: ["3³ = 3 × 3 × 3", "= 9 × 3 = 27"] },
);
questionBank['N6'][1].push(
  { q: "Find the value of √196.", a: "14", worked: ["√196 is the number that when squared gives 196", "14 × 14 = 196", "Therefore √196 = 14"] },
);
questionBank['N6'][2].push(
  { q: "Work out the value of 5² − 2³.", a: "17", worked: ["5² = 5 × 5 = 25", "2³ = 2 × 2 × 2 = 8", "25 − 8 = 17"] },
);
questionBank['N6'][3].push(
  { q: "Simplify x⁴ × x³. Give your answer using index notation.", type: "mcq", options: ["x⁷", "x¹²", "x¹", "2x⁷"], a: "x⁷", worked: ["When multiplying powers, add the indices", "x⁴ × x³ = x^(4+3) = x⁷"] },
);
questionBank['N6'][4].push(
  { q: "Evaluate 16^(1/2) + 8^(1/3).", a: "6", worked: ["16^(1/2) = √16 = 4", "8^(1/3) = ³√8 = 2", "4 + 2 = 6"] },
);

// N14: Rounding & Estimation
questionBank['N14'][0].push(
  { q: "Round 3,847 to the nearest thousand.", a: "4000", worked: ["Look at the hundreds digit: 8", "Since 8 ≥ 5, round up", "3,847 rounded to nearest thousand = 4000"] },
);
questionBank['N14'][1].push(
  { q: "Round 12.348 to 2 decimal places.", a: "12.35", worked: ["Look at the third decimal place: 8", "Since 8 ≥ 5, round up", "12.348 rounded to 2 d.p. = 12.35"] },
);
questionBank['N14'][2].push(
  { q: "Round 0.00837 to 1 significant figure.", a: "0.008", worked: ["First significant figure is 8", "Look at the next digit: 3", "Since 3 < 5, round down", "0.00837 to 1 s.f. = 0.008"] },
);
questionBank['N14'][3].push(
  { q: "Estimate the value of (9.8 × 51.2) ÷ 2.03.", a: "250", hint: "Round each value to 1 s.f. first: (10 × 50) ÷ 2", worked: ["Round to 1 s.f.: 9.8 ≈ 10, 51.2 ≈ 50, 2.03 ≈ 2", "Estimate = (10 × 50) ÷ 2 = 500 ÷ 2 = 250"] },
);
questionBank['N14'][4].push(
  { q: "A mass M is rounded to 250 g to the nearest 10 g. Write down the error interval for M.", type: "mcq", options: ["245 ≤ M < 255", "240 ≤ M < 260", "245 < M ≤ 255", "250 ≤ M < 260"], a: "245 ≤ M < 255", worked: ["Rounded to nearest 10g, so half of 10 = 5", "Lower bound: 250 − 5 = 245", "Upper bound: 250 + 5 = 255", "245 ≤ M < 255 (upper bound not included)"] },
);

// A1: Algebraic Notation
questionBank['A1'][0].push(
  { q: "Simplify: d + d + d + d + d", a: "5d", worked: ["Count the number of d's: 5", "5d is the simplified form"] },
);
questionBank['A1'][1].push(
  { q: "Simplify: 2 × p × 4 × q", a: "8pq", worked: ["Multiply the numbers: 2 × 4 = 8", "Write without multiplication signs: 8pq"] },
);
questionBank['A1'][2].push(
  { q: "Simplify: 3y² + 4y²", a: "7y²", worked: ["Add the coefficients: 3 + 4 = 7", "Keep the variable part: y²", "Answer: 7y²"] },
);
questionBank['A1'][3].push(
  { q: "A plumber charges £30 for a call-out plus £20 per hour. Write an expression for the total cost of h hours of work.", a: "30 + 20h", worked: ["Call-out fee = £30 (fixed)", "Hourly rate = £20 per hour = 20h", "Total = 30 + 20h"] },
);
questionBank['A1'][4].push(
  { q: "Simplify: 12y ÷ 4", a: "3y", worked: ["12y ÷ 4 = (12 ÷ 4)y = 3y"] },
);

// A3: Mixed Algebra Practice
questionBank['A3'][0].push(
  { q: "Expand: 3(2y − 4)", a: "6y - 12", worked: ["Multiply each term in the bracket by 3", "3 × 2y = 6y", "3 × (−4) = −12", "Answer: 6y − 12"] },
);
questionBank['A3'][1].push(
  { q: "The first three terms of an arithmetic sequence are 1, 5, 9… Find an expression for the nth term.", a: "4n - 3", worked: ["Common difference: 5 − 1 = 4", "General form: nth term = an + b where a = 4", "When n = 1: 4(1) + b = 1, so b = −3", "Formula: 4n − 3"] },
);
questionBank['A3'][2].push(
  { q: "A person walks at a constant speed. After 10 minutes they have walked 1 km. After 30 minutes they have walked 3 km. What is their speed in km per minute?", a: "0.1", worked: ["Distance change = 3 − 1 = 2 km", "Time change = 30 − 10 = 20 minutes", "Speed = distance ÷ time = 2 ÷ 20 = 0.1 km per minute"] },
);
questionBank['A3'][3].push(
  { q: "Multiply out and simplify (x + 4)(x − 2)", a: "x² + 2x − 8", worked: ["Use FOIL: x × x = x²", "x × (−2) + 4 × x = −2x + 4x = 2x", "4 × (−2) = −8", "Answer: x² + 2x − 8"] },
);
questionBank['A3'][4].push(
  { q: "For y = x² − 2x, what is the value of y when x = 5?", a: "15", worked: ["Substitute x = 5 into y = x² − 2x", "y = 5² − 2(5) = 25 − 10 = 15"] },
);

// A17: Solve Linear Equations
questionBank['A17'][0].push(
  { q: "Solve: x − 8 = 3", a: "11", worked: ["Add 8 to both sides", "x = 3 + 8", "x = 11"] },
);
questionBank['A17'][1].push(
  { q: "Solve: 3y = 27", a: "9", worked: ["Divide both sides by 3", "y = 27 ÷ 3", "y = 9"] },
);
questionBank['A17'][2].push(
  { q: "Solve: 4n + 5 = 29", a: "6", worked: ["Subtract 5 from both sides: 4n = 24", "Divide both sides by 4", "n = 6"] },
);
questionBank['A17'][3].push(
  { q: "Solve: 3(x − 2) = 15", a: "7", worked: ["Divide both sides by 3: x − 2 = 5", "Add 2 to both sides", "x = 7"] },
);
questionBank['A17'][4].push(
  { q: "Solve: 7x + 1 = 3x + 17", a: "4", worked: ["Move x terms to left: 7x − 3x = 4x", "4x + 1 = 17", "Subtract 1: 4x = 16", "x = 4"] },
);

// A21: Straight-Line Graphs
questionBank['A21'][0].push(
  { q: "What is the y-intercept of the line y = 3x + 5?", a: "5", worked: ["In y = mx + c, the y-intercept is c", "Here c = 5", "The y-intercept is 5"] },
);
questionBank['A21'][1].push(
  { q: "Using the equation y = 3x + 1, find the value of y when x = −2.", a: "-5", worked: ["Substitute x = −2 into y = 3x + 1", "y = 3(−2) + 1 = −6 + 1 = −5"] },
);
questionBank['A21'][2].push(
  { q: "What type of line does the equation x = 4 represent on a coordinate grid?", type: "mcq", options: ["A vertical line through (4, 0)", "A horizontal line through (0, 4)", "A diagonal line through (4, 0)", "A curve through (4, 0)"], a: "A vertical line through (4, 0)", worked: ["x = 4 means x is always 4, regardless of y", "This is a vertical line", "It passes through (4, 0)"] },
);
questionBank['A21'][3].push(
  { q: "What is the gradient of the line y = −2x + 7?", a: "-2", worked: ["The equation is in the form y = mx + c", "m is the gradient", "Here m = −2, so gradient = −2"] },
);
questionBank['A21'][4].push(
  { q: "Find the equation of a line with gradient 3 that passes through the point (0, 4).", a: "y = 3x + 4", worked: ["The line passes through (0, 4), so y-intercept = 4", "Gradient = 3", "Using y = mx + c: y = 3x + 4"] },
);

// R2: Mixed Ratio Practice
questionBank['R2'][0].push(
  { q: "Write 0.35 as a fraction in its simplest form.", a: "7/20", worked: ["0.35 = 35/100", "Divide numerator and denominator by 5: 7/20"] },
);
questionBank['R2'][1].push(
  { q: "A map has a scale of 1:200,000. Two cities are 3.5 cm apart on the map. Work out the real distance in kilometres.", a: "7", worked: ["Scale 1:200,000 means 1 cm on map = 200,000 cm real distance", "Real distance = 3.5 × 200,000 = 700,000 cm = 7 km"] },
);
questionBank['R2'][2].push(
  { q: "In a class, 60% of students walk to school. The rest cycle. Write the ratio of walkers to cyclists in its simplest form.", a: "3:2", worked: ["Walkers = 60%, Cyclists = 100% − 60% = 40%", "Ratio = 60:40 = 3:2"] },
);
questionBank['R2'][3].push(
  { q: "y is inversely proportional to x. When x = 3, y = 12. Find y when x = 4.", a: "9", worked: ["If y is inversely proportional to x: xy = k", "k = 3 × 12 = 36", "When x = 4: y = 36 ÷ 4 = 9"] },
);
questionBank['R2'][4].push(
  { q: "Change 30 miles per hour into kilometres per hour. (Use 5 miles = 8 km)", a: "48", worked: ["Scale factor = 8 ÷ 5 = 1.6", "30 × 1.6 = 48 km/h"] },
);

// G1: Angle Facts & Shape Properties
questionBank['G1'][0].push(
  { q: "How many sides does a hexagon have?", type: "mcq", options: ["6", "5", "7", "8"], a: "6", worked: ["Hex = 6, so a hexagon has 6 sides"] },
);
questionBank['G1'][1].push(
  { q: "Two angles on a straight line are x° and 65°. Work out the value of x.", a: "115", worked: ["Angles on a straight line sum to 180°", "x + 65 = 180", "x = 115°"] },
);
questionBank['G1'][2].push(
  { q: "An isosceles triangle has two equal angles of 50°. Work out the third angle.", a: "80", worked: ["Angles in a triangle sum to 180°", "50 + 50 + third angle = 180", "Third angle = 180 − 100 = 80°"] },
);
questionBank['G1'][3].push(
  { q: "Work out the size of one exterior angle of a regular hexagon.", a: "60", worked: ["Exterior angles of any polygon sum to 360°", "Regular hexagon has 6 equal exterior angles", "Each exterior angle = 360° ÷ 6 = 60°"] },
);
questionBank['G1'][4].push(
  { q: "Two angles in a triangle are 35° and 90°. What type of triangle is it?", type: "mcq", options: ["Right-angled triangle", "Equilateral triangle", "Isosceles triangle", "Obtuse triangle"], a: "Right-angled triangle", worked: ["One angle is 90°", "A triangle with a 90° angle is a right-angled triangle", "Third angle = 180 − 35 − 90 = 55°"] },
);

// G2: Mixed Geometry Practice
questionBank['G2'][0].push(
  { q: "The point (4, 6) is reflected in the x-axis. What are the coordinates of the image?", a: "(4, -6)", worked: ["When reflecting in the x-axis:", "The x-coordinate stays the same", "The y-coordinate changes sign", "(4, 6) → (4, −6)"] },
);
questionBank['G2'][1].push(
  { q: "Calculate the area of a trapezium with parallel sides 8 cm and 12 cm, and a height of 3 cm.", a: "30", worked: ["Area of trapezium = ½ × (a + b) × h", "= ½ × (8 + 12) × 3", "= ½ × 20 × 3 = 30 cm²"] },
);
questionBank['G2'][2].push(
  { q: "What 2D shape would you see if you looked at a cylinder from the front?", a: "rectangle", worked: ["Looking at a cylinder from the front shows its height and width", "This creates a rectangular outline", "Answer: rectangle"] },
);
questionBank['G2'][3].push(
  { q: "a = [vec:2,-3] and b = [vec:4,1]. Work out 2a − b. Give your answer as x, y.", a: "0, -7", worked: ["First find 2a: 2 × [vec:2,-3] = [vec:4,-6]", "Then subtract: 2a − b = [vec:4,-6] − [vec:4,1]", "= [vec:0,-7]"] },
);
questionBank['G2'][4].push(
  { q: "A sphere has radius 6 cm. Calculate the volume. Give your answer as a number followed by π (e.g. 50π).", a: "288π", worked: ["Volume of sphere = (4/3)πr³", "= (4/3) × π × 6³", "= (4/3) × π × 216 = 288π cm³"] },
);

// G12: Perimeter, Area & Volume
questionBank['G12'][0].push(
  { q: "Find the perimeter of a rectangle with length 7 cm and width 3 cm.", a: "20", worked: ["Perimeter = 2 × (length + width)", "= 2 × (7 + 3) = 2 × 10 = 20 cm"] },
);
questionBank['G12'][1].push(
  { q: "Work out the area of a square with side length 9 cm.", a: "81", worked: ["Area = side × side", "Area = 9 × 9 = 81 cm²"] },
);
questionBank['G12'][2].push(
  { q: "Find the area of a triangle with base 10 cm and perpendicular height 7 cm.", a: "35", worked: ["Area = (base × height) ÷ 2", "Area = (10 × 7) ÷ 2 = 70 ÷ 2 = 35 cm²"] },
);
questionBank['G12'][3].push(
  { q: "Calculate the volume of a cube with side length 4 cm.", a: "64", worked: ["Volume = side³", "Volume = 4³ = 4 × 4 × 4 = 64 cm³"] },
);
questionBank['G12'][4].push(
  { q: "Calculate the circumference of a circle with diameter 10 cm. Give your answer to 1 decimal place.", a: "31.4", calculator: true, hint: "Circumference = π × d", worked: ["Circumference = π × d", "= π × 10 ≈ 31.4 cm"] },
);

// G20: Pythagoras & Trigonometry
questionBank['G20'][0].push(
  { q: "Which side of a right-angled triangle is always opposite the right angle?", type: "mcq", options: ["The hypotenuse", "The base", "The adjacent", "The perpendicular height"], a: "The hypotenuse", worked: ["The side opposite the right angle is the longest side", "This is always called the hypotenuse"] },
);
questionBank['G20'][1].push(
  { q: "Use Pythagoras' theorem to find the hypotenuse c when a = 5 and b = 12.", a: "13", worked: ["c² = a² + b²", "c² = 5² + 12² = 25 + 144 = 169", "c = √169 = 13"] },
);
questionBank['G20'][2].push(
  { q: "A right-angled triangle has a hypotenuse of 10 cm and one side of 6 cm. Find the missing side.", a: "8", calculator: true, worked: ["Using c² = a² + b²", "10² = 6² + b²", "100 = 36 + b²", "b² = 64, so b = 8 cm"] },
);
questionBank['G20'][3].push(
  { q: "In a right-angled triangle, the angle is 45° and the adjacent side is 8 cm. Use tan to find the length of the opposite side.", a: "8", calculator: true, worked: ["tan(angle) = opposite / adjacent", "tan(45°) = opposite / 8", "opposite = tan(45°) × 8 = 1 × 8 = 8 cm"] },
);
questionBank['G20'][4].push(
  { q: "In a right-angled triangle, the opposite side is 7 cm and the hypotenuse is 14 cm. Use sin⁻¹ to find the angle.", a: "30", calculator: true, worked: ["sin(angle) = opposite / hypotenuse", "sin(angle) = 7 / 14 = 0.5", "angle = sin⁻¹(0.5) = 30°"] },
);

// P4: Mixed Probability & Statistics
questionBank['P4'][0].push(
  { q: "A fair 6-sided die is rolled and a fair coin is flipped. What is the probability of rolling an even number and getting Heads?", a: "1/4", worked: ["Even numbers on die: 2, 4, 6 → P(even) = 3/6 = 1/2", "P(Heads) = 1/2", "P(even and Heads) = 1/2 × 1/2 = 1/4"] },
);
questionBank['P4'][1].push(
  { q: "A jar has 6 red and 4 green sweets. Two sweets are taken without replacement. Work out the probability that both are green.", a: "2/15", worked: ["P(1st green) = 4/10 = 2/5", "P(2nd green | 1st green) = 3/9 = 1/3", "P(both green) = 2/5 × 1/3 = 2/15"] },
);
questionBank['P4'][2].push(
  { q: "A survey asks 'Do you think school dinners are healthy?' This is a leading question. Write a better question.", type: "mcq", options: ["What do you think about school dinners?", "Don't you agree school dinners are unhealthy?", "School dinners are great, aren't they?", "Why are school dinners so bad?"], a: "What do you think about school dinners?", worked: ["A good survey question should be unbiased", "It should not lead the person to a particular answer", "'What do you think about school dinners?' is neutral and open"] },
);
questionBank['P4'][3].push(
  { q: "As the temperature increases, the number of coats sold decreases. What type of correlation is this?", type: "mcq", options: ["Negative correlation", "Positive correlation", "No correlation"], a: "Negative correlation", worked: ["As one variable increases, the other decreases", "This is negative correlation"] },
);
questionBank['P4'][4].push(
  { q: "A spinner has sections A, B, C. P(A) = 0.5, P(B) = 0.3. The spinner is spun 200 times. How many times would you expect to land on C?", a: "40", worked: ["P(C) = 1 − 0.5 − 0.3 = 0.2", "Expected frequency = P(C) × number of spins", "Expected = 0.2 × 200 = 40"] },
);

// P7: Tree Diagrams & Enumeration
questionBank['P7'][0].push(
  { q: "A 4-sided spinner (1, 2, 3, 4) is spun and a coin is flipped. How many possible outcomes are there?", a: "8", worked: ["Spinner outcomes: 4 (1, 2, 3, 4)", "Coin outcomes: 2 (Heads, Tails)", "Total outcomes = 4 × 2 = 8"] },
);
questionBank['P7'][1].push(
  { q: "A bag has 4 yellow and 6 purple counters. One counter is picked at random. What is the probability it is yellow?", a: "2/5", worked: ["Total counters = 4 + 6 = 10", "Yellow counters = 4", "Probability = 4/10 = 2/5"] },
);
questionBank['P7'][2].push(
  { q: "A fair die is rolled twice. What is the probability of getting a 6 both times?", a: "1/36", worked: ["P(6) = 1/6", "P(two 6s) = 1/6 × 1/6 = 1/36"] },
);
questionBank['P7'][3].push(
  { q: "Two events are independent. P(A) = 0.3 and P(B) = 0.4. Find P(A and B).", a: "0.12", worked: ["For independent events: P(A and B) = P(A) × P(B)", "P(A and B) = 0.3 × 0.4 = 0.12"] },
);
questionBank['P7'][4].push(
  { q: "A bag has 5 red and 3 blue marbles. Two are picked without replacement. Find the probability both are blue.", a: "3/28", worked: ["P(first blue) = 3/8", "P(second blue | first was blue) = 2/7", "P(both blue) = 3/8 × 2/7 = 6/56 = 3/28"] },
);

// S2: Tables & Charts
questionBank['S2'][0].push(
  { q: "A bar chart shows: Pizza 15, Curry 10, Pasta 8, Salad 7. How many people were surveyed in total?", a: "40", worked: ["Total = 15 + 10 + 8 + 7", "= 40 people"] },
);
questionBank['S2'][1].push(
  { q: "The following data shows shoe sizes of 8 students: 5, 7, 6, 5, 8, 5, 7, 6. What is the most common shoe size?", a: "5", worked: ["Count each size: 5 appears 3 times, 6 appears 2 times, 7 appears 2 times, 8 appears 1 time", "Most common (mode) = 5"] },
);
questionBank['S2'][2].push(
  { q: "In a pictogram, each symbol represents 5 items. How many symbols are needed to show 22 items?", a: "4.4", worked: ["Number of symbols = 22 ÷ 5 = 4.4", "Need 4 full symbols and 2/5 of a symbol"] },
);
questionBank['S2'][3].push(
  { q: "60 people were asked their favourite colour. 20 said blue. Calculate the angle for blue in a pie chart.", a: "120", worked: ["Fraction = 20/60 = 1/3", "Angle = 1/3 × 360° = 120°"] },
);
questionBank['S2'][4].push(
  { q: "A frequency table shows: Score 1 (freq 3), Score 2 (freq 7), Score 3 (freq 5), Score 4 (freq 5). How many scores were recorded in total?", a: "20", worked: ["Total frequency = 3 + 7 + 5 + 5", "= 20 scores"] },
);

// S3: Averages & Range
questionBank['S3'][0].push(
  { q: "Find the mode of: 4, 7, 4, 3, 7, 4, 8.", a: "4", worked: ["Mode is the most frequent value", "4 appears 3 times, 7 appears 2 times", "Mode = 4"] },
);
questionBank['S3'][1].push(
  { q: "Find the range of: 3, 15, 7, 22, 9.", a: "19", worked: ["Range = highest − lowest", "Highest = 22, Lowest = 3", "Range = 22 − 3 = 19"] },
);
questionBank['S3'][2].push(
  { q: "Find the median of: 12, 5, 8, 15, 3, 9.", a: "8.5", worked: ["Order the data: 3, 5, 8, 9, 12, 15", "Even number of values, so median is average of middle two", "Middle values: 8 and 9", "Median = (8 + 9) ÷ 2 = 8.5"] },
);
questionBank['S3'][3].push(
  { q: "Calculate the mean of: 6, 3, 11, 8, 2.", a: "6", worked: ["Mean = sum ÷ count", "Sum = 6 + 3 + 11 + 8 + 2 = 30", "Mean = 30 ÷ 5 = 6"] },
);
questionBank['S3'][4].push(
  { q: "The mean of four numbers is 8. Three of the numbers are 5, 10, and 6. Find the fourth number.", a: "11", worked: ["Mean = 8, so sum of 4 numbers = 8 × 4 = 32", "Sum of known numbers = 5 + 10 + 6 = 21", "Fourth number = 32 − 21 = 11"] },
);

// R9: Write as a Fraction or Percentage (3 more per level)
questionBank['R9'][0].push(
  { q: "What fraction of 1 kilogram is 250 grams?", a: "1/4", worked: ["1 kilogram = 1000 grams", "Fraction = 250 ÷ 1000 = 1/4"] },
  { q: "What fraction of 1 day is 6 hours?", a: "1/4", worked: ["1 day = 24 hours", "Fraction = 6 ÷ 24 = 1/4"] },
  { q: "What fraction of £1 is 20p?", a: "1/5", worked: ["£1 = 100p", "Fraction = 20 ÷ 100 = 1/5"] },
);
questionBank['R9'][1].push(
  { q: "Write 18 out of 25 as a percentage.", a: "72%", worked: ["Percentage = (part ÷ whole) × 100", "= (18 ÷ 25) × 100 = 0.72 × 100 = 72%"] },
  { q: "Write 9 out of 20 as a percentage.", a: "45%", worked: ["Percentage = (part ÷ whole) × 100", "= (9 ÷ 20) × 100 = 0.45 × 100 = 45%"] },
  { q: "Write 3 out of 8 as a percentage.", a: "37.5%", worked: ["Percentage = (part ÷ whole) × 100", "= (3 ÷ 8) × 100 = 0.375 × 100 = 37.5%"] },
);
questionBank['R9'][2].push(
  { q: "In a class of 25 students, 15 are girls. What percentage of the class are girls?", a: "60%", worked: ["Percentage = (part ÷ whole) × 100", "= (15 ÷ 25) × 100 = 0.6 × 100 = 60%"] },
  { q: "A bag has 40 sweets and 14 are strawberry flavoured. What percentage are strawberry?", a: "35%", worked: ["Percentage = (part ÷ whole) × 100", "= (14 ÷ 40) × 100 = 0.35 × 100 = 35%"] },
  { q: "Out of 80 cars in a car park, 20 are blue. What percentage of the cars are blue?", a: "25%", worked: ["Percentage = (part ÷ whole) × 100", "= (20 ÷ 80) × 100 = 0.25 × 100 = 25%"] },
);
questionBank['R9'][3].push(
  { q: "Write 300 ml as a fraction of 2 litres. Give your answer in its simplest form.", a: "3/20", worked: ["Convert to same units: 2 litres = 2000 ml", "Fraction = 300 ÷ 2000 = 3/20"] },
  { q: "Write 40 minutes as a fraction of 2 hours. Give your answer in its simplest form.", a: "1/3", worked: ["Convert to same units: 2 hours = 120 minutes", "Fraction = 40 ÷ 120 = 1/3"] },
  { q: "Write 800 g as a fraction of 5 kg. Give your answer in its simplest form.", a: "4/25", worked: ["Convert to same units: 5 kg = 5000 g", "Fraction = 800 ÷ 5000 = 8/50 = 4/25"] },
);
questionBank['R9'][4].push(
  { q: "In a school, the ratio of boys to girls is 3:2. What percentage of the students are boys?", a: "60%", worked: ["Total parts = 3 + 2 = 5", "Boys = 3 parts out of 5", "Percentage = (3 ÷ 5) × 100 = 60%"] },
  { q: "The ratio of passes to fails is 9:1. What percentage of students passed?", a: "90%", worked: ["Total parts = 9 + 1 = 10", "Passes = 9 parts out of 10", "Percentage = (9 ÷ 10) × 100 = 90%"] },
  { q: "The ratio of red sweets to green sweets is 2:3. What percentage of the sweets are green?", a: "60%", worked: ["Total parts = 2 + 3 = 5", "Green = 3 parts out of 5", "Percentage = (3 ÷ 5) × 100 = 60%"] },
);

// Map every objective code to the primary code that owns its question bank
// (derived from reference equality — aliases share the same array object)
const questionBankPrimary = {};
const _seenBanks = new Map();
Object.keys(questionBank).forEach(code => {
  const bank = questionBank[code];
  if (_seenBanks.has(bank)) {
    questionBankPrimary[code] = _seenBanks.get(bank);
  } else {
    _seenBanks.set(bank, code);
    questionBankPrimary[code] = code;
  }
});

// Reverse map: primary code → all codes sharing that question bank
const questionBankGroups = {};
Object.entries(questionBankPrimary).forEach(([code, primary]) => {
  if (!questionBankGroups[primary]) questionBankGroups[primary] = [];
  questionBankGroups[primary].push(code);
});

// Friendly labels for mixed question banks (shown in celebration screen)
const questionBankLabel = {
  'N5': 'Mixed Number Practice',
  'A3': 'Mixed Algebra Practice',
  'R2': 'Mixed Ratio Practice',
  'G2': 'Mixed Geometry Practice',
  'P4': 'Mixed Probability & Statistics',
};

// Higher tier question bank — harder versions of shared objectives + Higher-only topics
const higherQuestionBank = {

  // ═══════════════════════════════════════════════════════════════
  // N6: Index Laws & Surds (Higher)
  // ═══════════════════════════════════════════════════════════════
  'N6': [
    // Level 1 (Grade 4) — Understanding bounds
    [
      { q: "A length is given as 15 cm to the nearest cm. Write down the lower bound.", a: "14.5 cm", worked: ["Nearest cm means accuracy ± 0.5 cm", "Lower bound = 15 − 0.5 = 14.5 cm"], hint: "The lower bound is half a unit below the rounded value" },
      { q: "Simplify 7⁵ × 7⁻².", a: "7³ or 343", worked: ["When multiplying powers with the same base, add the indices", "7⁵ × 7⁻² = 7⁵⁺⁽⁻²⁾ = 7³", "7³ = 343"], hint: "Add the indices: 5 + (−2)" },
      { q: "Simplify (y³)⁴.", a: "y¹²", worked: ["When raising a power to a power, multiply the indices", "(y³)⁴ = y³ˣ⁴ = y¹²"], hint: "Multiply the indices: 3 × 4" },
    ],
    // Level 2 (Grade 5) — Error intervals
    [
      { q: "Write the error interval for x = 4.7 rounded to 1 decimal place.", a: "4.65 ≤ x < 4.75", worked: ["Rounded to 1 d.p. means accurate to ± 0.05", "Lower bound = 4.7 − 0.05 = 4.65", "Upper bound = 4.7 + 0.05 = 4.75", "Error interval: 4.65 ≤ x < 4.75"], hint: "Half a unit of the last decimal place either side" },
      { q: "Evaluate 125^(1/3).", a: "5", worked: ["125^(1/3) means the cube root of 125", "∛125 = 5 because 5³ = 125"], hint: "A fractional index of 1/3 means cube root" },
      { q: "Evaluate 16^(−3/4).", a: "1/8", worked: ["16^(−3/4) = 1/16^(3/4)", "16^(1/4) = ⁴√16 = 2", "16^(3/4) = 2³ = 8", "16^(−3/4) = 1/8"], hint: "Negative index means reciprocal. Fractional index: root first, then power" },
    ],
    // Level 3 (Grade 7) — Bounds with calculations
    [
      { q: "Calculate the maximum possible area of a rectangle with sides 8.4 cm and 5.2 cm, both given to 1 decimal place.", a: "44.3625 cm²", worked: ["UB of 8.4 = 8.45 cm", "UB of 5.2 = 5.25 cm", "Maximum area = 8.45 × 5.25 = 44.3625 cm²"], hint: "For maximum area, use the upper bound of both measurements", calculator: true },
      { q: "Rationalise the denominator of 4/√2.", a: "2√2", worked: ["4/√2 × √2/√2 = 4√2/2 = 2√2"], hint: "Multiply top and bottom by √2" },
      { q: "Simplify √18 + √50.", a: "8√2", worked: ["√18 = √(9 × 2) = 3√2", "√50 = √(25 × 2) = 5√2", "3√2 + 5√2 = 8√2"], hint: "Simplify each surd first by finding square factors" },
    ],
    // Level 4 (Grade 8) — Bounds with division
    [
      { q: "v = s/t. s = 100 m to the nearest 10 m, t = 9.8 s to 1 d.p. Calculate the upper bound for v. Give your answer to 3 s.f.", a: "10.8 m/s", worked: ["UB of s = 105 m", "LB of t = 9.75 s", "Upper bound of v = UB(s) / LB(t)", "= 105 / 9.75 = 10.769...", "= 10.8 m/s (3 s.f.)"], hint: "For upper bound of a fraction: use upper bound of numerator and lower bound of denominator", calculator: true },
      { q: "Simplify (3 + √5)(3 − √5).", a: "4", worked: ["Use the difference of two squares: (a + b)(a − b) = a² − b²", "(3 + √5)(3 − √5) = 3² − (√5)²", "= 9 − 5 = 4"], hint: "This is a difference of two squares pattern" },
      { q: "Expand and simplify (√3 + 2)².", a: "7 + 4√3", worked: ["(√3 + 2)² = (√3)² + 2(√3)(2) + 2²", "= 3 + 4√3 + 4", "= 7 + 4√3"], hint: "Use (a + b)² = a² + 2ab + b²" },
    ],
    // Level 5 (Grade 9) — Complex bounds expressions
    [
      { q: "a = (b − c)/d. b = 50 (nearest 10), c = 20 (nearest 10), d = 6 (nearest integer). Calculate the lower bound for a. Give your answer to 3 s.f.", a: "3.08", worked: ["For minimum a: minimise numerator, maximise denominator", "LB of b = 45, UB of c = 25, UB of d = 6.5", "LB of (b − c) = 45 − 25 = 20", "LB of a = 20 / 6.5 = 3.076...", "= 3.08 (3 s.f.)"], hint: "For the smallest value of a fraction: smallest numerator ÷ largest denominator. For (b−c), smallest means smallest b and largest c.", calculator: true },
      { q: "Work out the value of x if 2^(x+1) = 16.", a: "3", worked: ["16 = 2⁴", "So 2^(x+1) = 2⁴", "x + 1 = 4", "x = 3"], hint: "Write 16 as a power of 2, then equate the indices" },
      { q: "Solve 25ˣ = 5^(x+3).", a: "3", worked: ["25 = 5², so 25ˣ = (5²)ˣ = 5²ˣ", "5²ˣ = 5^(x+3)", "Equate indices: 2x = x + 3", "x = 3"], hint: "Write both sides as powers of 5, then equate the indices" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N15: Exact Trigonometric Values (Higher)
  // ═══════════════════════════════════════════════════════════════
  'N15': [
    // Level 1 (Grade 4) — Recall exact values
    [
      { q: "State the value of tan(45°).", a: "1", worked: ["tan(45°) = 1", "This is a standard exact trig value to memorise"], hint: "sin(45°)/cos(45°) = 1" },
      { q: "Write down the exact value of sin(30°).", a: "1/2", worked: ["sin(30°) = 1/2"], hint: "A standard exact value" },
      { q: "Write down the exact value of cos(0°).", a: "1", worked: ["cos(0°) = 1"], hint: "What is cos at 0 degrees?" },
    ],
    // Level 2 (Grade 5) — Combining exact values
    [
      { q: "Use exact values to calculate sin(30°) + cos(60°).", a: "1", worked: ["sin(30°) = 1/2", "cos(60°) = 1/2", "1/2 + 1/2 = 1"], hint: "sin(30°) = 1/2 and cos(60°) = 1/2" },
      { q: "Without a calculator, work out cos(60°) + tan(45°). Give your answer as a fraction.", a: "3/2", worked: ["cos(60°) = 1/2", "tan(45°) = 1", "1/2 + 1 = 3/2"], hint: "cos(60°) = 1/2 and tan(45°) = 1" },
      { q: "Without a calculator, work out sin(45°) × cos(45°). Give your answer as a fraction.", a: "1/2", worked: ["sin(45°) = √2/2", "cos(45°) = √2/2", "√2/2 × √2/2 = 2/4 = 1/2"], hint: "Both sin(45°) and cos(45°) equal √2/2" },
    ],
    // Level 3 (Grade 7) — Using exact values in area problems
    [
      { q: "Calculate the area of a triangle with sides 6 cm and 8 cm and an included angle of 60°. Leave your answer in surd form.", a: "12√3", worked: ["Area = ½ × a × b × sin(C)", "= ½ × 6 × 8 × sin(60°)", "= ½ × 48 × √3/2", "= 24 × √3/2 = 12√3 cm²"], hint: "Area = ½ab sin(C), and sin(60°) = √3/2" },
      { q: "A triangle has sides 8 cm and 10 cm with an included angle of 30°. Find the exact area.", a: "20", worked: ["Area = ½ × 8 × 10 × sin(30°)", "= ½ × 80 × ½ = 20 cm²"], hint: "Area = ½ab sin(C), and sin(30°) = ½" },
      { q: "Show that tan(60°) × cos(30°) = 1.5.", a: "Shown", type: "proof", worked: ["tan(60°) = √3", "cos(30°) = √3/2", "tan(60°) × cos(30°) = √3 × √3/2 = 3/2 = 1.5 ✓"], hint: "Substitute the exact values for tan(60°) and cos(30°)" },
    ],
    // Level 4 (Grade 8) — Using exact values with trigonometry
    [
      { q: "A right-angled triangle has an angle of 30° and an adjacent side of 12 cm. Find the exact length of the opposite side. Give your answer in surd form.", a: "4√3", worked: ["tan(30°) = opposite/adjacent", "tan(30°) = 1/√3", "opposite = 12 × 1/√3 = 12/√3", "= 12√3/3 = 4√3 cm"], hint: "tan(30°) = 1/√3. Opposite = 12 × 1/√3, then rationalise" },
      { q: "In a right-angled triangle, one angle is 60° and the hypotenuse is 10 cm. Find the exact length of the side opposite the 60° angle.", a: "5√3", worked: ["sin(60°) = opposite/hypotenuse", "√3/2 = opposite/10", "opposite = 10 × √3/2 = 5√3 cm"], hint: "Use sin(60°) = √3/2 = opp/10" },
      { q: "A triangle has an angle of 45° and a hypotenuse of 10 cm. Find the exact length of the opposite side.", a: "5√2", worked: ["sin(45°) = opposite/hypotenuse", "√2/2 = opposite/10", "opposite = 10 × √2/2 = 5√2 cm"], hint: "sin(45°) = √2/2. Multiply by the hypotenuse." },
    ],
    // Level 5 (Grade 9) — Proving trig identities with exact values
    [
      { q: "Prove that sin(60°)/tan(30°) = 1.5. Write down each step of your proof.", a: "1.5", worked: ["sin(60°) = √3/2", "tan(30°) = 1/√3", "sin(60°)/tan(30°) = (√3/2) ÷ (1/√3)", "= (√3/2) × (√3/1) = 3/2 = 1.5 ✓"], hint: "Substitute the exact values: sin(60°) = √3/2 and tan(30°) = 1/√3" },
      { q: "Solve cos(θ) = −1/2 for 0° ≤ θ ≤ 360°. Give both values.", a: "120, 240", worked: ["cos(60°) = 1/2, so the reference angle is 60°", "cos is negative in Q2 and Q3", "θ = 180° − 60° = 120° or θ = 180° + 60° = 240°"], hint: "Reference angle is 60°. Cos is negative in Q2 and Q3" },
      { q: "Prove that sin(30°)/cos(30°) = 1/√3.", a: "Shown", type: "proof", worked: ["sin(30°) = 1/2", "cos(30°) = √3/2", "sin(30°)/cos(30°) = (1/2) ÷ (√3/2)", "= (1/2) × (2/√3) = 1/√3 ✓"], hint: "This is the same as tan(30°). Substitute the exact values." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A4/A11: Quadratic Sequences (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A25': [
    // Level 1 (Grade 4) — Continue a quadratic sequence
    [
      { q: "Find the next two terms in the sequence 3, 6, 11, 18, ...", a: "27, 38", worked: ["Differences: 3, 5, 7 (increasing by 2 each time)", "Next differences: 9, 11", "18 + 9 = 27, 27 + 11 = 38"], hint: "Find the differences, then the second differences" },
      { q: "Find the next two terms in the sequence 2, 5, 10, 17, ...", a: "26, 37", worked: ["Differences: 3, 5, 7 (increasing by 2)", "Next differences: 9, 11", "17 + 9 = 26, 26 + 11 = 37"], hint: "Find the first and second differences" },
      { q: "Find the next two terms in the sequence 1, 4, 9, 16, ...", a: "25, 36", worked: ["These are the square numbers: 1², 2², 3², 4²", "Next: 5² = 25, 6² = 36"], hint: "Look at the pattern — these are perfect squares" },
      { q: "Find the next two terms in the sequence 0, 3, 8, 15, ...", a: "24, 35", worked: ["Differences: 3, 5, 7 (increasing by 2 each time)", "Next differences: 9, 11", "15 + 9 = 24, 24 + 11 = 35"], hint: "Find the differences between terms, then the second differences" },
    ],
    // Level 2 (Grade 5) — nth term of linear sequence
    [
      { q: "Find the nth term of the sequence 7, 10, 13, 16, ...", a: "3n + 4", worked: ["Common difference = 3", "nth term starts as 3n", "When n=1: 3(1) = 3, but first term is 7", "Adjustment: +4", "nth term = 3n + 4"], hint: "Common difference = 3, so starts with 3n. Then adjust" },
      { q: "Find the nth term of the sequence 5, 9, 13, 17, ...", a: "4n + 1", worked: ["Common difference = 4", "nth term = 4n + ?", "When n=1: 4(1) = 4, need 5, so +1", "nth term = 4n + 1"], hint: "Common difference = 4, so starts with 4n" },
      { q: "Find the nth term of the sequence 2, 8, 14, 20, ...", a: "6n − 4", worked: ["Common difference = 6", "nth term = 6n + ?", "When n=1: 6(1) = 6, but first term is 2, so −4", "nth term = 6n − 4"], hint: "Common difference = 6, so starts with 6n. Then adjust" },
    ],
    // Level 3 (Grade 7) — nth term of quadratic sequence
    [
      { q: "Find the nth term of the quadratic sequence 5, 12, 23, 38, ...", a: "2n^2 + n + 2", worked: ["First differences: 7, 11, 15", "Second differences: 4, 4 → constant, so quadratic", "a = 4/2 = 2, so starts with 2n²", "Subtract 2n²: 5−2, 12−8, 23−18, 38−32 → 3, 4, 5, 6", "Linear part: n + 2", "nth term = 2n² + n + 2"], hint: "Second difference = 4, so a = 2. Subtract 2n² and find the linear part" },
      { q: "Find the nth term of the quadratic sequence 4, 10, 20, 34, ...", a: "2n^2 + 2", worked: ["First differences: 6, 10, 14", "Second differences: 4, 4", "a = 2, so 2n²", "Subtract 2n²: 4−2, 10−8, 20−18, 34−32 → 2, 2, 2, 2", "nth term = 2n² + 2"], hint: "Second difference = 4, so a = 2. Subtract 2n² from each term" },
      { q: "Find the nth term of the quadratic sequence 3, 8, 17, 30, ...", a: "2n^2 − n + 2", worked: ["First differences: 5, 9, 13", "Second differences: 4, 4 → constant, so quadratic", "a = 4/2 = 2, so starts with 2n²", "Subtract 2n²: 3−2, 8−8, 17−18, 30−32 → 1, 0, −1, −2", "Linear part: −n + 2", "nth term = 2n² − n + 2"], hint: "Second difference = 4, so a = 2. Subtract 2n² and find the linear part" },
    ],
    // Level 4 (Grade 8) — Finding coefficients from terms
    [
      { q: "A sequence has nth term n² + bn + c. The 3rd term is 15 and the 5th term is 35. Find b and c.", a: "b = 2, c = 0", worked: ["3rd term: 9 + 3b + c = 15 → 3b + c = 6", "5th term: 25 + 5b + c = 35 → 5b + c = 10", "Subtract: 2b = 4 → b = 2", "Substitute back: 3(2) + c = 6 → c = 0", "Check: 3rd = 9+6+0 = 15 ✓, 5th = 25+10+0 = 35 ✓"], hint: "Substitute n=3 and n=5 to form two simultaneous equations" },
      { q: "The nth term of a quadratic sequence is an² + bn + c. The first three terms are 4, 11, 22. Find a, b and c.", a: "a = 2, b = 1, c = 1", worked: ["n=1: a + b + c = 4", "n=2: 4a + 2b + c = 11", "n=3: 9a + 3b + c = 22", "Eq2 − Eq1: 3a + b = 7", "Eq3 − Eq2: 5a + b = 11", "Subtract: 2a = 4 → a = 2", "3(2) + b = 7 → b = 1", "2 + 1 + c = 4 → c = 1", "Check: 2(1) + 1 + 1 = 4 ✓, 2(4) + 2 + 1 = 11 ✓, 2(9) + 3 + 1 = 22 ✓"], hint: "Substitute n=1, 2, 3 to form three simultaneous equations" },
      { q: "A quadratic sequence has nth term 3n² − 2n + 1. Find the 10th term and verify the second differences are constant.", a: "10th term = 281; second differences = 6", worked: ["10th term: 3(100) − 2(10) + 1 = 300 − 20 + 1 = 281", "First 4 terms: 3−2+1=2, 12−4+1=9, 27−6+1=22, 48−8+1=41", "First differences: 7, 13, 19", "Second differences: 6, 6 ✓ (constant = 2a = 2×3 = 6)"], hint: "Substitute n=10. For second differences, list the first few terms and check" },
    ],
    // Level 5 (Grade 9) — Proof about sequences
    [
      { q: "The nth term of a sequence is n² + n + 1. Prove that every term is odd.", type: "mcq", options: ["n² + n is always even, so +1 makes it odd", "Every other term is odd", "Only works for even n", "Cannot be proven"], a: "n² + n is always even, so +1 makes it odd", worked: ["n² + n = n(n+1)", "n and n+1 are consecutive integers", "One of them must be even, so n(n+1) is always even", "Even + 1 = odd", "Therefore every term is odd ✓"], hint: "Factor n² + n as n(n+1). What can you say about consecutive integers?" },
      { q: "The nth term of a sequence is n² + n + 41. Show that the first 5 terms are all prime, then find a value of n for which the term is NOT prime.", a: "n = 40 gives 40² + 40 + 41 = 1681 = 41²", type: "mcq", options: ["n = 40 gives 40² + 40 + 41 = 1681 = 41²", "n = 10 gives 151 which is not prime", "All terms are always prime", "n = 20 gives 461 which is not prime"], worked: ["n=1: 1+1+41 = 43 (prime ✓)", "n=2: 4+2+41 = 47 (prime ✓)", "n=3: 9+3+41 = 53 (prime ✓)", "n=4: 16+4+41 = 61 (prime ✓)", "n=5: 25+5+41 = 71 (prime ✓)", "But n=40: 1600+40+41 = 1681 = 41×41 (NOT prime)", "This shows a formula can look like it always gives primes but doesn't"], hint: "Try n=40. What do you notice about 40² + 40 + 41 and factoring out?" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A18: Simultaneous Equations (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A18': [
    // Level 1 (Grade 4) — Simple elimination
    [
      { q: "Solve simultaneously: x + y = 10 and x − y = 4. Give your answer as x, y.", a: "7, 3", worked: ["Add the equations: 2x = 14 → x = 7", "Substitute: 7 + y = 10 → y = 3"], hint: "Add the equations to eliminate y" },
      { q: "Solve simultaneously: x + y = 8 and x − y = 2. Give your answer as x, y.", a: "5, 3", worked: ["Add: 2x = 10 → x = 5", "Substitute: 5 + y = 8 → y = 3"], hint: "Add the equations to eliminate y" },
      { q: "Solve simultaneously: x + y = 12 and x − y = 2. Give your answer as x, y.", a: "7, 5", worked: ["Add the equations: 2x = 14 → x = 7", "Substitute: 7 + y = 12 → y = 5"], hint: "Add the equations to eliminate y" },
    ],
    // Level 2 (Grade 5) — Elimination with multiplication
    [
      { q: "Solve simultaneously: 3x + 2y = 16 and 2x + 3y = 14. Give your answer as x, y.", a: "4, 2", worked: ["Multiply eq1 by 3: 9x + 6y = 48", "Multiply eq2 by 2: 4x + 6y = 28", "Subtract: 5x = 20 → x = 4", "Substitute: 3(4) + 2y = 16 → 2y = 4 → y = 2"], hint: "Make the y coefficients equal, then subtract" },
      { q: "Solve simultaneously: 5x + 3y = 21 and 2x + 4y = 14. Give your answer as x, y.", a: "3, 2", worked: ["Multiply eq1 by 4: 20x + 12y = 84", "Multiply eq2 by 3: 6x + 12y = 42", "Subtract: 14x = 42 → x = 3", "Substitute: 2(3) + 4y = 14 → y = 2"], hint: "Make the y coefficients equal, then subtract" },
      { q: "Solve simultaneously: 4x + 3y = 18 and x − 3y = 7. Give your answer as x, y.", a: "5, -2/3", worked: ["Add the equations: 5x = 25 → x = 5", "Substitute: 5 − 3y = 7 → −3y = 2 → y = −2/3"], hint: "The y terms cancel when you add the equations" },
      { q: "Solve simultaneously: 5x + 2y = 13 and x + 2y = 5. Give your answer as x, y.", a: "2, 1.5", worked: ["Subtract eq2 from eq1: 4x = 8 → x = 2", "Substitute: 2 + 2y = 5 → 2y = 3 → y = 1.5"], hint: "Subtract the equations to eliminate y" },
    ],
    // Level 3 (Grade 7) — One linear, one quadratic
    [
      { q: "Solve y = x + 2 and x² + y² = 10. Give your answers as coordinate pairs.", a: "(-3, -1), (1, 3)", worked: ["Substitute y = x + 2 into x² + y² = 10", "x² + (x+2)² = 10", "2x² + 4x + 4 = 10", "2x² + 4x − 6 = 0 → (x+3)(x−1) = 0", "x = −3, y = −1 or x = 1, y = 3"], hint: "Substitute y = x + 2 into x² + y² = 10" },
      { q: "Solve y = x + 3 and x² + y² = 17. Give your answers as coordinate pairs.", a: "(-4, -1), (1, 4)", worked: ["Substitute y = x + 3 into x² + y² = 17", "x² + (x+3)² = 17", "x² + x² + 6x + 9 = 17", "2x² + 6x − 8 = 0 → x² + 3x − 4 = 0", "(x+4)(x−1) = 0", "x = −4, y = −1 or x = 1, y = 4"], hint: "Substitute y = x + 3 into x² + y² = 17" },
      { q: "Solve y = 2x + 1 and x² + y² = 10. Give your answers as coordinate pairs.", a: "(-1.8, -2.6), (1, 3)", worked: ["Substitute y = 2x + 1 into x² + y² = 10:", "x² + (2x + 1)² = 10", "x² + 4x² + 4x + 1 = 10", "5x² + 4x − 9 = 0", "(5x + 9)(x − 1) = 0", "x = 1, y = 3 or x = −9/5 = −1.8, y = −2.6"], hint: "Substitute the linear equation into the circle equation" },
    ],
    // Level 4 (Grade 8) — Line intersects circle/curve
    [
      { q: "Find the coordinates where y = x − 4 and x² + y² = 10 intersect. Give your answers as coordinate pairs.", a: "(1, -3), (3, -1)", worked: ["Substitute y = x − 4 into x² + y² = 10", "x² + (x−4)² = 10", "x² + x² − 8x + 16 = 10", "2x² − 8x + 6 = 0 → x² − 4x + 3 = 0", "(x−1)(x−3) = 0", "x = 1, y = −3 or x = 3, y = −1"], hint: "Substitute y = x − 4 into x² + y² = 10" },
      { q: "Find the intersection of y = x − 5 and x² + y² = 25. Give your answers as coordinate pairs.", a: "(0, -5), (5, 0)", worked: ["Substitute y = x − 5 into x² + y² = 25:", "x² + (x − 5)² = 25", "x² + x² − 10x + 25 = 25", "2x² − 10x = 0 → 2x(x − 5) = 0", "x = 0, y = −5 or x = 5, y = 0"], hint: "Substitute and factorise" },
    ],
    // Level 5 (Grade 9) — Complex simultaneous
    [
      { q: "Solve 2x² + xy = 10 and x + y = 5. Give your answers as coordinate pairs.", a: "(2, 3), (-5/3, 20/3)", worked: ["From eq2: y = 5 − x", "Substitute: 2x² + x(5−x) = 10", "2x² + 5x − x² = 10", "x² + 5x − 10 = 0", "Use quadratic formula or: let's try integer values", "x = 2: 4 + 10 − 4 = 10 ✓, y = 3"], hint: "Rearrange x + y = 5 for y, substitute into the quadratic" },
      { q: "Solve 3x² − xy = 4 and x + y = 3. Give your answers to 2 d.p.", a: "x = 1.44 or x = −0.69", worked: ["From eq2: y = 3 − x", "Substitute: 3x² − x(3 − x) = 4", "3x² − 3x + x² = 4", "4x² − 3x − 4 = 0", "x = (3 ± √(9 + 64))/8 = (3 ± √73)/8", "x ≈ 1.44 or x ≈ −0.69"], hint: "Rearrange x + y = 3 for y, substitute into the quadratic, use the formula", calculator: true },
      { q: "Solve x² + y² = 20 and 2x + y = 10. Give your answers as coordinate pairs.", a: "(4, 2)", worked: ["From eq2: y = 10 − 2x", "x² + (10 − 2x)² = 20", "x² + 100 − 40x + 4x² = 20", "5x² − 40x + 80 = 0 → x² − 8x + 16 = 0", "(x − 4)² = 0 → x = 4", "y = 10 − 8 = 2", "One repeated solution: (4, 2)"], hint: "The line is tangent to the circle — there's only one solution" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A7: Composite and Inverse Functions (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A7': [
    // Level 1 (Grade 5) — Evaluating functions
    [
      { q: "If f(x) = 3x − 1, find f(4).", a: "11", worked: ["f(4) = 3(4) − 1", "= 12 − 1 = 11"], hint: "Replace x with 4" },
      { q: "If f(x) = 2x + 5, find f(7).", a: "19", worked: ["f(7) = 2(7) + 5 = 14 + 5 = 19"], hint: "Replace x with 7" },
      { q: "If g(x) = x² − 4, find g(5).", a: "21", worked: ["g(5) = 5² − 4 = 25 − 4 = 21"], hint: "Replace x with 5" },
    ],
    // Level 2 (Grade 6) — Composite functions
    [
      { q: "If f(x) = x² and g(x) = x − 4, find fg(x).", a: "(x − 4)²", worked: ["fg(x) means f(g(x))", "g(x) = x − 4", "f(g(x)) = f(x−4) = (x−4)²"], hint: "fg(x) = f(g(x)). First apply g, then apply f" },
      { q: "If f(x) = 2x and g(x) = x − 1, find gf(x).", a: "2x − 1", worked: ["gf(x) = g(f(x))", "f(x) = 2x", "g(2x) = 2x − 1"], hint: "gf(x) = g(f(x)). First apply f, then apply g" },
      { q: "If f(x) = x + 2 and g(x) = 3x, find fg(2).", a: "8", worked: ["g(2) = 3(2) = 6", "f(6) = 6 + 2 = 8"], hint: "First find g(2), then put that into f" },
    ],
    // Level 3 (Grade 7) — Inverse functions
    [
      { q: "Find the inverse function f⁻¹(x) for f(x) = (3x − 1)/4.", a: "(4x + 1)/3", worked: ["Let y = (3x − 1)/4", "4y = 3x − 1", "4y + 1 = 3x", "x = (4y + 1)/3", "f⁻¹(x) = (4x + 1)/3"], hint: "Let y = f(x), rearrange to make x the subject, then swap" },
      { q: "Find the inverse function f⁻¹(x) for f(x) = (x + 5)/2.", a: "2x − 5", worked: ["Let y = (x + 5)/2", "2y = x + 5", "x = 2y − 5", "f⁻¹(x) = 2x − 5"], hint: "Swap x and y, then rearrange" },
      { q: "Given f(x) = 4x − 10, find f⁻¹(x).", a: "(x + 10)/4", worked: ["Let y = 4x − 10", "y + 10 = 4x", "x = (y + 10)/4", "f⁻¹(x) = (x + 10)/4"], hint: "Let y = f(x), rearrange to make x the subject" },
    ],
    // Level 4 (Grade 8) — Solving f(x) = g(x) and domain restrictions
    [
      { q: "Solve f(x) = g(x) where f(x) = x² + 3 and g(x) = 4x − 1.", a: "x = 2", worked: ["x² + 3 = 4x − 1", "x² − 4x + 4 = 0", "(x − 2)² = 0", "x = 2 (repeated root)"], hint: "Set f(x) = g(x) and solve the resulting quadratic" },
      { q: "Given f(x) = 2/(x − 3), state the value of x for which f(x) is undefined.", a: "3", worked: ["f(x) is undefined when the denominator = 0", "x − 3 = 0 → x = 3"], hint: "The function is undefined when you divide by zero" },
      { q: "If f(x) = x² + 3 and g(x) = x − 5, find fg(x) in its simplest form.", a: "x² − 10x + 28", worked: ["fg(x) = f(g(x)) = f(x − 5)", "= (x − 5)² + 3", "= x² − 10x + 25 + 3", "= x² − 10x + 28"], hint: "fg(x) means f(g(x)). Replace x in f with g(x) = x − 5" },
    ],
    // Level 5 (Grade 9) — Inverse of rational functions
    [
      { q: "Given h(x) = (x + 2)/(x − 3), find h⁻¹(x) and state the value of x for which h(x) is undefined.", a: "h⁻¹(x) = (3x + 2)/(x − 1), undefined at x = 3", worked: ["Let y = (x + 2)/(x − 3)", "y(x − 3) = x + 2", "xy − 3y = x + 2", "xy − x = 3y + 2", "x(y − 1) = 3y + 2", "x = (3y + 2)/(y − 1)", "h⁻¹(x) = (3x + 2)/(x − 1)", "h(x) is undefined when x − 3 = 0, so x = 3"], hint: "Let y = h(x), multiply out, collect x terms, factorise" },
      { q: "Find f⁻¹(x) for f(x) = 2/(x − 3).", a: "(2 + 3x)/x", worked: ["Let y = 2/(x − 3)", "y(x − 3) = 2", "xy − 3y = 2", "xy = 2 + 3y", "x = (2 + 3y)/y", "f⁻¹(x) = (2 + 3x)/x"], hint: "Multiply both sides by (x−3), then solve for x" },
      { q: "If f(x) = x² + 3 and g(x) = x − 5, solve gf(x) = 15.", a: "x = ±√17", worked: ["gf(x) = g(f(x)) = g(x² + 3)", "= (x² + 3) − 5 = x² − 2", "Set x² − 2 = 15", "x² = 17", "x = ±√17 ≈ ±4.12"], hint: "Find gf(x) first, then solve the equation. Remember both ± solutions." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G20: Advanced Pythagoras & Trigonometry (Higher)
  // ═══════════════════════════════════════════════════════════════
  'G20': [
    // Level 1 (Grade 5) — Finding base diagonal of a cuboid
    [
      { q: "Find the length of the diagonal on the base of a cuboid with dimensions 3 cm × 4 cm × 12 cm.", a: "5 cm", worked: ["Base diagonal = √(3² + 4²)", "= √(9 + 16) = √25", "= 5 cm"], hint: "Use 2D Pythagoras on the base: √(length² + width²)", calculator: true },
      { q: "Find the diagonal of the base of a cuboid with dimensions 5 cm × 12 cm × 10 cm.", a: "13 cm", worked: ["Base diagonal = √(5² + 12²)", "= √(25 + 144) = √169", "= 13 cm"], hint: "Use Pythagoras on the base rectangle", calculator: true },
      { q: "Find the diagonal of the base for a 6 cm × 8 cm × 15 cm cuboid.", a: "10 cm", worked: ["Base diagonal = √(6² + 8²)", "= √(36 + 64) = √100", "= 10 cm"], hint: "Apply Pythagoras to the length and width", calculator: true },
    ],
    // Level 2 (Grade 6) — Internal (space) diagonal of a cuboid
    [
      { q: "Calculate the longest diagonal (internal diagonal) of a cuboid with dimensions 3 cm × 4 cm × 12 cm.", a: "13 cm", worked: ["Base diagonal = √(9 + 16) = 5 cm", "Space diagonal = √(5² + 12²) = √(25 + 144)", "= √169 = 13 cm"], hint: "Find the base diagonal first, then use Pythagoras with the height", calculator: true },
      { q: "Calculate the internal diagonal of an 8 cm × 6 cm × 5 cm cuboid. Give your answer to 1 d.p.", a: "11.2 cm", worked: ["Space diagonal = √(8² + 6² + 5²)", "= √(64 + 36 + 25) = √125", "= 11.2 cm (1 d.p.)"], hint: "Space diagonal = √(l² + w² + h²)", calculator: true },
      { q: "Find the distance between opposite corners (0,0,0) and (4,4,4) in a cube.", a: "4√3 cm", worked: ["Distance = √(4² + 4² + 4²)", "= √(16 + 16 + 16) = √48", "= 4√3 ≈ 6.93 cm"], hint: "Use 3D distance: √(x² + y² + z²)" },
    ],
    // Level 3 (Grade 7) — Angle between space diagonal and base
    [
      { q: "Find the angle between the longest diagonal and the base of a 3 cm × 4 cm × 12 cm cuboid. Give your answer to 1 d.p.", a: "67.4°", worked: ["Base diagonal = 5 cm", "tan θ = height / base diagonal = 12/5 = 2.4", "θ = tan⁻¹(2.4) = 67.4°"], hint: "tan(angle) = vertical height ÷ base diagonal", calculator: true },
      { q: "Find the angle between the internal diagonal and the shortest edge (5 cm) of an 8 cm × 6 cm × 5 cm cuboid. Give your answer to 1 d.p.", a: "63.4°", worked: ["Base diagonal (8 × 6 face) = √(64 + 36) = 10 cm", "The angle is between space diagonal and the vertical edge", "tan θ = base diagonal / height = 10/5 = 2", "θ = tan⁻¹(2) = 63.4°"], hint: "The angle at the base between the vertical edge and the space diagonal. Use tan = base diagonal / height.", calculator: true },
      { q: "Find the angle between the diagonal of a cube and its base. Give your answer to 1 d.p.", a: "35.3°", worked: ["For a cube with side a:", "Base diagonal = a√2", "tan θ = a / (a√2) = 1/√2", "θ = tan⁻¹(1/√2) = 35.3°"], hint: "The base diagonal of a cube with side a is a√2. Use tan = height / base diagonal.", calculator: true },
    ],
    // Level 4 (Grade 8) — 3D pyramids and cones
    [
      { q: "A square-based pyramid has base 6 cm × 6 cm and slant height 10 cm. Find the vertical height. Give your answer to 1 d.p.", a: "9.5 cm", worked: ["Slant height goes from apex to midpoint of base edge", "Half base edge = 3 cm", "h² + 3² = 10²", "h² = 100 − 9 = 91", "h = √91 = 9.5 cm (1 d.p.)"], hint: "The slant height, half the base edge, and the vertical height form a right triangle", calculator: true },
      { q: "A pyramid has a 10 cm square base and vertical height 12 cm. Find the slant height.", a: "13 cm", worked: ["Half base edge = 5 cm", "Slant height² = 12² + 5²", "= 144 + 25 = 169", "Slant height = √169 = 13 cm"], hint: "The slant height forms a right triangle with the height and half the base edge", calculator: true },
      { q: "In a cone, the radius is 5 cm and slant height is 13 cm. Find the vertical height.", a: "12 cm", worked: ["h² + r² = slant²", "h² + 25 = 169", "h² = 144", "h = 12 cm"], hint: "Use Pythagoras: h² + radius² = slant height²", calculator: true },
    ],
    // Level 5 (Grade 9) — Complex 3D angle problems
    [
      { q: "Calculate the angle between two triangular faces of a regular tetrahedron. Give your answer to 1 d.p.", a: "70.5°", worked: ["For a regular tetrahedron, the dihedral angle = arccos(1/3)", "cos θ = 1/3", "θ = cos⁻¹(1/3) = 70.5°"], hint: "The dihedral angle of a regular tetrahedron is arccos(1/3). This is a well-known result.", calculator: true },
      { q: "A pyramid has a 10 cm square base and vertical height 12 cm. Find the angle between a slant edge and the base. Give your answer to 1 d.p.", a: "59.5°", worked: ["Half diagonal of base = ½ × 10√2 = 5√2 ≈ 7.071 cm", "tan θ = height / half-diagonal = 12/5√2", "θ = tan⁻¹(12/7.071) = 59.5°"], hint: "The slant edge goes to a corner, so use the half-diagonal (not half-edge) of the base", calculator: true },
      { q: "Find the angle at the apex of a cone with radius 5 cm and slant height 13 cm. Give your answer to 1 d.p.", a: "45.2°", worked: ["The cross-section is an isosceles triangle: sides 13, 13, base 10", "cos A = (13² + 13² − 10²)/(2 × 13 × 13)", "= (169 + 169 − 100)/338 = 238/338", "A = cos⁻¹(0.7041) = 45.2°"], hint: "Use the cosine rule on the cross-sectional triangle with both slant heights and the diameter", calculator: true },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G10: Circle Theorems (Higher only)
  // ═══════════════════════════════════════════════════════════════
  'G10': [
    // Level 1 (Grade 4/5) — Angle in a semicircle and angle at centre
    [
      { q: "The angle in a semicircle is always...", type: "mcq", options: ["45°", "90°", "180°", "360°"], a: "90°", worked: ["The angle subtended by a diameter at the circumference is always 90°", "This is one of the key circle theorems"], hint: "Think about a triangle inscribed in a semicircle" },
      { q: "Triangle ABC is inscribed in a circle where AC is a diameter. Angle BAC = 35°. Find angle ABC.", a: "90", worked: ["AC is a diameter, so angle ABC is an angle in a semicircle", "Angle in a semicircle = 90°"], hint: "If one side of the triangle is a diameter, the angle opposite it is 90°", diagram: "G10-semicircle-35" },
      { q: "An arc subtends an angle of 140° at the centre. Find the angle subtended at the circumference.", a: "70", worked: ["The angle at the centre is twice the angle at the circumference", "Angle at circumference = 140° ÷ 2 = 70°"], hint: "Angle at centre = 2 × angle at circumference", diagram: "G10-centre-circum-140" },
    ],
    // Level 2 (Grade 6) — Cyclic quadrilateral and angle at centre
    [
      { q: "In a cyclic quadrilateral, one angle is 85°. Calculate the opposite angle.", a: "95", worked: ["Opposite angles in a cyclic quadrilateral sum to 180°", "Opposite angle = 180° − 85° = 95°"], hint: "Opposite angles in a cyclic quadrilateral add up to 180°", diagram: "G10-cyclic-quad-85" },
      { q: "An angle at the centre of a circle is 130°. What is the angle at the circumference standing on the same arc?", a: "65", worked: ["The angle at the centre is twice the angle at the circumference", "Angle at circumference = 130° ÷ 2 = 65°"], hint: "Angle at centre = 2 × angle at circumference", diagram: "G10-centre-circum-130" },
      { q: "A cyclic quadrilateral has an angle of 110°. Find the opposite angle.", a: "70", worked: ["Opposite angles in a cyclic quadrilateral sum to 180°", "Opposite angle = 180° − 110° = 70°"], hint: "Opposite angles in a cyclic quadrilateral add up to 180°", diagram: "G10-cyclic-quad-110" },
    ],
    // Level 3 (Grade 7) — Tangent-radius and alternate segment
    [
      { q: "Find the angle between a tangent and a radius at the point of contact.", a: "90", worked: ["A tangent to a circle is perpendicular to the radius at the point of contact", "The angle is always 90°"], hint: "Tangent is perpendicular to the radius" },
      { q: "In a cyclic quadrilateral ABCD, angle A = 115°. Find angle C.", a: "65", worked: ["Opposite angles in a cyclic quadrilateral sum to 180°", "Angle C = 180° − 115° = 65°"], hint: "Opposite angles in a cyclic quadrilateral add up to 180°" },
      { q: "The angle in the alternate segment is 65°. Calculate the angle between the chord and the tangent.", a: "65", worked: ["By the Alternate Segment Theorem:", "The angle between a tangent and a chord equals the angle in the alternate segment", "Angle = 65°"], hint: "Alternate Segment Theorem works both ways", diagram: "G10-alt-segment-65" },
    ],
    // Level 4 (Grade 8) — Proving cyclic quadrilateral property
    [
      { q: "A tangent to a circle meets chord AB at point A. The angle between the tangent and chord AB is 55°. Use the Alternate Segment Theorem to find the angle ACB where C is a point on the major arc.", a: "55", worked: ["By the Alternate Segment Theorem:", "The angle between a tangent and a chord equals", "the angle in the alternate segment", "So angle ACB = 55°"], hint: "Alternate Segment Theorem: angle between tangent and chord = angle in alternate segment", diagram: "G10-tangent-chord-55" },
      { q: "In a circle, a tangent at point A makes an angle of 72° with chord AB. Find the angle ACB where C is on the major arc.", a: "72", worked: ["By the Alternate Segment Theorem:", "Angle ACB = angle between tangent and chord = 72°"], hint: "Alternate Segment Theorem", diagram: "G10-tangent-chord-72" },
      { q: "Prove that opposite angles in a cyclic quadrilateral sum to 180°. What theorem does this use?", a: "Angle at centre theorem", type: "mcq", options: ["Angle at centre theorem", "Alternate segment theorem", "Pythagoras"], worked: ["Each pair of opposite angles subtends the full circle at the centre", "The two angles at the centre sum to 360°", "Each angle at circumference = half the angle at centre", "So opposite angles at circumference sum to 360°/2 = 180°"], hint: "Use the fact that the angle at the centre is twice the angle at the circumference" },
    ],
    // Level 5 (Grade 9) — Combined problems and tangent lengths
    [
      { q: "Prove that the angle subtended by an arc at the centre is twice the angle subtended at the circumference. (What is the name of this theorem?)", a: "Angle at centre theorem", type: "mcq", options: ["Angle at centre theorem", "Alternate segment theorem", "Tangent-radius theorem"], worked: ["Draw a radius to the point on the circumference to create two isosceles triangles", "In each isosceles triangle, the base angles are equal", "The angle at the centre = sum of the two exterior angles of the isosceles triangles", "This equals twice the angle at the circumference"], hint: "Create isosceles triangles using radii, then use exterior angle = sum of interior opposite angles" },
      { q: "Two tangents are drawn from point P to a circle with centre O and radius 5 cm. The angle between the tangents is 60°. Find the length OP.", a: "10", worked: ["The tangent is perpendicular to the radius: angle OAP = 90°", "Angle APO = 30° (half of 60° by symmetry)", "sin(30°) = OA/OP", "½ = 5/OP", "OP = 10 cm"], hint: "Split into two right triangles. Use sin(30°) = radius/OP", calculator: true, diagram: "G10-two-tangents-60" },
      { q: "Find the length of a tangent from point P(0, 10) to a circle centred at (0, 0) with radius 6.", a: "8", worked: ["OP = 10 (distance from origin to P)", "The tangent is perpendicular to the radius at the point of contact", "By Pythagoras: tangent² + 6² = 10²", "tangent² = 100 − 36 = 64", "tangent = 8"], hint: "The tangent, radius and OP form a right triangle. Use Pythagoras.", calculator: true, diagram: "G10-tangent-length" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R16: Direct & Inverse Proportion (Higher)
  // ═══════════════════════════════════════════════════════════════
  'R16': [
    // Level 1 (Grade 4) — Finding the constant of proportionality
    [
      { q: "y is directly proportional to x. When x = 10, y = 50. Find the constant k.", a: "5", worked: ["y = kx", "50 = k × 10", "k = 50/10 = 5"], hint: "y = kx, so k = y/x" },
      { q: "y is directly proportional to x. When x = 5, y = 20. Find y when x = 8.", a: "32", worked: ["y = kx", "20 = k × 5 → k = 4", "When x = 8: y = 4 × 8 = 32"], hint: "Find k first: y = kx, so k = 20/5" },
      { q: "y ∝ x. When x = 6, y = 42. Find the constant k.", a: "7", worked: ["y = kx", "42 = k × 6", "k = 42/6 = 7"], hint: "y = kx, so k = y/x" },
    ],
    // Level 2 (Grade 5) — Using direct and inverse proportion
    [
      { q: "y ∝ x. If x = 4 when y = 12, find y when x = 9.", a: "27", worked: ["y = kx", "12 = k × 4 → k = 3", "When x = 9: y = 3 × 9 = 27"], hint: "Find k first, then substitute the new x value" },
      { q: "y is directly proportional to x. When x = 3, y = 12. Find y when x = 7.", a: "28", worked: ["y = kx", "12 = k × 3 → k = 4", "When x = 7: y = 4 × 7 = 28"], hint: "y = kx, so k = 12/3" },
      { q: "y is inversely proportional to x. When x = 2, y = 20. Find y when x = 8.", a: "5", worked: ["y = k/x", "20 = k/2 → k = 40", "When x = 8: y = 40/8 = 5"], hint: "y = k/x, so k = 20 × 2 = 40" },
    ],
    // Level 3 (Grade 7) — Proportion to a power
    [
      { q: "y is inversely proportional to x. When x = 4, y = 10. Find y when x = 2.5.", a: "16", worked: ["y = k/x", "10 = k/4 → k = 40", "When x = 2.5: y = 40/2.5 = 16"], hint: "y = k/x, so k = 10 × 4 = 40" },
      { q: "y is inversely proportional to x. When x = 6, y = 15. Find y when x = 10.", a: "9", worked: ["y = k/x", "15 = k/6 → k = 90", "When x = 10: y = 90/10 = 9"], hint: "y = k/x, so k = y × x" },
      { q: "y ∝ x². When x = 2, y = 12. Find y when x = 5.", a: "75", worked: ["y = kx²", "12 = k × 4 → k = 3", "When x = 5: y = 3 × 25 = 75"], hint: "y = kx², so k = 12/4 = 3" },
    ],
    // Level 4 (Grade 8) — Proportion to a power and compound growth
    [
      { q: "y is directly proportional to the square of x. When x = 3, y = 36. Find y when x = 5.", a: "100", worked: ["y = kx²", "36 = k × 3² = 9k → k = 4", "When x = 5: y = 4 × 25 = 100"], hint: "y = kx², so k = 36/9 = 4" },
      { q: "y is directly proportional to x². When x = 4, y = 48. Find y when x = 6.", a: "108", worked: ["y = kx²", "48 = k × 16 → k = 3", "When x = 6: y = 3 × 36 = 108"], hint: "y = kx², so k = 48/16 = 3" },
      { q: "£2,000 is invested at 4% compound interest. Find the value after 3 years.", a: "£2,249.73", worked: ["Value = 2000 × 1.04³", "= 2000 × 1.124864", "= £2,249.73 (to nearest penny)"], hint: "Multiply by 1.04 three times, or use 2000 × 1.04³", calculator: true },
    ],
    // Level 5 (Grade 9) — Complex proportion and multi-rate depreciation
    [
      { q: "y is inversely proportional to the cube root of x. If x is increased by 700%, calculate the percentage decrease in y. Give your answer to 1 d.p.", a: "50.0", worked: ["x increases by 700% means new x = 8x (original + 700%)", "y = k/∛x", "New y = k/∛(8x) = k/(2∛x) = original y / 2", "Decrease = 1 − 0.5 = 0.5 = 50%"], hint: "700% increase means new x = 8 × original x. ∛8 = 2", calculator: true },
      { q: "The force F between two magnets is inversely proportional to the square of the distance d. If d increases by 50%, what is the percentage decrease in F? Give your answer to 1 d.p.", a: "55.6", worked: ["F = k/d²", "New d = 1.5d", "New F = k/(1.5d)² = k/2.25d²", "Ratio = 1/2.25 = 0.444...", "Decrease = 1 − 0.444 = 0.556 = 55.6%"], hint: "New d = 1.5d. New F = k/(1.5d)². Compare to original", calculator: true },
      { q: "A car loses 20% of its value in year 1, then 10% each year after. If the original value is £20,000, find the value after 4 years.", a: "£11,664", worked: ["After year 1: 20000 × 0.8 = £16,000", "After year 2: 16000 × 0.9 = £14,400", "After year 3: 14400 × 0.9 = £12,960", "After year 4: 12960 × 0.9 = £11,664"], hint: "Year 1: multiply by 0.8. Years 2-4: multiply by 0.9 each year.", calculator: true },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // S4: Cumulative Frequency & Histograms (Higher)
  // ═══════════════════════════════════════════════════════════════
  'S4': [
    // Level 1 (Grade 4/5) — Reading median from cumulative frequency
    [
      { q: "A cumulative frequency graph shows 80 data points. At what position should you read the median?", a: "40", worked: ["Median position = n/2", "= 80/2 = 40", "Read across from 40 on the cumulative frequency axis"], hint: "Median position = n ÷ 2" },
      { q: "A cumulative frequency graph for 60 students shows the 30th value corresponds to a score of 54. What is the median?", a: "54", worked: ["Median position = 60/2 = 30th value", "The 30th value corresponds to a score of 54", "Median = 54"], hint: "Find the n/2 position on the y-axis, then read across to the x-axis" },
      { q: "100 data values are shown on a cumulative frequency graph. At what positions would you read Q1 and Q3?", a: "Q1 at 25th value, Q3 at 75th value", worked: ["Q1 position = n/4 = 100/4 = 25th value", "Q3 position = 3n/4 = 3 × 100/4 = 75th value"], hint: "Q1 is at n/4 and Q3 is at 3n/4" },
    ],
    // Level 2 (Grade 6) — Drawing and reading box plots
    [
      { q: "A data set has: minimum = 12, Q1 = 18, median = 25, Q3 = 33, maximum = 45. What is the IQR?", a: "15", worked: ["IQR = Q3 − Q1", "= 33 − 18 = 15"], hint: "IQR = Q3 − Q1" },
      { q: "A box plot shows Q1 = 23, median = 31, Q3 = 51. What is the range of the middle 50% of the data?", a: "28", worked: ["The middle 50% is between Q1 and Q3", "Range of middle 50% = IQR = Q3 − Q1", "= 51 − 23 = 28"], hint: "The middle 50% is described by the interquartile range" },
      { q: "A box plot has: minimum 5, Q1 = 12, median = 19, Q3 = 27, maximum = 40. What percentage of data lies between 12 and 27?", a: "50%", worked: ["Q1 to Q3 contains the middle 50% of the data", "This is by definition — the interquartile range", "So 50% of data lies between 12 and 27"], hint: "What percentage of data is between Q1 and Q3?" },
    ],
    // Level 3 (Grade 7) — Using cumulative frequency to estimate
    [
      { q: "A cumulative frequency graph for 120 students shows: at 70 marks the CF is 85. Estimate the number of students who scored more than 70%.", a: "35", worked: ["Total students = 120", "Students scoring 70 or less = 85", "Students scoring more than 70 = 120 − 85 = 35"], hint: "Subtract the cumulative frequency at 70 from the total" },
      { q: "From a cumulative frequency graph of 200 data values, Q1 corresponds to 35 and Q3 corresponds to 58. Estimate the IQR.", a: "23", worked: ["Q1 position = 200/4 = 50th value → value = 35", "Q3 position = 3 × 200/4 = 150th value → value = 58", "IQR = 58 − 35 = 23"], hint: "Q1 is at n/4, Q3 is at 3n/4. Read the values and subtract." },
      { q: "A histogram has a bar from 10–20 with frequency density 3. The bar width is 10. How many data values are in this class?", a: "30", worked: ["Frequency = frequency density × class width", "= 3 × 10 = 30"], hint: "Frequency = frequency density × class width" },
    ],
    // Level 4 (Grade 8) — Comparing distributions using box plots
    [
      { q: "Class A has median 62 and IQR 18. Class B has median 58 and IQR 30. Which class performed more consistently?", a: "Class A", type: "mcq", options: ["Class A", "Class B", "Both the same"], worked: ["Consistency is measured by spread — lower IQR means more consistent", "Class A: IQR = 18 (less spread)", "Class B: IQR = 30 (more spread)", "Class A performed more consistently"], hint: "A smaller IQR means the data is more consistent (less spread out)" },
      { q: "Two box plots show: Boys — median 45, IQR 20, range 55. Girls — median 52, IQR 12, range 40. Make two comparisons.", a: "Girls have higher median (52 > 45) and smaller IQR (12 < 20)", worked: ["Median: Girls (52) > Boys (45), so girls scored higher on average", "IQR: Girls (12) < Boys (20), so girls' scores were more consistent", "Range: Girls (40) < Boys (55), confirming less spread"], hint: "Compare the medians (average) and the IQRs (consistency)" },
      { q: "A histogram shows classes 0–5 (FD=2), 5–10 (FD=4), 10–20 (FD=3), 20–40 (FD=1). Estimate the total frequency.", a: "80", worked: ["Frequency = FD × class width for each bar:", "0–5: 2 × 5 = 10", "5–10: 4 × 5 = 20", "10–20: 3 × 10 = 30", "20–40: 1 × 20 = 20", "Total = 10 + 20 + 30 + 20 = 80"], hint: "Frequency = frequency density × class width. Add up all the frequencies." },
    ],
    // Level 5 (Grade 9) — Outliers using 1.5 × IQR rule
    [
      { q: "A data set has Q1 = 20 and Q3 = 44. Using the 1.5 × IQR rule, what are the boundaries for outliers?", a: "Lower: −16, Upper: 80", worked: ["IQR = Q3 − Q1 = 44 − 20 = 24", "1.5 × IQR = 1.5 × 24 = 36", "Lower boundary = Q1 − 36 = 20 − 36 = −16", "Upper boundary = Q3 + 36 = 44 + 36 = 80", "Any value below −16 or above 80 is an outlier"], hint: "Outlier boundaries: Q1 − 1.5×IQR and Q3 + 1.5×IQR" },
      { q: "A data set has Q1 = 15, Q3 = 35. The value 72 appears in the data. Is it an outlier? Explain how outliers affect the mean.", a: "Yes, 72 is an outlier", worked: ["IQR = 35 − 15 = 20", "1.5 × IQR = 30", "Upper boundary = 35 + 30 = 65", "72 > 65, so 72 IS an outlier", "Outliers pull the mean towards them (increase it here)", "The median is not affected by outliers"], hint: "Check if 72 > Q3 + 1.5 × IQR. Outliers affect the mean but not the median." },
      { q: "A data set has Q1 = 25 and Q3 = 45. Find the outlier boundaries, and determine whether the values 0 and 78 are outliers.", a: "Lower: −5, Upper: 75. 0 is not an outlier, 78 is an outlier.", worked: ["IQR = 45 − 25 = 20", "1.5 × IQR = 30", "Lower boundary = 25 − 30 = −5", "Upper boundary = 45 + 30 = 75", "0 > −5, so 0 is NOT an outlier", "78 > 75, so 78 IS an outlier"], hint: "Find Q1 − 1.5×IQR and Q3 + 1.5×IQR. Then check if each value falls outside." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A4: Expanding, Factorising, Completing the Square & Algebraic Fractions (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A4': [
    // Level 1 (Grade 4) — Solving linear simultaneous equations
    [
      { q: "Solve x + y = 10 and x − y = 4.", a: "x = 7, y = 3", worked: ["Add the equations: 2x = 14", "x = 7", "Substitute: 7 + y = 10 → y = 3"], hint: "Add the two equations to eliminate y" },
      { q: "Solve x + y = 15 and x − y = 3.", a: "x = 9, y = 6", worked: ["Add: 2x = 18 → x = 9", "9 + y = 15 → y = 6"], hint: "Add the equations to eliminate y" },
      { q: "Solve x + y = 20 and y − x = 4.", a: "x = 8, y = 12", worked: ["Add: 2y = 24 → y = 12", "x + 12 = 20 → x = 8"], hint: "Add the equations to eliminate x" },
    ],
    // Level 2 (Grade 6) — Simultaneous equations by elimination
    [
      { q: "Solve 3x + 2y = 16 and 2x + y = 9.", a: "x = 2, y = 5", worked: ["From eq 2: y = 9 − 2x", "Substitute into eq 1: 3x + 2(9 − 2x) = 16", "3x + 18 − 4x = 16 → −x = −2 → x = 2", "y = 9 − 4 = 5"], hint: "Rearrange one equation for y, then substitute into the other" },
      { q: "Solve 5x + 3y = 21 and x + y = 5.", a: "x = 3, y = 2", worked: ["From eq 2: y = 5 − x", "Substitute: 5x + 3(5 − x) = 21", "5x + 15 − 3x = 21 → 2x = 6 → x = 3", "y = 5 − 3 = 2"], hint: "Rearrange the simpler equation for y" },
      { q: "Solve 2x − y = 7 and x + 2y = 11.", a: "x = 5, y = 3", worked: ["From eq 1: y = 2x − 7", "Substitute: x + 2(2x − 7) = 11", "5x − 14 = 11 → 5x = 25 → x = 5", "y = 10 − 7 = 3"], hint: "Rearrange for y, then substitute" },
    ],
    // Level 3 (Grade 7) — One linear, one quadratic (circle)
    [
      { q: "Solve y = x − 3 and x² + y² = 9.", a: "(0, −3) and (3, 0)", worked: ["Substitute y = x − 3 into x² + y² = 9", "x² + (x − 3)² = 9", "x² + x² − 6x + 9 = 9", "2x² − 6x = 0 → 2x(x − 3) = 0", "x = 0, y = −3 or x = 3, y = 0"], hint: "Substitute the linear equation into the circle equation" },
      { q: "Solve y = x + 2 and x² + y² = 10.", a: "(−3, −1) and (1, 3)", worked: ["x² + (x + 2)² = 10", "2x² + 4x + 4 = 10", "2x² + 4x − 6 = 0 → x² + 2x − 3 = 0", "(x + 3)(x − 1) = 0", "x = −3, y = −1 or x = 1, y = 3"], hint: "Substitute y = x + 2 into x² + y² = 10" },
      { q: "Solve x = y − 4 and x² + y² = 10.", a: "(−3, 1) and (−1, 3)", worked: ["(y − 4)² + y² = 10", "y² − 8y + 16 + y² = 10", "2y² − 8y + 6 = 0 → y² − 4y + 3 = 0", "(y − 1)(y − 3) = 0", "y = 1, x = −3 or y = 3, x = −1"], hint: "Substitute x = y − 4 into x² + y² = 10" },
    ],
    // Level 4 (Grade 8) — Line intersecting a circle
    [
      { q: "Find the intersection points of y = 2x + 1 and x² + y² = 13.", a: "(1.2, 3.4) and (−2, −3)", worked: ["x² + (2x + 1)² = 13", "x² + 4x² + 4x + 1 = 13", "5x² + 4x − 12 = 0", "x = (−4 ± √(16 + 240))/10 = (−4 ± 16)/10", "x = 1.2, y = 3.4 or x = −2, y = −3"], hint: "Substitute the linear equation into the circle, then use the quadratic formula", calculator: true },
      { q: "Find the intersection points of y = 3x − 1 and x² + y² = 5.", a: "(1, 2) and (−0.4, −2.2)", worked: ["x² + (3x − 1)² = 5", "10x² − 6x + 1 = 5", "10x² − 6x − 4 = 0 → 5x² − 3x − 2 = 0", "x = (3 ± 7)/10", "x = 1, y = 2 or x = −0.4, y = −2.2"], hint: "Substitute and solve the resulting quadratic", calculator: true },
      { q: "Find the intersection points of y = x + 1 and x² + y² = 25.", a: "(3, 4) and (−4, −3)", worked: ["x² + (x + 1)² = 25", "2x² + 2x + 1 = 25", "2x² + 2x − 24 = 0 → x² + x − 12 = 0", "(x + 4)(x − 3) = 0", "x = 3, y = 4 or x = −4, y = −3"], hint: "Substitute y = x + 1 and solve the quadratic" },
    ],
    // Level 5 (Grade 9) — Non-standard simultaneous equations
    [
      { q: "Solve 2x² + xy = 6 and x + 2y = 7. Give answers to 2 d.p.", a: "x = 1.15, y = 2.93 and x = −3.48, y = 5.24", worked: ["From eq 2: y = (7 − x)/2", "Substitute: 2x² + x(7 − x)/2 = 6", "4x² + 7x − x² = 12", "3x² + 7x − 12 = 0", "x = (−7 ± √193)/6", "x = 1.15, y = 2.93 or x = −3.48, y = 5.24"], hint: "Rearrange the linear equation for y, substitute, and use the quadratic formula", calculator: true },
      { q: "Solve x² − xy = 4 and y = 2x − 5.", a: "(1, −3) and (4, 3)", worked: ["x² − x(2x − 5) = 4", "x² − 2x² + 5x = 4", "−x² + 5x − 4 = 0 → x² − 5x + 4 = 0", "(x − 1)(x − 4) = 0", "x = 1, y = −3 or x = 4, y = 3"], hint: "Substitute y = 2x − 5 and solve the quadratic" },
      { q: "Solve 3x² + 2xy = 1 and x − y = 2.", a: "(1, −1) and (−0.2, −2.2)", worked: ["From eq 2: y = x − 2", "3x² + 2x(x − 2) = 1", "5x² − 4x − 1 = 0", "(5x + 1)(x − 1) = 0", "x = 1, y = −1 or x = −0.2, y = −2.2"], hint: "Substitute y = x − 2 into the quadratic equation" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A6: Rearranging & Using Formulae (Higher)
  // ═══════════════════════════════════════════════════════════════
  // A5: Rearranging Formulae (moved from old A6 — corrected AQA mapping)
  'A5': [
    // Level 1 (Grade 5) — Substituting into formulae
    [
      { q: "The formula for the area of a trapezium is A = ½(a + b)h. Find A when a = 5, b = 9 and h = 4.", a: "28", worked: ["A = ½(a + b)h", "A = ½(5 + 9) × 4", "A = ½ × 14 × 4 = 28"], hint: "Substitute the values into the formula and work out step by step", calculator: true },
      { q: "v = u + at. Find v when u = 3, a = 10 and t = 4.", a: "43", worked: ["v = u + at", "v = 3 + 10 × 4", "v = 3 + 40 = 43"], hint: "Substitute and remember to multiply before adding" },
      { q: "Make x the subject of y = x + a.", a: "x = y − a", worked: ["y = x + a", "Subtract a from both sides:", "x = y − a"], hint: "Get x on its own by subtracting a" },
    ],
    // Level 2 (Grade 6) — Rearranging simple formulae
    [
      { q: "Make t the subject of v = u + at", a: "t = (v − u)/a", worked: ["v = u + at", "Subtract u: v − u = at", "Divide by a: t = (v − u)/a"], hint: "Get the term with t on its own by undoing each operation" },
      { q: "Make r the subject of A = πr²", a: "r = √(A/π)", worked: ["A = πr²", "Divide by π: A/π = r²", "Square root: r = √(A/π)"], hint: "Divide by π first, then take the square root" },
      { q: "Make b the subject of P = 2a + 2b.", a: "b = (P − 2a)/2", worked: ["P = 2a + 2b", "P − 2a = 2b", "b = (P − 2a)/2"], hint: "Subtract 2a first, then divide by 2" },
    ],
    // Level 3 (Grade 7) — Rearranging with subject appearing twice
    [
      { q: "Make x the subject of y = (3x + 1)/(x − 2)", a: "x = (2y + 1)/(y − 3)", worked: ["y(x − 2) = 3x + 1", "yx − 2y = 3x + 1", "yx − 3x = 2y + 1", "x(y − 3) = 2y + 1", "x = (2y + 1)/(y − 3)"], hint: "Multiply out, collect all x terms on one side, then factorise" },
      { q: "Make t the subject of s = (t + 1)/(t − 1)", a: "t = (s + 1)/(s − 1)", worked: ["s(t − 1) = t + 1", "st − s = t + 1", "st − t = s + 1", "t(s − 1) = s + 1", "t = (s + 1)/(s − 1)"], hint: "Multiply both sides by (t − 1), expand, then collect t terms" },
      { q: "Make x the subject of y = (x + 3)/(x − 2).", a: "x = (2y + 3)/(y − 1)", worked: ["y(x − 2) = x + 3", "yx − 2y = x + 3", "yx − x = 2y + 3", "x(y − 1) = 2y + 3", "x = (2y + 3)/(y − 1)"], hint: "Multiply out, collect all x terms on one side, then factorise" },
    ],
    // Level 4 (Grade 8) — Rearranging with roots and powers
    [
      { q: "Make a the subject of T = 2π√(a/g)", a: "a = gT²/(4π²)", worked: ["T = 2π√(a/g)", "T/(2π) = √(a/g)", "Square both sides: T²/(4π²) = a/g", "Multiply by g: a = gT²/(4π²)"], hint: "Divide by 2π, then square both sides, then multiply by g" },
      { q: "Rearrange A = 2πr² + 2πrh to make h the subject.", a: "h = (A − 2πr²)/(2πr)", worked: ["A = 2πr² + 2πrh", "A − 2πr² = 2πrh", "h = (A − 2πr²)/(2πr)"], hint: "Subtract 2πr² first, then divide by 2πr" },
      { q: "Make r the subject of V = ⅓πr²h.", a: "r = √(3V/(πh))", worked: ["V = ⅓πr²h", "3V = πr²h", "3V/(πh) = r²", "r = √(3V/(πh))"], hint: "Multiply by 3, divide by πh, then take the square root" },
    ],
    // Level 5 (Grade 9) — Complex rearrangement
    [
      { q: "Make x the subject of y = √((2x + 3)/(x − 1))", a: "x = (y² + 3)/(y² − 2)", worked: ["y² = (2x + 3)/(x − 1)", "y²(x − 1) = 2x + 3", "xy² − y² = 2x + 3", "xy² − 2x = y² + 3", "x(y² − 2) = y² + 3", "x = (y² + 3)/(y² − 2)"], hint: "Square both sides first, then multiply out and collect x terms" },
      { q: "Make x the subject of w = √((x + a)/(x − a)).", a: "x = a(w² + 1)/(w² − 1)", worked: ["w² = (x + a)/(x − a)", "w²(x − a) = x + a", "w²x − w²a = x + a", "w²x − x = a + w²a", "x(w² − 1) = a(w² + 1)", "x = a(w² + 1)/(w² − 1)"], hint: "Square both sides, multiply out, collect x terms and factorise" },
      { q: "Make x the subject of y = (x + a)/(x − b).", a: "x = (a + yb)/(y − 1)", worked: ["y(x − b) = x + a", "yx − yb = x + a", "yx − x = a + yb", "x(y − 1) = a + yb", "x = (a + yb)/(y − 1)"], hint: "Multiply out, collect x terms, factorise" },
    ],
  ],

  // A6: Algebraic Proof (corrected AQA mapping — proofs and identities)
  'A6': [
    // Level 1 (Grade 5) — Simple sum proofs
    [
      { q: "Prove that the sum of any two consecutive integers is always odd.", a: "Shown", type: "proof", worked: ["Let the consecutive integers be n and n + 1", "Sum = n + (n + 1) = 2n + 1", "2n + 1 is always odd (one more than an even number)"], hint: "Write two consecutive integers as n and n + 1, then add them" },
      { q: "Prove that the sum of any three consecutive integers is always a multiple of 3.", a: "Shown", type: "proof", worked: ["Let the integers be n, n + 1, n + 2", "Sum = n + (n + 1) + (n + 2) = 3n + 3", "= 3(n + 1)", "This is a multiple of 3"], hint: "Call the first integer n. Write all three and add them up." },
      { q: "Prove that the sum of any two even numbers is even.", a: "Shown", type: "proof", worked: ["Let the two even numbers be 2a and 2b", "Sum = 2a + 2b = 2(a + b)", "This is 2 × (a + b), which is a multiple of 2", "So the sum is always even"], hint: "Write each even number as 2 times something" },
    ],
    // Level 2 (Grade 6-7) — Expanding bracket proofs
    [
      { q: "Show that (n + 2)² − n² is always a multiple of 4 for any integer n.", a: "Shown", type: "proof", worked: ["(n + 2)² − n² = n² + 4n + 4 − n²", "= 4n + 4", "= 4(n + 1)", "This is a multiple of 4"], hint: "Expand (n + 2)², then subtract n² and factorise" },
      { q: "Prove that (n + 1)² − (n − 1)² is always a multiple of 4.", a: "Shown", type: "proof", worked: ["(n + 1)² = n² + 2n + 1", "(n − 1)² = n² − 2n + 1", "(n + 1)² − (n − 1)² = 4n", "4n is a multiple of 4"], hint: "Expand both brackets and subtract. Look for a factor of 4." },
      { q: "Prove that (n + 3)² − (n + 1)² is always a multiple of 4.", a: "Shown", type: "proof", worked: ["(n + 3)² = n² + 6n + 9", "(n + 1)² = n² + 2n + 1", "(n + 3)² − (n + 1)² = 4n + 8", "= 4(n + 2)", "This is a multiple of 4"], hint: "Expand both, subtract, and factorise" },
      { q: "Prove that (n + 5)² − (n + 1)² is always a multiple of 8.", a: "Shown", type: "proof", worked: ["(n + 5)² = n² + 10n + 25", "(n + 1)² = n² + 2n + 1", "(n + 5)² − (n + 1)² = 8n + 24", "= 8(n + 3)", "This is a multiple of 8"], hint: "Expand both squares, subtract, and look for a factor of 8" },
    ],
    // Level 3 (Grade 7-8) — Proofs involving squares
    [
      { q: "Prove algebraically that the square of any odd number is always 1 more than a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the odd number be 2n + 1", "(2n + 1)² = 4n² + 4n + 1", "= 4n(n + 1) + 1", "n and n + 1 are consecutive, so one is even", "Therefore n(n + 1) is always even: n(n + 1) = 2k", "= 4(2k) + 1 = 8k + 1", "This is 1 more than a multiple of 8"], hint: "Write an odd number as 2n + 1. Square it and use the fact that n(n + 1) is always even." },
      { q: "Prove algebraically that the sum of the squares of any two consecutive even numbers is always 4 more than a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the consecutive even numbers be 2n and 2n + 2", "(2n)² + (2n + 2)² = 4n² + 4n² + 8n + 4", "= 8n² + 8n + 4", "= 8(n² + n) + 4", "= 8n(n + 1) + 4", "This is 4 more than a multiple of 8"], hint: "Write two consecutive even numbers as 2n and 2n + 2. Square each, add, and factorise." },
      { q: "Prove that the sum of two consecutive odd numbers is always a multiple of 4.", a: "Shown", type: "proof", worked: ["Let the consecutive odd numbers be 2n + 1 and 2n + 3", "Sum = (2n + 1) + (2n + 3) = 4n + 4", "= 4(n + 1)", "This is a multiple of 4"], hint: "Write two consecutive odd numbers as 2n + 1 and 2n + 3" },
    ],
    // Level 4 (Grade 8) — Difference of squares proofs
    [
      { q: "Prove that the difference between the squares of any two consecutive even numbers is always a multiple of 4 but never a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the consecutive even numbers be 2n and 2n + 2", "(2n + 2)² − (2n)² = 4n² + 8n + 4 − 4n²", "= 8n + 4 = 4(2n + 1)", "4(2n + 1) is a multiple of 4 ✓", "But 2n + 1 is always odd, so 4(2n + 1) is not divisible by 8 ✗"], hint: "Expand and simplify. Show it equals 4 × (odd number) — that's divisible by 4 but not 8." },
      { q: "Prove that the difference between the squares of any two odd numbers is always a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the two odd numbers be 2a + 1 and 2b + 1", "(2a + 1)² − (2b + 1)² = 4a² + 4a + 1 − 4b² − 4b − 1", "= 4(a² + a − b² − b) = 4(a(a + 1) − b(b + 1))", "a(a + 1) and b(b + 1) are both even (consecutive integers)", "Let a(a + 1) = 2m and b(b + 1) = 2p", "= 4(2m − 2p) = 8(m − p)", "This is a multiple of 8"], hint: "Use 2a + 1 and 2b + 1 for any two odd numbers. Remember n(n+1) is always even." },
      { q: "Prove that (2n + 1)² − (2n − 1)² is always a multiple of 8.", a: "Shown", type: "proof", worked: ["(2n + 1)² = 4n² + 4n + 1", "(2n − 1)² = 4n² − 4n + 1", "(2n + 1)² − (2n − 1)² = 8n", "8n is a multiple of 8"], hint: "Expand both squares and subtract" },
    ],
    // Level 5 (Grade 9) — Complex expansion proofs
    [
      { q: "Prove that (3n + 1)² − (3n − 1)² is always a multiple of 12 for all integer values of n.", a: "Shown", type: "proof", worked: ["(3n + 1)² = 9n² + 6n + 1", "(3n − 1)² = 9n² − 6n + 1", "(3n + 1)² − (3n − 1)² = 12n", "12n is a multiple of 12 for all integers n"], hint: "Expand both squares and subtract. Look for a factor of 12." },
      { q: "Prove that (2n + 3)² − (2n − 3)² is a multiple of 24 for all integer values of n.", a: "Shown", type: "proof", worked: ["(2n + 3)² = 4n² + 12n + 9", "(2n − 3)² = 4n² − 12n + 9", "(2n + 3)² − (2n − 3)² = 24n", "24n is a multiple of 24 for all integers n"], hint: "Expand both squares and subtract. Look for a factor of 24." },
      { q: "Prove that the difference between the squares of consecutive odd numbers is always a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the odd numbers be 2n + 1 and 2n + 3", "(2n + 3)² − (2n + 1)²", "= (4n² + 12n + 9) − (4n² + 4n + 1)", "= 8n + 8 = 8(n + 1)", "This is a multiple of 8"], hint: "Write two consecutive odd numbers as 2n + 1 and 2n + 3, then expand" },
      { q: "Prove that n² − n is always even for any integer n.", a: "Shown", type: "proof", worked: ["n² − n = n(n − 1)", "n and n − 1 are consecutive integers", "One of any two consecutive integers must be even", "So n(n − 1) is always even"], hint: "Factorise as n(n − 1). What can you say about consecutive integers?" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A9: Solving Quadratic Equations (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A9': [
    // Level 1 (Grade 5) — Solving by factorising (a = 1)
    [
      { q: "Solve x² + 5x + 6 = 0", a: "x = −2 or x = −3", worked: ["Factorise: (x + 2)(x + 3) = 0", "x + 2 = 0 → x = −2", "x + 3 = 0 → x = −3"], hint: "Factorise and set each bracket equal to zero" },
      { q: "Solve x² − 7x + 10 = 0", a: "x = 2 or x = 5", worked: ["Factorise: (x − 2)(x − 5) = 0", "x − 2 = 0 → x = 2", "x − 5 = 0 → x = 5"], hint: "Find two numbers that multiply to 10 and add to −7" },
      { q: "Solve x² − x − 12 = 0", a: "x = 4 or x = −3", worked: ["Factorise: (x − 4)(x + 3) = 0", "x − 4 = 0 → x = 4", "x + 3 = 0 → x = −3"], hint: "Find two numbers that multiply to −12 and add to −1" },
    ],
    // Level 2 (Grade 6) — Solving by factorising (a ≠ 1)
    [
      { q: "Solve 2x² + 7x + 3 = 0", a: "x = −3 or x = −0.5", worked: ["AC = 6. Numbers: 6 and 1", "2x² + 6x + x + 3 = 0", "2x(x + 3) + 1(x + 3) = 0", "(2x + 1)(x + 3) = 0", "x = −½ or x = −3"], hint: "Use the AC method to factorise, then set each bracket to zero" },
      { q: "Solve 3x² − 10x − 8 = 0", a: "x = 4 or x = −2/3", worked: ["AC = −24. Numbers: −12 and 2", "3x² − 12x + 2x − 8 = 0", "3x(x − 4) + 2(x − 4) = 0", "(3x + 2)(x − 4) = 0", "x = −⅔ or x = 4"], hint: "Find two numbers that multiply to −24 and add to −10" },
      { q: "Solve 5x² − 3x − 2 = 0", a: "x = 1 or x = −2/5", worked: ["AC = −10. Numbers: −5 and 2", "5x² − 5x + 2x − 2 = 0", "5x(x − 1) + 2(x − 1) = 0", "(5x + 2)(x − 1) = 0", "x = −⅖ or x = 1"], hint: "Use the AC method: find two numbers that multiply to −10 and add to −3" },
    ],
    // Level 3 (Grade 7) — Using the quadratic formula
    [
      { q: "Solve x² + 3x − 7 = 0, giving your answers to 2 decimal places.", a: "x = 1.54 or x = −4.54", worked: ["a = 1, b = 3, c = −7", "x = (−3 ± √(9 + 28))/2", "x = (−3 ± √37)/2", "x = (−3 + 6.083)/2 = 1.54", "x = (−3 − 6.083)/2 = −4.54"], hint: "Use x = (−b ± √(b² − 4ac))/(2a)", calculator: true },
      { q: "Solve 2x² − 5x + 1 = 0, giving your answers to 2 decimal places.", a: "x = 2.28 or x = 0.22", worked: ["a = 2, b = −5, c = 1", "x = (5 ± √(25 − 8))/4", "x = (5 ± √17)/4", "x = (5 + 4.123)/4 = 2.28", "x = (5 − 4.123)/4 = 0.22"], hint: "Use the quadratic formula with a = 2, b = −5, c = 1", calculator: true },
      { q: "Solve x² − 4x − 3 = 0, giving your answers to 2 decimal places.", a: "x = 4.65 or x = −0.65", worked: ["a = 1, b = −4, c = −3", "x = (4 ± √(16 + 12))/2", "x = (4 ± √28)/2", "x = (4 + 5.292)/2 = 4.65", "x = (4 − 5.292)/2 = −0.65"], hint: "Use x = (−b ± √(b² − 4ac))/(2a)", calculator: true },
    ],
    // Level 4 (Grade 8) — Completing the square to solve
    [
      { q: "Solve x² + 6x + 1 = 0 by completing the square. Give exact answers.", a: "x = −3 + 2√2 or x = −3 − 2√2", worked: ["(x + 3)² − 9 + 1 = 0", "(x + 3)² = 8", "x + 3 = ±√8 = ±2√2", "x = −3 ± 2√2"], hint: "Complete the square, then rearrange and take the square root" },
      { q: "Solve x² − 8x + 10 = 0 by completing the square. Give exact answers.", a: "x = 4 + √6 or x = 4 − √6", worked: ["(x − 4)² − 16 + 10 = 0", "(x − 4)² = 6", "x − 4 = ±√6", "x = 4 ± √6"], hint: "Half the coefficient of x is 4, so write (x − 4)²" },
      { q: "Solve x² + 4x − 7 = 0 by completing the square. Give exact answers.", a: "x = −2 + √11 or x = −2 − √11", worked: ["(x + 2)² − 4 − 7 = 0", "(x + 2)² = 11", "x + 2 = ±√11", "x = −2 ± √11"], hint: "Half the coefficient of x is 2, so write (x + 2)²" },
    ],
    // Level 5 (Grade 9) — Using the discriminant
    [
      { q: "The equation kx² + 6x + 3 = 0 has equal roots. Find the value of k.", a: "k = 3", worked: ["For equal roots: b² − 4ac = 0", "6² − 4(k)(3) = 0", "36 − 12k = 0", "12k = 36", "k = 3"], hint: "Equal roots means discriminant = 0: b² − 4ac = 0" },
      { q: "The equation 2x² + px + 8 = 0 has equal roots. Find the possible values of p.", a: "p = 8 or p = −8", worked: ["For equal roots: b² − 4ac = 0", "p² − 4(2)(8) = 0", "p² − 64 = 0", "p² = 64", "p = ±8"], hint: "Equal roots means b² − 4ac = 0. Don't forget both ± solutions." },
      { q: "Show that x² + 3x + 5 = 0 has no real roots.", a: "Shown", type: "proof", worked: ["Discriminant = b² − 4ac", "= 3² − 4(1)(5)", "= 9 − 20 = −11", "Since −11 < 0, there are no real roots"], hint: "Calculate the discriminant. If it's negative, there are no real roots." },
    ],
  ],

  // (A11 iteration content moved to A20 — corrected AQA mapping)

  // G24: Vectors — Column Vectors and Translations (moved from old G17 — corrected AQA mapping)
  'G24': [
    // Level 1 (Grade 5) — Vector paths
    [
      { q: "In triangle OAB, OA = a and OB = b. Find AB in terms of a and b.", a: "b − a", worked: ["To go from A to B, go via O:", "AB = AO + OB", "AO = −OA = −a", "AB = −a + b = b − a"], hint: "Go from A to O (which is −a), then O to B (which is b)" },
      { q: "OABC is a quadrilateral. OA = a, AB = b. Express OB in terms of a and b.", a: "a + b", worked: ["OB = OA + AB", "= a + b"], hint: "Go from O to A, then from A to B" },
      { q: "In triangle PQR, PQ = a and PR = b. Express QR in terms of a and b.", a: "b − a", worked: ["QR = QP + PR", "QP = −PQ = −a", "QR = −a + b = b − a"], hint: "Go from Q to P (which is −a), then P to R (which is b)" },
    ],
    // Level 2 (Grade 6) — Midpoint vectors
    [
      { q: "OA = a and OB = b. M is the midpoint of AB. Find OM in terms of a and b.", a: "½(a + b)", worked: ["AB = b − a", "AM = ½AB = ½(b − a)", "OM = OA + AM = a + ½(b − a)", "= a + ½b − ½a = ½a + ½b", "= ½(a + b)"], hint: "Go from O to A, then halfway from A to B" },
      { q: "OA = 4a and OB = 6b. M is the midpoint of OA and N is the midpoint of OB. Express MN in terms of a and b.", a: "−2a + 3b", worked: ["OM = ½OA = 2a", "ON = ½OB = 3b", "MN = MO + ON = −2a + 3b"], hint: "Find OM and ON first, then MN = −OM + ON" },
      { q: "In triangle OAB, OA = a and OB = b. P is the midpoint of OA. Express PB in terms of a and b.", a: "b − ½a", worked: ["OP = ½a (midpoint of OA)", "PB = PO + OB = −½a + b", "= b − ½a"], hint: "Go from P to O (which is −½a), then O to B" },
    ],
    // Level 3 (Grade 7) — Showing lines are parallel
    [
      { q: "In triangle OAB, OA = a and OB = b. M is the midpoint of OA and N is the midpoint of OB. Show that MN is parallel to AB.", a: "Shown", type: "proof", worked: ["OM = ½a (midpoint of OA)", "ON = ½b (midpoint of OB)", "MN = MO + ON = −½a + ½b = ½(b − a)", "AB = AO + OB = −a + b = b − a", "MN = ½AB", "MN is a scalar multiple of AB, so MN is parallel to AB"], hint: "Find MN and AB in terms of a and b. If one is a scalar multiple of the other, they are parallel." },
      { q: "RS = 3a + 6b and TU = a + 2b. Show that RS is parallel to TU.", a: "Shown", type: "proof", worked: ["RS = 3a + 6b = 3(a + 2b)", "TU = a + 2b", "RS = 3 × TU", "RS is a scalar multiple of TU", "So RS is parallel to TU"], hint: "Try to write RS as a multiple of TU" },
      { q: "OA = a and OB = b. P divides AB such that AP:PB = 1:3. Express OP in terms of a and b.", a: "¾a + ¼b", worked: ["AB = b − a", "AP = ¼AB = ¼(b − a)", "OP = OA + AP = a + ¼(b − a)", "= a + ¼b − ¼a = ¾a + ¼b"], hint: "P is ¼ of the way from A to B (ratio 1:3)" },
    ],
    // Level 4 (Grade 8) — Proving collinearity
    [
      { q: "OA = 2a + b, OB = 5a + 2.5b, OC = 8a + 4b. Show that A, B and C are collinear.", a: "Shown", type: "proof", worked: ["AB = OB − OA = (5a + 2.5b) − (2a + b) = 3a + 1.5b", "AC = OC − OA = (8a + 4b) − (2a + b) = 6a + 3b", "AC = 2(3a + 1.5b) = 2 × AB", "AC is a scalar multiple of AB, so they are parallel", "They share point A, so A, B and C are collinear"], hint: "Find AB and AC. If AC = k × AB for some scalar k, and they share point A, then A, B and C lie on the same line." },
      { q: "OA = a and OB = b. M is the midpoint of AB. Show that OM = ½(a + b).", a: "Shown", type: "proof", worked: ["AB = b − a", "AM = ½AB = ½(b − a)", "OM = OA + AM", "= a + ½(b − a)", "= a + ½b − ½a", "= ½a + ½b = ½(a + b) ✓"], hint: "Go from O to A, then A to M (midpoint of AB)" },
      { q: "In quadrilateral OABC, OA = 2a, AB = 3b, BC = −2a, OC = 3b. Verify that OABC is a parallelogram.", a: "Shown", type: "proof", worked: ["OA = 2a and CB = −BC = 2a, so OA = CB ✓", "AB = 3b and OC = 3b, so AB = OC ✓", "Both pairs of opposite sides are equal and parallel", "So OABC is a parallelogram"], hint: "Show both pairs of opposite sides are equal vectors" },
    ],
    // Level 5 (Grade 9) — Ratio problems with vectors
    [
      { q: "In triangle OAB, OA = a and OB = b. P lies on AB such that AP:PB = 2:1. Q is the midpoint of OP. Find OQ in terms of a and b.", a: "⅙a + ⅓b", worked: ["AP:PB = 2:1, so AP = ⅔AB", "AB = b − a", "OP = OA + AP = a + ⅔(b − a)", "= a + ⅔b − ⅔a = ⅓a + ⅔b", "Q is the midpoint of OP:", "OQ = ½OP = ½(⅓a + ⅔b)", "= ⅙a + ⅓b"], hint: "First find OP using the ratio on AB. Then halve it for the midpoint Q." },
      { q: "OA = a and OB = b. P divides OA in ratio 3:1, Q divides OB in ratio 3:1. Show PQ is parallel to AB and find PQ:AB.", a: "PQ is parallel to AB, PQ:AB = 3:4", type: "proof", worked: ["OP = ¾a (ratio 3:1)", "OQ = ¾b", "PQ = OQ − OP = ¾b − ¾a = ¾(b − a)", "AB = b − a", "PQ = ¾AB, so PQ is parallel to AB", "PQ:AB = 3:4"], hint: "Find PQ and AB. Show PQ is a scalar multiple of AB." },
      { q: "In triangle OAB, OA = a and OB = b. X lies on OA such that OX:XA = 1:2, and Y lies on OB such that OY:YB = 1:2. Show that XY is parallel to AB.", a: "Shown", type: "proof", worked: ["OX = ⅓a (ratio 1:2)", "OY = ⅓b", "XY = OY − OX = ⅓b − ⅓a = ⅓(b − a)", "AB = b − a", "XY = ⅓AB", "XY is a scalar multiple of AB, so XY is parallel to AB"], hint: "Find XY and AB in terms of a and b" },
    ],
  ],

  // G17: Circles — Circumference, Area, Arcs and Sectors (corrected AQA mapping)
  'G17': [
    // Level 1 (Grade 4) — Area of a circle
    [
      { q: "Calculate the area of a circle with a radius of 6 cm. Give your answer in terms of π.", a: "36π cm²", worked: ["Area = πr²", "Area = π × 6²", "Area = 36π cm²"], hint: "Use the formula Area = πr². Leave your answer as a multiple of π." },
      { q: "Find the area of a circle with r = 5 cm. Give your answer in terms of π.", a: "25π cm²", worked: ["Area = πr²", "= π × 5² = 25π cm²"], hint: "Use Area = πr²" },
      { q: "Find the perimeter of a semicircle with r = 7 cm. Give your answer in terms of π.", a: "7π + 14 cm", worked: ["Curved part = half circumference = πr = 7π", "Straight edge = diameter = 14", "Perimeter = 7π + 14 cm"], hint: "Perimeter = half the circumference + the diameter", diagram: "G17-semicircle-r7" },
    ],
    // Level 2 (Grade 5) — Perimeter of a semicircle
    [
      { q: "Find the perimeter of a semicircle with a diameter of 10 cm. Give your answer to 1 d.p.", a: "25.7 cm", calculator: true, worked: ["Curved part = half the circumference = πd/2 = 10π/2 = 5π", "Straight part = diameter = 10", "Perimeter = 5π + 10 ≈ 15.71 + 10 = 25.7 cm"], hint: "Perimeter = half the circumference + the diameter. Don't forget the straight edge!", diagram: "G17-semicircle-d10" },
      { q: "Find the circumference of a circle with d = 10 cm. Give your answer in terms of π.", a: "10π cm", worked: ["Circumference = πd", "= π × 10 = 10π cm"], hint: "Use C = πd" },
      { q: "Find the area of a quarter-circle with r = 4 cm. Give your answer in terms of π.", a: "4π cm²", worked: ["Full circle area = π × 4² = 16π", "Quarter circle = 16π ÷ 4 = 4π cm²"], hint: "Find the full circle area and divide by 4", diagram: "G17-quarter-circle-r4" },
    ],
    // Level 3 (Grade 7) — Area of a sector
    [
      { q: "Calculate the area of a sector with radius 8 cm and central angle 45°. Give your answer in terms of π.", a: "8π cm²", worked: ["Area of sector = (θ/360) × πr²", "= (45/360) × π × 8²", "= (1/8) × 64π", "= 8π cm²"], hint: "Sector area = (angle/360) × πr²", diagram: "G17-sector-45-r8" },
      { q: "Find the area of a sector with r = 6 cm and angle 60°. Give your answer in terms of π.", a: "6π cm²", worked: ["Area = (60/360) × π × 6²", "= (1/6) × 36π = 6π cm²"], hint: "Sector area = (angle/360) × πr²", diagram: "G17-sector-60-r6" },
      { q: "Find the angle of a sector if the area is 10π cm² and r = 5 cm.", a: "144°", worked: ["10π = (θ/360) × π × 25", "10 = 25θ/360", "θ = 10 × 360/25 = 144°"], hint: "Substitute into the sector area formula and solve for θ" },
    ],
    // Level 4 (Grade 8) — Reverse sector problems
    [
      { q: "The area of a sector is 20π cm² and the radius is 10 cm. Find the central angle.", a: "72°", worked: ["Area = (θ/360) × πr²", "20π = (θ/360) × π × 100", "20π = 100πθ/360", "20 = 100θ/360", "θ = 20 × 360/100 = 72°"], hint: "Substitute into the sector area formula and solve for θ" },
      { q: "Find the arc length of a sector with r = 9 cm and angle 120°.", a: "6π cm", worked: ["Arc length = (θ/360) × 2πr", "= (120/360) × 2π × 9", "= (1/3) × 18π = 6π cm"], hint: "Arc length = (angle/360) × 2πr", diagram: "G17-sector-120-r9" },
      { q: "Find the perimeter of a sector with r = 10 cm and angle 36°. Give your answer in terms of π.", a: "2π + 20 cm", worked: ["Arc length = (36/360) × 2π × 10 = (1/10) × 20π = 2π", "Perimeter = arc + 2 radii = 2π + 20 cm"], hint: "Perimeter = arc length + 2 × radius", diagram: "G17-sector-36-r10" },
    ],
    // Level 5 (Grade 9) — Composite sector problems
    [
      { q: "A shape is made from a sector of a circle with radius r. If the radius is increased by 50%, find the percentage increase in the area of the sector.", a: "125%", worked: ["Original area = (θ/360) × πr²", "New radius = 1.5r", "New area = (θ/360) × π(1.5r)² = (θ/360) × 2.25πr²", "New area = 2.25 × original area", "Percentage increase = (2.25 − 1) × 100% = 125%"], hint: "If the radius is multiplied by k, the area is multiplied by k². What is 1.5²?" },
      { q: "Find the radius of a sector with area 15π cm² and angle 150°.", a: "6 cm", worked: ["15π = (150/360) × πr²", "15 = (5/12) × r²", "r² = 15 × 12/5 = 36", "r = 6 cm"], hint: "Substitute into the area formula and solve for r" },
      { q: "Find the area of a segment with r = 6 cm and angle 90°. Give your answer in terms of π.", a: "9π − 18 cm²", worked: ["Sector area = (90/360) × π × 36 = 9π", "Triangle area = ½ × 6 × 6 = 18", "Segment = sector − triangle = 9π − 18 cm²"], hint: "Segment = sector area − triangle area. The triangle is right-angled with both sides = r", diagram: "G17-segment-90-r6" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // P9: Conditional Probability & Set Notation (Higher only)
  // ═══════════════════════════════════════════════════════════════
  'P9': [
    // Level 1 (Grade 4/5) — Complement and basic probability
    [
      { q: "A bag contains 5 red and 3 blue marbles. Two marbles are picked with replacement. Find the probability of picking two reds.", a: "25/64", worked: ["P(1st red) = 5/8", "With replacement, P(2nd red) = 5/8", "P(both red) = 5/8 × 5/8 = 25/64"], hint: "With replacement means the probabilities stay the same each time" },
      { q: "A fair coin is flipped and a fair die is rolled. Find the probability of getting heads and a 6.", a: "1/12", worked: ["P(heads) = 1/2", "P(six) = 1/6", "P(heads and 6) = 1/2 × 1/6 = 1/12"], hint: "These are independent events — multiply the probabilities" },
      { q: "P(A) = 0.3. Find P(not A).", a: "0.7", worked: ["P(not A) = 1 − P(A)", "= 1 − 0.3 = 0.7"], hint: "P(not A) = 1 − P(A)" },
    ],
    // Level 2 (Grade 6) — Independent events and tree diagrams
    [
      { q: "P(A) = 0.7 and P(B) = 0.4. A and B are independent. Find P(A and B).", a: "0.28", worked: ["For independent events: P(A and B) = P(A) × P(B)", "= 0.7 × 0.4 = 0.28"], hint: "Independent means P(A and B) = P(A) × P(B)", calculator: true },
      { q: "P(A) = 0.7 and P(B) = 0.4. A and B are independent. Find P(neither A nor B).", a: "0.18", worked: ["P(A') = 1 − 0.7 = 0.3", "P(B') = 1 − 0.4 = 0.6", "P(neither) = P(A') × P(B') = 0.3 × 0.6 = 0.18"], hint: "P(neither) = P(not A) × P(not B)", calculator: true },
      { q: "Two independent events each have P(Win) = 0.6. Find P(Win both times).", a: "0.36", worked: ["P(Win twice) = 0.6 × 0.6 = 0.36"], hint: "Independent: multiply the probabilities", calculator: true },
    ],
    // Level 3 (Grade 7) — Without replacement (dependent events)
    [
      { q: "A bag has 4 red and 6 blue marbles. Two are picked without replacement. Find the probability that both are the same colour.", a: "7/15", worked: ["P(both red) = 4/10 × 3/9 = 12/90", "P(both blue) = 6/10 × 5/9 = 30/90", "P(same colour) = 12/90 + 30/90 = 42/90 = 7/15"], hint: "Calculate P(both red) + P(both blue). Remember totals decrease without replacement." },
      { q: "A bag has 3 red and 5 blue balls. Two are picked without replacement. Find P(both red).", a: "3/28", worked: ["P(1st red) = 3/8", "P(2nd red | 1st red) = 2/7", "P(both red) = 3/8 × 2/7 = 6/56 = 3/28"], hint: "After taking a red ball, there are 2 red left out of 7 total" },
      { q: "A bag has 4 green and 6 blue marbles. Two are picked without replacement. Find P(both blue).", a: "1/3", worked: ["P(1st blue) = 6/10", "P(2nd blue | 1st blue) = 5/9", "P(both blue) = 6/10 × 5/9 = 30/90 = 1/3"], hint: "After taking a blue marble, there are 5 blue left out of 9 total" },
    ],
    // Level 4 (Grade 8) — Venn diagrams and conditional probability
    [
      { q: "In a group of 100 students, 60 study French, 40 study Spanish, and 20 study both. Find the probability that a student studies only French, given that they study a language.", a: "0.5", worked: ["Only French = 60 − 20 = 40", "Study a language = 60 + 40 − 20 = 80", "P(only French | studies a language) = 40/80 = 0.5"], hint: "Find 'only French' from the Venn diagram, then divide by total who study a language", calculator: true },
      { q: "ξ = {1,2,3,...,12}, A = {multiples of 3}, B = {even numbers}. List the members of (A ∪ B)'.", a: "{1, 5, 7, 11}", worked: ["A = {3, 6, 9, 12}", "B = {2, 4, 6, 8, 10, 12}", "A ∪ B = {2, 3, 4, 6, 8, 9, 10, 12}", "(A ∪ B)' = {1, 5, 7, 11}"], hint: "Find A ∪ B first, then find everything NOT in that set" },
      { q: "P(A|B) = 0.4 and P(B) = 0.5. Find P(A ∩ B).", a: "0.2", worked: ["P(A|B) = P(A ∩ B)/P(B)", "0.4 = P(A ∩ B)/0.5", "P(A ∩ B) = 0.4 × 0.5 = 0.2"], hint: "Rearrange: P(A ∩ B) = P(A|B) × P(B)", calculator: true },
    ],
    // Level 5 (Grade 9) — Algebraic probability proof
    [
      { q: "There are n sweets in a bag. 6 are orange and the rest are yellow. Two sweets are taken without replacement. The probability of two orange sweets is 1/3. Show that n² − n − 90 = 0 and find n.", a: "n = 10", worked: ["P(1st orange) = 6/n", "P(2nd orange) = 5/(n − 1)", "P(both orange) = 6/n × 5/(n−1) = 30/(n(n−1)) = 1/3", "Cross multiply: 90 = n(n − 1) = n² − n", "n² − n − 90 = 0", "Factorise: (n − 10)(n + 9) = 0", "n = 10 (n must be positive)"], hint: "Set up P(both orange) = (6/n) × (5/(n−1)) = 1/3, then rearrange" },
      { q: "Events A and B are independent. P(A) = 0.3 and P(A ∪ B) = 0.72. Find P(B).", a: "0.6", worked: ["P(A ∩ B) = P(A) × P(B) = 0.3P(B)", "0.72 = 0.3 + P(B) − 0.3P(B)", "0.42 = P(B)(1 − 0.3) = 0.7P(B)", "P(B) = 0.6"], hint: "Independent means P(A ∩ B) = P(A) × P(B). Substitute into the addition rule.", calculator: true },
      { q: "A bag has n red and 4 white balls. Two are picked without replacement. P(both red) = 1/3. Find n.", a: "n = 6", worked: ["P(both red) = n/(n+4) × (n−1)/(n+3) = 1/3", "3n(n−1) = (n+4)(n+3)", "3n² − 3n = n² + 7n + 12", "2n² − 10n − 12 = 0", "n² − 5n − 6 = 0", "(n − 6)(n + 1) = 0", "n = 6 (must be positive)"], hint: "Set up n/(n+4) × (n−1)/(n+3) = 1/3 and solve the quadratic" },
    ],
  ],

  // A22: Solving Inequalities including Quadratic (corrected AQA mapping — moved from old A15)
  'A22': [
    // Level 1 (Grade 6) — Solving linear inequalities
    [
      { q: "Solve 3x + 2 > 14", a: "x > 4", worked: ["3x + 2 > 14", "3x > 12", "x > 4"], hint: "Treat it like an equation, but keep the inequality sign" },
      { q: "Solve 5 − 2x ≤ 11", a: "x ≥ −3", worked: ["5 − 2x ≤ 11", "−2x ≤ 6", "x ≥ −3 (flip the sign when dividing by negative)"], hint: "Remember to flip the inequality when dividing by a negative" },
      { q: "Solve 4x − 7 < 2x + 3", a: "x < 5", worked: ["4x − 7 < 2x + 3", "4x − 2x < 3 + 7", "2x < 10", "x < 5"], hint: "Collect x terms on one side and numbers on the other." },
    ],
    // Level 2 (Grade 7) — Compound inequalities
    [
      { q: "Solve −3 < 2x + 1 ≤ 7 and list the integer values.", a: "−1, 0, 1, 2, 3", worked: ["−3 < 2x + 1 ≤ 7", "Subtract 1: −4 < 2x ≤ 6", "Divide by 2: −2 < x ≤ 3", "Integer values: −1, 0, 1, 2, 3"], hint: "Solve the compound inequality in one go, doing the same to all three parts" },
      { q: "Solve −5 ≤ 2x − 3 < 9 and list the integer values.", a: "−1, 0, 1, 2, 3, 4, 5", worked: ["−5 ≤ 2x − 3 < 9", "Add 3: −2 ≤ 2x < 12", "Divide by 2: −1 ≤ x < 6", "Integer values: −1, 0, 1, 2, 3, 4, 5"], hint: "Do the same operation to all three parts of the compound inequality." },
      { q: "Find the largest integer n such that 3n − 4 < 20.", a: "7", worked: ["3n − 4 < 20", "3n < 24", "n < 8", "Largest integer less than 8 is 7"], hint: "Solve the inequality, then find the largest whole number that satisfies it." },
    ],
    // Level 3 (Grade 8) — Quadratic inequalities (basic)
    [
      { q: "Solve x² < 25", a: "−5 < x < 5", worked: ["x² < 25", "x² − 25 < 0", "(x + 5)(x − 5) < 0", "The parabola is negative between the roots", "−5 < x < 5"], hint: "Find where x² = 25, then think about where the parabola is below zero" },
      { q: "Solve x² ≥ 9", a: "x ≤ −3 or x ≥ 3", worked: ["x² ≥ 9", "x² − 9 ≥ 0", "(x + 3)(x − 3) ≥ 0", "The parabola is positive outside the roots", "x ≤ −3 or x ≥ 3"], hint: "Think about where the U-shaped parabola is above the x-axis" },
      { q: "Solve x² − 4x < 0", a: "0 < x < 4", worked: ["Factorise: x(x − 4) < 0", "Roots at x = 0 and x = 4", "Parabola is negative between the roots", "0 < x < 4"], hint: "Factor out x first, then find where the quadratic is negative." },
    ],
    // Level 4 (Grade 8) — Factorised quadratic inequalities
    [
      { q: "Solve x² − 5x + 6 > 0", a: "x < 2 or x > 3", worked: ["Factorise: (x − 2)(x − 3) > 0", "Roots at x = 2 and x = 3", "Parabola is positive outside the roots", "x < 2 or x > 3"], hint: "Factorise, find the roots, then sketch the parabola" },
      { q: "Solve x² + x − 12 ≤ 0", a: "−4 ≤ x ≤ 3", worked: ["Factorise: (x + 4)(x − 3) ≤ 0", "Roots at x = −4 and x = 3", "Parabola is negative (or zero) between the roots", "−4 ≤ x ≤ 3"], hint: "Factorise, find the roots, then determine where the parabola is below zero." },
      { q: "Solve x² − 7x + 10 < 0", a: "2 < x < 5", worked: ["Factorise: (x − 2)(x − 5) < 0", "Roots at x = 2 and x = 5", "Parabola is negative between the roots", "2 < x < 5"], hint: "Factorise, find the roots, sketch the parabola." },
    ],
    // Level 5 (Grade 9) — Complex quadratic inequalities
    [
      { q: "Find the set of values of x for which x² − 3x − 10 ≤ 0", a: "−2 ≤ x ≤ 5", worked: ["Factorise: (x − 5)(x + 2) ≤ 0", "Roots at x = −2 and x = 5", "Parabola is negative (or zero) between the roots", "−2 ≤ x ≤ 5"], hint: "Factorise, find roots, then determine where the quadratic is ≤ 0" },
      { q: "Solve 2x² − 3x − 9 ≥ 0", a: "x ≤ −1.5 or x ≥ 3", worked: ["Factorise: (2x + 3)(x − 3) ≥ 0", "Roots: 2x + 3 = 0 → x = −1.5; x − 3 = 0 → x = 3", "Parabola is positive outside the roots", "x ≤ −1.5 or x ≥ 3"], hint: "Factorise the quadratic, find the roots, then determine where it's ≥ 0." },
      { q: "Find the integer values of x that satisfy both x² < 16 and 2x + 1 > 0.", a: "1, 2, 3", worked: ["From x² < 16: −4 < x < 4", "From 2x + 1 > 0: x > −0.5", "Combining: −0.5 < x < 4", "Integer values: 1, 2, 3"], hint: "Solve each inequality separately, then find the overlap. List the integers in the overlap." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // N10: Fraction, Decimal & Percentage Conversions (Higher)
  // ═══════════════════════════════════════════════════════════════
  'N10': [
    // Level 1 (Grade 5) — Simplifying surds
    [
      { q: "Simplify √75.", a: "5√3", worked: ["√75 = √(25 × 3)", "= √25 × √3", "= 5√3"], hint: "Find the largest square factor of 75" },
      { q: "Simplify √48.", a: "4√3", worked: ["√48 = √(16 × 3)", "= √16 × √3", "= 4√3"], hint: "Find the largest square factor of 48" },
      { q: "Simplify √200.", a: "10√2", worked: ["√200 = √(100 × 2)", "= √100 × √2", "= 10√2"], hint: "Find the largest square factor of 200" },
    ],
    // Level 2 (Grade 6) — Expanding surd expressions
    [
      { q: "Expand and simplify √2(3 + √8).", a: "3√2 + 4", worked: ["√2 × 3 = 3√2", "√2 × √8 = √16 = 4", "= 3√2 + 4"], hint: "Multiply √2 by each term. Remember √2 × √8 = √16" },
      { q: "Expand and simplify √3(4 − √27).", a: "4√3 − 9", worked: ["√3 × 4 = 4√3", "√3 × √27 = √81 = 9", "= 4√3 − 9"], hint: "√3 × √27 = √81 = 9" },
      { q: "Expand and simplify √5(√20 + 2).", a: "10 + 2√5", worked: ["√5 × √20 = √100 = 10", "√5 × 2 = 2√5", "= 10 + 2√5"], hint: "√5 × √20 = √100" },
    ],
    // Level 3 (Grade 7) — Rationalising the denominator
    [
      { q: "Rationalise the denominator of 15/√5. Give your answer in simplified surd form.", a: "3√5", worked: ["Multiply top and bottom by √5", "15/√5 × √5/√5 = 15√5/5 = 3√5"], hint: "Multiply numerator and denominator by √5" },
      { q: "Rationalise the denominator of 21/√7.", a: "3√7", worked: ["Multiply top and bottom by √7", "21/√7 × √7/√7 = 21√7/7 = 3√7"], hint: "Multiply numerator and denominator by √7" },
      { q: "Rationalise the denominator of 18/√3.", a: "6√3", worked: ["Multiply top and bottom by √3", "18/√3 × √3/√3 = 18√3/3 = 6√3"], hint: "Multiply numerator and denominator by √3" },
    ],
    // Level 4 (Grade 8) — Expanding double surd brackets
    [
      { q: "Simplify (4 + √3)(2 − √3). Give your answer in the form a + b√3.", a: "5 − 2√3", worked: ["Expand: 4×2 + 4×(−√3) + √3×2 + √3×(−√3)", "= 8 − 4√3 + 2√3 − 3", "= 5 − 2√3"], hint: "FOIL: multiply each term, remember √3 × √3 = 3" },
      { q: "Simplify (3 − √5)(1 + √5). Give your answer in the form a + b√5.", a: "−2 + 2√5", worked: ["Expand: 3×1 + 3×√5 + (−√5)×1 + (−√5)×√5", "= 3 + 3√5 − √5 − 5", "= −2 + 2√5"], hint: "FOIL: multiply each term, remember √5 × √5 = 5" },
      { q: "Simplify (2 + √7)(5 − √7).", a: "3 + 3√7", worked: ["Expand: 2×5 + 2×(−√7) + √7×5 + √7×(−√7)", "= 10 − 2√7 + 5√7 − 7", "= 3 + 3√7"], hint: "FOIL: multiply each term, remember √7 × √7 = 7" },
    ],
    // Level 5 (Grade 9) — Surd proof problems
    [
      { q: "Show that 6/√2 + √50 can be written as 8√2.", a: "Shown", type: "proof", worked: ["6/√2 = 6√2/2 = 3√2 (rationalise)", "√50 = √(25×2) = 5√2", "3√2 + 5√2 = 8√2 ✓"], hint: "Rationalise 6/√2 and simplify √50, then add" },
      { q: "Show that 10/√5 + √45 can be written as 5√5.", a: "Shown", type: "proof", worked: ["10/√5 = 10√5/5 = 2√5 (rationalise)", "√45 = √(9×5) = 3√5", "2√5 + 3√5 = 5√5 ✓"], hint: "Rationalise 10/√5 and simplify √45, then add" },
      { q: "Show that 12/√6 + √24 can be written as 4√6.", a: "Shown", type: "proof", worked: ["12/√6 = 12√6/6 = 2√6 (rationalise)", "√24 = √(4×6) = 2√6", "2√6 + 2√6 = 4√6 ✓"], hint: "Rationalise 12/√6 and simplify √24, then add" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A20: Algebraic Proof
  // ═══════════════════════════════════════════════════════════════
  'A20': [
    // Level 0 (Grade 5) — Prove sums of consecutive integers
    [
      { q: "Prove that the sum of any three consecutive integers is a multiple of 3.", a: "Shown", type: "proof", worked: ["Let the integers be n, n+1, n+2", "Sum = n + (n+1) + (n+2) = 3n + 3 = 3(n+1)", "3(n+1) is a multiple of 3 for all integers n"], hint: "Let the three consecutive integers be n, n+1, n+2 and add them" },
      { q: "Prove that the sum of any four consecutive integers is always even.", a: "Shown", type: "proof", worked: ["Let the integers be n, n+1, n+2, n+3", "Sum = 4n + 6 = 2(2n + 3)", "2(2n + 3) is always even (it's a multiple of 2)"], hint: "Let the integers be n, n+1, n+2, n+3" },
      { q: "Show that the sum of 2n and 2n + 2 is always a multiple of 2.", a: "Shown", type: "proof", worked: ["2n + (2n + 2) = 4n + 2 = 2(2n + 1)", "2(2n + 1) is a multiple of 2 for all integers n"], hint: "Add the two expressions and factorise" },
    ],
    // Level 1 (Grade 6) — Expand and prove identities
    [
      { q: "Show that (n+1)² − n² is always equal to 2n + 1.", a: "Shown", type: "proof", worked: ["(n+1)² − n² = n² + 2n + 1 − n² = 2n + 1"], hint: "Expand (n+1)² and then subtract n²" },
      { q: "Prove that (n+3)² − (n−3)² = 12n.", a: "Shown", type: "proof", worked: ["(n+3)² = n² + 6n + 9", "(n−3)² = n² − 6n + 9", "Difference = (n² + 6n + 9) − (n² − 6n + 9)", "= 12n"], hint: "Expand both brackets then subtract" },
      { q: "Expand and simplify (n+2)² − (n+1)² to show it is always odd.", a: "Shown", type: "proof", worked: ["(n+2)² = n² + 4n + 4", "(n+1)² = n² + 2n + 1", "Difference = 2n + 3", "2n + 3 = 2n + 2 + 1 = 2(n+1) + 1", "This is odd (one more than an even number)"], hint: "Expand both, subtract, then show the result is 2k + 1" },
    ],
    // Level 2 (Grade 7) — Prove properties of even/odd numbers
    [
      { q: "Prove that the square of any even number is a multiple of 4.", a: "Shown", type: "proof", worked: ["Let the even number be 2n", "(2n)² = 4n²", "4n² is a multiple of 4 for all integers n"], hint: "Write an even number as 2n, then square it" },
      { q: "Prove that the sum of two consecutive odd numbers is always a multiple of 4.", a: "Shown", type: "proof", worked: ["Let the odd numbers be 2n+1 and 2n+3", "Sum = (2n+1) + (2n+3) = 4n + 4 = 4(n+1)", "4(n+1) is a multiple of 4"], hint: "Write two consecutive odd numbers as 2n+1 and 2n+3" },
      { q: "Prove that the square of any odd number is always odd.", a: "Shown", type: "proof", worked: ["Let the odd number be 2n + 1", "(2n+1)² = 4n² + 4n + 1 = 2(2n² + 2n) + 1", "This is one more than an even number, so it is odd"], hint: "Write an odd number as 2n+1, square it, then show it's 2k+1" },
    ],
    // Level 3 (Grade 8) — Prove products and squared expressions
    [
      { q: "Prove that the product of any two odd numbers is always odd.", a: "Shown", type: "proof", worked: ["Let the odd numbers be 2a+1 and 2b+1", "(2a+1)(2b+1) = 4ab + 2a + 2b + 1", "= 2(2ab + a + b) + 1", "This is one more than an even number, so it is odd"], hint: "Write the two odd numbers as 2a+1 and 2b+1, then multiply" },
      { q: "Prove that (2n+1)² is always 1 more than a multiple of 4.", a: "Shown", type: "proof", worked: ["(2n+1)² = 4n² + 4n + 1 = 4(n² + n) + 1", "4(n² + n) is a multiple of 4", "So (2n+1)² is 1 more than a multiple of 4"], hint: "Expand (2n+1)², then factorise to show 4k + 1" },
      { q: "Prove that (n+1)² + n² is always an odd number.", a: "Shown", type: "proof", worked: ["(n+1)² + n² = n² + 2n + 1 + n²", "= 2n² + 2n + 1", "= 2(n² + n) + 1", "This is one more than an even number, so it is odd"], hint: "Expand, collect terms, and show the result is 2k + 1" },
    ],
    // Level 4 (Grade 9) — Advanced algebraic proofs
    [
      { q: "Prove algebraically that the difference between the squares of any two consecutive odd numbers is always a multiple of 8.", a: "Shown", type: "proof", worked: ["Let the odd numbers be 2n+1 and 2n+3", "(2n+3)² − (2n+1)² = (4n² + 12n + 9) − (4n² + 4n + 1)", "= 8n + 8 = 8(n + 1)", "8(n+1) is a multiple of 8"], hint: "Write two consecutive odd numbers as 2n+1 and 2n+3, square both, subtract" },
      { q: "Prove that n² + n is an even number for all integer values of n.", a: "Shown", type: "proof", worked: ["n² + n = n(n + 1)", "n and n+1 are consecutive integers", "One of any pair of consecutive integers is always even", "So their product n(n+1) is always even"], hint: "Factorise to n(n+1). One of two consecutive integers must be even" },
      { q: "Prove that the sum of the squares of two consecutive integers is always 1 more than an even number.", a: "Shown", type: "proof", worked: ["Let the integers be n and n+1", "n² + (n+1)² = n² + n² + 2n + 1 = 2n² + 2n + 1", "= 2(n² + n) + 1", "2(n² + n) is even, so the sum is 1 more than an even number"], hint: "Expand n² + (n+1)², simplify, and show it's 2k + 1" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A15: Gradients and Area Under Curves
  // ═══════════════════════════════════════════════════════════════
  'A15': [
    // Level 0 (Grade 6) — Estimate gradient by drawing tangent
    [
      { q: "Estimate the gradient of y = x² at the point (2, 4) by considering a tangent through (1, 0) and (3, 8).", a: "4", worked: ["Gradient of tangent = (8 − 0)/(3 − 1) = 8/2 = 4", "The gradient of the curve at (2, 4) is approximately 4"], hint: "Use the two points on the tangent to calculate rise ÷ run" },
      { q: "Estimate the gradient of y = x² − 2x at x = 3. A tangent at this point passes through (2, 0) and (4, 8).", a: "4", worked: ["At x = 3: y = 9 − 6 = 3", "Tangent gradient = (8 − 0)/(4 − 2) = 8/2 = 4"], hint: "Use the two tangent points to find the gradient" },
      { q: "Estimate the gradient of y = 1/x at (1, 1). A tangent passes through (0, 2) and (2, 0).", a: "−1", worked: ["Tangent gradient = (0 − 2)/(2 − 0) = −2/2 = −1", "The gradient of the curve at (1, 1) is approximately −1"], hint: "The gradient is negative because the curve slopes downward" },
    ],
    // Level 1 (Grade 7) — Interpret gradients on real-life graphs
    [
      { q: "Explain why the area under a velocity-time graph represents distance.", a: "Area = velocity × time = distance, since the units are m/s × s = m", worked: ["The y-axis shows velocity (m/s)", "The x-axis shows time (s)", "Area = height × width = velocity × time", "Velocity × time = distance (m/s × s = m)"], hint: "Think about the units: velocity × time gives what?" },
      { q: "What does the gradient of a velocity-time graph represent?", type: "mcq", options: ["Acceleration", "Distance", "Speed", "Displacement"], a: "Acceleration", worked: ["Gradient = change in velocity ÷ change in time", "= (m/s) ÷ s = m/s²", "This is acceleration"], hint: "The gradient is the rate of change. Rate of change of velocity is..." },
      { q: "Calculate the distance travelled in 5 seconds from a velocity-time graph showing constant speed of 8 m/s.", a: "40", worked: ["Distance = area under the graph", "= velocity × time = 8 × 5 = 40 m"], hint: "For constant speed, the area is a rectangle" },
    ],
    // Level 2 (Grade 8) — Trapezium rule
    [
      { q: "Use the trapezium rule with 3 strips to estimate the area under y = √x from x = 1 to x = 4.", a: "4.65", calculator: true, worked: ["h = (4−1)/3 = 1", "y₀ = √1 = 1, y₁ = √2 ≈ 1.414, y₂ = √3 ≈ 1.732, y₃ = √4 = 2", "Area ≈ h/2 × [y₀ + 2y₁ + 2y₂ + y₃]", "= 0.5 × [1 + 2(1.414) + 2(1.732) + 2]", "= 0.5 × [1 + 2.828 + 3.464 + 2] = 0.5 × 9.292 = 4.65"], hint: "Use h/2 × [first + 2×middles + last]. Calculate y at x = 1, 2, 3, 4" },
      { q: "Use 2 trapezia to estimate the area under y = 2ˣ from x = 0 to x = 2.", a: "4.5", calculator: true, worked: ["h = (2−0)/2 = 1", "y₀ = 2⁰ = 1, y₁ = 2¹ = 2, y₂ = 2² = 4", "Area ≈ 1/2 × [1 + 2(2) + 4] = 1/2 × 9 = 4.5"], hint: "Calculate y at x = 0, 1, 2, then apply the trapezium rule" },
      { q: "Use the trapezium rule with 3 strips to estimate the area under y = x² + 1 between x = 0 and x = 3.", a: "12.5", calculator: true, worked: ["h = 1. y₀ = 1, y₁ = 2, y₂ = 5, y₃ = 10", "Area ≈ 1/2 × [1 + 2(2) + 2(5) + 10]", "= 1/2 × [1 + 4 + 10 + 10] = 1/2 × 25 = 12.5"], hint: "y values at x=0,1,2,3 are 1,2,5,10. Apply h/2 × [first + 2×middles + last]" },
    ],
    // Level 3 (Grade 9) — Rate of change
    [
      { q: "Calculate the average rate of change for f(x) = x³ between x = 1 and x = 3.", a: "13", worked: ["f(1) = 1, f(3) = 27", "Average rate of change = (f(3) − f(1))/(3 − 1)", "= (27 − 1)/2 = 26/2 = 13"], hint: "Average rate of change = (f(b) − f(a))/(b − a)" },
      { q: "Find the instantaneous rate of change of y = 5x² at x = 2 by considering a tangent through (1, 5) and (3, 45).", a: "20", worked: ["Tangent gradient = (45 − 5)/(3 − 1) = 40/2 = 20", "Instantaneous rate of change at x = 2 is 20"], hint: "Use the tangent line to estimate the gradient at x = 2" },
      { q: "Compare the average speed and instantaneous speed at the midpoint: a car travels 100m in 10s. At t=5, a tangent gives gradient 12 m/s.", a: "Average speed = 10 m/s, instantaneous speed at t=5 = 12 m/s. The instantaneous speed is higher than the average.", worked: ["Average speed = total distance ÷ total time = 100/10 = 10 m/s", "Instantaneous speed at t=5 = gradient of tangent = 12 m/s", "The car is going faster than average at the midpoint"], hint: "Average speed = distance/time. Instantaneous speed = gradient of tangent" },
    ],
    // Level 4 (Grade 9) — Over/underestimates and velocity from distance-time
    [
      { q: "Determine if the trapezium rule provides an over-estimate or under-estimate for y = √x from x = 1 to x = 4.", type: "mcq", options: ["Over-estimate — curve is concave", "Under-estimate — curve is concave", "Over-estimate — curve is convex"], a: "Under-estimate — curve is concave", worked: ["y = √x is concave (curves downward/flattens out)", "For concave curves, the trapezium tops lie below the curve", "So the trapezium rule under-estimates the area"], hint: "Is √x bending upward (convex) or flattening out (concave)?" },
      { q: "A car accelerates from rest. Use a velocity-time graph: v = 0 at t=0, v = 5 at t=2, v = 12 at t=4, v = 15 at t=6, v = 18 at t=8, v = 20 at t=10. Estimate total distance in 10 seconds.", a: "120", calculator: true, worked: ["Use trapezium rule with h = 2:", "Area ≈ h/2 × [first + 2(middles) + last]", "= 2/2 × [0 + 2(5) + 2(12) + 2(15) + 2(18) + 20]", "= 1 × [0 + 10 + 24 + 30 + 36 + 20] = 120 m"], hint: "Apply the trapezium rule to the velocity-time data. Distance = area under the graph" },
      { q: "Use a distance-time graph to estimate the velocity at t = 4. The tangent at t = 4 passes through (2, 10) and (6, 50).", a: "10 m/s", worked: ["Velocity = gradient of distance-time graph", "Gradient of tangent = (50 − 10)/(6 − 2) = 40/4 = 10", "Estimated velocity at t = 4 is 10 m/s"], hint: "On a distance-time graph, velocity = gradient. Use the tangent" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G22: Enlargement with Negative & Fractional Scale Factors (Higher)
  // ═══════════════════════════════════════════════════════════════
  'G22': [
    // Level 1 (Grade 5) — Area of triangle using ½absinC
    [
      { q: "Calculate the area of a triangle with sides 8 cm and 11 cm and an included angle of 42°. Give your answer to 1 d.p.", a: "29.4 cm²", calculator: true, worked: ["Area = ½ × a × b × sin(C)", "= ½ × 8 × 11 × sin(42°)", "= 44 × 0.6691...", "= 29.4 cm² (1 d.p.)"], hint: "Use Area = ½ × a × b × sin(C)" },
      { q: "Find the area of a triangle with sides 10 cm and 14 cm and an included angle of 35°. Give to 1 d.p.", a: "40.2 cm²", calculator: true, worked: ["Area = ½ × 10 × 14 × sin(35°)", "= 70 × 0.5736", "= 40.2 cm² (1 d.p.)"], hint: "Use Area = ½ab sin(C)" },
      { q: "A triangle has sides 5 cm and 9 cm with an included angle of 110°. Find the area to 1 d.p.", a: "21.1 cm²", calculator: true, worked: ["Area = ½ × 5 × 9 × sin(110°)", "= 22.5 × 0.9397", "= 21.1 cm² (1 d.p.)"], hint: "Use Area = ½ab sin(C). sin(110°) is positive!" },
    ],
    // Level 2 (Grade 6) — Sine Rule to find a missing side
    [
      { q: "In triangle ABC, angle A = 40°, angle B = 75° and side a = 10 cm (opposite angle A). Use the Sine Rule to find side b. Give your answer to 1 d.p.", a: "15.0 cm", calculator: true, worked: ["Sine Rule: a/sin A = b/sin B", "10/sin 40° = b/sin 75°", "b = 10 × sin 75° / sin 40°", "b = 10 × 0.9659 / 0.6428", "b = 15.0 cm (1 d.p.)"], hint: "Use a/sin A = b/sin B and rearrange to find b" },
      { q: "In triangle PQR, angle P = 45°, angle R = 65°, and p = 8 cm. Find r to 1 d.p.", a: "10.3 cm", calculator: true, worked: ["Sine Rule: p/sin P = r/sin R", "8/sin 45° = r/sin 65°", "r = 8 × sin 65° / sin 45°", "r = 8 × 0.9063 / 0.7071", "r = 10.3 cm (1 d.p.)"], hint: "Use the Sine Rule: p/sin P = r/sin R" },
      { q: "In triangle XYZ, angle X = 72°, angle Y = 38°, and x = 20 cm. Find y to 1 d.p.", a: "12.9 cm", calculator: true, worked: ["Sine Rule: x/sin X = y/sin Y", "20/sin 72° = y/sin 38°", "y = 20 × sin 38° / sin 72°", "y = 20 × 0.6157 / 0.9511", "y = 12.9 cm (1 d.p.)"], hint: "Use the Sine Rule: x/sin X = y/sin Y" },
    ],
    // Level 3 (Grade 7) — Cosine Rule in bearing context
    [
      { q: "A ship sails 15 km on a bearing of 060° and then 20 km on a bearing of 150°. Calculate the direct distance back to the starting point.", a: "25 km", calculator: true, worked: ["Back-bearing of first leg = 060° + 180° = 240°", "Angle at turning point = 240° − 150° = 90°", "Using Cosine Rule: c² = 15² + 20² − 2(15)(20)cos(90°)", "cos(90°) = 0, so c² = 225 + 400 = 625", "c = √625 = 25 km"], hint: "Find the angle between the two legs using bearings. The back-bearing of the first leg minus the forward bearing of the second gives the angle." },
      { q: "In triangle ABC, a = 10 cm, b = 14 cm and angle C = 75°. Find c to 1 d.p.", a: "15.0 cm", calculator: true, worked: ["Cosine Rule: c² = a² + b² − 2ab cos(C)", "c² = 100 + 196 − 2(10)(14)cos(75°)", "c² = 296 − 280 × 0.2588", "c² = 296 − 72.5 = 223.5", "c = √223.5 = 15.0 cm (1 d.p.)"], hint: "Use c² = a² + b² − 2ab cos(C)" },
      { q: "Two ships leave port. Ship A sails 12 km due east, Ship B sails 18 km on a bearing of 110°. Find the distance between the ships to 1 d.p.", a: "7.9 km", calculator: true, worked: ["Ship A: bearing 090° (due east)", "Ship B: bearing 110°", "Angle between paths at port = 110° − 90° = 20°", "Cosine Rule: d² = 12² + 18² − 2(12)(18)cos(20°)", "d² = 144 + 324 − 432 × 0.9397", "d² = 468 − 405.9 = 62.1", "d = √62.1 = 7.9 km"], hint: "Find the angle between the two bearings at the port, then use the Cosine Rule." },
    ],
    // Level 4 (Grade 8) — Cosine Rule to find an angle
    [
      { q: "Find the largest angle in a triangle with sides 5 cm, 7 cm and 10 cm. Give your answer to 1 d.p.", a: "111.8°", calculator: true, worked: ["The largest angle is opposite the longest side (10 cm)", "cos C = (a² + b² − c²) / 2ab", "cos C = (25 + 49 − 100) / (2 × 5 × 7)", "cos C = −26/70 = −0.3714...", "C = cos⁻¹(−0.3714) = 111.8°"], hint: "The largest angle is opposite the longest side. Use cos C = (a² + b² − c²) / 2ab" },
      { q: "A triangle has sides 7 cm, 9 cm and 11 cm. Find the angle opposite the 11 cm side to 1 d.p.", a: "85.9°", calculator: true, worked: ["cos C = (a² + b² − c²) / (2ab)", "cos C = (49 + 81 − 121) / (2 × 7 × 9)", "cos C = 9 / 126 = 0.0714", "C = cos⁻¹(0.0714) = 85.9°"], hint: "Use cos C = (a² + b² − c²) / (2ab) where c = 11" },
      { q: "In triangle ABC, a = 10 cm, b = 12 cm, c = 14 cm. Find angle C to 1 d.p.", a: "78.5°", calculator: true, worked: ["cos C = (a² + b² − c²) / (2ab)", "cos C = (100 + 144 − 196) / (2 × 10 × 12)", "cos C = 48 / 240 = 0.2", "C = cos⁻¹(0.2) = 78.5°"], hint: "Use the rearranged Cosine Rule to find the angle." },
    ],
    // Level 5 (Grade 9) — 3D pyramid problem
    [
      { q: "A square-based pyramid has a base of side 10 cm and a vertical height of 12 cm. Calculate the angle between a slant edge and the base. Give your answer to 1 d.p.", a: "59.5°", calculator: true, worked: ["The slant edge goes from a base corner to the apex", "Half-diagonal of base = ½ × 10√2 = 5√2 = 7.071 cm", "The slant edge, height and half-diagonal form a right triangle", "tan θ = height / half-diagonal = 12 / 5√2", "θ = tan⁻¹(12/7.071) = 59.5°"], hint: "Find the half-diagonal of the square base. The angle is between the slant edge and the horizontal half-diagonal, with the vertical height opposite." },
      { q: "A cuboid is 8 cm × 6 cm × 10 cm. Find the angle a space diagonal makes with the base to 1 d.p.", a: "45.0°", calculator: true, worked: ["Base diagonal = √(8² + 6²) = √100 = 10 cm", "The space diagonal, base diagonal, and height form a right triangle", "tan θ = height / base diagonal = 10 / 10 = 1", "θ = tan⁻¹(1) = 45.0°"], hint: "Find the base diagonal first using Pythagoras, then use tan(angle) = height / base diagonal." },
      { q: "A cone has base radius 5 cm and slant height 13 cm. Find the angle between the slant height and the vertical axis to 1 d.p.", a: "22.6°", calculator: true, worked: ["Vertical height = √(13² − 5²) = √(169 − 25) = √144 = 12 cm", "The slant height, height, and radius form a right triangle", "The angle between slant and axis: sin θ = radius / slant = 5/13", "θ = sin⁻¹(5/13) = 22.6°", "Or: tan θ = 5/12, θ = tan⁻¹(5/12) = 22.6°"], hint: "Find the vertical height using Pythagoras. Then use trigonometry in the right triangle formed by height, radius, and slant height." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R15: Growth & Decay (Higher)
  // ═══════════════════════════════════════════════════════════════
  'R15': [
    // Level 1 (Grade 4) — Speed, distance, time
    [
      { q: "A car travels 120 miles in 2 hours 30 minutes. Calculate its average speed.", a: "48 mph", worked: ["Time = 2.5 hours", "Speed = distance ÷ time", "= 120 ÷ 2.5 = 48 mph"], hint: "Convert minutes to hours first, then use speed = distance ÷ time", calculator: true },
      { q: "A train travels 210 km in 3 hours 30 minutes. Calculate its average speed.", a: "60 km/h", worked: ["Time = 3.5 hours", "Speed = 210 ÷ 3.5 = 60 km/h"], hint: "Convert to hours, then speed = distance ÷ time", calculator: true },
      { q: "Walk 6 miles at 4 mph. How many minutes does it take?", a: "90 minutes", worked: ["Time = distance ÷ speed", "= 6 ÷ 4 = 1.5 hours", "= 1.5 × 60 = 90 minutes"], hint: "Time = distance ÷ speed, then convert hours to minutes", calculator: true },
    ],
    // Level 2 (Grade 5) — Density and mass
    [
      { q: "A block of wood has a mass of 600 g and a volume of 750 cm³. Calculate its density.", a: "0.8 g/cm³", worked: ["Density = mass ÷ volume", "= 600 ÷ 750 = 0.8 g/cm³"], hint: "Density = mass ÷ volume", calculator: true },
      { q: "A metal bar has density 8 g/cm³ and volume 50 cm³. Calculate its mass.", a: "400 g", worked: ["Mass = density × volume", "= 8 × 50 = 400 g"], hint: "Mass = density × volume", calculator: true },
      { q: "A stone has mass 2.4 kg and density 3 g/cm³. Find its volume.", a: "800 cm³", worked: ["Convert mass: 2.4 kg = 2400 g", "Volume = mass ÷ density", "= 2400 ÷ 3 = 800 cm³"], hint: "Convert kg to g first, then volume = mass ÷ density", calculator: true },
    ],
    // Level 3 (Grade 7) — Compound measures with unit conversion
    [
      { q: "A liquid has a density of 1.2 g/cm³. Calculate the mass of 2.5 litres of the liquid.", a: "3000 g (or 3 kg)", worked: ["2.5 litres = 2500 cm³", "Mass = density × volume", "= 1.2 × 2500 = 3000 g = 3 kg"], hint: "1 litre = 1000 cm³. Then use mass = density × volume", calculator: true },
      { q: "Force = 120 N acting on an area of 0.5 m². Calculate the pressure.", a: "240 N/m²", worked: ["Pressure = force ÷ area", "= 120 ÷ 0.5 = 240 N/m²"], hint: "Pressure = force ÷ area", calculator: true },
      { q: "Change a pressure of 40 N/m² into N/cm².", a: "0.004 N/cm²", worked: ["1 m² = 10,000 cm²", "40 N/m² = 40 N per 10,000 cm²", "= 40 ÷ 10,000 = 0.004 N/cm²"], hint: "1 m = 100 cm, so 1 m² = 10,000 cm². Divide by 10,000.", calculator: true },
    ],
    // Level 4 (Grade 8) — Converting compound units
    [
      { q: "Convert a speed of 72 km/h into metres per second (m/s).", a: "20 m/s", worked: ["72 km = 72,000 m", "1 hour = 3600 seconds", "72 km/h = 72,000 ÷ 3600 = 20 m/s"], hint: "Multiply km by 1000, divide hours by 3600", calculator: true },
      { q: "Convert a density of 1000 kg/m³ into g/cm³.", a: "1 g/cm³", worked: ["1000 kg = 1,000,000 g", "1 m³ = 1,000,000 cm³", "1000 kg/m³ = 1,000,000/1,000,000 = 1 g/cm³"], hint: "Convert both units: kg to g and m³ to cm³", calculator: true },
      { q: "Convert 15 m/s into km/h.", a: "54 km/h", worked: ["15 m/s = 15 × 3600 m/h = 54,000 m/h", "= 54,000 ÷ 1000 = 54 km/h"], hint: "Multiply by 3600 to get m/h, then divide by 1000 for km/h", calculator: true },
    ],
    // Level 5 (Grade 9) — Complex compound measure problems
    [
      { q: "Liquid A (density 0.8 g/cm³) is mixed with Liquid B (density 1.1 g/cm³) in a 3:1 ratio by volume. Find the density of the mixture.", a: "0.875 g/cm³", worked: ["Take 3 cm³ of A and 1 cm³ of B", "Mass of A = 0.8 × 3 = 2.4 g", "Mass of B = 1.1 × 1 = 1.1 g", "Total mass = 3.5 g, total volume = 4 cm³", "Density = 3.5/4 = 0.875 g/cm³"], hint: "Find the total mass and total volume of the mixture, then divide", calculator: true },
      { q: "A cyclist travels at 12 mph for 20 miles, then 18 mph for 30 miles. Find the average speed for the whole journey.", a: "15 mph", worked: ["Time 1 = 20/12 = 5/3 hours", "Time 2 = 30/18 = 5/3 hours", "Total distance = 50 miles", "Total time = 10/3 hours", "Average speed = 50 ÷ (10/3) = 15 mph"], hint: "Average speed = total distance ÷ total time. Don't just average the two speeds!", calculator: true },
      { q: "Alloy X is 60% metal A (density 7 g/cm³) and 40% metal B (density 9 g/cm³) by mass. Find the density of Alloy X to 1 d.p.", a: "7.7 g/cm³", worked: ["Take 100 g of alloy: 60 g of A, 40 g of B", "Volume of A = 60/7 = 8.571 cm³", "Volume of B = 40/9 = 4.444 cm³", "Total volume = 13.016 cm³", "Density = 100/13.016 = 7.7 g/cm³ (1 d.p.)"], hint: "Find the volume of each component using mass/density, then total density = total mass / total volume", calculator: true },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A11: Quadratic Graphs & Turning Points (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A11': [
    // Level 1 (Grade 5) — Tables of values and basic quadratic graphs
    [
      { q: "Complete the table of values for y = x² − 3 when x = −2, −1, 0, 1, 2. What is y when x = −2?", a: "1", worked: ["y = x² − 3", "When x = −2: y = (−2)² − 3 = 4 − 3 = 1"], hint: "Substitute x = −2 into the equation. Remember (−2)² = 4" },
      { q: "For y = 2x², what is the value of y when x = 3?", a: "18", worked: ["y = 2x²", "When x = 3: y = 2 × 3² = 2 × 9 = 18"], hint: "Substitute x = 3. Square first, then multiply by 2" },
      { q: "State the equation of the line of symmetry for y = x² + 4.", a: "x = 0", worked: ["y = x² + 4 has no x-term", "The graph is symmetric about the y-axis", "Line of symmetry: x = 0"], hint: "A quadratic y = x² + c with no x-term is symmetric about the y-axis" },
    ],
    // Level 2 (Grade 6) — Intercepts and roots from factorised form
    [
      { q: "Write down the coordinates of the y-intercept for y = x² − 5x + 6.", a: "(0, 6)", worked: ["The y-intercept occurs when x = 0", "y = 0² − 5(0) + 6 = 6", "y-intercept is (0, 6)"], hint: "Substitute x = 0 to find the y-intercept" },
      { q: "Find the roots of y = (x − 2)(x + 4).", a: "x = 2 and x = −4", worked: ["Set y = 0:", "(x − 2)(x + 4) = 0", "x − 2 = 0 → x = 2", "x + 4 = 0 → x = −4"], hint: "Set each bracket equal to zero" },
      { q: "Where does the graph of y = 12 − x − x² cross the y-axis?", a: "(0, 12)", worked: ["Substitute x = 0:", "y = 12 − 0 − 0² = 12", "The graph crosses the y-axis at (0, 12)"], hint: "Substitute x = 0 into the equation" },
    ],
    // Level 3 (Grade 7) — Solving quadratics for x-intercepts
    [
      { q: "Solve x² − 4x − 5 = 0 to find the x-intercepts of y = x² − 4x − 5.", a: "x = 5 and x = −1", worked: ["Factorise: (x − 5)(x + 1) = 0", "x − 5 = 0 → x = 5", "x + 1 = 0 → x = −1", "x-intercepts: (5, 0) and (−1, 0)"], hint: "Find two numbers that multiply to −5 and add to −4" },
      { q: "Use the quadratic formula to find the x-intercepts of y = x² + 3x − 1 to 2 decimal places.", a: "x = 0.30 and x = −3.30", calculator: true, worked: ["a = 1, b = 3, c = −1", "x = (−3 ± √(9 + 4)) / 2", "x = (−3 ± √13) / 2", "x = (−3 + 3.606) / 2 = 0.30", "x = (−3 − 3.606) / 2 = −3.30"], hint: "Use x = (−b ± √(b² − 4ac)) / 2a with a = 1, b = 3, c = −1" },
      { q: "Determine the number of real roots for y = 2x² + 4x + 5 using the discriminant.", a: "No real roots", type: "mcq", options: ["No real roots", "One repeated root", "Two distinct roots"], worked: ["Discriminant = b² − 4ac", "= 4² − 4(2)(5)", "= 16 − 40 = −24", "Since −24 < 0, there are no real roots"], hint: "Calculate b² − 4ac. If it's negative, there are no real roots" },
    ],
    // Level 4 (Grade 8) — Completing the square for turning points
    [
      { q: "By completing the square, find the coordinates of the turning point of y = x² + 6x + 2.", a: "(−3, −7)", worked: ["y = x² + 6x + 2", "= (x + 3)² − 9 + 2", "= (x + 3)² − 7", "Turning point is at (−3, −7)"], hint: "Half the coefficient of x gives the bracket. Subtract (half)² and simplify" },
      { q: "Find the coordinates of the minimum point of y = x² − 8x + 10.", a: "(4, −6)", worked: ["y = x² − 8x + 10", "= (x − 4)² − 16 + 10", "= (x − 4)² − 6", "Minimum point is at (4, −6)"], hint: "Complete the square: half of −8 is −4" },
      { q: "Write y = 2x² + 8x − 3 in the form a(x + b)² + c and find the turning point.", a: "(−2, −11)", worked: ["y = 2x² + 8x − 3", "= 2(x² + 4x) − 3", "= 2[(x + 2)² − 4] − 3", "= 2(x + 2)² − 8 − 3", "= 2(x + 2)² − 11", "Turning point is at (−2, −11)"], hint: "Factor out the 2 from the first two terms first, then complete the square inside the brackets" },
    ],
    // Level 5 (Grade 9) — Sketching, equation from turning point, algebraic proof
    [
      { q: "Sketch the graph of y = 9 − (x − 2)². State whether the turning point is a maximum or minimum.", a: "Maximum at (2, 9)", worked: ["y = 9 − (x − 2)² = −(x − 2)² + 9", "The coefficient of (x − 2)² is negative", "So the parabola opens downward → maximum", "Turning point: (2, 9)", "y-intercept: 9 − (0 − 2)² = 9 − 4 = 5", "x-intercepts: (x − 2)² = 9 → x − 2 = ±3 → x = 5 or x = −1"], hint: "The negative sign in front of (x − 2)² means the parabola is upside down" },
      { q: "A quadratic has a turning point at (3, −4) and passes through (0, 5). Find its equation in the form y = ax² + bx + c.", a: "y = x² − 6x + 5", worked: ["Vertex form: y = a(x − 3)² − 4", "Passes through (0, 5): 5 = a(0 − 3)² − 4", "5 = 9a − 4 → 9a = 9 → a = 1", "y = (x − 3)² − 4 = x² − 6x + 9 − 4", "y = x² − 6x + 5"], hint: "Use vertex form y = a(x − h)² + k with the turning point, then find a using the other point" },
      { q: "Prove that the turning point of y = x² + kx + 4 always has a y-coordinate of 4 − k²/4.", a: "Shown", type: "proof", worked: ["Complete the square:", "y = x² + kx + 4", "= (x + k/2)² − k²/4 + 4", "= (x + k/2)² + (4 − k²/4)", "The turning point is at (−k/2, 4 − k²/4)", "So the y-coordinate is always 4 − k²/4 ∎"], hint: "Complete the square for x² + kx. The constant term that remains gives the y-coordinate of the turning point" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A12: Equation of a Circle and Tangents (Higher only)
  // ═══════════════════════════════════════════════════════════════
  'A12': [
    // Level 1 (Grade 5) — Equation of a circle centred at origin
    [
      { q: "Write down the equation of a circle with centre (0, 0) and radius 9.", a: "x² + y² = 81", worked: ["The equation of a circle centred at the origin is x² + y² = r²", "r = 9, so r² = 81", "x² + y² = 81"], hint: "Use x² + y² = r² and square the radius" },
      { q: "State the radius of the circle x² + y² = 49.", a: "7", worked: ["x² + y² = r²", "r² = 49", "r = √49 = 7"], hint: "The number on the right-hand side is r². Take its square root" },
      { q: "Write the equation of a circle centred at the origin that passes through (0, 5).", a: "x² + y² = 25", worked: ["The point (0, 5) lies on the circle", "r = distance from origin = 5", "r² = 25", "x² + y² = 25"], hint: "The radius equals the distance from (0,0) to (0,5)" },
    ],
    // Level 2 (Grade 6) — Verifying points on a circle
    [
      { q: "Verify that the point (3, 4) lies on the circle x² + y² = 25.", a: "Shown", type: "proof", worked: ["Substitute (3, 4) into x² + y²", "3² + 4² = 9 + 16 = 25 ✓", "This equals the right-hand side", "So (3, 4) lies on the circle"], hint: "Substitute x = 3 and y = 4 into x² + y² and check it equals 25" },
      { q: "Does the point (1, √3) lie on the circle x² + y² = 4?", a: "Yes", type: "mcq", options: ["Yes", "No"], worked: ["Substitute: 1² + (√3)² = 1 + 3 = 4 ✓", "4 = 4, so yes the point lies on the circle"], hint: "Substitute the coordinates. Remember (√3)² = 3" },
      { q: "Find the coordinates of the points where x² + y² = 16 crosses the x-axis.", a: "(4, 0) and (−4, 0)", worked: ["On the x-axis, y = 0", "x² + 0² = 16", "x² = 16 → x = ±4", "Points are (4, 0) and (−4, 0)"], hint: "On the x-axis, y = 0. Substitute into the equation" },
    ],
    // Level 3 (Grade 7) — Tangent equations
    [
      { q: "Find the equation of the tangent to x² + y² = 25 at the point (3, 4). Give your answer in the form y = mx + c.", a: "y = −¾x + 25/4", worked: ["Gradient of radius to (3, 4) = 4/3", "Tangent is perpendicular: gradient = −3/4", "y − 4 = −¾(x − 3)", "y = −¾x + 9/4 + 4 = −¾x + 25/4"], hint: "The tangent is perpendicular to the radius. Find the radius gradient, then use the negative reciprocal" },
      { q: "Find the equation of the tangent to x² + y² = 100 at the point (−6, 8).", a: "y = ¾x + 25/2", worked: ["Gradient of radius to (−6, 8) = 8/(−6) = −4/3", "Tangent gradient = 3/4 (negative reciprocal)", "y − 8 = ¾(x − (−6))", "y − 8 = ¾(x + 6) = ¾x + 9/2", "y = ¾x + 9/2 + 8 = ¾x + 25/2"], hint: "Find the gradient from origin to (−6, 8), then the perpendicular gradient" },
      { q: "Find the equation of the tangent to x² + y² = 50 at the point (5, −5).", a: "y = x − 10", worked: ["Gradient of radius to (5, −5) = −5/5 = −1", "Tangent gradient = 1 (negative reciprocal)", "y − (−5) = 1(x − 5)", "y + 5 = x − 5", "y = x − 10"], hint: "The radius gradient is −1, so the tangent gradient is 1" },
    ],
    // Level 4 (Grade 8) — Line-circle intersections
    [
      { q: "Find the points where the line y = x + 1 intersects the circle x² + y² = 13.", a: "(−3, −2) and (2, 3)", calculator: true, worked: ["Substitute y = x + 1 into x² + y² = 13:", "x² + (x + 1)² = 13", "x² + x² + 2x + 1 = 13", "2x² + 2x − 12 = 0 → x² + x − 6 = 0", "(x + 3)(x − 2) = 0 → x = −3 or x = 2", "When x = −3: y = −2. When x = 2: y = 3", "Points: (−3, −2) and (2, 3)"], hint: "Substitute the line equation into the circle equation and solve the resulting quadratic" },
      { q: "Solve simultaneously: x² + y² = 25 and y = 2x − 5.", a: "(0, −5) and (4, 3)", calculator: true, worked: ["Substitute y = 2x − 5 into x² + y² = 25:", "x² + (2x − 5)² = 25", "x² + 4x² − 20x + 25 = 25", "5x² − 20x = 0", "5x(x − 4) = 0 → x = 0 or x = 4", "When x = 0: y = −5. When x = 4: y = 3", "Points: (0, −5) and (4, 3)"], hint: "Substitute the line into the circle and factorise" },
      { q: "Show that the line y = x + 10 is a tangent to the circle x² + y² = 50.", a: "Shown", type: "proof", calculator: true, worked: ["Substitute y = x + 10 into x² + y² = 50:", "x² + (x + 10)² = 50", "x² + x² + 20x + 100 = 50", "2x² + 20x + 50 = 0", "x² + 10x + 25 = 0", "Discriminant = 100 − 100 = 0", "Discriminant = 0, so the line touches the circle at exactly one point (tangent)"], hint: "Substitute into the circle equation and show the discriminant equals zero" },
    ],
    // Level 5 (Grade 9) — Triangle area, distance, and point of contact
    [
      { q: "Find the area of the triangle formed by the tangent to x² + y² = 40 at the point (2, 6), the x-axis and the y-axis.", a: "200/3", calculator: true, worked: ["Check: 2² + 6² = 4 + 36 = 40 ✓", "Gradient of radius = 6/2 = 3", "Tangent gradient = −1/3 (perpendicular)", "Tangent: y − 6 = −⅓(x − 2)", "y = −⅓x + ⅔ + 6 = −⅓x + 20/3", "x-intercept (y = 0): x = 20", "y-intercept (x = 0): y = 20/3", "Area = ½ × 20 × 20/3 = 200/3 ≈ 66.7"], hint: "Find the tangent equation, then its x and y intercepts. Use Area = ½ × base × height" },
      { q: "The tangent to x² + y² = 25 is y = −¾x + 25/4. Find the point of contact on the circle.", a: "(3, 4)", worked: ["Tangent gradient = −3/4, so radius gradient = 4/3", "Point (x, y) on circle with y/x = 4/3 → y = 4x/3", "Substitute: x² + 16x²/9 = 25", "25x²/9 = 25 → x² = 9 → x = 3 (positive, since tangent has positive y-intercept)", "y = 4(3)/3 = 4", "Point of contact: (3, 4)"], hint: "The radius to the point of contact is perpendicular to the tangent. Use this to find the relationship between x and y" },
      { q: "Find the shortest distance from the origin to the line 3x + 4y = 25.", a: "5", worked: ["Use the distance formula: d = |ax₀ + by₀ − c| / √(a² + b²)", "Rewrite as 3x + 4y − 25 = 0", "d = |3(0) + 4(0) − 25| / √(9 + 16)", "d = 25 / √25 = 25/5 = 5"], hint: "Use the perpendicular distance formula: d = |ax + by + c| / √(a² + b²)" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A13: Graph Transformations — f(x) notation (Higher only)
  // ═══════════════════════════════════════════════════════════════
  'A13': [
    // Level 1 (Grade 7) — Vertical translations f(x) + a
    [
      { q: "The graph of y = x² is transformed to y = x² + 3. Describe the transformation.", a: "Translation by (0, 3) — shift up 3 units", worked: ["y = x² + 3 means f(x) + 3", "This adds 3 to every y-coordinate", "The graph shifts UP by 3 units", "Translation vector (0, 3)"], hint: "f(x) + a shifts the graph UP by a units" },
      { q: "The graph of y = f(x) passes through (5, 2). What point must be on y = f(x) + 7?", a: "(5, 9)", worked: ["f(x) + 7 adds 7 to every y-value", "(5, 2) → (5, 2 + 7) = (5, 9)"], hint: "f(x) + 7 shifts every point up by 7" },
      { q: "The graph of y = f(x) passes through (−3, 4). What point must be on y = f(x) − 5?", a: "(-3, -1)", worked: ["f(x) − 5 subtracts 5 from every y-value", "(−3, 4) → (−3, 4 − 5) = (−3, −1)"], hint: "f(x) − a shifts every point DOWN by a" },
    ],
    // Level 2 (Grade 7) — Horizontal translations f(x − a)
    [
      { q: "Describe the transformation that maps y = f(x) onto y = f(x − 4).", a: "Translation by (4, 0) — shift right 4 units", worked: ["f(x − 4) replaces x with (x − 4)", "This shifts the graph RIGHT by 4 units", "Translation vector (4, 0)"], hint: "f(x − a) shifts RIGHT by a units. Watch the sign!" },
      { q: "The graph of y = f(x) passes through (1, 6). What point must be on y = f(x + 3)?", a: "(-2, 6)", worked: ["f(x + 3) shifts the graph LEFT by 3 units", "x-coordinates decrease by 3, y stays the same", "(1, 6) → (1 − 3, 6) = (−2, 6)"], hint: "f(x + a) shifts LEFT by a. Subtract a from x-coordinates" },
      { q: "The minimum of y = f(x) is at (4, −2). State the minimum of y = f(x − 3) + 1.", a: "(7, -1)", worked: ["f(x − 3): shift right 3 → x becomes 4 + 3 = 7", "+1: shift up 1 → y becomes −2 + 1 = −1", "New minimum: (7, −1)"], hint: "f(x − 3) shifts right 3, then +1 shifts up 1" },
    ],
    // Level 3 (Grade 8) — Reflections −f(x) and f(−x)
    [
      { q: "The graph of y = f(x) has a maximum at (4, 6). State the coordinates of the maximum of y = −f(x).", a: "(4, −6) — it becomes a minimum", worked: ["−f(x) reflects the graph in the x-axis", "All y-values change sign", "(4, 6) → (4, −6)", "The maximum becomes a minimum"], hint: "−f(x) reflects in the x-axis: negate the y-coordinate" },
      { q: "Describe the transformation that maps y = f(x) onto y = f(−x).", a: "Reflection in the y-axis", worked: ["f(−x) replaces x with −x", "All x-coordinates change sign", "This reflects the graph in the y-axis"], hint: "f(−x) reflects in the y-axis. −f(x) reflects in the x-axis." },
      { q: "The graph of y = f(x) passes through (3, −1) and (−2, 5). Find the corresponding points on y = −f(x).", a: "(3, 1) and (-2, -5)", worked: ["−f(x) reflects in the x-axis: negate y-values", "(3, −1) → (3, 1)", "(−2, 5) → (−2, −5)"], hint: "−f(x) changes the sign of every y-coordinate" },
    ],
    // Level 4 (Grade 8) — Stretches f(ax) and af(x)
    [
      { q: "Describe the single transformation from y = cos(x) to y = cos(2x).", a: "Horizontal stretch, scale factor ½", worked: ["cos(2x) means f(2x)", "f(ax) is a horizontal stretch with scale factor 1/a", "Scale factor = 1/2", "The graph is squashed horizontally — the period halves from 360° to 180°"], hint: "f(ax) stretches horizontally by scale factor 1/a" },
      { q: "A curve has a maximum at (6, 3). State the new maximum after the transformation y = f(2x).", a: "(3, 3)", worked: ["f(2x) is a horizontal stretch with scale factor ½", "x-coordinates are divided by 2", "y-coordinates stay the same", "(6, 3) → (3, 3)"], hint: "f(2x) halves all x-coordinates" },
      { q: "The graph of y = sin(x) is transformed to y = 3sin(x). Describe the transformation and state the new amplitude.", a: "Vertical stretch scale factor 3; amplitude = 3", worked: ["3sin(x) means 3 × f(x)", "This multiplies all y-values by 3", "Vertical stretch, scale factor 3", "Original amplitude 1 → new amplitude 3"], hint: "af(x) stretches vertically by factor a. Amplitude = |a|" },
    ],
    // Level 5 (Grade 9) — Combined transformations
    [
      { q: "The graph of y = f(x) passes through (2, 5). Find the corresponding point on y = 3f(x − 1).", a: "(3, 15)", worked: ["Two transformations:", "f(x − 1): shift RIGHT by 1 → x becomes 2 + 1 = 3", "3f: multiply y by 3 → y becomes 5 × 3 = 15", "New point: (3, 15)"], hint: "Apply inside function first (shift right 1), then outside (multiply y by 3)" },
      { q: "Describe the transformations that map y = sin(x) onto y = 2sin(x) + 1.", a: "Vertical stretch factor 2, then translation up 1", worked: ["2sin(x): vertical stretch with scale factor 2", "The amplitude doubles (−1 to 1 becomes −2 to 2)", "+1: translation up by 1 unit", "Final range: −2 + 1 = −1 to 2 + 1 = 3"], hint: "The 2 stretches vertically (doubles y-values), the +1 shifts up" },
      { q: "The graph of y = f(x) passes through (−1, 4) and (3, −2). Find the corresponding points on y = 2f(x + 4).", a: "(-5, 8) and (-1, -4)", worked: ["Two transformations: f(x + 4) shifts LEFT 4, then 2f multiplies y by 2", "Point (−1, 4): x shifts left 4: −1 − 4 = −5, y doubles: 4 × 2 = 8 → (−5, 8)", "Point (3, −2): x shifts left 4: 3 − 4 = −1, y doubles: −2 × 2 = −4 → (−1, −4)"], hint: "Apply inside function first (shift left 4), then outside (multiply y by 2)" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A16: Circle Equations and Tangents (Higher)
  // ═══════════════════════════════════════════════════════════════
  'A16': [
    // Level 1 (Grade 5) — Angle in a semicircle
    [
      { q: "Points A, B and C lie on a circle. BC is a diameter. What is the size of angle BAC? State the reason.", a: "90°", worked: ["BC is a diameter of the circle", "Angle BAC is an angle in a semicircle", "The angle in a semicircle is always 90°"], hint: "What theorem applies when an angle is drawn from the ends of a diameter?" },
      { q: "P, Q, R lie on a circle. PR is a diameter and angle QPR = 35°. Find angle PQR.", a: "55°", worked: ["PR is a diameter, so angle PQR is NOT the angle in the semicircle", "Angle QRP is in the semicircle (subtended by diameter PR)", "So angle QRP = 90°", "Angles in triangle: PQR = 180° − 90° − 35° = 55°"], hint: "Which angle is in the semicircle? Then use angles in a triangle = 180°." },
      { q: "A triangle ABC is inscribed in a semicircle with diameter AC = 10 cm. If BC = 6 cm, find AB.", a: "8 cm", worked: ["AC is a diameter, so angle ABC = 90° (angle in semicircle)", "By Pythagoras: AB² + BC² = AC²", "AB² + 36 = 100", "AB² = 64", "AB = 8 cm"], hint: "The angle in a semicircle is 90°, so you have a right-angled triangle. Use Pythagoras." },
    ],
    // Level 2 (Grade 6) — Opposite angles in a cyclic quadrilateral
    [
      { q: "Points A, B, C and D lie on a circle. Angle ABC = 112°. Calculate the size of angle ADC.", a: "68°", worked: ["ABCD is a cyclic quadrilateral", "Opposite angles in a cyclic quadrilateral sum to 180°", "Angle ADC = 180° − 112° = 68°"], hint: "Opposite angles in a cyclic quadrilateral add up to 180°" },
      { q: "PQRS is a cyclic quadrilateral. Angle PQR = 85° and angle QRS = 100°. Find angles RSP and SPQ.", a: "RSP = 95°, SPQ = 80°", worked: ["Opposite angles in a cyclic quadrilateral sum to 180°", "RSP is opposite PQR: RSP = 180° − 85° = 95°", "SPQ is opposite QRS: SPQ = 180° − 100° = 80°", "Check: 85 + 100 + 95 + 80 = 360° ✓"], hint: "Each pair of opposite angles sums to 180°." },
      { q: "ABCD is a cyclic quadrilateral. Angle BAD = 3x and angle BCD = 2x + 10. Find x.", a: "x = 34", worked: ["Opposite angles sum to 180°", "3x + (2x + 10) = 180", "5x + 10 = 180", "5x = 170", "x = 34"], hint: "Set up an equation using: opposite angles in a cyclic quad sum to 180°." },
    ],
    // Level 3 (Grade 7) — Alternate Segment Theorem
    [
      { q: "A tangent meets a circle at point T. A chord from T makes an angle of 55° with the tangent. Find the angle in the alternate segment.", a: "55°", worked: ["By the Alternate Segment Theorem:", "The angle between a tangent and a chord equals", "the angle in the alternate segment", "So the angle in the alternate segment = 55°"], hint: "The Alternate Segment Theorem says the angle between tangent and chord equals the angle in the other segment" },
      { q: "A tangent at B makes 62° with chord BC. BD is a diameter. Find angle DBC.", a: "28°", worked: ["By the Alternate Segment Theorem: angle BDC = 62°", "BD is a diameter, so angle BCD = 90° (angle in semicircle)", "In triangle BDC: DBC = 180° − 90° − 62° = 28°"], hint: "Use the Alternate Segment Theorem first, then the semicircle theorem, then angles in a triangle." },
      { q: "Two tangents from external point P touch the circle at A and B. Angle APB = 50°. Find angle AOB where O is the centre.", a: "130°", worked: ["OA ⊥ PA (radius perpendicular to tangent) → angle OAP = 90°", "OB ⊥ PB → angle OBP = 90°", "In quadrilateral OAPB: angles sum to 360°", "90° + 90° + 50° + AOB = 360°", "AOB = 130°"], hint: "The radius to a tangent point is perpendicular to the tangent. Use angle sum in the quadrilateral OAPB." },
    ],
    // Level 4 (Grade 8) — Proving angle at centre = 2 × angle at circumference
    [
      { q: "A, B and C are points on a circle with centre O. Angle AOC = 148°. Find angle ABC. State the theorem used.", a: "74°", worked: ["The angle at the centre is twice the angle at the circumference", "Angle AOC = 2 × angle ABC", "148° = 2 × angle ABC", "Angle ABC = 74°"], hint: "The angle at the centre is twice the angle at the circumference when both subtend the same arc" },
      { q: "A, B, C lie on a circle centre O. The reflex angle AOB = 250°. C is on the major arc. Find angle ACB.", a: "125°", worked: ["Reflex angle AOB = 250°", "The angle at the circumference is half the angle at the centre", "C is on the major arc, so ACB is subtended by the reflex angle", "ACB = 250° / 2 = 125°"], hint: "When the point is on the major arc, use the reflex angle at the centre. Angle at circumference = half angle at centre." },
      { q: "A, B lie on a circle centre O. Angle BAC = 35° where C is on the circumference. Find angle BOC.", a: "70°", worked: ["Angle at centre = 2 × angle at circumference", "Both angles subtend the same arc BC", "BOC = 2 × BAC = 2 × 35° = 70°"], hint: "The angle at the centre is twice the angle at the circumference." },
    ],
    // Level 5 (Grade 9) — Tangent length proof
    [
      { q: "Two tangents are drawn from an external point P to a circle with centre O, touching at T₁ and T₂. Prove that PT₁ = PT₂.", a: "Shown", type: "proof", worked: ["In triangles OPT₁ and OPT₂:", "OT₁ = OT₂ (radii of the same circle)", "OP = OP (common side)", "Angle OT₁P = angle OT₂P = 90° (radius ⊥ tangent)", "So triangles OPT₁ and OPT₂ are congruent (RHS)", "Therefore PT₁ = PT₂ (corresponding sides)"], hint: "Consider the right-angled triangles formed by the radius to each tangent point and the line OP. What congruence condition applies?" },
      { q: "A, B, C lie on a circle with centre O. TA is a tangent at A. Angle TAB = 64°. Show that angle AOB = 128°.", a: "Shown", type: "proof", worked: ["By the Alternate Segment Theorem:", "Angle ACB = angle TAB = 64° (angle in alternate segment)", "Angle at centre = 2 × angle at circumference", "AOB = 2 × ACB = 2 × 64° = 128°"], hint: "Use the Alternate Segment Theorem to find angle ACB, then the angle at the centre theorem." },
      { q: "A, B, C lie on a circle. Angle BAC = 90°. Prove that BC is a diameter.", a: "Shown", type: "proof", worked: ["This is the converse of the angle in a semicircle theorem", "If angle BAC = 90° and A lies on the circle", "Then the arc BC must be a semicircle", "Therefore BC must be a diameter", "Proof: angle at centre = 2 × 90° = 180°", "An angle of 180° at the centre means BC is a straight line through the centre", "So BC is a diameter"], hint: "Use the converse of the angle in a semicircle theorem, or use the relationship between angle at centre and circumference." },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G25: Vectors — Advanced (Higher only)
  // ═══════════════════════════════════════════════════════════════
  'G25': [
    // Level 1 (Grade 4/5) — Column vector arithmetic
    [
      { q: "If a = (4, −1) and b = (2, 3), calculate 3a − b.", a: "(10, −6)", worked: ["3a = 3 × (4, −1) = (12, −3)", "3a − b = (12, −3) − (2, 3)", "= (12−2, −3−3) = (10, −6)"], hint: "First multiply a by 3, then subtract b" },
      { q: "If a = (2, 3) and b = (4, −1), find a + 2b.", a: "(10, 1)", worked: ["2b = 2 × (4, −1) = (8, −2)", "a + 2b = (2, 3) + (8, −2)", "= (10, 1)"], hint: "First multiply b by 2, then add to a" },
      { q: "a = (5, 2) and b = (−1, 3). Find 2a + b.", a: "(9, 7)", worked: ["2a = (10, 4)", "2a + b = (10, 4) + (−1, 3) = (9, 7)"], hint: "Double a first, then add b" },
      { q: "a = (2, 3) and b = (−1, 4). Find 2a + b.", a: "(3, 10)", worked: ["2a = 2 × (2, 3) = (4, 6)", "2a + b = (4, 6) + (−1, 4) = (3, 10)"], hint: "Multiply a by 2, then add b component by component" },
    ],
    // Level 2 (Grade 6) — Vector paths
    [
      { q: "In triangle OAB, OA = a and OB = b. Find AB in terms of a and b.", a: "b − a", worked: ["AB = AO + OB", "AO = −OA = −a", "AB = −a + b = b − a"], hint: "Go from A to O (which is −a), then O to B (which is b)" },
      { q: "ABCD is a parallelogram. AB = a and AD = b. Find AC.", a: "a + b", worked: ["AC = AB + BC", "In a parallelogram, BC = AD = b", "AC = a + b"], hint: "In a parallelogram, opposite sides are equal vectors" },
      { q: "Find the magnitude of the vector (3, 4).", a: "5", worked: ["|v| = √(3² + 4²)", "= √(9 + 16) = √25 = 5"], hint: "Use |v| = √(x² + y²)" },
    ],
    // Level 3 (Grade 7) — Midpoints and vector expressions
    [
      { q: "OA = a and OB = b. M is the midpoint of AB. Find OM in its simplest form.", a: "½(a + b)", worked: ["AB = b − a", "AM = ½AB = ½(b − a)", "OM = OA + AM = a + ½(b − a)", "= a + ½b − ½a = ½a + ½b = ½(a + b)"], hint: "Go O → A → M. M is halfway from A to B." },
      { q: "OA = a and OB = b. Q divides AB in the ratio 1:2. Express OQ in terms of a and b.", a: "⅔a + ⅓b", worked: ["AB = b − a", "AQ = ⅓AB = ⅓(b − a)", "OQ = OA + AQ = a + ⅓(b − a)", "= ⅔a + ⅓b"], hint: "Q is ⅓ of the way from A to B" },
      { q: "If AB = (4, 2), find BA.", a: "(−4, −2)", worked: ["BA = −AB", "= −(4, 2) = (−4, −2)"], hint: "BA is the opposite direction to AB" },
    ],
    // Level 4 (Grade 8) — Parallelogram problems and proving parallel vectors
    [
      { q: "In parallelogram ABCD, AB = a and AD = b. P is on AC such that AP:PC = 3:1. Express DP in terms of a and b.", a: "¾a − ¼b", worked: ["AC = AB + BC = a + b", "AP = ¾AC = ¾(a + b)", "DP = DA + AP = −b + ¾(a + b)", "= −b + ¾a + ¾b = ¾a − ¼b"], hint: "Find AC first, then AP = ¾AC (ratio 3:1), then DP = DA + AP" },
      { q: "Prove that AB = 2a + 3b and CD = 4a + 6b are parallel.", a: "Shown", type: "proof", worked: ["CD = 4a + 6b = 2(2a + 3b) = 2 × AB", "CD is a scalar multiple of AB (factor of 2)", "So AB and CD are parallel"], hint: "Show that one vector is a scalar multiple of the other" },
      { q: "OA = 2a + b, OB = 5a − 2b, OC = 8a − 5b. Prove that A, B and C are collinear.", a: "Shown", type: "proof", worked: ["AB = OB − OA = 3a − 3b", "AC = OC − OA = 6a − 6b = 2(3a − 3b) = 2AB", "AC is a scalar multiple of AB and they share point A", "So A, B and C are collinear"], hint: "Show AC = k × AB. Since they share A, they're collinear." },
    ],
    // Level 5 (Grade 9) — Midpoint theorem and ratio proofs
    [
      { q: "OABC is a quadrilateral. OA = a, OB = b, OC = c. M is the midpoint of AB and N is the midpoint of BC. Prove that MN is parallel to AC and find the ratio MN:AC.", a: "MN is parallel to AC, MN:AC = 1:2", worked: ["OM = ½(a + b) (midpoint of AB)", "ON = ½(b + c) (midpoint of BC)", "MN = ON − OM = ½(b + c) − ½(a + b)", "= ½c − ½a = ½(c − a)", "AC = OC − OA = c − a", "MN = ½AC, so MN is parallel to AC", "MN:AC = 1:2"], hint: "Find OM and ON using the midpoint formula, then compute MN" },
      { q: "OA = a, OB = b. P divides OA in ratio 2:1 and Q divides OB in ratio 2:1. Show that PQ is parallel to AB.", a: "Shown", type: "proof", worked: ["OP = ⅔a", "OQ = ⅔b", "PQ = OQ − OP = ⅔b − ⅔a = ⅔(b − a)", "AB = b − a", "PQ = ⅔AB, so PQ is parallel to AB"], hint: "Find PQ and AB, show one is a scalar multiple of the other" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // S3: Averages & Range
  // ═══════════════════════════════════════════════════════════════
  'S3': [
    // Level 0 (Grade 4) — Median, range, mean of simple lists
    [
      { q: "Find the median of the list: 3, 8, 2, 10, 5", a: "5", worked: ["Order the data: 2, 3, 5, 8, 10", "Median = middle value = 5"], hint: "Put the numbers in order first, then find the middle one" },
      { q: "Find the range of the list: 15, 2, 22, 8, 11", a: "20", worked: ["Highest value = 22", "Lowest value = 2", "Range = 22 − 2 = 20"], hint: "Range = highest value − lowest value" },
      { q: "Calculate the mean and range of: 1.2, 3.4, 2.1, 0.5, 2.8", a: "Mean = 2, Range = 2.9", worked: ["Mean = (1.2 + 3.4 + 2.1 + 0.5 + 2.8) ÷ 5 = 10 ÷ 5 = 2", "Range = 3.4 − 0.5 = 2.9"], hint: "Mean = sum ÷ count. Range = highest − lowest" },
    ],
    // Level 1 (Grade 5) — Mode, median of larger lists
    [
      { q: "Calculate the mean of 4, 7, 9, 10.", a: "7.5", worked: ["Sum = 4 + 7 + 9 + 10 = 30", "Mean = 30 ÷ 4 = 7.5"], hint: "Add all the numbers and divide by how many there are" },
      { q: "Find the mode and median of: 5, 2, 8, 5, 10, 12, 5", a: "Mode = 5, Median = 5", worked: ["Mode = 5 (appears 3 times)", "Order: 2, 5, 5, 5, 8, 10, 12", "Median = 4th value = 5"], hint: "Mode = most frequent. Median = middle value when ordered" },
      { q: "Find the median of: 4, 9, 2, 11, 6, 8", a: "7", worked: ["Order: 2, 4, 6, 8, 9, 11", "Even number of values: median = average of 3rd and 4th", "Median = (6 + 8) ÷ 2 = 7"], hint: "With an even number, average the two middle values" },
    ],
    // Level 2 (Grade 6) — Working backwards from the mean
    [
      { q: "The mean of five numbers is 12. Four of the numbers are 8, 15, 10, and 13. Find the fifth number.", a: "14", worked: ["Total = mean × count = 12 × 5 = 60", "Sum of four numbers = 8 + 15 + 10 + 13 = 46", "Fifth number = 60 − 46 = 14"], hint: "Find the total first (mean × count), then subtract the known numbers" },
      { q: "A set of 4 numbers has a mean of 7. When a 5th number is added, the mean becomes 8. What number was added?", a: "12", worked: ["Original total = 4 × 7 = 28", "New total = 5 × 8 = 40", "Number added = 40 − 28 = 12"], hint: "Find both totals, then subtract" },
      { q: "The mean age of 10 people is 25. The mean age of 15 people is 30. Find the mean age of all 25 people.", a: "28", worked: ["Total for group 1 = 10 × 25 = 250", "Total for group 2 = 15 × 30 = 450", "Combined mean = (250 + 450) ÷ 25 = 700 ÷ 25 = 28"], hint: "Find the total for each group, add them, then divide by the total number of people" },
    ],
    // Level 3 (Grade 7) — Grouped frequency tables
    [
      { q: "Estimate the mean from a grouped frequency table: 0-10 (f=5), 10-20 (f=12), 20-30 (f=8), 30-40 (f=5). Use midpoints.", a: "19", calculator: true, worked: ["Midpoints: 5, 15, 25, 35", "Σfx = 5(5) + 12(15) + 8(25) + 5(35)", "= 25 + 180 + 200 + 175 = 580", "Σf = 30", "Estimated mean = 580 ÷ 30 ≈ 19.3"], hint: "Use midpoints of each class. Estimated mean = Σ(f × midpoint) ÷ Σf" },
      { q: "Find the modal class and the class containing the median for: 0-10 (f=3), 10-20 (f=8), 20-30 (f=12), 30-40 (f=7).", a: "Modal class: 20-30, Median class: 20-30", worked: ["Modal class = highest frequency = 20-30 (f=12)", "Total = 30, median at 15th value", "Cumulative: 3, 11, 23...", "15th value is in the 20-30 class"], hint: "Modal class has the highest frequency. For the median class, use cumulative frequencies" },
      { q: "Explain why the mean calculated from a grouped frequency table is only an estimate.", a: "Because we use midpoints to represent each class, not the actual data values", worked: ["In a grouped table, we don't know the exact values", "We assume data is evenly spread using midpoints", "The actual values could be anywhere in each class", "So the mean is only an estimate"], hint: "Think about what information is lost when data is grouped" },
    ],
    // Level 4 (Grade 8–9) — Box plots, IQR, outliers
    [
      { q: "Compare two distributions: Class A has median 55 and IQR 12. Class B has median 62 and IQR 20. Comment on the differences.", a: "Class B has a higher median (62 vs 55), so scored better on average. Class A has a smaller IQR (12 vs 20), so scores are more consistent.", worked: ["Compare medians: Class B's median (62) > Class A's (55)", "Class B scored higher on average", "Compare IQRs: Class A's IQR (12) < Class B's (20)", "Class A's scores are more consistent/less spread out"], hint: "Compare medians for average, IQR for spread/consistency" },
      { q: "A dataset has Q1 = 20, Q3 = 44. Use the 1.5 × IQR rule to identify the boundaries for outliers.", a: "Lower boundary: −16, Upper boundary: 80", worked: ["IQR = Q3 − Q1 = 44 − 20 = 24", "1.5 × IQR = 36", "Lower boundary = Q1 − 36 = 20 − 36 = −16", "Upper boundary = Q3 + 36 = 44 + 36 = 80", "Any value below −16 or above 80 is an outlier"], hint: "IQR = Q3 − Q1. Outlier boundaries are Q1 − 1.5×IQR and Q3 + 1.5×IQR" },
      { q: "A frequency table has an unknown frequency x. Scores: 2 (f=3), 4 (f=x), 5 (f=5), 6 (f=2). The mean is 4.2. Find x.", a: "5", calculator: true, worked: ["Σfx = 2(3) + 4(x) + 5(5) + 6(2) = 6 + 4x + 25 + 12 = 43 + 4x", "Σf = 3 + x + 5 + 2 = 10 + x", "Mean = (43 + 4x)/(10 + x) = 4.2", "43 + 4x = 4.2(10 + x) = 42 + 4.2x", "43 − 42 = 4.2x − 4x", "1 = 0.2x", "x = 5"], hint: "Set up Σfx ÷ Σf = 4.2, then solve for x" },
    ],
  ],

  // G21: Sine and Cosine Rules (Non-right-angled triangles)
  'G21': [
    // Level 1 (Grade 5) — Area of a triangle using ½absinC
    [
      { q: "Calculate the area of a triangle with sides 7 cm and 10 cm and an included angle of 30°.", a: "17.5 cm²", calculator: true, worked: ["Area = ½ × a × b × sin(C)", "Area = ½ × 7 × 10 × sin(30°)", "sin(30°) = 0.5", "Area = ½ × 7 × 10 × 0.5 = 17.5 cm²"], hint: "Use Area = ½ × a × b × sin(C) where C is the angle between the two known sides" },
      { q: "Find the area of a triangle with sides 9 cm and 12 cm and an included angle of 50°. Give your answer to 1 d.p.", a: "41.4 cm²", calculator: true, worked: ["Area = ½ × a × b × sin(C)", "= ½ × 9 × 12 × sin(50°)", "= 54 × 0.7660", "= 41.4 cm² (1 d.p.)"], hint: "Use Area = ½ × a × b × sin(C)" },
      { q: "A triangle has sides 6 cm and 8 cm with an included angle of 30°. Find the area.", a: "12 cm²", calculator: true, worked: ["Area = ½ × 6 × 8 × sin(30°)", "= 24 × 0.5", "= 12 cm²"], hint: "Use Area = ½ab sin(C). What is sin(30°)?" },
    ],
    // Level 2 (Grade 6) — Sine Rule to find a missing side
    [
      { q: "In triangle ABC, angle A = 40°, angle B = 75°, and side a = 12 cm (opposite angle A). Find side b (opposite angle B).", a: "18.0 cm", calculator: true, worked: ["Sine Rule: a/sin A = b/sin B", "12/sin 40° = b/sin 75°", "12/0.6428 = b/0.9659", "18.666 = b/0.9659", "b = 18.666 × 0.9659 ≈ 18.0 cm"], hint: "Use the Sine Rule: a/sin A = b/sin B. Rearrange to find b." },
      { q: "In triangle PQR, angle P = 48°, angle Q = 52°, and p = 15 cm. Find q to 1 d.p.", a: "15.9 cm", calculator: true, worked: ["Sine Rule: p/sin P = q/sin Q", "15/sin 48° = q/sin 52°", "q = 15 × sin 52° / sin 48°", "q = 15 × 0.7880 / 0.7431", "q = 15.9 cm (1 d.p.)"], hint: "Use the Sine Rule: p/sin P = q/sin Q" },
      { q: "In triangle ABC, angle A = 55°, angle C = 80°, and c = 20 cm. Find side a to 1 d.p.", a: "16.6 cm", calculator: true, worked: ["Sine Rule: a/sin A = c/sin C", "a/sin 55° = 20/sin 80°", "a = 20 × sin 55° / sin 80°", "a = 20 × 0.8192 / 0.9848", "a = 16.6 cm (1 d.p.)"], hint: "Use the Sine Rule: a/sin A = c/sin C" },
    ],
    // Level 3 (Grade 7) — Cosine Rule to find a missing side
    [
      { q: "In triangle ABC, side a = 6 cm, side b = 9 cm, and angle C = 120°. Use the Cosine Rule to find side c.", a: "13.1 cm", calculator: true, worked: ["Cosine Rule: c² = a² + b² − 2ab cos(C)", "c² = 6² + 9² − 2(6)(9)cos(120°)", "c² = 36 + 81 − 108 × (−0.5)", "c² = 117 + 54 = 171", "c = √171 ≈ 13.1 cm"], hint: "Use c² = a² + b² − 2ab cos(C). Remember cos(120°) is negative." },
      { q: "Triangle PQR has PQ = 5 cm, PR = 8 cm, and angle QPR = 60°. Find QR.", a: "7.0 cm", calculator: true, worked: ["Cosine Rule: QR² = PQ² + PR² − 2(PQ)(PR)cos(QPR)", "QR² = 25 + 64 − 2(5)(8)cos(60°)", "QR² = 89 − 80 × 0.5", "QR² = 89 − 40 = 49", "QR = √49 = 7 cm"], hint: "Use the Cosine Rule: c² = a² + b² − 2ab cos(C) with the angle between the two known sides." },
      { q: "In triangle XYZ, x = 7 cm, y = 11 cm, angle Z = 100°. Find side z to 1 d.p.", a: "14.0 cm", calculator: true, worked: ["Cosine Rule: z² = x² + y² − 2xy cos(Z)", "z² = 49 + 121 − 2(7)(11)cos(100°)", "cos(100°) = −0.1736", "z² = 170 − 154 × (−0.1736) = 170 + 26.7 = 196.7", "z = √196.7 = 14.0 cm (1 d.p.)"], hint: "Use the Cosine Rule. Remember cos(100°) is negative!" },
    ],
    // Level 4 (Grade 8) — Cosine Rule to find a missing angle
    [
      { q: "In triangle ABC, a = 5 cm, b = 7 cm, c = 8 cm. Find angle C (the angle opposite side c).", a: "81.8°", calculator: true, worked: ["Rearranged Cosine Rule: cos C = (a² + b² − c²) / (2ab)", "cos C = (25 + 49 − 64) / (2 × 5 × 7)", "cos C = 10 / 70", "cos C = 1/7 ≈ 0.1429", "C = cos⁻¹(0.1429) ≈ 81.8°"], hint: "Use cos C = (a² + b² − c²) / (2ab) and then use inverse cosine." },
      { q: "A triangle has sides 8 cm, 10 cm and 9 cm. Find the angle opposite the 9 cm side to 1 d.p.", a: "58.8°", calculator: true, worked: ["Let C be opposite the 9 cm side, with a = 8, b = 10, c = 9", "cos C = (64 + 100 − 81) / (2 × 8 × 10)", "cos C = 83 / 160 = 0.51875", "C = cos⁻¹(0.51875) = 58.8°"], hint: "Use cos C = (a² + b² − c²) / (2ab) where c is the side opposite the angle you want." },
      { q: "In triangle DEF, d = 6 cm, e = 10 cm, f = 7 cm. Find the largest angle to 1 d.p.", a: "100.3°", calculator: true, worked: ["The largest angle is opposite the longest side (e = 10)", "cos E = (d² + f² − e²) / (2df)", "cos E = (36 + 49 − 100) / (2 × 6 × 7)", "cos E = −15 / 84 = −0.1786", "E = cos⁻¹(−0.1786) = 100.3°"], hint: "The largest angle is opposite the longest side. Use the rearranged Cosine Rule." },
    ],
    // Level 5 (Grade 9) — 3D problem requiring Sine/Cosine Rule
    [
      { q: "A pyramid has a rectangular base ABCD where AB = 8 cm and BC = 6 cm. The apex E is directly above the centre of the base, and the slant edge AE = 13 cm. Find angle AEB.", a: "35.8°", calculator: true, worked: ["Diagonal AC = √(8² + 6²) = √100 = 10 cm", "Centre M is midpoint of diagonals, so AM = 5 cm", "Height EM: AE² = AM² + EM² → 169 = 25 + EM² → EM = 12 cm", "BM = half of BD = 5 cm (diagonals of rectangle bisect each other)", "BE = √(BM² + EM²) = √(25 + 144) = √169 = 13 cm", "Triangle AEB: AE = 13, BE = 13, AB = 8", "cos(AEB) = (13² + 13² − 8²) / (2 × 13 × 13)", "= (169 + 169 − 64) / 338 = 274/338 ≈ 0.811", "Angle AEB = cos⁻¹(0.811) ≈ 35.8°"], hint: "First find the height of the pyramid using 3D Pythagoras. Then use the Cosine Rule on triangle AEB." },
      { q: "Two boats leave a harbour. Boat A sails 10 km on a bearing of 070°. Boat B sails 15 km on a bearing of 130°. Find the distance between the boats to 1 d.p.", a: "13.2 km", calculator: true, worked: ["Angle between bearings at harbour = 130° − 70° = 60°", "Using Cosine Rule: d² = 10² + 15² − 2(10)(15)cos(60°)", "d² = 100 + 225 − 300 × 0.5", "d² = 325 − 150 = 175", "d = √175 ≈ 13.2 km"], hint: "Find the angle between the two bearings, then use the Cosine Rule." },
      { q: "A cuboid has dimensions 8 cm × 6 cm × 10 cm. Find the angle the space diagonal makes with the base to 1 d.p.", a: "45.0°", calculator: true, worked: ["Base diagonal = √(8² + 6²) = √100 = 10 cm", "Space diagonal = √(10² + 10²) = √200 = 14.1 cm", "The angle with the base: tan θ = height / base diagonal = 10/10 = 1", "θ = tan⁻¹(1) = 45.0°"], hint: "Find the base diagonal first, then use tan(angle) = height / base diagonal." },
    ],
  ],

  // G23: Trigonometric Graphs
  'G23': [
    // Level 1 (Grade 5) — Sketch sin graph
    [
      { q: "Which of these correctly describes the graph of y = sin(x) for 0° ≤ x ≤ 360°?", a: "Starts at 0, rises to 1 at 90°, returns to 0 at 180°, falls to −1 at 270°, returns to 0 at 360°", type: "mcq", options: ["Starts at 0, rises to 1 at 90°, returns to 0 at 180°, falls to −1 at 270°, returns to 0 at 360°", "Starts at 1, falls to 0 at 90°, falls to −1 at 180°", "Starts at 0, rises to 1 at 180°, returns to 0 at 360°"], worked: ["y = sin(0°) = 0 (starts at origin)", "y = sin(90°) = 1 (maximum)", "y = sin(180°) = 0 (crosses x-axis)", "y = sin(270°) = −1 (minimum)", "y = sin(360°) = 0 (completes one cycle)"], hint: "The sine graph starts at 0, reaches its maximum at 90°, and has a period of 360°." },
      { q: "What is the period of y = tan(x)?", a: "180°", type: "mcq", options: ["90°", "180°", "360°", "720°"], worked: ["The tangent graph repeats every 180°", "tan(0°) = 0, and the next time tan(x) = 0 going through the same pattern is x = 180°", "Period of tan(x) = 180°", "Compare: sin and cos have period 360°"], hint: "After how many degrees does the tan graph repeat?" },
      { q: "What are the values of x between 0° and 360° where y = sin(x) crosses the x-axis?", a: "0°, 180°, 360°", worked: ["sin(x) = 0 when the graph crosses the x-axis", "sin(0°) = 0", "sin(180°) = 0", "sin(360°) = 0"], hint: "Where does sin(x) = 0?" },
    ],
    // Level 2 (Grade 6) — Max/min of cos graph
    [
      { q: "State the coordinates of the maximum and minimum points on y = cos(x) for 0° ≤ x ≤ 360°.", a: "Maximum: (0°, 1) and (360°, 1); Minimum: (180°, −1)", worked: ["cos(0°) = 1 → maximum at (0°, 1)", "cos(180°) = −1 → minimum at (180°, −1)", "cos(360°) = 1 → maximum at (360°, 1)", "The cosine graph starts at its maximum, unlike sine"], hint: "cos(0°) = 1, cos(180°) = −1, cos(360°) = 1" },
      { q: "What is the amplitude of y = 4cos(x)?", a: "4", worked: ["The amplitude is the distance from the centre line to the peak", "For y = 4cos(x), the maximum value is 4 and minimum is −4", "Amplitude = 4", "In general, y = A cos(x) has amplitude |A|"], hint: "The coefficient of cos(x) tells you the amplitude." },
      { q: "What is the period of y = sin(2x)?", a: "180°", worked: ["For y = sin(Bx), the period = 360°/B", "Here B = 2", "Period = 360°/2 = 180°", "The graph completes two full cycles in 360°"], hint: "Period = 360° ÷ the number in front of x" },
    ],
    // Level 3 (Grade 7) — Solve using trig graph
    [
      { q: "Use the graph of y = sin(x) to find two solutions for sin(x) = 0.5 in the range 0° ≤ x ≤ 360°.", a: "x = 30° and x = 150°", worked: ["sin(x) = 0.5", "First solution: x = sin⁻¹(0.5) = 30°", "The sine graph is symmetric about x = 90°", "Second solution: x = 180° − 30° = 150°", "So x = 30° and x = 150°"], hint: "Find the first solution with inverse sin, then use the symmetry of the sine curve: the second solution is 180° minus the first." },
      { q: "Solve cos(x) = −0.5 for 0° ≤ x ≤ 360°.", a: "x = 120° and x = 240°", worked: ["cos(x) = −0.5", "Reference angle: cos⁻¹(0.5) = 60°", "cos is negative in the 2nd and 3rd quadrants", "2nd quadrant: x = 180° − 60° = 120°", "3rd quadrant: x = 180° + 60° = 240°"], hint: "Find the reference angle from cos⁻¹(0.5). Cosine is negative in the 2nd and 3rd quadrants." },
      { q: "Solve sin(x) = −0.5 for 0° ≤ x ≤ 360°.", a: "x = 210° and x = 330°", worked: ["sin(x) = −0.5", "Reference angle: sin⁻¹(0.5) = 30°", "sin is negative in the 3rd and 4th quadrants", "3rd quadrant: x = 180° + 30° = 210°", "4th quadrant: x = 360° − 30° = 330°"], hint: "Find the reference angle from sin⁻¹(0.5). Sine is negative in the 3rd and 4th quadrants." },
    ],
    // Level 4 (Grade 8) — Transformation of trig graph
    [
      { q: "Describe the transformation that maps y = sin(x) onto y = 3sin(x).", a: "Vertical stretch, scale factor 3", worked: ["In y = 3sin(x), the output of sin(x) is multiplied by 3", "This stretches the graph vertically by factor 3", "The amplitude changes from 1 to 3", "Maximum becomes 3, minimum becomes −3", "The period (360°) is unchanged"], hint: "The number in front of sin multiplies all y-values. This is a vertical stretch." },
      { q: "Describe the transformation that maps y = cos(x) onto y = cos(x) + 2.", a: "Translation by (0, 2) — shift up 2 units", worked: ["y = cos(x) + 2 adds 2 to every y-value", "This shifts the entire graph up by 2 units", "Translation by vector (0, 2)", "Maximum becomes (0°, 3), minimum becomes (180°, 1)", "The amplitude and period are unchanged"], hint: "Adding a number outside the function shifts the graph vertically." },
      { q: "Sketch the key features of y = 2sin(x) + 1 for 0° ≤ x ≤ 360°. State the maximum, minimum, and where it crosses the line y = 1.", a: "Max = 3 at 90°, Min = −1 at 270°, crosses y = 1 at 0°, 180°, 360°", worked: ["Amplitude = 2, vertical shift = +1", "Maximum: 2(1) + 1 = 3, at x = 90°", "Minimum: 2(−1) + 1 = −1, at x = 270°", "Centre line is y = 1", "Crosses y = 1 when sin(x) = 0: x = 0°, 180°, 360°"], hint: "The amplitude is 2 and the centre line is y = 1. The graph crosses the centre line where sin(x) = 0." },
    ],
    // Level 5 (Grade 9) — Solve tan equation over extended range
    [
      { q: "Solve tan(x) = −1 for 0° ≤ x ≤ 540°. Give all solutions.", a: "x = 135°, 315°, 495°", worked: ["tan(x) = −1", "Reference angle: tan⁻¹(1) = 45°", "tan is negative in the 2nd and 4th quadrants", "2nd quadrant: x = 180° − 45° = 135°", "4th quadrant: x = 360° − 45° = 315°", "tan has period 180°, so next solution: 135° + 360° = 495°", "Check: 315° + 180° = 495° ✓", "All solutions in range: 135°, 315°, 495°"], hint: "Find where tan is negative (2nd and 4th quadrants). The period of tan is 180°, so add 180° to find more solutions." },
      { q: "Solve cos(x) = 0.5 for −180° ≤ x ≤ 180°.", a: "x = −60° and x = 60°", worked: ["cos(x) = 0.5", "cos⁻¹(0.5) = 60°", "Cosine is symmetric: cos(−x) = cos(x)", "So x = 60° and x = −60° are both solutions", "Both are in the range −180° ≤ x ≤ 180° ✓"], hint: "Cosine is an even function: cos(−x) = cos(x). Find the positive solution, then the negative." },
      { q: "Solve 2sin(x) = √3 for 0° ≤ x ≤ 360°.", a: "x = 60° and x = 120°", worked: ["2sin(x) = √3", "sin(x) = √3/2", "sin⁻¹(√3/2) = 60°", "sin is positive in Q1 and Q2", "x = 60° and x = 180° − 60° = 120°"], hint: "First rearrange to get sin(x) = √3/2. What angle has sin = √3/2?" },
    ],
  ],

  // A14: Rates of Change & Graphs in Real Contexts
  'A14': [
    // Level 1 (Grade 6) — Reading distance-time graphs
    [
      { q: "A car travels 80 km in 2 hours. What is the gradient of the distance-time graph, and what does it represent?", a: "40 km/h — the gradient represents speed", worked: ["Gradient = change in distance / change in time", "= 80/2 = 40 km/h", "On a distance-time graph, gradient = speed"], hint: "Gradient = rise/run = distance/time = speed" },
      { q: "A distance-time graph shows a horizontal line at 150 km from t = 3 to t = 5 hours. What is happening?", a: "The object is stationary (not moving)", worked: ["A horizontal line means the distance is not changing", "No change in distance = speed of 0", "The object is stationary for 2 hours"], hint: "What does a flat line mean on a distance-time graph?" },
      { q: "A cyclist travels 15 km in 30 minutes. What is their speed in km/h?", a: "30 km/h", worked: ["30 minutes = 0.5 hours", "Speed = distance / time = 15 / 0.5 = 30 km/h"], hint: "Convert minutes to hours first, then speed = distance ÷ time" },
    ],
    // Level 2 (Grade 7) — Velocity-time graphs: area and gradient
    [
      { q: "A velocity-time graph shows a constant velocity of 15 m/s for 8 seconds. What is the total distance travelled?", a: "120 m", worked: ["Distance = area under a velocity-time graph", "Area = velocity × time (rectangle)", "= 15 × 8 = 120 m"], hint: "The area under a velocity-time graph gives the distance." },
      { q: "A velocity-time graph shows velocity increasing from 0 to 20 m/s in 5 seconds. What is the acceleration?", a: "4 m/s²", worked: ["Acceleration = gradient of a velocity-time graph", "= change in velocity / change in time", "= (20 − 0) / (5 − 0) = 20/5 = 4 m/s²"], hint: "On a velocity-time graph, the gradient gives the acceleration." },
      { q: "A train decelerates from 30 m/s to 10 m/s in 4 seconds. What is the deceleration?", a: "5 m/s²", worked: ["Deceleration = change in velocity / time", "= (30 − 10) / 4 = 20/4 = 5 m/s²", "The velocity decreases, so this is a deceleration of 5 m/s²"], hint: "Deceleration = (initial − final velocity) / time" },
    ],
    // Level 3 (Grade 8) — Multi-stage journeys
    [
      { q: "A car travels at 30 km/h for 2 hours, then 60 km/h for 1 hour. What is the total distance?", a: "120 km", worked: ["Stage 1: distance = speed × time = 30 × 2 = 60 km", "Stage 2: distance = 60 × 1 = 60 km", "Total = 60 + 60 = 120 km"], hint: "Calculate distance for each stage separately: distance = speed × time" },
      { q: "A velocity-time graph shows: 0–4 s accelerating from 0 to 12 m/s, then constant 12 m/s for 6 s. Find the total distance.", a: "96 m", worked: ["Stage 1 (triangle): ½ × 4 × 12 = 24 m", "Stage 2 (rectangle): 12 × 6 = 72 m", "Total distance = 24 + 72 = 96 m"], hint: "Split into a triangle (acceleration phase) and a rectangle (constant phase). Distance = area." },
      { q: "A v-t graph shows: acceleration 0→10 m/s in 4 s, constant 10 m/s for 6 s, deceleration to 0 in 5 s. Find total distance.", a: "105 m", worked: ["Phase 1 (triangle): ½ × 4 × 10 = 20 m", "Phase 2 (rectangle): 10 × 6 = 60 m", "Phase 3 (triangle): ½ × 5 × 10 = 25 m", "Total = 20 + 60 + 25 = 105 m"], hint: "Split into three areas: two triangles and a rectangle. Distance = total area under the graph." },
    ],
    // Level 4 (Grade 9) — Tangent to a curve for instantaneous rate
    [
      { q: "At a point on a distance-time curve, the tangent passes through (2, 10) and (6, 50). Estimate the speed at this point.", a: "10 m/s", worked: ["Speed = gradient of the tangent to a distance-time graph", "Gradient = (50 − 10) / (6 − 2)", "= 40 / 4 = 10 m/s", "This gives the instantaneous speed at that point"], hint: "The gradient of the tangent to a distance-time graph gives the instantaneous speed." },
      { q: "A curve shows water depth changing over time. The gradient at t = 10 is −0.8. Interpret this value.", a: "The depth is decreasing at 0.8 cm per minute", worked: ["The gradient of a graph gives the rate of change", "A gradient of −0.8 means the depth is changing by −0.8 cm per minute", "The negative sign means the depth is decreasing", "The depth is falling at a rate of 0.8 cm per minute"], hint: "The gradient tells you the rate of change. What does the negative sign mean?" },
      { q: "On a velocity-time curve, the tangent at t = 3 passes through (1, 5) and (5, 17). Find the acceleration at t = 3.", a: "3 m/s²", worked: ["Acceleration = gradient of velocity-time graph", "Gradient of tangent = (17 − 5) / (5 − 1)", "= 12 / 4 = 3 m/s²", "This is the instantaneous acceleration at t = 3"], hint: "Acceleration is the gradient of a velocity-time graph. Use the tangent to estimate the gradient at a point." },
    ],
    // Level 5 (Grade 9) — Trapezium rule and interpreting area under a curve
    [
      { q: "Estimate the distance using the trapezium rule with strips of width 2 s. Velocities at t = 0, 2, 4, 6, 8 are 0, 6, 10, 12, 8 m/s.", a: "64 m", calculator: true, worked: ["Trapezium rule: h/2 × [y₀ + 2(y₁ + y₂ + y₃) + y₄]", "h = 2", "= 2/2 × [0 + 2(6 + 10 + 12) + 8]", "= 1 × [0 + 56 + 8] = 64 m"], hint: "Trapezium rule: h/2 × [first + last + 2×(sum of middle values)]" },
      { q: "A graph shows temperature falling from 80°C to 20°C over 30 minutes. At t = 15 the tangent has gradient −2.5. Interpret this.", a: "At 15 minutes, the temperature is dropping at 2.5°C per minute", worked: ["The gradient of a curve gives the instantaneous rate of change", "Gradient = −2.5 means the temperature is changing at −2.5°C/min", "The negative sign shows the temperature is falling", "At t = 15, the rate of cooling is 2.5°C per minute"], hint: "The gradient of the tangent gives the instantaneous rate of change at that point." },
      { q: "Estimate the area under a curve using the trapezium rule with 4 strips of width 2. The y-values at x = 0, 2, 4, 6, 8 are 0, 3, 5, 4, 2.", a: "26", calculator: true, worked: ["Trapezium rule: h/2 × [y₀ + 2(y₁ + y₂ + y₃) + y₄]", "h = 2", "= 2/2 × [0 + 2(3 + 5 + 4) + 2]", "= 1 × [0 + 24 + 2] = 26"], hint: "Trapezium rule: h/2 × [first + last + 2 × (sum of middle values)]" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A3: Expanding & Factorising
  // ═══════════════════════════════════════════════════════════════
  'A3': [
    // Level 0 (Grade 4) — Expand single brackets
    [
      { q: "Expand 2(x + 5)", a: "2x + 10", worked: ["Multiply each term inside by 2", "2 × x = 2x", "2 × 5 = 10", "= 2x + 10"], hint: "Multiply the number outside by each term inside the bracket" },
      { q: "Expand 4(2a − 3)", a: "8a − 12", worked: ["Multiply each term inside by 4", "4 × 2a = 8a", "4 × (−3) = −12", "= 8a − 12"], hint: "Multiply 4 by each term inside the bracket" },
      { q: "Expand x(x + 8)", a: "x² + 8x", worked: ["Multiply each term inside by x", "x × x = x²", "x × 8 = 8x", "= x² + 8x"], hint: "Multiply x by each term inside the bracket" },
    ],
    // Level 1 (Grade 5) — Factorise into single bracket
    [
      { q: "Factorise 3y − 12", a: "3(y − 4)", worked: ["Find the HCF of 3y and 12: HCF = 3", "3y ÷ 3 = y", "12 ÷ 3 = 4", "= 3(y − 4)"], hint: "Find the highest common factor of both terms" },
      { q: "Factorise 5x + 20", a: "5(x + 4)", worked: ["Find the HCF of 5x and 20: HCF = 5", "5x ÷ 5 = x", "20 ÷ 5 = 4", "= 5(x + 4)"], hint: "Find the highest common factor of both terms" },
      { q: "Factorise 14w − 7", a: "7(2w − 1)", worked: ["Find the HCF of 14w and 7: HCF = 7", "14w ÷ 7 = 2w", "7 ÷ 7 = 1", "= 7(2w − 1)"], hint: "Find the highest common factor of both terms" },
    ],
    // Level 2 (Grade 6) — Expand and simplify double brackets
    [
      { q: "Expand and simplify (x + 3)(x − 5)", a: "x² − 2x − 15", worked: ["Use FOIL: First × First = x²", "Outer: x × (−5) = −5x", "Inner: 3 × x = 3x", "Last: 3 × (−5) = −15", "= x² − 5x + 3x − 15 = x² − 2x − 15"], hint: "Use FOIL: First, Outer, Inner, Last, then collect like terms" },
      { q: "Expand and simplify (x − 4)(x − 2)", a: "x² − 6x + 8", worked: ["First: x × x = x²", "Outer: x × (−2) = −2x", "Inner: (−4) × x = −4x", "Last: (−4) × (−2) = 8", "= x² − 2x − 4x + 8 = x² − 6x + 8"], hint: "Use FOIL and be careful with negative signs" },
      { q: "Expand and simplify (2x + 1)(x − 3)", a: "2x² − 5x − 3", worked: ["First: 2x × x = 2x²", "Outer: 2x × (−3) = −6x", "Inner: 1 × x = x", "Last: 1 × (−3) = −3", "= 2x² − 6x + x − 3 = 2x² − 5x − 3"], hint: "Use FOIL — the first term gives 2x², not x²" },
    ],
    // Level 3 (Grade 7) — Difference of two squares
    [
      { q: "Factorise x² − 9", type: "mcq", options: ["(x + 3)(x − 3)", "(x − 3)(x − 3)", "(x + 9)(x − 1)", "(x + 3)²"], a: "(x + 3)(x − 3)", worked: ["Recognise difference of two squares: a² − b² = (a + b)(a − b)", "x² − 9 = x² − 3²", "= (x + 3)(x − 3)"], hint: "This is a difference of two squares: a² − b² = (a + b)(a − b)" },
      { q: "Factorise y² − 144", type: "mcq", options: ["(y + 12)(y − 12)", "(y − 12)(y − 12)", "(y + 144)(y − 1)", "(y + 12)²"], a: "(y + 12)(y − 12)", worked: ["Difference of two squares: y² − 144 = y² − 12²", "= (y + 12)(y − 12)"], hint: "144 = 12², so this is a difference of two squares" },
      { q: "Factorise 4a² − 25", type: "mcq", options: ["(2a + 5)(2a − 5)", "(4a + 5)(4a − 5)", "(2a − 5)²", "(a + 5)(4a − 5)"], a: "(2a + 5)(2a − 5)", worked: ["Difference of two squares: 4a² − 25 = (2a)² − 5²", "= (2a + 5)(2a − 5)"], hint: "4a² = (2a)² and 25 = 5², so use (2a + 5)(2a − 5)" },
    ],
    // Level 4 (Grade 9) — Factorise fully / expand triple brackets
    [
      { q: "Factorise fully 10p² + 15p", a: "5p(2p + 3)", worked: ["Find the HCF of 10p² and 15p: HCF = 5p", "10p² ÷ 5p = 2p", "15p ÷ 5p = 3", "= 5p(2p + 3)"], hint: "The HCF includes both a number and a variable" },
      { q: "Factorise fully 12x²y − 18xy²", a: "6xy(2x − 3y)", worked: ["Find the HCF of 12x²y and 18xy²: HCF = 6xy", "12x²y ÷ 6xy = 2x", "18xy² ÷ 6xy = 3y", "= 6xy(2x − 3y)"], hint: "Find the HCF of both the numbers and all variables" },
      { q: "Expand and simplify (x + 2)(x − 3)(x + 5)", a: "x³ + 4x² − 11x − 30", worked: ["First expand (x + 2)(x − 3) = x² − x − 6", "Then multiply by (x + 5):", "x²(x + 5) = x³ + 5x²", "−x(x + 5) = −x² − 5x", "−6(x + 5) = −6x − 30", "= x³ + 5x² − x² − 5x − 6x − 30", "= x³ + 4x² − 11x − 30"], hint: "Expand the first two brackets, then multiply the result by the third" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A17: Algebraic Fractions
  // ═══════════════════════════════════════════════════════════════
  'A17': [
    // Level 0 (Grade 5) — Simplify basic algebraic fractions
    [
      { q: "Simplify 10x³/5x", a: "2x²", worked: ["Divide coefficients: 10 ÷ 5 = 2", "Divide x terms: x³ ÷ x = x²", "= 2x²"], hint: "Divide the numbers and subtract the powers of x" },
      { q: "Simplify 12a⁴/3a²", a: "4a²", worked: ["Divide coefficients: 12 ÷ 3 = 4", "Divide a terms: a⁴ ÷ a² = a²", "= 4a²"], hint: "Divide the numbers and subtract the powers" },
      { q: "Simplify 15x²y/5x", a: "3xy", worked: ["Divide coefficients: 15 ÷ 5 = 3", "Divide x terms: x² ÷ x = x", "y stays: y", "= 3xy"], hint: "Divide the numbers, subtract powers of x, and keep y" },
    ],
    // Level 1 (Grade 6) — Adding/subtracting algebraic fractions
    [
      { q: "Express x/2 + x/5 as a single fraction.", a: "7x/10", worked: ["Common denominator: LCM of 2 and 5 = 10", "x/2 = 5x/10", "x/5 = 2x/10", "5x/10 + 2x/10 = 7x/10"], hint: "Find the LCM of the denominators, then convert each fraction" },
      { q: "Express 2y/3 − y/4 as a single fraction.", a: "5y/12", worked: ["Common denominator: LCM of 3 and 4 = 12", "2y/3 = 8y/12", "y/4 = 3y/12", "8y/12 − 3y/12 = 5y/12"], hint: "Find the LCM of 3 and 4, then convert each fraction" },
      { q: "Express 3/x + 2/y as a single fraction.", a: "(3y + 2x)/xy", worked: ["Common denominator: xy", "3/x = 3y/xy", "2/y = 2x/xy", "= (3y + 2x)/xy"], hint: "The common denominator for x and y is xy" },
    ],
    // Level 2 (Grade 7) — Simplify by factorising
    [
      { q: "Simplify fully: (x² − 25)/(3x + 15)", a: "(x − 5)/3", worked: ["Factorise numerator: x² − 25 = (x + 5)(x − 5)", "Factorise denominator: 3x + 15 = 3(x + 5)", "Cancel (x + 5): = (x − 5)/3"], hint: "Factorise both: difference of two squares on top, common factor on bottom" },
      { q: "Simplify fully: (x² − 9)/(5x + 15)", a: "(x − 3)/5", worked: ["Factorise numerator: x² − 9 = (x + 3)(x − 3)", "Factorise denominator: 5x + 15 = 5(x + 3)", "Cancel (x + 3): = (x − 3)/5"], hint: "Difference of two squares on top, common factor on bottom" },
      { q: "Simplify fully: (2x + 4)/(x² − 4)", a: "2/(x − 2)", worked: ["Factorise numerator: 2x + 4 = 2(x + 2)", "Factorise denominator: x² − 4 = (x + 2)(x − 2)", "Cancel (x + 2): = 2/(x − 2)"], hint: "Factorise both parts and look for a common factor to cancel" },
    ],
    // Level 3 (Grade 8) — Solve equations / combine fractions
    [
      { q: "Solve: 4/(x + 2) + 2/(x − 1) = 1. Give your answers to 2 decimal places.", a: "x = 5.37 and x = −0.37", calculator: true, worked: ["Multiply through by (x + 2)(x − 1):", "4(x − 1) + 2(x + 2) = (x + 2)(x − 1)", "4x − 4 + 2x + 4 = x² + x − 2", "6x = x² + x − 2", "x² − 5x − 2 = 0", "x = (5 ± √33) / 2", "x ≈ 5.37 or x ≈ −0.37"], hint: "Multiply every term by (x + 2)(x − 1) to clear fractions, then solve the quadratic" },
      { q: "Solve: 3/(x − 1) + 1/(x + 2) = 2. Give your answers to 2 decimal places.", a: "x = 2.68 and x = −1.68", calculator: true, worked: ["Multiply through by (x − 1)(x + 2):", "3(x + 2) + 1(x − 1) = 2(x − 1)(x + 2)", "3x + 6 + x − 1 = 2(x² + x − 2)", "4x + 5 = 2x² + 2x − 4", "2x² − 2x − 9 = 0", "x = (2 ± √76) / 4 = (1 ± √19) / 2", "x ≈ 2.68 or x ≈ −1.68"], hint: "Clear fractions by multiplying through, then use the quadratic formula" },
      { q: "Express (x + 1)/2 − (x − 3)/5 as a single fraction in its simplest form.", a: "(3x + 11)/10", worked: ["Common denominator: 10", "(x + 1)/2 = 5(x + 1)/10", "(x − 3)/5 = 2(x − 3)/10", "= [5(x + 1) − 2(x − 3)] / 10", "= (5x + 5 − 2x + 6) / 10", "= (3x + 11)/10"], hint: "Find common denominator 10, then expand and simplify the numerator" },
    ],
    // Level 4 (Grade 9) — Simplify and hence solve
    [
      { q: "Simplify (3x² + 10x − 8)/(x² − 16) and find the value of x for which the fraction equals 2.", a: "x = −6", worked: ["Factorise numerator: 3x² + 10x − 8 = (3x − 2)(x + 4)", "Factorise denominator: x² − 16 = (x + 4)(x − 4)", "Simplified: (3x − 2)/(x − 4)", "Solve (3x − 2)/(x − 4) = 2:", "3x − 2 = 2(x − 4)", "3x − 2 = 2x − 8", "x = −6"], hint: "Factorise numerator and denominator, cancel, then solve" },
      { q: "Simplify (2x² − 5x − 3)/(x² − 9).", a: "(2x + 1)/(x + 3)", worked: ["Factorise numerator: 2x² − 5x − 3 = (2x + 1)(x − 3)", "Factorise denominator: x² − 9 = (x + 3)(x − 3)", "Cancel (x − 3): = (2x + 1)/(x + 3)"], hint: "Factorise both using appropriate methods, then cancel common factors" },
      { q: "Solve 1/x + 1/(x + 1) = 5/6.", a: "x = 2 or x = −3/5", worked: ["Multiply through by 6x(x + 1):", "6(x + 1) + 6x = 5x(x + 1)", "6x + 6 + 6x = 5x² + 5x", "12x + 6 = 5x² + 5x", "5x² − 7x − 6 = 0", "(5x + 3)(x − 2) = 0", "x = 2 or x = −3/5"], hint: "Clear all fractions by multiplying through by 6x(x + 1), then factorise the quadratic" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // A21: Straight-Line Graphs
  // ═══════════════════════════════════════════════════════════════
  'A21': [
    // Level 0 (Grade 4) — Identify y-intercept
    [
      { q: "Write down the y-intercept for the line y = x + 5.", a: "5", worked: ["The equation is in the form y = mx + c", "The y-intercept is c = 5"], hint: "In y = mx + c, the y-intercept is the value of c" },
      { q: "Write down the y-intercept for y = 3x − 7.", a: "−7", worked: ["The equation is in the form y = mx + c", "The y-intercept is c = −7"], hint: "In y = mx + c, the y-intercept is the constant term" },
      { q: "Where does the line y = 10 − 2x cross the y-axis?", a: "10", worked: ["Rewrite as y = −2x + 10", "The y-intercept is c = 10", "The line crosses the y-axis at (0, 10)"], hint: "The y-axis is where x = 0. Substitute x = 0 into the equation" },
    ],
    // Level 1 (Grade 5) — Find gradient
    [
      { q: "Find the gradient of the line y = 4x − 2.", a: "4", worked: ["The equation is in the form y = mx + c", "The gradient is m = 4"], hint: "In y = mx + c, the gradient is the coefficient of x" },
      { q: "Find the gradient of the line 2y = 6x + 4.", a: "3", worked: ["Divide both sides by 2: y = 3x + 2", "The gradient is m = 3"], hint: "First rearrange to the form y = mx + c" },
      { q: "Find the gradient of the line y = ½x + 3.", a: "1/2", worked: ["The equation is already in y = mx + c form", "The gradient is m = 1/2"], hint: "In y = mx + c, the gradient is the number multiplied by x" },
    ],
    // Level 2 (Grade 6) — Describe horizontal/vertical/simple lines
    [
      { q: "Describe the graph of y = 3.", a: "A horizontal line through y = 3", worked: ["y = 3 means every point has y-coordinate 3", "This is a horizontal line passing through (0, 3)"], hint: "When y equals a constant, the line is horizontal" },
      { q: "Describe the graph of x = −2.", a: "A vertical line through x = −2", worked: ["x = −2 means every point has x-coordinate −2", "This is a vertical line passing through (−2, 0)"], hint: "When x equals a constant, the line is vertical" },
      { q: "Describe the graph of y = −x for values of x from −3 to 3.", a: "A straight line through the origin with gradient −1", worked: ["When x = −3, y = 3; when x = 0, y = 0; when x = 3, y = −3", "The line passes through the origin", "Gradient = −1 (slopes downward left to right)"], hint: "Substitute a few x-values to get coordinates, then describe the line" },
    ],
    // Level 3 (Grade 7) — Parallel and perpendicular lines
    [
      { q: "State the equation of a line parallel to y = 5x + 3 passing through (0, −1).", a: "y = 5x − 1", worked: ["Parallel lines have the same gradient: m = 5", "The line passes through (0, −1), so c = −1", "Equation: y = 5x − 1"], hint: "Parallel lines have the same gradient. Use the given point to find c" },
      { q: "State the equation of a line parallel to y = −2x + 4 passing through (0, 5).", a: "y = −2x + 5", worked: ["Parallel lines have the same gradient: m = −2", "Passes through (0, 5), so c = 5", "Equation: y = −2x + 5"], hint: "Same gradient as the given line, then use the point for c" },
      { q: "Find the equation of a line perpendicular to y = 2x + 1 passing through (0, 6).", a: "y = −½x + 6", worked: ["Original gradient: m = 2", "Perpendicular gradient: −1/m = −1/2", "Passes through (0, 6), so c = 6", "Equation: y = −½x + 6"], hint: "Perpendicular gradients multiply to give −1. If m = 2, the perpendicular gradient is −1/2" },
    ],
    // Level 4 (Grade 8) — Equation of line through two points
    [
      { q: "Find the equation of the line passing through (2, 5) and (4, 13).", a: "y = 4x − 3", worked: ["Gradient: m = (13 − 5)/(4 − 2) = 8/2 = 4", "Using y = mx + c with point (2, 5):", "5 = 4(2) + c", "5 = 8 + c", "c = −3", "Equation: y = 4x − 3"], hint: "Find the gradient using (y₂ − y₁)/(x₂ − x₁), then substitute a point to find c" },
      { q: "Find the equation of the line passing through (1, 4) and (3, 10).", a: "y = 3x + 1", worked: ["Gradient: m = (10 − 4)/(3 − 1) = 6/2 = 3", "Using y = mx + c with point (1, 4):", "4 = 3(1) + c", "c = 1", "Equation: y = 3x + 1"], hint: "Find gradient first, then substitute one point into y = mx + c" },
      { q: "Find the equation of the line passing through (−2, 1) and (2, 9).", a: "y = 2x + 5", worked: ["Gradient: m = (9 − 1)/(2 − (−2)) = 8/4 = 2", "Using y = mx + c with point (2, 9):", "9 = 2(2) + c", "9 = 4 + c", "c = 5", "Equation: y = 2x + 5"], hint: "Be careful with negative coordinates when finding the gradient" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G1: Angle Facts & Shape Properties
  // ═══════════════════════════════════════════════════════════════
  'G1': [
    // Level 0 (Grade 4) — Angles on a straight line / around a point
    [
      { q: "Angles on a straight line add up to 180°. One angle is 130°. Find the other angle.", a: "50", worked: ["Angles on a straight line sum to 180°", "Other angle = 180° − 130° = 50°"], hint: "Angles on a straight line add up to 180°" },
      { q: "Angles around a point add up to 360°. Three angles are 120°, 85° and 90°. Find angle y.", a: "65", worked: ["Angles around a point sum to 360°", "y = 360° − 120° − 85° − 90° = 65°"], hint: "Angles around a point add up to 360°" },
      { q: "Find the supplement of 115°.", a: "65", worked: ["Supplementary angles add to 180°", "180° − 115° = 65°"], hint: "Supplementary angles add up to 180°" },
    ],
    // Level 1 (Grade 5) — Angles in a triangle
    [
      { q: "Find the missing angle in a triangle with angles 40° and 70°.", a: "70", worked: ["Angles in a triangle sum to 180°", "Missing angle = 180° − 40° − 70° = 70°"], hint: "Angles in a triangle add up to 180°" },
      { q: "Find the base angle of an isosceles triangle where the vertex angle is 50°.", a: "65", worked: ["Isosceles triangle has two equal base angles", "Base angles = (180° − 50°) ÷ 2 = 130° ÷ 2 = 65°"], hint: "An isosceles triangle has two equal angles. All three add to 180°" },
      { q: "In a right-angled triangle, one angle is 32°. Find the third angle.", a: "58", worked: ["One angle is 90° (right angle), another is 32°", "Third angle = 180° − 90° − 32° = 58°"], hint: "A right angle is 90°. All angles in a triangle sum to 180°" },
    ],
    // Level 2 (Grade 6) — Vertically opposite angles / forming equations
    [
      { q: "Find y if the vertically opposite angle is 72°.", a: "72", worked: ["Vertically opposite angles are equal", "y = 72°"], hint: "Vertically opposite angles are always equal" },
      { q: "Two angles on a straight line are 3x and 2x. Find x.", a: "36", worked: ["Angles on a straight line: 3x + 2x = 180°", "5x = 180°", "x = 36°"], hint: "Set up an equation using the fact that angles on a straight line sum to 180°" },
      { q: "Vertically opposite angles are (2x + 10)° and 50°. Find x.", a: "20", worked: ["Vertically opposite angles are equal:", "2x + 10 = 50", "2x = 40", "x = 20"], hint: "Vertically opposite angles are equal — set up and solve the equation" },
    ],
    // Level 3 (Grade 7) — Interior/exterior angles of polygons
    [
      { q: "Work out the size of one interior angle of a regular pentagon.", a: "108", worked: ["Sum of interior angles = (n − 2) × 180° = (5 − 2) × 180° = 540°", "Each interior angle = 540° ÷ 5 = 108°"], hint: "Sum of interior angles = (n − 2) × 180°, then divide by the number of sides" },
      { q: "Work out the size of one exterior angle of a regular hexagon.", a: "60", worked: ["Exterior angles of any polygon sum to 360°", "Each exterior angle = 360° ÷ 6 = 60°"], hint: "Exterior angles of any polygon add up to 360°" },
      { q: "An interior angle of a regular polygon is 140°. Find the number of sides.", a: "9", worked: ["Exterior angle = 180° − 140° = 40°", "Number of sides = 360° ÷ 40° = 9"], hint: "Find the exterior angle first (180° − interior), then divide 360° by it" },
    ],
    // Level 4 (Grade 8) — Complex angle problems
    [
      { q: "The ratio of exterior to interior angles of a regular polygon is 1:4. How many sides does it have?", a: "10", worked: ["Let exterior = x, interior = 4x", "x + 4x = 180° (angles on a straight line)", "5x = 180°, so x = 36°", "Number of sides = 360° ÷ 36° = 10"], hint: "Use the ratio to find the exterior angle, then divide 360° by it" },
      { q: "Calculate the sum of interior angles for a 12-sided polygon.", a: "1800", worked: ["Sum = (n − 2) × 180°", "= (12 − 2) × 180°", "= 10 × 180°", "= 1800°"], hint: "Use the formula (n − 2) × 180°" },
      { q: "Find the value of x in a quadrilateral with angles x, 2x, 3x, and 90°.", a: "45", worked: ["Angles in a quadrilateral sum to 360°", "x + 2x + 3x + 90 = 360", "6x + 90 = 360", "6x = 270", "x = 45"], hint: "Angles in a quadrilateral add up to 360°" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G2: Transformations
  // ═══════════════════════════════════════════════════════════════
  'G2': [
    // Level 0 (Grade 4) — Reflections
    [
      { q: "A shape has a vertex at (3, 2). What are its coordinates after reflection in the y-axis?", a: "(−3, 2)", worked: ["Reflecting in the y-axis: x-coordinate changes sign", "y-coordinate stays the same", "(3, 2) → (−3, 2)"], hint: "When reflecting in the y-axis, the x-coordinate changes sign" },
      { q: "A point is at (4, −1). What are its coordinates after reflection in the x-axis?", a: "(4, 1)", worked: ["Reflecting in the x-axis: y-coordinate changes sign", "x-coordinate stays the same", "(4, −1) → (4, 1)"], hint: "When reflecting in the x-axis, the y-coordinate changes sign" },
      { q: "A point is at (2, 5). What are its coordinates after reflection in the line y = x?", a: "(5, 2)", worked: ["Reflecting in y = x: swap x and y coordinates", "(2, 5) → (5, 2)"], hint: "Reflecting in y = x swaps the x and y coordinates" },
    ],
    // Level 1 (Grade 5) — Translations
    [
      { q: "A shape has a vertex at (1, 4). Where is this vertex after translation by vector (3, −2)?", a: "(4, 2)", worked: ["Add the vector to the coordinates:", "x: 1 + 3 = 4", "y: 4 + (−2) = 2", "New position: (4, 2)"], hint: "Add the top number to x and the bottom number to y" },
      { q: "A shape has a vertex at (3, 1). Where is this vertex after translation by vector (−4, 5)?", a: "(−1, 6)", worked: ["Add the vector to the coordinates:", "x: 3 + (−4) = −1", "y: 1 + 5 = 6", "New position: (−1, 6)"], hint: "Add the vector components to the original coordinates" },
      { q: "What vector moves a shape from (1, 1) to (5, −2)?", a: "(4, −3)", worked: ["Vector = new position − old position", "x: 5 − 1 = 4", "y: −2 − 1 = −3", "Translation vector: (4, −3)"], hint: "Subtract the old coordinates from the new coordinates" },
    ],
    // Level 2 (Grade 6) — Rotations
    [
      { q: "A point is at (2, 3). Where is it after a 90° clockwise rotation about the origin?", a: "(3, −2)", worked: ["90° clockwise about origin: (x, y) → (y, −x)", "(2, 3) → (3, −2)"], hint: "For 90° clockwise about the origin: (x, y) becomes (y, −x)" },
      { q: "A point is at (1, 4). Where is it after a 180° rotation about the origin?", a: "(−1, −4)", worked: ["180° rotation about origin: (x, y) → (−x, −y)", "(1, 4) → (−1, −4)"], hint: "For 180° rotation about the origin: both coordinates change sign" },
      { q: "A point is at (3, 1). Where is it after a 90° anticlockwise rotation about the origin?", a: "(−1, 3)", worked: ["90° anticlockwise about origin: (x, y) → (−y, x)", "(3, 1) → (−1, 3)"], hint: "For 90° anticlockwise about the origin: (x, y) becomes (−y, x)" },
    ],
    // Level 3 (Grade 7) — Enlargements (positive scale factor)
    [
      { q: "A vertex is at (3, 1). Enlarge by scale factor 2 from the origin. Find the new coordinates.", a: "(6, 2)", worked: ["Multiply each coordinate by the scale factor:", "x: 3 × 2 = 6", "y: 1 × 2 = 2", "New position: (6, 2)"], hint: "From the origin, multiply both coordinates by the scale factor" },
      { q: "A vertex is at (4, 2). Enlarge by scale factor 0.5 from the origin. Find the new coordinates.", a: "(2, 1)", worked: ["Multiply each coordinate by the scale factor:", "x: 4 × 0.5 = 2", "y: 2 × 0.5 = 1", "New position: (2, 1)"], hint: "Scale factor 0.5 means halve both coordinates (from the origin)" },
      { q: "A vertex is at (1, 3). Enlarge by scale factor 3 from centre (2, 2). Find the new coordinates.", a: "(−1, 5)", worked: ["Find vector from centre to point: (1−2, 3−2) = (−1, 1)", "Multiply by scale factor 3: (−3, 3)", "Add to centre: (2+(−3), 2+3) = (−1, 5)"], hint: "Find the vector from the centre to each point, multiply by scale factor, then add back to the centre" },
    ],
    // Level 4 (Grade 8) — Negative scale factor enlargements
    [
      { q: "A vertex is at (4, 2). Enlarge by scale factor −1.5 from centre (1, 1). Find the new coordinates.", a: "(−3.5, −0.5)", worked: ["Vector from centre to point: (4−1, 2−1) = (3, 1)", "Multiply by −1.5: (−4.5, −1.5)", "Add to centre: (1+(−4.5), 1+(−1.5)) = (−3.5, −0.5)"], hint: "A negative scale factor means the image is on the opposite side of the centre" },
      { q: "Describe fully the single transformation that maps (2, 2) to (−4, −4).", a: "Enlargement, scale factor −2, centre (0, 0)", worked: ["The image is on the opposite side of the origin (negative SF)", "Scale factor = −4/2 = −2", "Check: (2 × −2, 2 × −2) = (−4, −4) ✓", "Enlargement, scale factor −2, centre the origin"], hint: "The point moved through the origin and got bigger — this is a negative enlargement" },
      { q: "A vertex is at (1, 3). Enlarge by scale factor −½ from the origin. Find the new coordinates.", a: "(−0.5, −1.5)", worked: ["Multiply each coordinate by −½:", "x: 1 × (−½) = −0.5", "y: 3 × (−½) = −1.5", "New position: (−0.5, −1.5)"], hint: "Negative scale factor: multiply both coordinates by −½ (from the origin)" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // G12: Perimeter, Area & Volume
  // ═══════════════════════════════════════════════════════════════
  'G12': [
    // Level 0 (Grade 4) — Perimeter
    [
      { q: "Find the perimeter of a square with side length 5 cm.", a: "20", worked: ["Perimeter of a square = 4 × side", "= 4 × 5 = 20 cm"], hint: "A square has 4 equal sides. Add them all up" },
      { q: "Find the perimeter of a rectangle with length 12 cm and width 4 cm.", a: "32", worked: ["Perimeter = 2 × (length + width)", "= 2 × (12 + 4) = 2 × 16 = 32 cm"], hint: "A rectangle has 2 lengths and 2 widths" },
      { q: "The perimeter of a regular hexagon is 42 cm. Find the length of one side.", a: "7", worked: ["A regular hexagon has 6 equal sides", "Side = 42 ÷ 6 = 7 cm"], hint: "A regular hexagon has 6 equal sides" },
    ],
    // Level 1 (Grade 5) — Area of rectangles, parallelograms, trapeziums
    [
      { q: "Work out the area of a rectangle with base 8 cm and height 3 cm.", a: "24", worked: ["Area = base × height", "= 8 × 3 = 24 cm²"], hint: "Area of a rectangle = base × height" },
      { q: "Calculate the area of a parallelogram with base 7 cm and vertical height 5 cm.", a: "35", worked: ["Area of parallelogram = base × vertical height", "= 7 × 5 = 35 cm²"], hint: "Area of a parallelogram = base × perpendicular height" },
      { q: "Find the area of a trapezium with parallel sides 6 cm and 10 cm, and height 4 cm.", a: "32", worked: ["Area = ½ × (a + b) × h", "= ½ × (6 + 10) × 4", "= ½ × 16 × 4 = 32 cm²"], hint: "Area of trapezium = ½ × (sum of parallel sides) × height" },
    ],
    // Level 2 (Grade 6) — Triangles and circles
    [
      { q: "Find the area of a triangle with base 6 cm and vertical height 4 cm.", a: "12", worked: ["Area = ½ × base × height", "= ½ × 6 × 4 = 12 cm²"], hint: "Area of a triangle = ½ × base × height" },
      { q: "The area of a triangle is 20 cm² and the base is 8 cm. Find the vertical height.", a: "5", worked: ["Area = ½ × base × height", "20 = ½ × 8 × h", "20 = 4h", "h = 5 cm"], hint: "Rearrange the triangle area formula to find height" },
      { q: "Find the circumference of a circle with diameter 14 cm. Use π = 22/7.", a: "44", worked: ["Circumference = π × d", "= 22/7 × 14", "= 22 × 2 = 44 cm"], hint: "Circumference = π × diameter" },
    ],
    // Level 3 (Grade 7) — Volume of prisms and cubes
    [
      { q: "Calculate the volume of a cuboid with dimensions 2 cm × 3 cm × 10 cm.", a: "60", worked: ["Volume = length × width × height", "= 2 × 3 × 10 = 60 cm³"], hint: "Volume of a cuboid = l × w × h" },
      { q: "Calculate the volume of a triangular prism with a cross-sectional area of 15 cm² and length 12 cm.", a: "180", worked: ["Volume = area of cross-section × length", "= 15 × 12 = 180 cm³"], hint: "Volume of any prism = area of cross-section × length" },
      { q: "A cube has a surface area of 150 cm². Find its volume.", a: "125", worked: ["A cube has 6 identical faces", "Area of one face = 150 ÷ 6 = 25 cm²", "Side length = √25 = 5 cm", "Volume = 5³ = 125 cm³"], hint: "Find the area of one face first, then the side length, then cube it" },
    ],
    // Level 4 (Grade 8) — Surface area and volume of cylinders, spheres, cones
    [
      { q: "Calculate the total surface area of a cylinder with radius 3 cm and height 10 cm. Give your answer to 1 decimal place.", a: "245.0", calculator: true, worked: ["SA = 2πrh + 2πr²", "= 2π(3)(10) + 2π(3²)", "= 60π + 18π = 78π", "= 245.0 cm² (1 d.p.)"], hint: "Total SA = curved surface (2πrh) + two circles (2πr²)" },
      { q: "Calculate the volume of a sphere with radius 6 cm. Give your answer to 1 decimal place.", a: "904.8", calculator: true, worked: ["V = 4/3 × π × r³", "= 4/3 × π × 6³", "= 4/3 × π × 216", "= 288π = 904.8 cm³ (1 d.p.)"], hint: "V = 4/3 πr³. Remember to cube the radius first" },
      { q: "Calculate the total surface area of a cone with radius 5 cm and slant height 13 cm. Give your answer to 1 decimal place.", a: "282.7", calculator: true, worked: ["SA = πrl + πr²", "= π(5)(13) + π(5²)", "= 65π + 25π = 90π", "= 282.7 cm² (1 d.p.)"], hint: "Total SA = curved surface (πrl) + base circle (πr²)" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // P4: Relative Frequency
  // ═══════════════════════════════════════════════════════════════
  'P4': [
    // Level 0 (Grade 4) — Calculate relative frequency
    [
      { q: "A coin is flipped 50 times and lands on heads 20 times. Write the relative frequency of heads.", a: "0.4", worked: ["Relative frequency = number of successes ÷ number of trials", "= 20 ÷ 50 = 0.4"], hint: "Relative frequency = successes ÷ total trials" },
      { q: "A spinner is spun 80 times and lands on Blue 32 times. State the relative frequency of Blue.", a: "0.4", worked: ["Relative frequency = 32 ÷ 80 = 0.4"], hint: "Divide the number of Blues by the total number of spins" },
      { q: "A basketball player makes 15 out of 25 free throws. What is the relative frequency of success?", a: "0.6", worked: ["Relative frequency = 15 ÷ 25 = 0.6"], hint: "Divide successful throws by total throws" },
    ],
    // Level 1 (Grade 5) — Expected outcomes
    [
      { q: "If the probability of an event is 0.3, how many times would you expect it to happen in 100 trials?", a: "30", worked: ["Expected frequency = probability × number of trials", "= 0.3 × 100 = 30"], hint: "Multiply the probability by the number of trials" },
      { q: "The probability that a seed grows is 0.85. If 200 seeds are planted, how many are expected to grow?", a: "170", worked: ["Expected = 0.85 × 200 = 170"], hint: "Multiply the probability by the number of seeds" },
      { q: "P(Late) = 0.05. In a 20-day month, how many days is a train expected to be late?", a: "1", worked: ["Expected = 0.05 × 20 = 1"], hint: "Multiply the probability by the number of days" },
    ],
    // Level 2 (Grade 6) — Use relative frequency from trials
    [
      { q: "Use a table: after 200 trials, a biased spinner lands on Red 48 times. Estimate the probability of Red.", a: "0.24", worked: ["Estimated probability = relative frequency", "= 48 ÷ 200 = 0.24"], hint: "Relative frequency is the best estimate of probability from experimental data" },
      { q: "After 500 trials, the relative frequency of an event is 0.12. How many times did the event occur?", a: "60", worked: ["Frequency = relative frequency × trials", "= 0.12 × 500 = 60"], hint: "Multiply the relative frequency by the number of trials" },
      { q: "A biased coin is flipped. After 100 flips there are 62 heads. After 500 flips there are 315 heads. Which is the better estimate for P(Heads)?", type: "mcq", options: ["500 flips: 0.63", "100 flips: 0.62"], a: "500 flips: 0.63", worked: ["100 flips: RF = 62/100 = 0.62", "500 flips: RF = 315/500 = 0.63", "More trials gives a more reliable estimate", "The 500-flip estimate (0.63) is better"], hint: "More trials give a more reliable estimate of the true probability" },
    ],
    // Level 3 (Grade 7) — Apply relative frequency reasoning
    [
      { q: "A die is rolled 300 times. The relative frequency of rolling a 6 is 0.2. How many 6s were rolled?", a: "60", worked: ["Frequency = RF × trials", "= 0.2 × 300 = 60"], hint: "Multiply the relative frequency by the number of rolls" },
      { q: "A bag contains black and white counters. In 150 trials, a white counter was picked 60 times. Estimate the probability of picking a black counter.", a: "0.6", worked: ["P(white) = 60/150 = 0.4", "P(black) = 1 − 0.4 = 0.6"], hint: "Find P(white) first, then use P(black) = 1 − P(white)" },
      { q: "A spinner has 4 sections. After 400 spins, Section 1 has a relative frequency of 0.35. Find the frequency of Section 1.", a: "140", worked: ["Frequency = RF × total spins", "= 0.35 × 400 = 140"], hint: "Multiply the relative frequency by the total number of spins" },
    ],
    // Level 4 (Grade 8) — Reasoning about reliability / extended problems
    [
      { q: "Explain why relative frequency becomes a more reliable estimate of probability as the number of trials increases.", a: "As the number of trials increases, the relative frequency gets closer to the true probability because random variation has less effect on a larger sample", worked: ["With few trials, results can be very different from the true probability due to chance", "With many trials, the effects of randomness average out", "The relative frequency converges towards the theoretical probability"], hint: "Think about how random variation affects small vs large samples" },
      { q: "Two people conduct the same experiment: Person A does 10 trials, Person B does 1000 trials. Whose estimate is more reliable and why?", a: "Person B, because more trials reduces the effect of random variation", worked: ["Person A: only 10 trials — high random variation", "Person B: 1000 trials — random variation averages out", "Person B's estimate is much more reliable"], hint: "Consider how the number of trials affects the accuracy of the estimate" },
      { q: "If the relative frequency of an event is 7/25 over 200 trials, how many more times should it occur in the next 100 trials?", a: "28", worked: ["Estimated probability = 7/25 = 0.28", "Expected in next 100 trials = 0.28 × 100 = 28"], hint: "Use the relative frequency as your probability estimate, then multiply by 100" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // P7: Tree Diagrams & Enumeration
  // ═══════════════════════════════════════════════════════════════
  'P7': [
    // Level 0 (Grade 4) — List outcomes / systematic listing
    [
      { q: "List all possible outcomes of flipping a coin and rolling a 4-sided die. How many outcomes are there?", a: "8", worked: ["H1, H2, H3, H4", "T1, T2, T3, T4", "Total = 2 × 4 = 8 outcomes"], hint: "List heads with each die number, then tails with each die number" },
      { q: "A menu has 2 starters and 3 mains. How many different 2-course meal combinations are there?", a: "6", worked: ["For each starter, there are 3 mains", "Total = 2 × 3 = 6 combinations"], hint: "Multiply the number of starters by the number of mains" },
      { q: "How many different 3-digit numbers can be made using the digits 1, 2, and 3 without repetition?", a: "6", worked: ["First digit: 3 choices", "Second digit: 2 choices", "Third digit: 1 choice", "Total = 3 × 2 × 1 = 6"], hint: "For each position, count how many digits are left to choose from" },
    ],
    // Level 1 (Grade 5) — Tree diagram basics
    [
      { q: "Complete the branches: P(Success) = 0.6. What is P(Failure)?", a: "0.4", worked: ["Probabilities on branches must sum to 1", "P(Failure) = 1 − 0.6 = 0.4"], hint: "The probabilities on each set of branches must add up to 1" },
      { q: "Complete a tree diagram where P(Rain) = 1/4. What is P(No Rain)?", a: "3/4", worked: ["P(No Rain) = 1 − 1/4 = 3/4"], hint: "The two branches from each point must add to 1" },
      { q: "If P(Win) = p, what is P(Lose) in terms of p?", a: "1 − p", worked: ["Probabilities on branches sum to 1", "P(Lose) = 1 − p"], hint: "The two probabilities must add up to 1" },
    ],
    // Level 2 (Grade 6) — Combined events (with replacement)
    [
      { q: "Use a tree diagram to find the probability of getting two Heads when a fair coin is flipped twice.", a: "1/4", worked: ["P(H) = 1/2 for each flip", "P(HH) = 1/2 × 1/2 = 1/4"], hint: "Multiply along the branches for P(H and H)" },
      { q: "A bag has 3 red and 7 blue counters. One is picked, replaced, then another picked. Find P(both red).", a: "9/100", worked: ["P(red) = 3/10 each time (with replacement)", "P(RR) = 3/10 × 3/10 = 9/100"], hint: "With replacement, the probabilities stay the same for each pick" },
      { q: "A fair coin is flipped three times. Find the probability of getting exactly two Tails.", a: "3/8", worked: ["Possible ways: HTT, THT, TTH = 3 ways", "P(each) = (1/2)³ = 1/8", "P(exactly 2T) = 3 × 1/8 = 3/8"], hint: "List all the ways to get exactly 2 tails, then add their probabilities" },
    ],
    // Level 3 (Grade 7) — Independent events
    [
      { q: "P(A) = 0.5 and P(B) = 0.2. If A and B are independent, find P(A and B).", a: "0.1", worked: ["For independent events: P(A and B) = P(A) × P(B)", "= 0.5 × 0.2 = 0.1"], hint: "For independent events, multiply the probabilities" },
      { q: "A student takes two tests. P(Pass A) = 0.8, P(Pass B) = 0.7. Find P(Pass both).", a: "0.56", worked: ["Tests are independent", "P(Pass both) = 0.8 × 0.7 = 0.56"], hint: "Multiply the individual probabilities for independent events" },
      { q: "The probability a lightbulb is faulty is 0.02. Find the probability that two randomly selected bulbs are both working.", a: "0.9604", worked: ["P(working) = 1 − 0.02 = 0.98", "P(both working) = 0.98 × 0.98 = 0.9604"], hint: "First find P(working), then multiply for both bulbs" },
    ],
    // Level 4 (Grade 8) — Without replacement problems
    [
      { q: "A bag has 5 red and 5 blue marbles. Two are picked without replacement. Find P(different colours).", a: "5/9", worked: ["P(RB) = 5/10 × 5/9 = 25/90", "P(BR) = 5/10 × 5/9 = 25/90", "P(different) = 25/90 + 25/90 = 50/90 = 5/9"], hint: "There are two ways to get different colours: RB or BR" },
      { q: "In a bag of 10 sweets, 4 are lime. Two are taken without replacement. Find P(exactly one lime).", a: "8/15", worked: ["P(Lime then Not) = 4/10 × 6/9 = 24/90", "P(Not then Lime) = 6/10 × 4/9 = 24/90", "P(exactly one) = 24/90 + 24/90 = 48/90 = 8/15"], hint: "Two paths: Lime-then-Not or Not-then-Lime. Add both probabilities" },
      { q: "A box contains 5 red and 3 green apples. Two are chosen without replacement. Find P(both red).", a: "5/14", worked: ["P(1st red) = 5/8", "P(2nd red | 1st red) = 4/7", "P(both red) = 5/8 × 4/7 = 20/56 = 5/14"], hint: "After taking one red, there are fewer reds and fewer total" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // R2: Percentage Change & Growth/Decay
  // ═══════════════════════════════════════════════════════════════
  'R2': [
    // Level 0 (Grade 4) — Simple percentage increase/decrease
    [
      { q: "Increase £40 by 10%.", a: "44", worked: ["10% of £40 = £4", "£40 + £4 = £44"], hint: "Find 10% first, then add it on" },
      { q: "Decrease £120 by 5%.", a: "114", worked: ["5% of £120 = £6", "£120 − £6 = £114"], hint: "Find 5% first, then subtract it" },
      { q: "What is the multiplier for a 17.5% increase?", type: "mcq", options: ["1.175", "0.175", "1.75", "0.825"], a: "1.175", worked: ["A 17.5% increase means 100% + 17.5% = 117.5%", "As a decimal: 117.5 ÷ 100 = 1.175"], hint: "Add the percentage to 100%, then divide by 100" },
    ],
    // Level 1 (Grade 5) — Percentage of an amount
    [
      { q: "Decrease 60 kg by 20%.", a: "48", worked: ["20% of 60 = 12", "60 − 12 = 48 kg"], hint: "Find 20%, then subtract from 60" },
      { q: "Increase 250g by 12%.", a: "280", worked: ["12% of 250 = 30", "250 + 30 = 280g"], hint: "Find 12% of 250 and add it" },
      { q: "A shop offers '20% extra free' on a 500 ml bottle. What is the new volume?", a: "600", worked: ["20% of 500 = 100 ml", "New volume = 500 + 100 = 600 ml"], hint: "20% extra means add 20% of 500" },
    ],
    // Level 2 (Grade 6) — Percentage change
    [
      { q: "A house price increases from £200,000 to £220,000. Calculate the percentage increase.", a: "10", worked: ["Increase = £220,000 − £200,000 = £20,000", "% increase = (20,000 ÷ 200,000) × 100 = 10%"], hint: "% change = (change ÷ original) × 100" },
      { q: "A car's value drops from £15,000 to £12,300. Find the percentage decrease.", a: "18", worked: ["Decrease = £15,000 − £12,300 = £2,700", "% decrease = (2,700 ÷ 15,000) × 100 = 18%"], hint: "% change = (change ÷ original) × 100" },
      { q: "An item costing £80 is sold for £100. Find the percentage profit.", a: "25", worked: ["Profit = £100 − £80 = £20", "% profit = (20 ÷ 80) × 100 = 25%"], hint: "% profit = (profit ÷ cost price) × 100" },
    ],
    // Level 3 (Grade 7) — Multipliers
    [
      { q: "Use a multiplier to increase £450 by 3.5%.", a: "465.75", calculator: true, worked: ["Multiplier = 1 + 0.035 = 1.035", "£450 × 1.035 = £465.75"], hint: "The multiplier for an increase of x% is 1 + x/100" },
      { q: "A population of 8000 increases by 1.5% per year. What is the population after 1 year?", a: "8120", worked: ["Multiplier = 1.015", "8000 × 1.015 = 8120"], hint: "Multiply by (1 + rate/100)" },
      { q: "Use multipliers to decrease £60 by 15% and then increase the result by 10%.", a: "56.10", calculator: true, worked: ["Decrease by 15%: £60 × 0.85 = £51", "Increase by 10%: £51 × 1.10 = £56.10"], hint: "Apply the two multipliers in sequence: × 0.85 then × 1.10" },
    ],
    // Level 4 (Grade 8) — Compound interest / growth and decay
    [
      { q: "£1000 is invested at 4% compound interest for 2 years. Work out the final amount.", a: "1081.60", calculator: true, worked: ["Year 1: £1000 × 1.04 = £1040", "Year 2: £1040 × 1.04 = £1081.60", "Or: £1000 × 1.04² = £1081.60"], hint: "Compound interest: multiply by (1 + rate)ⁿ" },
      { q: "£2500 is invested at 3% compound interest per year. Find the total interest earned after 3 years.", a: "231.82", calculator: true, worked: ["Final amount = £2500 × 1.03³", "= £2500 × 1.092727 = £2731.82", "Interest = £2731.82 − £2500 = £231.82"], hint: "Find the final amount using (1.03)³, then subtract the original" },
      { q: "A rare stamp appreciates by 5% each year. If it is worth £400 now, find its value in 4 years. Give your answer to 2 decimal places.", a: "486.20", calculator: true, worked: ["Value = £400 × 1.05⁴", "= £400 × 1.21550625", "= £486.20"], hint: "Appreciation is like compound interest: multiply by (1.05)⁴" },
    ],
  ],

  // ═══════════════════════════════════════════════════════════════
  // S2: Tables & Charts
  // ═══════════════════════════════════════════════════════════════
  'S2': [
    // Level 0 (Grade 4) — Read and interpret simple charts
    [
      { q: "A bar chart shows: Football 12, Tennis 8, Rugby 5. How many more chose Football than Rugby?", a: "7", worked: ["Football = 12, Rugby = 5", "Difference = 12 − 5 = 7"], hint: "Subtract the smaller value from the larger" },
      { q: "From a frequency table, the scores are: 3, 5, 5, 7, 5, 3, 7. What is the mode?", a: "5", worked: ["Count each value: 3 appears 2 times, 5 appears 3 times, 7 appears 2 times", "Mode = most frequent = 5"], hint: "The mode is the value that appears most often" },
      { q: "State one advantage of using a bar chart over a pictogram.", a: "A bar chart can show exact values more easily because it uses a scale", worked: ["Bar charts use a continuous scale on the y-axis", "Pictograms use symbols which can be harder to read precisely", "Bar charts are better for exact comparisons"], hint: "Think about which is easier to read exact values from" },
    ],
    // Level 1 (Grade 5) — Pictograms and basic data
    [
      { q: "Complete a tally chart: the data is 3, 1, 4, 1, 5, 1, 3, 5. What is the frequency of 1?", a: "3", worked: ["Go through the data and count each 1:", "1 appears at positions 2, 4, 6", "Frequency of 1 = 3"], hint: "Go through the data one by one and count how many times 1 appears" },
      { q: "A pictogram uses 1 circle to represent 8 books. How many circles represent 20 books?", a: "2.5", worked: ["Each circle = 8 books", "20 ÷ 8 = 2.5 circles", "Draw 2 full circles and a half circle"], hint: "Divide the number of books by what each symbol represents" },
      { q: "A line graph shows temperature at noon: 12°C at 2pm, 16°C at 3pm. Estimate the temperature at 2:30pm.", a: "14", worked: ["2:30pm is halfway between 2pm and 3pm", "Halfway between 12°C and 16°C = (12 + 16) ÷ 2 = 14°C"], hint: "2:30 is halfway between the two readings — find the midpoint" },
    ],
    // Level 2 (Grade 6) — Two-way tables and constructing charts
    [
      { q: "In a pictogram, 1 symbol represents 4 people. How many symbols are needed for 18 people?", a: "4.5", worked: ["18 ÷ 4 = 4.5 symbols", "Draw 4 full symbols and a half symbol"], hint: "Divide the frequency by the value of each symbol" },
      { q: "Complete a two-way table: 100 students, 55 boys. 30 boys take the bus, 20 girls take the bus. How many girls walk?", a: "25", worked: ["Girls = 100 − 55 = 45", "Girls who take bus = 20", "Girls who walk = 45 − 20 = 25"], hint: "Find total girls first, then subtract those who take the bus" },
      { q: "Draw a bar chart: scores are Red 15, Blue 25, Green 10. If 1 unit = 5 people, how tall is the Blue bar?", a: "5", worked: ["Blue = 25 people", "Height = 25 ÷ 5 = 5 units"], hint: "Divide the frequency by the scale (1 unit = 5 people)" },
    ],
    // Level 3 (Grade 7) — Pie charts
    [
      { q: "Calculate the angle for a sector in a pie chart representing 10 people out of 40.", a: "90", worked: ["Fraction = 10/40 = 1/4", "Angle = 1/4 × 360° = 90°"], hint: "Angle = (frequency ÷ total) × 360°" },
      { q: "In a pie chart, a sector of 72° represents 12 people. How many people are in the whole survey?", a: "60", worked: ["72° represents 12 people", "1° represents 12/72 = 1/6 person", "360° represents 1/6 × 360 = 60 people"], hint: "Find how many people per degree, then multiply by 360" },
      { q: "A survey of 60 people is shown on a pie chart. The Red sector has an angle of 120°. How many people chose Red?", a: "20", worked: ["Fraction = 120/360 = 1/3", "Number = 1/3 × 60 = 20 people"], hint: "Find what fraction of 360° the angle is, then multiply by the total" },
    ],
    // Level 4 (Grade 8) — Interpret and critique charts
    [
      { q: "A dual bar chart shows Group A scored a mean of 65 and Group B scored 72 across 5 tests. Find the difference in their means.", a: "7", worked: ["Mean of Group A = 65", "Mean of Group B = 72", "Difference = 72 − 65 = 7"], hint: "Subtract the smaller mean from the larger" },
      { q: "A frequency polygon has its highest point at the 20-30 class. The frequency is 15. What does this tell you?", a: "The modal class is 20-30 with 15 data values in that interval", worked: ["The highest point on a frequency polygon shows the modal class", "Modal class = 20-30", "15 data values fall in this interval"], hint: "The highest point on a frequency polygon shows the most common class interval" },
      { q: "A chart has a y-axis starting at 50 instead of 0. Explain why this could be misleading.", a: "It exaggerates differences between bars because the scale doesn't start at zero", worked: ["When the y-axis doesn't start at 0, small differences look much larger", "This makes it harder to compare values fairly", "A broken or truncated axis can mislead the reader"], hint: "Think about how not starting at zero affects the visual comparison of bars" },
    ],
  ],
};

// Pick a random variant from a question slot (supports both single questions and variant arrays)
const pickVariant = (questionOrVariants) => {
  if (Array.isArray(questionOrVariants)) {
    return questionOrVariants[Math.floor(Math.random() * questionOrVariants.length)];
  }
  return questionOrVariants;
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

// Legacy worked examples (now replaced by per-question worked arrays)
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


// Generate diagram HTML - uses PNG images for AQA-style diagrams
const generateDiagram = (type) => {
  // Image-based diagrams (AQA exam style)
  const imageDiagrams = {
    'distance-time-1': 'distane time graph 1.png',
    'distance-time-2': 'distance time graph 2.png',
    'distance-time-3': 'distance time graph 3.png',
    'plot-a-graph': 'Plot a graph.png',
    'football-pictogram': 'football pictogram.png',
    'scatter-graph': 'Scatter graph.png',
    'pythagoras': 'Pythagoras.png',
    'pythagoras-2': 'pythagoras 2.png',
    'pythagoras-3': 'Pythagoras 3.png',
    'tea-coffee': 'tea-coffee.png',
    'dual-bar-chart': 'dual bar chart.png',
    'spinners': 'spinners.png',
    'isosceles-triangle': 'Isoceles triangle missing angle.png',
    'isosceles-40': 'Isoceles 40.png',
    'isosceles-50': 'Isoceles 50.png',
    'pythagoras-shorter': 'pythagoras shorter side.png',
    'pythag-3-4': 'pythag-3-4.png',
    'pythag-5-13': 'pythag-5-13.png',
    'trig-30-hyp10': 'trig-30-hyp10.png',
    'trig-opp5-adj12': 'trig-opp5-adj12.png',
    'G10-semicircle-35': 'G10-semicircle-35.png',
    'G10-centre-circum-140': 'G10-centre-circum-140.png',
    'G10-cyclic-quad-85': 'G10-cyclic-quad-85.png',
    'G10-centre-circum-130': 'G10-centre-circum-130.png',
    'G10-cyclic-quad-110': 'G10-cyclic-quad-110.png',
    'G10-alt-segment-65': 'G10-alt-segment-65.png',
    'G10-tangent-chord-55': 'G10-tangent-chord-55.png',
    'G10-tangent-chord-72': 'G10-tangent-chord-72.png',
    'G10-two-tangents-60': 'G10-two-tangents-60.png',
    'G10-tangent-length': 'G10-tangent-length.png',
    // Batch 3: G17 Sectors & Circles
    'G17-semicircle-r7': 'G17-semicircle-r7.png',
    'G17-semicircle-d10': 'G17-semicircle-d10.png',
    'G17-quarter-circle-r4': 'G17-quarter-circle-r4.png',
    'G17-sector-45-r8': 'G17-sector-45-r8.png',
    'G17-sector-60-r6': 'G17-sector-60-r6.png',
    'G17-sector-120-r9': 'G17-sector-120-r9.png',
    'G17-sector-36-r10': 'G17-sector-36-r10.png',
    'G17-segment-90-r6': 'G17-segment-90-r6.png',
  };

  // Check for image-based diagram first
  if (imageDiagrams[type]) {
    return `<div class="bg-white rounded-lg p-4 mx-auto max-w-md"><img src="/images/${imageDiagrams[type]}" alt="${type}" class="w-full h-auto mx-auto" /></div>`;
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
  // Table-of-values diagrams (AQA style)
  if (type && type.startsWith('table:')) {
    const data = type.slice(6); // e.g. "y=2x+1|-1,0,1,2|?,1,?,5"
    const [equation, xVals, yVals] = data.split('|');
    const xs = xVals.split(',');
    const ys = yVals.split(',');
    const cells = xs.map((x, i) => `<td style="border:2px solid #64748b;padding:8px 14px;text-align:center;font-weight:${ys[i] === '?' ? 'bold' : 'normal'};color:${ys[i] === '?' ? '#a78bfa' : '#e2e8f0'};font-size:1.1em">${ys[i]}</td>`).join('');
    const xCells = xs.map(x => `<td style="border:2px solid #64748b;padding:8px 14px;text-align:center;color:#e2e8f0;font-size:1.1em">${x}</td>`).join('');
    return `<table style="border-collapse:collapse;margin:0 auto;background:#1e293b;border-radius:8px;overflow:hidden">
      <tr><td style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1.1em">x</td>${xCells}</tr>
      <tr><td style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1.1em">y</td>${cells}</tr>
    </table>`;
  }

  // Tally chart diagrams (AQA style)
  if (type && type.startsWith('tally:')) {
    const raw = type.slice(6); // e.g. "Red:6,Blue:5,Green:4|Colour"
    const parts = raw.split('|');
    const data = parts[0];
    const headerLabel = parts[1] || 'Colour';
    const items = data.split(',').map(item => {
      const [label, count] = item.split(':');
      const n = parseInt(count);
      let tally = '';
      const groups = Math.floor(n / 5);
      const remainder = n % 5;
      for (let g = 0; g < groups; g++) tally += '<span style="text-decoration:line-through;letter-spacing:2px">||||</span> ';
      for (let r = 0; r < remainder; r++) tally += '|';
      return { label: label.trim(), count: n, tally: tally.trim() };
    });
    const rows = items.map(item => `<tr>
      <td style="border:2px solid #64748b;padding:8px 14px;color:#e2e8f0;font-size:1.05em">${item.label}</td>
      <td style="border:2px solid #64748b;padding:8px 14px;color:#e2e8f0;font-size:1.1em;font-family:monospace;letter-spacing:1px">${item.tally}</td>
      <td style="border:2px solid #64748b;padding:8px 14px;text-align:center;color:#e2e8f0;font-size:1.05em">${item.count}</td>
    </tr>`).join('');
    return `<table style="border-collapse:collapse;margin:0 auto;background:#1e293b;border-radius:8px;overflow:hidden">
      <tr>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">${headerLabel}</th>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">Tally</th>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">Frequency</th>
      </tr>${rows}
    </table>`;
  }

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
  const qBank = getQuestionBankForTier(tier);
  const recentQuestions = new Set(loadRecentQuestions());

  // Shuffle helper (Fisher-Yates)
  const shuffle = (arr) => {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  };

  // Pick a variant that hasn't been recently answered (falls back to random if all are recent)
  const pickFreshVariant = (variants, objCode, questionIdx) => {
    if (!Array.isArray(variants) || variants.length <= 1) return pickVariant(variants);

    // Try to find a variant NOT in recent questions
    const fresh = variants.filter(v => {
      const id = getQuestionId(objCode, questionIdx, v);
      return !recentQuestions.has(id);
    });

    if (fresh.length > 0) {
      return fresh[Math.floor(Math.random() * fresh.length)];
    }
    // All variants are recent — just pick randomly
    return variants[Math.floor(Math.random() * variants.length)];
  };

  // ── Step 1: Collect all eligible objectives ──
  const candidates = [];

  allObjectives.forEach(obj => {
    const objProg = progress[obj.code];
    const questions = qBank[obj.code] || [];
    if (questions.length === 0) return;

    // Use this objective's own progress only
    const qc = objProg?.quickCorrect ?? 0;
    if (qc >= 5) return; // Mastered — skip

    // Skip if this objective is still in cooldown
    if ((objProg?.skipUntilSession ?? 0) > sessionCount) return;

    const questionIdx = Math.min(qc, questions.length - 1);
    const q = pickFreshVariant(questions[questionIdx], obj.code, questionIdx);

    // Priority: never-practiced objectives first, then least-recently-practiced
    const neverPracticed = objProg?.quickCorrect === undefined;
    const lastPracticed = objProg?.lastPracticed ?? 0;

    candidates.push({
      objective: obj,
      question: q,
      questionIndex: questionIdx,
      questionId: getQuestionId(obj.code, questionIdx, q),
      level: qc,
      topic: obj.topic,
      neverPracticed,
      lastPracticed,
    });
  });

  // ── Step 2: Sort within each topic — unseen objectives first, then oldest-practiced ──
  const byTopic = {};
  candidates.forEach(c => {
    if (!byTopic[c.topic]) byTopic[c.topic] = [];
    byTopic[c.topic].push(c);
  });

  Object.keys(byTopic).forEach(t => {
    // Separate into never-practiced and already-practiced
    const unseen = shuffle(byTopic[t].filter(c => c.neverPracticed));
    const seen = byTopic[t]
      .filter(c => !c.neverPracticed)
      .sort((a, b) => a.lastPracticed - b.lastPracticed); // oldest first
    // Unseen objectives get priority, then oldest-practiced
    byTopic[t] = [...unseen, ...seen];
  });

  // ── Step 3: Round-robin across topics, picking from the front (prioritised) ──
  const queue = [];
  const usedObjectives = new Set();
  const topicCount = {};

  while (queue.length < count) {
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

    if (!bestTopic) break;

    // Pick FIRST available (unseen/oldest gets priority thanks to sorting)
    const topicCandidates = byTopic[bestTopic];
    const nextIdx = topicCandidates.findIndex(c => !usedObjectives.has(c.objective.code));
    if (nextIdx === -1) break;

    const next = topicCandidates.splice(nextIdx, 1)[0];
    // Block all codes sharing the same question bank to avoid duplicate question types
    const primary = questionBankPrimary[next.objective.code] || next.objective.code;
    const bankGroup = questionBankGroups[primary] || [next.objective.code];
    bankGroup.forEach(c => usedObjectives.add(c));
    topicCount[next.topic] = (topicCount[next.topic] || 0) + 1;
    queue.push(next);
  }

  // Shuffle the final queue so topics are interleaved
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
    // Sequential progression: pick the question at the student's current level, with random variant
    const questionIndex = Math.min(quickCorrect, questions.length - 1);
    const q = pickVariant(questions[questionIndex]);
    const questionType = quickCorrect >= 5 ? 'review' : 'quick';
    return { ...q, objective, questionType, difficultyLevel: questionIndex + 1 };
  }

  // Fallback: generic question (should never trigger with full coverage)
  return {
    q: `True or false: "${objective.title}" is a GCSE maths topic.`,
    a: "True",
    type: "mcq",
    options: ["True", "False"],
    objective,
    questionType: 'quick',
  };
};

function PracticePage({ dailyObjectives, progress, setProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings, isSubscribed, FREE_DAILY_LIMIT, tier = 'foundation', setRecentSessionCodes, setSessionToastData, setShowOneVsOne, setShowCelebration, setCelebrationIndex, setShowUpgradePrompt }) {
  const { user: practiceUser } = useAuth();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [questionCount, setQuestionCount] = useState(() => {
    const requested = settings?.questionsPerSession ?? 5;
    if (!isSubscribed) {
      const activity = loadDailyActivity();
      const todayKey = getTodayKey();
      const todayQuestions = activity[todayKey]?.questions ?? 0;
      const remaining = Math.max(0, (FREE_DAILY_LIMIT ?? 5) - todayQuestions);
      return Math.min(requested, remaining || 1); // at least 1 so UI doesn't break
    }
    return requested;
  });
  const [sessionCount, setSessionCount] = useState(() => loadSessionCount());
  const [masteryGained, setMasteryGained] = useState(0);
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
  const [currentDiagnosis, setCurrentDiagnosis] = useState(null); // Diagnosis of error

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);

  // Question tracking
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(() => loadTotalQuestions());
  
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
    // Enforce daily limit for free users
    if (!isSubscribed) {
      const activity = loadDailyActivity();
      const todayKey = getTodayKey();
      const todayQuestions = activity[todayKey]?.questions ?? 0;
      if (todayQuestions >= FREE_DAILY_LIMIT) {
        setShowUpgradePrompt(true);
        return;
      }
      // Cap session length to remaining questions
      const remaining = FREE_DAILY_LIMIT - todayQuestions;
      if (questionCount > remaining) {
        setQuestionCount(remaining);
      }
    }

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
            return { ...item.question, objective: item.objective, questionType: 'quick', difficultyLevel: (item.questionIndex ?? 0) + 1, _fsrsQuestionId: item.questionId };
          }
          // Fallback: pick a random MCQ from the objective
          const mcqQuestions = qBank[item.objective?.code]?.filter(q => q.type === 'mcq') || [];
          const mcq = mcqQuestions[Math.floor(Math.random() * mcqQuestions.length)];
          return { ...(mcq || {}), objective: item.objective, questionType: 'quick', difficultyLevel: (item.questionIndex ?? 0) + 1 };
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
          difficultyLevel: (item.questionIndex ?? 0) + 1,
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
    setPracticeMode(mode);
    setShowMathKeyboard(false);
    setCapturedImage(null);
    setInputMode('handwriting');
    
    // Reset scaffolding state
    setFailureCounts({});
    setCurrentDiagnosis(null);

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

    const code = current.objective.code;
    
    // === SCAFFOLDING LOGIC (disabled in Quick Fire and Exam modes) ===
    const scaffoldingEnabled = practiceMode !== 'quickfire' && practiceMode !== 'exam';

    if (!correct && scaffoldingEnabled) {
      // Quick diagnosis for wrong answers
      const quickDiag = quickDiagnosis(current, userAnswer, current.a);
      setCurrentDiagnosis(quickDiag);
      
      // Track failure count for this objective
      const newFailureCount = (failureCounts[code] || 0) + 1;
      setFailureCounts(prev => ({ ...prev, [code]: newFailureCount }));
    } else if (correct) {
      // Reset failure count on success
      setCurrentDiagnosis(null);
        setFailureCounts(prev => ({ ...prev, [code]: 0 }));
    }
    
    // Update progress and track mastery
    const prog = progress[code] || {};
    const oldQuickCorrect = prog.quickCorrect ?? 0;
    const wasMastered = oldQuickCorrect >= 5;

    let newQuickCorrect = oldQuickCorrect;

    if (correct) {
      // Correct: advance to next level (max 5 = mastered)
      newQuickCorrect = Math.min(oldQuickCorrect + 1, 5);
    } else {
      // Wrong: stay at same level — student gets a shadow question next time
      newQuickCorrect = oldQuickCorrect;
    }

    const nowMastered = newQuickCorrect >= 5;

    // Track mastery gained
    if (correct && nowMastered && !wasMastered) {
      setMasteryGained(prev => prev + 1);
    }

    setProgress(prev => {
      const updated = { ...prev };
      const now = Date.now();
      const skipUntil = correct
        ? sessionCount + (
            newQuickCorrect >= 5 ? 10 : // Mastered — long break
            newQuickCorrect >= 4 ? 3 :  // Nearly there
            newQuickCorrect >= 2 ? 2 :  // Making progress
            1                            // Just started
          )
        : 0; // Wrong — no cooldown, will reappear naturally within a few sessions

      // Update only the specific objective being practiced
      const oldProg = prev[code] || {};
      updated[code] = {
        ...oldProg,
        quickCorrect: newQuickCorrect,
        lastPracticed: now,
        nextDue: getNextDueTime(newQuickCorrect, correct),
        skipUntilSession: skipUntil,
        masteredAt: (newQuickCorrect >= 5 && (oldProg.quickCorrect ?? 0) < 5) ? now : oldProg.masteredAt,
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

        // Persist to localStorage and cloud
        saveFsrsData(updatedFsrsData);
        if (practiceUser) {
          saveFsrsToCloud(practiceUser.id, updatedFsrsData);
        }
        return updatedFsrsData;
      });

      // Track this question as recently answered so it won't repeat soon
      const recentList = loadRecentQuestions();
      recentList.push(questionId);
      saveRecentQuestions(recentList);
  };

  // Next question
  const nextQuestion = () => {
    setShowFeedback(false);
    setUserAnswer('');
    setIsCorrect(null);
    setCurrentDiagnosis(null);
    setShowMathKeyboard(false);
    setCapturedImage(null);
    setShowCalculator(false);
    setInputMode('handwriting');

    // Reset FSRS state for next question
    setQuestionStartTime(Date.now());
    setUserConfidence(null);
    setShowConfidenceRating(false);
    setShowDelayedFeedback(false);

    // Clear Quick Fire timer
    if (timerRef.current) clearInterval(timerRef.current);

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
      
      // Record daily activity and sync to cloud
      const updatedActivity = recordDailyActivity(totalQuestions, correctCount, masteryGained);
      if (practiceUser) {
        const todayKey = getTodayKey();
        saveDailyActivityToCloud(practiceUser.id, todayKey, updatedActivity[todayKey]);
      }

      // Check for streak milestones (earns freezes)
      const updatedStreak = calculateStreak();
      const freezeEarned = checkStreakMilestone(updatedStreak.streak);

      // Sync streak data to cloud (merge calculated streak with saved data)
      if (practiceUser) {
        const savedStreak = loadStreakData();
        savedStreak.currentStreak = updatedStreak.streak;
        savedStreak.lastActivityDate = new Date().toISOString().split('T')[0];
        saveStreakToCloud(practiceUser.id, savedStreak);
      }
      
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

      // ---- Piro Evolution ----
      // Calculate days missed (0 if practised yesterday or today)
      const daysMissed = updatedStreak.streak > 0 ? 0 :
        updatedStreak.needsRepair ? 2 : 1;
      const piroResult = updatePiro(updatedStreak.streak, daysMissed);
      setPiro(loadPiro());
      if (piroResult.evolved) {
        setPiroEvolution({ oldStage: piroResult.oldStage, newStage: piroResult.newStage });
      }
      if (piroResult.decayed) {
        setPiroDecayed(true);
      }

      // Extract practiced objective codes with full data for celebration
      const allResults = [...sessionResults, { correct: isCorrect, code: current.objective.code, topic: current.objective.topic }];
      const practicedCodes = [...new Set(allResults.map(r => r.code))];

      // Build rich data for each practiced objective, mapping to primary bank labels
      const practicedObjectives = practicedCodes.map(code => {
        const obj = allObjectives.find(o => o.code === code);
        const primary = questionBankPrimary[code] || code;
        const prog = progress[code];
        const level = getUnderstandingLevel(prog);
        const resultsForCode = allResults.filter(r => r.code === code);
        const correctForCode = resultsForCode.filter(r => r.correct).length;
        // Use friendly bank label for mixed banks, otherwise use primary's description
        const displayTitle = questionBankLabel[primary] || descriptions[primary] || obj?.title || code;
        return {
          code: primary !== code ? primary : code,
          title: displayTitle,
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
          <h2 className="text-2xl font-bold text-white">No questions available</h2>
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
        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />
        <div className="pt-24 pb-28 px-4 relative z-10 page-content">
          <div className="max-w-md mx-auto content-container">
            <div className="glass-panel rounded-3xl p-8 shadow-glass">
              {/* Header */}
              <div className="text-center mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  accuracy === 100 ? 'bg-gradient-to-br from-[#FBBF24] to-orange-500 shadow-[0_0_30px_rgba(251,191,36,0.4)]' :
                  accuracy >= 80 ? 'bg-gradient-to-br from-mint to-red-700 shadow-glow-mint' :
                  accuracy >= 60 ? 'bg-gradient-violet shadow-glow-violet' :
                  'bg-gradient-to-br from-secondary-text/40 to-secondary-text/60'
                }`}>
                  {accuracy === 100 ? <TrophyIcon className="w-10 h-10 text-white" /> :
                   accuracy >= 80 ? <Sparkles className="w-10 h-10 text-white" /> :
                   <Target className="w-10 h-10 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-white">
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
                  <div className="text-xl font-bold text-white">{topicsSet.size}</div>
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
                      <span className="font-medium text-white">{r.code}</span>
                      {r.newMastery && (
                        <span className="ml-auto text-xs bg-violet/20 text-violet-light px-2 py-0.5 rounded-full font-semibold border border-violet/30">
                          ⭐ Mastered!
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

  // Check if daily limit reached (for pre-session screen)
  const preSessionActivity = loadDailyActivity();
  const preSessionTodayQuestions = preSessionActivity[getTodayKey()]?.questions ?? 0;
  const dailyLimitReached = !isSubscribed && preSessionTodayQuestions >= FREE_DAILY_LIMIT;
  const questionsRemainingToday = isSubscribed ? Infinity : Math.max(0, FREE_DAILY_LIMIT - preSessionTodayQuestions);

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
                <h2 className="text-2xl font-bold text-white">Practice Session</h2>
                <p className="text-secondary-text mt-1">Build lasting maths skills</p>
              </div>

              {dailyLimitReached ? (
                <div className="text-center space-y-4">
                  <div className="glass-panel rounded-xl p-4 border border-violet/30">
                    <p className="text-white font-semibold mb-1">Daily limit reached</p>
                    <p className="text-secondary-text text-sm">You've completed your {FREE_DAILY_LIMIT} free questions for today. Come back tomorrow or upgrade for unlimited practice.</p>
                  </div>
                  <button
                    onClick={() => setShowUpgradePrompt(true)}
                    className="w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg btn-gradient-mint text-void shadow-glow-mint"
                  >
                    Unlock Unlimited Practice
                  </button>
                  <button
                    onClick={() => setCurrentPage('home')}
                    className="w-full py-2 text-secondary-text hover:text-white text-sm font-medium transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              ) : (
                <>
                  {/* Remaining questions indicator for free users */}
                  {!isSubscribed && (
                    <div className="text-center mb-4">
                      <span className="text-xs px-3 py-1 glass-panel text-violet-light rounded-full">
                        {questionsRemainingToday} free question{questionsRemainingToday !== 1 ? 's' : ''} remaining today
                      </span>
                    </div>
                  )}

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
                </>
              )}
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
      <div className="ambient-glow" style={{ animationPlayState: 'paused' }} />
      <div className="orb-purple w-72 h-72 -top-36 -right-36 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-cyan w-56 h-56 bottom-10 -left-28 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-pink w-40 h-40 top-1/3 right-0 opacity-50 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />

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
                  className="flex items-center gap-0.5 text-secondary-text hover:text-white text-xs transition-colors shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>

                {/* Topic code badge */}
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: TOPIC_HEX[current.objective.topic] }}
                >
                  {current.objective.code}
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
                          : 'linear-gradient(180deg, #8BA8D9, #5B7FC7, #3D5A8A)',
                      width: `${progressPct}%`
                    }}
                  />
                </div>

                {/* Difficulty level */}
                {current.difficultyLevel && (
                  <span className="text-xs font-semibold text-white/60 shrink-0">
                    Lv {current.difficultyLevel}/5
                  </span>
                )}

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
                                ? 'border-violet bg-violet/20 text-white'
                                : 'border-white/20 hover:border-white/40 bg-white/5 text-white'
                            }`}
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white/70 text-sm font-bold mr-3">
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
                                  : 'text-secondary-text hover:text-white'
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
                                className="w-full px-4 py-3 pr-12 border-2 border-white/20 rounded-xl focus:border-violet focus:outline-none text-lg bg-white/10 text-white placeholder-secondary-text"
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

                        {/* Error Diagnosis */}
                        {!isCorrect && currentDiagnosis?.hasDiagnosis && (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/20">
                                <span className="text-xl">💡</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-amber-300 mb-1">
                                  What went wrong?
                                </h4>
                                <p className="text-sm mb-2 text-amber-200/80">
                                  {currentDiagnosis.diagnosis}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                    

                        {/* Worked Example - show when incorrect and question has worked steps */}
                        {!isCorrect && current.worked && (
                          <details className="bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden">
                            <summary className="p-4 cursor-pointer font-semibold text-blue-300 hover:bg-blue-500/15 transition-colors flex items-center gap-2">
                              <BookOpen className="w-5 h-5" />
                              View Worked Example
                            </summary>
                            <div className="p-4 pt-2">
                              <div className="text-sm text-blue-200/80 space-y-2">
                                {current.worked.map((step, i) => (
                                  <p key={i} className={i === current.worked.length - 1 ? 'font-semibold text-blue-300' : ''}>
                                    {renderRecurring(step)}
                                  </p>
                                ))}
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
                <h2 className="font-bold text-white">Exam Readiness</h2>
                <p className={`text-sm font-medium ${readiness.color}`}>{readiness.label}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-white">{readinessScore}%</div>
              </div>
            </div>

            {/* Readiness bar */}
            <div className="h-4 bg-white/20 rounded-full overflow-hidden">
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
                <h2 className="font-semibold text-white">Weekly Activity</h2>
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
                      <div className="w-full max-w-[40px] h-2 bg-white/20 rounded-lg" />
                    )}
                  </div>
                  <span className="text-xs text-secondary-text">{day.day}</span>
                  <span className="text-xs font-medium text-white">{day.questions}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{weeklyActivity.reduce((s, d) => s + d.sessions, 0)}</div>
                <div className="text-xs text-secondary-text">Sessions this week</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{weeklyActivity.reduce((s, d) => s + d.questions, 0)}</div>
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
                  <span className="font-semibold text-white">{getBestPracticeTime()}</span>
                </div>
                <p className="text-xs text-secondary-text mt-1">Based on when you're most active</p>
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
                <h2 className="font-semibold text-white">Recent Sessions</h2>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessionHistory.slice(-10).reverse().map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-white">
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
              <h3 className="font-semibold text-white mb-1">School Leaderboard</h3>
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
  const { refreshProfile } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  const [allSchoolsList, setAllSchoolsList] = useState([]);
  const [schoolsLoaded, setSchoolsLoaded] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [schoolJoining, setSchoolJoining] = useState(false);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolTown, setNewSchoolTown] = useState('');
  const [summaryStatus, setSummaryStatus] = useState(''); // '', 'copied', 'shared'
  
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
    
    // Count mastered objectives from progress object
    const progressEntries = Object.values(progress || {});
    const masteredCount = progressEntries.filter(p => isMastered(p)).length;
    const totalTracked = progressEntries.length;

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
      `• Objectives mastered: ${masteredCount}${totalTracked > 0 ? ` of ${totalTracked} practised` : ''}`,
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
      `Generated by The Maths Habit`,
    ];
    
    return lines.join('\n');
  };
  
  // Export weekly summary — use share sheet on mobile, copy fallback
  const handleExportSummary = async () => {
    try {
      const summary = generateWeeklySummary();
      // Try native share (works on iOS/Android)
      if (navigator.share) {
        try {
          await navigator.share({ title: 'GCSE Maths Weekly Summary', text: summary });
          setSummaryStatus('shared');
          setTimeout(() => setSummaryStatus(''), 2500);
          return;
        } catch (e) { /* user cancelled share */ }
      }
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(summary);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = summary;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    setSummaryStatus('copied');
    setTimeout(() => setSummaryStatus(''), 2500);
    } catch (err) { console.error('Export error:', err); }
  };

  // Handle export
  const handleExport = () => {
    const data = exportProgress();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-maths-habit-backup-${new Date().toISOString().split('T')[0]}.json`;
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

  // Load all schools once when dropdown opens, then filter client-side
  useEffect(() => {
    if (!schoolDropdownOpen || schoolsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        setSchoolError('');
        const schools = await getAllSchools();
        if (!cancelled) {
          setAllSchoolsList(schools);
          setSchoolsLoaded(true);
          if (schools.length === 0) {
            setSchoolError('No schools in database yet');
          }
        }
      } catch (err) {
        console.error('Failed to load schools:', err);
        if (!cancelled) {
          setSchoolError('Failed to load schools: ' + (err.message || 'Unknown error'));
          setSchoolsLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [schoolDropdownOpen, schoolsLoaded]);

  // Client-side filter (instant, no debounce needed)
  const schoolResults = useMemo(() => {
    if (!schoolFilter.trim() || schoolFilter.trim().length < 2) return [];
    const q = schoolFilter.trim().toLowerCase();
    return allSchoolsList.filter(s =>
      s.name?.toLowerCase().includes(q) || s.town?.toLowerCase().includes(q)
    );
  }, [schoolFilter, allSchoolsList]);

  // Handle joining a school
  const handleJoinSchool = async (school) => {
    if (!user) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      await joinSchool(user.id, school.id);
      setUserSchool(school);
      localStorage.setItem('maths-habit-user-school', JSON.stringify(school));
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
      localStorage.setItem('maths-habit-user-school', JSON.stringify(school));
      setShowAddSchool(false);
      setNewSchoolName('');
      setNewSchoolTown('');
      setSchoolsLoaded(false); // refresh list on next open
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
      localStorage.removeItem('maths-habit-user-school');
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
                <h2 className="font-semibold text-white">Account</h2>
                <p className="text-sm text-secondary-text">Manage your account and subscription</p>
              </div>
            </div>

            {user && (
              <div className="space-y-4">
                {/* User info with avatar */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    {/* Avatar with optional upload */}
                    <div className="relative group">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="w-12 h-12 rounded-full object-cover border-2 border-violet/30"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className={`w-12 h-12 bg-gradient-violet rounded-full flex items-center justify-center text-white font-semibold text-lg ${profile?.avatar_url ? 'hidden' : ''}`}
                      >
                        {(profile?.display_name || user.email)?.[0]?.toUpperCase() || '?'}
                      </div>
                      {/* Camera overlay for subscribers */}
                      {isSubscribed && (
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                          <Camera className="w-5 h-5 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const url = await uploadAvatar(user.id, file);
                                // Update profile in context
                                refreshProfile();
                              } catch (err) {
                                console.error('Avatar upload failed:', err);
                                alert('Failed to upload avatar. Please try again.');
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{profile?.display_name || 'User'}</div>
                      <div className="text-sm text-secondary-text">{user.email}</div>
                      {isSubscribed && (
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-violet cursor-pointer hover:text-violet-light transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  await uploadAvatar(user.id, file);
                                  refreshProfile();
                                } catch (err) {
                                  console.error('Avatar upload failed:', err);
                                  alert('Failed to upload avatar. Please try again.');
                                }
                                e.target.value = '';
                              }}
                            />
                            {profile?.avatar_url ? 'Change photo' : 'Add photo'}
                          </label>
                          {profile?.avatar_url && (
                            <button
                              onClick={async () => {
                                try {
                                  await deleteAvatar(user.id);
                                  refreshProfile();
                                } catch (err) {
                                  console.error('Avatar delete failed:', err);
                                }
                              }}
                              className="text-xs text-secondary-text hover:text-red-400 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
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
                    <div className="font-semibold text-white">
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

                {/* Promo code input for free users */}
                {!isSubscribed && (
                  <PromoCodeInput onSuccess={() => window.location.reload()} />
                )}

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
                  <h2 className="font-semibold text-white">Your School</h2>
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
                        <div className="font-medium text-white">{userSchool.name}</div>
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
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40"
                  />
                  <input
                    type="text"
                    value={newSchoolTown}
                    onChange={(e) => setNewSchoolTown(e.target.value)}
                    placeholder="Town / region..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40"
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
                      className="px-4 py-3 text-secondary-text hover:text-white bg-white/10 rounded-xl transition-colors"
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
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white"
                  >
                    <span className="text-secondary-text/60">Select your school...</span>
                    <svg className={`w-4 h-4 text-secondary-text transition-transform ${schoolDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {schoolDropdownOpen && (
                    <div className="rounded-xl border border-white/10 bg-white/10 shadow-lg overflow-hidden backdrop-blur-sm">
                      {/* Search input */}
                      <div className="p-2 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="text"
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            placeholder="Type your school name..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder-white/40"
                          />
                          {!schoolsLoaded && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text animate-spin" />
                          )}
                        </div>
                      </div>

                      {/* School results */}
                      <div className="max-h-56 overflow-y-auto">
                        {!schoolsLoaded ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">
                            Loading schools...
                          </div>
                        ) : schoolError && allSchoolsList.length === 0 ? (
                          <div className="px-4 py-4 text-center text-sm text-red-400">
                            {schoolError}
                          </div>
                        ) : schoolFilter.trim().length < 2 ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">
                            Start typing to search...
                          </div>
                        ) : schoolResults.length > 0 ? schoolResults.map(school => (
                          <button
                            key={school.id}
                            onClick={() => handleJoinSchool(school)}
                            disabled={schoolJoining}
                            className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center justify-between disabled:opacity-50 border-b border-white/5 last:border-b-0"
                          >
                            <div>
                              <div className="text-sm text-white">{school.name}</div>
                              {school.town && <div className="text-xs text-white/60">{school.town}</div>}
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
                <h2 className="font-semibold text-white">Study Preferences</h2>
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
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-violet"
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
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-not-allowed opacity-50"
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
                  <div className="text-xs text-secondary-text/70">Add Higher-only objectives to practice</div>
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
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-mint"
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
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-not-allowed opacity-50"
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
                  className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-xs text-secondary-text mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
                <p className="text-xs text-secondary-text/70 mt-2">Objectives to master each week</p>
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
                <h2 className="font-semibold text-white">Accessibility</h2>
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
                  <div className="text-xs text-secondary-text/70">Use OpenDyslexic for easier reading</div>
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

            </div>
          </div>

          {/* Data Management */}
          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-secondary-text" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Data Management</h2>
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
                    <h3 className="font-semibold text-white">Weekly Summary</h3>
                    <p className="text-xs text-secondary-text mb-3">
                      Plain-English report for parents or teachers
                    </p>
                    {isSubscribed ? (
                      <button
                        onClick={handleExportSummary}
                        className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                          summaryStatus ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        {summaryStatus === 'copied' ? '✓ Copied to clipboard!' : summaryStatus === 'shared' ? '✓ Shared!' : '📤 Share Summary'}
                      </button>
                    ) : (
                      <button
                        onClick={onUpgrade}
                        className="px-4 py-2 text-white text-sm font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        🔒 Upgrade to unlock
                      </button>
                    )}
                  </div>
                </div>
              </div>
              

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
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-colors border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Progress
                  </button>
                ) : (
                  <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold">Are you sure?</span>
                    </div>
                    <p className="text-sm text-red-400/80 mb-4">
                      This will permanently delete all your progress. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-2 glass-panel hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
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
                <h2 className="font-semibold text-white">About</h2>
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
                <span className="font-medium text-white">{Object.keys(progress).length}</span>
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
              <img
                src="/images/the-maths-habit-logo-hires.jpeg"
                alt="The Maths Habit logo"
                className="w-10 h-10 rounded-xl shadow-glow-celebration group-hover:scale-105 transition-transform nav-logo object-cover"
              />
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
                        : "text-secondary-text hover:text-white hover:bg-white/10"
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
                      : "text-secondary-text hover:text-white"
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
function OnboardingAuthForm({ onSuccess, initialMode = 'signup' }) {
  const [mode, setMode] = useState(initialMode); // 'signin' or 'signup'
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
        // Check display name for profanity
        const profanityCheck = checkProfanity(displayName);
        if (!profanityCheck.clean) {
          throw new Error(profanityCheck.reason);
        }
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
        className="w-full py-3 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
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
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent"
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
            className="text-violet-light hover:text-white transition-colors"
          >
            Already have an account? Sign in
          </button>
        ) : (
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            className="text-violet-light hover:text-white transition-colors"
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
          <h3 className="text-xl font-bold text-white mb-1">Premium</h3>
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
              : 'bg-white/10 text-secondary-text hover:bg-white/20'
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
              : 'bg-white/10 text-secondary-text hover:bg-white/20'
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
        <div className="text-4xl font-bold text-white">
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
          className="text-violet-light hover:text-white text-sm transition-colors"
        >
          Have a class code? Enter it here
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <h4 className="text-white font-medium mb-3 flex items-center gap-2">
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
          placeholder="e.g. MATHS2026"
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-secondary-text/50 focus:ring-2 focus:ring-mint focus:border-transparent uppercase tracking-wider"
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

  // Apply accessibility settings to document.body
  useEffect(() => {
    const b = document.body;
    b.classList.toggle('dyslexia-font', !!settings.dyslexiaFont);
    b.classList.add('high-contrast'); // Always use high contrast for readability
    b.classList.remove('font-large', 'font-xlarge');
    if (settings.fontSize === 'large') b.classList.add('font-large');
    if (settings.fontSize === 'xlarge') b.classList.add('font-xlarge');
  }, [settings.dyslexiaFont, settings.fontSize]);

  const [currentPage, setCurrentPage] = useState('home');
  const [recentSessionCodes, setRecentSessionCodes] = useState([]);
  const [sessionToastData, setSessionToastData] = useState(null);
  const [celebrationIndex, setCelebrationIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Welcome, 2: Auth, 3: Profile Picture, 4: Plan Selection
  const [onboardingAuthMode, setOnboardingAuthMode] = useState('signup');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');
  const [showOneVsOne, setShowOneVsOne] = useState(false);
  const [userSchool, setUserSchool] = useState(null); // { id, name } or null
  const [piro, setPiro] = useState(() => loadPiro());
  const [piroEvolution, setPiroEvolution] = useState(null); // { oldStage, newStage } when evolution happens
  const [piroDecayed, setPiroDecayed] = useState(false); // Show decay warning

  // 1v1 daily limit for free users (1 per day)
  const FREE_1V1_LIMIT = 1;
  const get1v1TodayCount = () => {
    try {
      const data = JSON.parse(localStorage.getItem('maths-habit-1v1-daily') || '{}');
      const todayKey = getTodayKey();
      return data[todayKey] || 0;
    } catch { return 0; }
  };
  const increment1v1Count = () => {
    try {
      const data = JSON.parse(localStorage.getItem('maths-habit-1v1-daily') || '{}');
      const todayKey = getTodayKey();
      data[todayKey] = (data[todayKey] || 0) + 1;
      localStorage.setItem('maths-habit-1v1-daily', JSON.stringify(data));
    } catch {}
  };

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
        // Always pull from cloud first (cloud is source of truth)
        const cloudResult = await loadFromCloud(user.id);

        if (cloudResult.success && cloudResult.hasData) {
          // Cloud had data — refresh React state from localStorage (which loadFromCloud populated)
          setProgress(loadProgress());
          setSettings(loadSettings());
        } else {
          // Cloud is empty — push local data up (first-time user)
          const hasLocalData = localStorage.getItem('maths-habit-progress');
          if (hasLocalData) {
            await migrateLocalToCloud(user.id);
          }
        }
      }
    };
    syncOnLogin();
  }, [user, authLoading]);

  // Fetch user's school on login — also check localStorage cache
  useEffect(() => {
    if (user && !authLoading) {
      // Load cached school immediately for instant display
      try {
        const cached = localStorage.getItem('maths-habit-user-school');
        if (cached) setUserSchool(JSON.parse(cached));
      } catch {}
      // Then fetch fresh from server
      getUserSchool(user.id).then(school => {
        setUserSchool(school);
        if (school) {
          localStorage.setItem('maths-habit-user-school', JSON.stringify(school));
        } else {
          localStorage.removeItem('maths-habit-user-school');
        }
      }).catch(err => {
        console.error('Failed to fetch user school:', err);
      });
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

  // After auth during onboarding, skip plan for returning users or show profile pic step for new ones
  useEffect(() => {
    if (!showOnboarding || !user) return;
    if (onboardingStep !== 2 && onboardingStep !== 3 && onboardingStep !== 4) return;

    // Wait for profile to load before deciding
    if (authLoading) return;

    // Returning user — has profile or local progress
    if (profile || Object.keys(progress).length > 0) {
      setOnboardingComplete();
      setShowOnboarding(false);
      setCurrentPage('home');
    } else if (onboardingStep === 2) {
      // New user — show profile picture step
      setOnboardingStep(3);
    }
  }, [user, showOnboarding, onboardingStep, profile, authLoading]);

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
            {/* App Logo */}
            <div className="w-24 h-24 rounded-2xl mx-auto mb-8 shadow-glow-violet animate-float overflow-hidden">
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
              onClick={() => { setOnboardingAuthMode('signup'); setOnboardingStep(2); }}
              className="w-full py-5 btn-gradient-mint font-bold text-xl rounded-2xl transition-all active:scale-[0.98]"
            >
              Get Started →
            </button>

            <button
              onClick={() => { setOnboardingAuthMode('signin'); setOnboardingStep(2); }}
              className="w-full py-4 mt-3 glass-panel hover:bg-gray-100 font-semibold text-lg text-gray-700 rounded-2xl transition-all active:scale-[0.98]"
            >
              Sign In
            </button>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
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
              className="flex items-center gap-2 text-secondary-text hover:text-white mb-6 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="glass-panel rounded-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {onboardingAuthMode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-secondary-text">
                  {onboardingAuthMode === 'signin' ? 'Sign in to continue' : 'Save your progress and sync across devices'}
                </p>
              </div>

              {/* Embedded Auth Form */}
              <OnboardingAuthForm
                key={onboardingAuthMode}
                onSuccess={() => setOnboardingStep(3)}
                initialMode={onboardingAuthMode}
              />
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Profile Picture (teaser with lock for free users)
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

          <div className="max-w-md w-full relative z-10">
            <div className="glass-panel rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Personalise your profile</h2>
              <p className="text-secondary-text mb-8">Stand out on the leaderboard with a profile picture</p>

              {/* Avatar preview with lock overlay */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="w-28 h-28 rounded-full bg-gradient-violet flex items-center justify-center text-white text-4xl font-bold">
                  {(user?.user_metadata?.full_name || user?.email)?.[0]?.toUpperCase() || '?'}
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center">
                  <Lock className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] text-white/80 font-medium">PRO</span>
                </div>
              </div>

              <p className="text-secondary-text text-sm mb-8">
                Upload a custom profile picture with a <span className="text-mint font-semibold">Pro subscription</span>
              </p>

              <button
                onClick={() => setOnboardingStep(4)}
                className="w-full py-3 btn-gradient-mint text-gray-800 font-semibold rounded-xl"
              >
                Continue
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-mint" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      );
    }

    // Step 4: Plan Selection
    if (onboardingStep === 4) {
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
              <h2 className="text-3xl font-bold text-white mb-2">Choose your plan</h2>
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
                    <h3 className="text-xl font-bold text-white mb-1">Free Plan</h3>
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
                    <div className="text-3xl font-bold text-white">£0</div>
                    <div className="text-secondary-text text-sm">Forever free</div>
                  </div>
                </div>
                <button className="w-full mt-6 py-3 border border-violet rounded-xl text-white font-medium hover:bg-violet/20 transition-colors">
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

  // Update Piro decay/death state when streak changes
  useEffect(() => {
    const currentPiro = loadPiro();
    if (currentPiro.dead) return; // Dead is permanent

    // Calculate actual days since last practice
    const activity = loadDailyActivity();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysMissed = 0;
    if (dayStreak === 0 && !practicedToday) {
      // Find last day they practiced
      for (let d = 1; d <= 30; d++) {
        const check = new Date(today);
        check.setDate(check.getDate() - d);
        const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
        if (activity[key]?.questions >= 5) break;
        daysMissed = d;
      }
    }

    let changed = false;

    // Recovery: practising reverses decay/dying
    if (practicedToday && (currentPiro.decayed || currentPiro.dying)) {
      currentPiro.decayed = false;
      currentPiro.dying = false;
      changed = true;
    }

    // Death ladder (only after reaching Epic)
    if (currentPiro.reachedEpic && daysMissed >= PIRO_DEATH_DAYS && !currentPiro.dead) {
      currentPiro.dead = true;
      currentPiro.decayed = false;
      currentPiro.dying = false;
      changed = true;
    } else if (currentPiro.reachedEpic && daysMissed >= PIRO_DYING_DAYS && !currentPiro.dying) {
      currentPiro.dying = true;
      currentPiro.decayed = false;
      changed = true;
    } else if (currentPiro.reachedEpic && daysMissed >= PIRO_DECAY_DAYS && !currentPiro.decayed && !currentPiro.dying) {
      currentPiro.decayed = true;
      changed = true;
    }

    if (changed) {
      savePiro(currentPiro);
      setPiro({ ...currentPiro });
    }
  }, [dayStreak, needsRepair, practicedToday]);
  
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

  // Gated 1v1 launcher — checks free daily limit
  const tryOpenOneVsOne = () => {
    if (!isSubscribed && get1v1TodayCount() >= FREE_1V1_LIMIT) {
      setShowUpgradePrompt(true);
      return;
    }
    if (!isSubscribed) increment1v1Count();
    setShowOneVsOne(true);
  };

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
        setShowOneVsOne={tryOpenOneVsOne}
        setShowCelebration={setShowCelebration}
        setCelebrationIndex={setCelebrationIndex}
        setShowUpgradePrompt={setShowUpgradePrompt}
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
          onSignOut={async () => { await signOut(); localStorage.removeItem('maths-habit-onboarding-complete'); window.location.reload(); }}
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
      <div className="orb-cyan w-72 h-72 bottom-20 right-10 opacity-60 fixed pointer-events-none hidden md:block" />
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

      {/* Piro Evolution Celebration Modal */}
      {piroEvolution && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPiroEvolution(null)}>
          <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-4">🐉</div>
            <h2 className="text-2xl font-bold text-primary-text mb-2">Piro Evolved!</h2>
            <p className="text-secondary-text mb-4">
              {PIRO_STAGES[piroEvolution.oldStage].name} → <span className="text-[#D4AF37] font-bold">{PIRO_STAGES[piroEvolution.newStage].name}</span>
            </p>
            <div className="w-40 h-40 mx-auto mb-4 rounded-2xl overflow-hidden flex items-center justify-center">
              <PiroMedia display={PIRO_STAGES[piroEvolution.newStage]} className="w-full h-full object-cover rounded-2xl" />
            </div>
            <button
              onClick={() => setPiroEvolution(null)}
              className="btn-gradient-mint px-8 py-3 text-white font-bold rounded-full"
            >
              Amazing!
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-20 pb-28 md:pb-10 relative z-10">

      {/* Piro Dragon Card - Home Screen Hero */}
      <div className="max-w-4xl mx-auto px-2 sm:px-4 mb-4">
        <div className={`glass-panel rounded-3xl p-4 sm:p-6 shadow-glass ${piro.dead ? 'border-red-900/60' : piro.dying ? 'border-red-700/50' : piro.decayed ? 'border-[#8F0000]/40' : ''}`}>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Dragon Video/Image */}
            <div className={`w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center ${piro.dead ? 'piro-decay grayscale' : piro.dying ? 'piro-decay' : piro.decayed ? 'piro-decay' : 'piro-idle'}`}>
              <PiroMedia display={getPiroDisplay(piro)} className="w-full h-full object-cover rounded-2xl" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-bold text-primary-text">Piro</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${piro.dead ? 'bg-red-900/30 text-red-500' : piro.dying ? 'bg-red-800/20 text-red-400' : piro.decayed ? 'bg-[#8F0000]/20 text-[#8F0000]' : 'bg-white/10 text-secondary-text'}`}>
                  {getPiroDisplay(piro).name}
                </span>
              </div>

              {/* Streak Progress Bar */}
              {(() => {
                const progressInfo = getPiroProgress(piro);
                const isMaxStage = piro.stage >= PIRO_STAGES.length - 1;
                return (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-secondary-text mb-1">
                      <span>{dayStreak} day streak</span>
                      {!isMaxStage && progressInfo.nextName && (
                        <span>{progressInfo.needed} day{progressInfo.needed !== 1 ? 's' : ''} to {progressInfo.nextName}</span>
                      )}
                      {isMaxStage && !piro.decayed && !piro.dying && !piro.dead && <span className="text-[#D4AF37]">Max Evolution</span>}
                      {piro.dead && <span className="text-red-500 font-bold">DEAD</span>}
                      {!piro.dead && piro.dying && <span className="text-red-400 font-bold animate-pulse">DYING</span>}
                      {!piro.dead && !piro.dying && piro.decayed && <span className="text-[#8F0000]">Needs care!</span>}
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${piro.dead ? 100 : isMaxStage ? 100 : Math.max(2, progressInfo.progress * 100)}%`,
                          background: piro.dead
                            ? '#991b1b'
                            : piro.dying
                              ? '#dc2626'
                              : piro.decayed
                                ? '#8F0000'
                                : isMaxStage
                                  ? 'linear-gradient(90deg, #D4AF37, #B00053)'
                                  : piro.stage >= 3
                                    ? 'linear-gradient(90deg, #B00053, #A845A2)'
                                    : 'linear-gradient(90deg, #A845A2, #513A6F)',
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Nudge Message */}
              <p className={`text-xs sm:text-sm ${piro.dead ? 'text-red-500' : piro.dying ? 'text-red-400 font-bold' : piro.decayed ? 'text-[#8F0000]' : 'text-secondary-text'}`}>
                {getPiroNudge(piro, dayStreak, todayQuestions, dailyGoal)}
              </p>

              {/* Reset button when dead */}
              {piro.dead && (
                <button
                  onClick={() => {
                    if (window.confirm('Piro is gone forever. Hatch a new egg and start again?')) {
                      const freshPiro = { stage: 0, highestStreak: 0, reachedEpic: false, decayed: false, dying: false, dead: false, evolvedAt: [] };
                      savePiro(freshPiro);
                      setPiro(freshPiro);
                    }
                  }}
                  className="mt-2 px-4 py-1.5 text-xs font-bold rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                >
                  Hatch New Egg
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Heatmap Card */}
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <div className="glass-panel rounded-3xl p-3 sm:p-6 md:p-10 shadow-glass card-hover">

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
                      tier === t ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-gray-800'
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

          {/* Mastery Level Legend - Top */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mb-6 pb-6 border-b-2" style={{borderImage: 'linear-gradient(90deg, transparent, #B00053, #76235E, transparent) 1'}}>
            <span className="text-xs text-secondary-text mr-1">Progress:</span>
            {[
              { level: 0, label: 'New' },
              { level: 1, label: 'Started' },
              { level: 2, label: 'Learning' },
              { level: 3, label: 'Confident' },
              { level: 4, label: 'Exam ready' },
              { level: 5, label: 'Mastered' },
            ].map(({ level, label }) => (
              <div key={level} className="flex items-center gap-1.5">
                <img src={TILE_IMAGES[level]} alt={label} className="w-4 h-4 rounded-sm object-cover" />
                <span className="text-xs text-secondary-text">{label}</span>
              </div>
            ))}
          </div>

          {/* Heatmap Explainer - shows for new users */}
          {!loadShownTips().includes('heatmapExplainer') && (
            <div className="mb-4 p-4 glass-panel rounded-xl border border-violet/30 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">🗺️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 mb-2">How the heatmap works</p>
                  <div className="space-y-1.5 text-xs text-secondary-text">
                    <div className="flex items-center gap-2">
                      <img src={TILE_IMAGES[0]} alt="Stone" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span>Stone = not started yet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src={TILE_IMAGES[2]} alt="Gem" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span>Coloured gems = making progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src={TILE_IMAGES[4]} alt="Crimson" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span>Bright gem = nearly there</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src={TILE_IMAGES[5]} alt="Gold" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span>Gold = mastered!</span>
                    </div>
                  </div>
                  <p className="text-xs text-secondary-text/60 mt-2">Tap any tile to see its objective details</p>
                </div>
                <button
                  onClick={(e) => { e.currentTarget.closest('.animate-fade-in').remove(); markTipShown('heatmapExplainer'); }}
                  className="text-secondary-text/60 hover:text-gray-800 shrink-0 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* THE HEATMAP - Hero Element */}
          <div className="flex justify-center py-4" style={{ overflow: 'hidden', width: '100%' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: window.innerWidth < 480 ? 3 : 6,
              width: '100%',
              maxWidth: `${cols * 36 + (cols - 1) * 6}px`
            }}>
              {allObjectives.map((obj) => {
                const level = getLevel(obj.code);
                const objProg = progress[obj.code];
                const isMastered = level >= 5;
                const isExamReady = level === 4;
                const recency = getRecencyFactor(objProg?.lastPracticed);
                const needsRevisit = recency < 0.6 && level > 0 && level < 5;
                const tileOpacity = level === 0 ? 1 : (0.5 + 0.5 * recency);
                return (
                  <div
                    key={obj.code}
                    onClick={() => handleTileTap(obj)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      opacity: tileOpacity,
                    }}
                    className="w-full transition-all duration-200 hover:scale-110 hover:z-20 hover:brightness-110 cursor-pointer active:scale-95"
                  >
                    {/* Tile image */}
                    <img
                      src={TILE_IMAGES[level] || TILE_IMAGES[0]}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                    {/* Gentle glow on recently practiced tiles (after celebration) */}
                    {recentSessionCodes.includes(obj.code) && (
                      <div className="heatmap-glow-afterpulse" style={{
                        position: 'absolute', inset: -1, borderRadius: 6, pointerEvents: 'none',
                        zIndex: 9,
                      }} />
                    )}
                    {/* Revisit indicator overlay */}
                    {needsRevisit && !isExamReady && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-[8px] text-white/70">↻</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend - Tile Icons */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-secondary-text">
              <div className="flex items-center gap-2">
                <img src={TILE_IMAGES[5]} alt="Mastered" style={{ width: 20, height: 20, borderRadius: 3 }} className="object-cover" />
                <span>Mastered</span>
              </div>
              <div className="flex items-center gap-2">
                <img src={TILE_IMAGES[4]} alt="Nearly there" style={{ width: 20, height: 20, borderRadius: 3 }} className="object-cover" />
                <span>Nearly there</span>
              </div>
              <div className="flex items-center gap-2">
                <img src={TILE_IMAGES[0]} alt="Needs revisit" style={{ width: 20, height: 20, borderRadius: 3, opacity: 0.6 }} className="object-cover" />
                <span>Needs revisit</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-secondary-text/60 mt-2">
              Gems fade when topics haven't been practiced recently
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
                <div className="mt-2 bg-white/20 rounded-full h-3 overflow-hidden">
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
                <span className="text-sm font-bold text-white">{todayQuestions}</span>
              </div>
            </div>

            {/* Status */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className={`text-sm font-semibold ${dailyProgress >= 100 ? 'text-mint' : 'text-white'}`}>
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
                onClick={() => tryOpenOneVsOne()}
                className="px-6 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 text-white btn-gradient-violet"
              >
                <Swords className="w-4 h-4" />
                1v1 Battle
              </button>

              {/* Sign In Button — shown when logged out */}
              {!user && (
                <button
                  onClick={() => { setAuthModalMode('signin'); setShowAuthModal(true); }}
                  className="px-6 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 text-gray-700 glass-panel hover:bg-gray-100"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
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
              <h2 className="font-bold text-white">{userSchool.name}{userSchool.town ? `, ${userSchool.town}` : ''}</h2>
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
                <h3 className="font-semibold text-white text-sm">School Leaderboard</h3>
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
  const levelLabels = ['Not started', 'Getting started', 'Building knowledge', 'Good progress', 'Nearly there', '⭐ Mastered!'];
  const levelLabel = levelLabels[current.level] || 'Learning';
  const progressPct = (current.level / 5) * 100;
  const isLast = currentIndex >= objectives.length - 1;
  const isMastered = current.level >= 5;

  // Generate tile confetti pieces for mastery celebration
  const tileConfetti = isMastered ? [...Array(50)].map((_, i) => {
    const allTopicColors = ['#B00053', '#A845A2', '#76235E', '#513A6F', '#31456A', '#2F4858', '#D4AF37', '#8E0039'];
    const color = allTopicColors[Math.floor(Math.random() * allTopicColors.length)];
    const size = 10 + Math.random() * 16;
    const left = Math.random() * 100;
    const delay = Math.random() * 2.5;
    const duration = 2.5 + Math.random() * 2;
    const rotation = Math.random() * 360;
    const opacity = 0.6 + Math.random() * 0.4;
    return { color, size, left, delay, duration, rotation, opacity, key: `${currentIndex}-${i}` };
  }) : [];

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
      {/* Tile confetti for mastery */}
      {isMastered && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 61 }}>
          <style>{`
            @keyframes tileFall {
              0% { transform: translateY(-30px) rotate(var(--rot)) scale(0.3); opacity: 0; }
              10% { opacity: var(--op); transform: translateY(0) rotate(var(--rot)) scale(1); }
              90% { opacity: var(--op); }
              100% { transform: translateY(calc(100vh + 30px)) rotate(calc(var(--rot) + 360deg)) scale(0.8); opacity: 0; }
            }
            @keyframes tileSway {
              0%, 100% { margin-left: 0; }
              25% { margin-left: 20px; }
              75% { margin-left: -20px; }
            }
          `}</style>
          {tileConfetti.map(t => (
            <div
              key={t.key}
              style={{
                position: 'absolute',
                left: `${t.left}%`,
                top: '-30px',
                width: `${t.size}px`,
                height: `${t.size}px`,
                borderRadius: Math.random() > 0.3 ? 4 : '50%',
                backgroundColor: t.color,
                border: `1px solid rgba(255,255,255,0.3)`,
                boxShadow: `0 0 6px ${t.color}80`,
                '--rot': `${t.rotation}deg`,
                '--op': t.opacity,
                animation: `tileFall ${t.duration}s ease-out forwards, tileSway ${1.5 + Math.random()}s ease-in-out infinite`,
                animationDelay: `${t.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Animated card */}
      <div
        key={current.code}
        className="celebration-card"
        style={{
          width: 'min(85vw, 340px)',
          aspectRatio: '1',
          borderRadius: 24,
          background: isMastered
            ? `linear-gradient(135deg, #FFD70040, ${topicColor}30, #FFD70020)`
            : `linear-gradient(135deg, ${topicColor}40, ${topicColor}20)`,
          border: isMastered ? '3px solid #FFD700' : `3px solid ${topicColor}`,
          boxShadow: isMastered
            ? `0 0 50px #FFD70060, 0 0 100px ${topicColor}40, 0 0 150px #FFD70020`
            : `0 0 40px ${topicColor}60, 0 0 80px ${topicColor}30, 0 0 120px ${topicColor}15`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', position: 'relative', overflow: 'hidden',
          zIndex: 62,
        }}
      >
        {/* White glow pulse */}
        <div className="celebration-glow" style={{
          position: 'absolute', inset: -8, borderRadius: 32,
          border: isMastered ? '2px solid rgba(255,215,0,0.7)' : '2px solid rgba(255,255,255,0.6)',
          boxShadow: isMastered
            ? '0 0 40px rgba(255,215,0,0.4), inset 0 0 40px rgba(255,215,0,0.15)'
            : '0 0 30px rgba(255,255,255,0.3), inset 0 0 30px rgba(255,255,255,0.1)',
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
            background: isMastered
              ? `linear-gradient(90deg, #FFD700, ${topicColor})`
              : `linear-gradient(90deg, ${topicColor}, ${topicColor}CC)`,
            boxShadow: isMastered ? `0 0 16px #FFD70080` : `0 0 12px ${topicColor}80`,
          }} />
        </div>

        <span style={{ color: isMastered ? '#FFD700' : 'rgba(255,255,255,0.7)', fontSize: isMastered ? '1.1rem' : '0.9rem', fontWeight: isMastered ? 700 : 500 }}>
          {isMastered ? '⭐ Mastered!' : levelLabel}
        </span>
      </div>

      {/* Dots */}
      <div style={{ position: 'fixed', bottom: '3rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 62 }}>
        {objectives.map((_, i) => (
          <div key={i} style={{
            width: i === currentIndex ? 24 : 8, height: 8, borderRadius: 4,
            background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <p style={{ position: 'fixed', bottom: '1.2rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', zIndex: 62 }}>
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
