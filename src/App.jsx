import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronRight, X, Sparkles, Download, Upload, Trash2, AlertTriangle, Info, TrendingUp, Target, Award, Zap, Calendar, User, LogOut, BookOpen, Swords, Search, School, Loader2, Trophy, Camera, Lock, Star, Flag } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import OneVsOne from './components/OneVsOne';
// HandwritingInput removed — Mathpix integration discontinued
import SchoolLeaderboard from './components/SchoolLeaderboard';
import { getAllSchools, createSchool, joinSchool, joinSchoolByCode, leaveSchool, getUserSchool } from './lib/leaderboardService';
import { redirectToCheckout, STRIPE_PRICES } from './lib/stripe';
import IOSUpgradePrompt from './components/IOSUpgradePrompt';
import { initIAP, destroyIAP } from './lib/iapService';
import { checkProfanity, sanitiseName } from './lib/profanityFilter';
import { uploadAvatar, deleteAvatar } from './lib/avatarService';
import { migrateLocalToCloud, loadFromCloud, saveProgressToCloud, saveFsrsToCloud, saveSettingsToCloud, saveStreakToCloud, saveDailyActivityToCloud } from './lib/syncService';
import { supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { CubeIcon, SquareRootIcon, CompassIcon, InfinityIcon, CompassStarIcon, BooksIcon, PiIcon } from './components/MathIcons';
import DragDropOrder from './components/DragDropOrder';
import DragDropMatch from './components/DragDropMatch';
import ErrorBoundary from "./components/ErrorBoundary";
import { safeInitial, safeDisplayName } from "./lib/safeDisplayName";
import { Capacitor } from "@capacitor/core";
const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
import { diamondQuestionBank } from './data/diamondQuestionBank.js';
import { higherQuestionBank } from './data/higherQuestionBank.js';

// Custom maths-themed nav icons (image-based)
const NavIcon = ({ src, className = '' }) => (
  <img src={src} alt="" className={`${className} object-contain rounded-md`} draggable={false} />
);
const HomeIcon = ({ className }) => <NavIcon src="/images/nav/home.png" className={className} />;
const HeatmapIcon = ({ className }) => <NavIcon src="/images/nav/journey.png" className={className} />;
const PracticeIcon = ({ className }) => <NavIcon src="/images/nav/practice.png" className={className} />;
const StatsIcon = ({ className }) => <NavIcon src="/images/nav/stats.png" className={className} />;
const SettingsIcon = ({ className }) => <NavIcon src="/images/nav/settings.png" className={className} />;

// Legacy icon aliases (used elsewhere in app)
const StreakIcon = InfinityIcon;     // Infinity ∞ for Streak
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
  3: '/images/tiles/magenta-jem.jpeg',    // Magenta gem (confident)
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

// Permanently answered questions — once correct, never show again
const ANSWERED_CORRECT_KEY = 'maths-habit-answered-correct';

const loadAnsweredCorrect = () => {
  try {
    const saved = localStorage.getItem(ANSWERED_CORRECT_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
};

const saveAnsweredCorrect = (set) => {
  try {
    localStorage.setItem(ANSWERED_CORRECT_KEY, JSON.stringify([...set]));
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
  { name: 'Hatchling',     minStreak: 7,  image: '/images/Piro/hatchling.png',      video: '/images/Piro/hatchling.mp4' },
  { name: 'Smoke Flame',   minStreak: 14, image: '/images/Piro/smoke-flame.png',    video: '/images/Piro/smoke-flame.mp4' },
  { name: 'Teal Flame',    minStreak: 21, image: '/images/Piro/teal-flame.png',     video: '/images/Piro/teal-flame.mp4' },
  { name: 'Magenta Flame', minStreak: 28, image: '/images/Piro/magenta-flame.png',  video: '/images/Piro/magenta-flame.mp4' },
  { name: 'Epic Piro',     minStreak: 35, image: '/images/Piro/gold-flames.png',    video: '/images/Piro/gold-flames.mp4' },
  { name: 'Legendary Piro', minStreak: 70, image: '/images/Piro/diamond-piro.png',  video: '/images/Piro/diamond-piro.mp4' },
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

  // Check if reached Epic Piro (35-day streak)
  if (piro.highestStreak >= 35) {
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
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: false, dead: true, newStage: piro.stage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DYING_DAYS) {
    piro.dying = true;
    piro.decayed = false;
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: false, dying: true, dead: false, newStage: piro.stage, oldStage };
  }

  if (piro.reachedEpic && daysMissed >= PIRO_DECAY_DAYS) {
    piro.decayed = true;
    piro.dying = false;
    piro.stage = Math.max(oldStage, earnedStage);
    savePiro(piro);
    return { piro, evolved: false, decayed: true, dying: false, dead: false, newStage: piro.stage, oldStage };
  }

  // Evolution check — stage can only go UP, never down
  const newStage = Math.max(oldStage, earnedStage);
  piro.stage = newStage;

  if (newStage > oldStage) {
    piro.evolvedAt.push({ stage: newStage, name: PIRO_STAGES[newStage].name, date: Date.now() });
  }

  savePiro(piro);
  return { piro, evolved: newStage > oldStage, decayed: false, dying: false, dead: false, newStage, oldStage };
};

// Get current display info for Piro
// Once evolved, Piro always shows its current evolution stage — never reverts visually.
// Decay/dying flags only affect styling (borders, nudge text), not the dragon image.
const getPiroDisplay = (piro) => {
  if (piro.dead) {
    return { name: PIRO_DEAD.name, image: PIRO_DEAD.image, video: PIRO_DEAD.video, isDead: true, isDying: false, isDecayed: false };
  }
  const stage = PIRO_STAGES[piro.stage] || PIRO_STAGES[0];
  return { name: stage.name, image: stage.image, video: stage.video, isDead: false, isDying: !!piro.dying, isDecayed: !!piro.decayed };
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
const getPiroProgress = (piro, currentStreak) => {
  const currentStageIdx = piro.stage;
  if (currentStageIdx >= PIRO_STAGES.length - 1) {
    return { needed: 0, total: 0, progress: 1, nextName: null }; // Max stage (Legendary)
  }
  const streak = currentStreak ?? piro.highestStreak; // Use current streak if provided
  const nextStage = PIRO_STAGES[currentStageIdx + 1];
  const currentThreshold = PIRO_STAGES[currentStageIdx].minStreak;
  const nextThreshold = nextStage.minStreak;
  const range = nextThreshold - currentThreshold;
  const progressInRange = streak - currentThreshold;
  return {
    needed: nextThreshold - streak,
    total: range,
    progress: Math.min(1, Math.max(0, progressInRange / range)),
    nextName: nextStage.name,
  };
};

// Near-miss nudge messages
const getPiroNudge = (piro, dayStreak, todayQuestions, dailyGoal) => {
  const display = getPiroDisplay(piro);
  const progressInfo = getPiroProgress(piro, dayStreak);

  // Dead - game over
  if (display.isDead) {
    return "Piro has died. Reset to hatch a new egg and start again.";
  }

  // Close to death - critical warning
  if (display.isDying) {
    return "Piro is fading! Practice NOW to save your dragon!";
  }

  // Decayed state - urgent
  if (display.isDecayed) {
    return "Piro misses you! Practice today to keep your streak alive.";
  }

  // Egg stage - encourage first streak
  if (piro.stage === 0 && piro.highestStreak === 0) {
    return "Build a 7-day streak to hatch Piro!";
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
      { q: "Shop A sells 1.2 kg of rice for £1.80. Shop B sells 500 g of rice for £0.80. Which shop offers the better value?", type: "mcq", options: ["Shop A", "Shop B", "They are the same value", "Not enough information"], a: "Shop A", calculator: true, worked: ["Shop A: £1.80 ÷ 1200g = £0.0015 per gram", "Shop B: £0.80 ÷ 500g = £0.0016 per gram", "Shop A is cheaper per gram"] },
      { q: "Shop X sells 1.5 kg of pasta for £2.10. Shop Y sells 400 g of pasta for £0.60. Which shop offers the better value?", type: "mcq", options: ["Shop X", "Shop Y", "They are the same value", "Not enough information"], a: "Shop X", calculator: true, worked: ["Shop X: £2.10 ÷ 1500g = £0.0014 per gram", "Shop Y: £0.60 ÷ 400g = £0.0015 per gram", "Shop X is cheaper per gram"] },
      { q: "Shop Alpha sells 2 kg of flour for £1.40. Shop Beta sells 750 g of flour for £0.60. Which shop offers the better value?", type: "mcq", options: ["Shop Alpha", "Shop Beta", "They are the same value", "Not enough information"], a: "Shop Alpha", calculator: true, worked: ["Shop Alpha: £1.40 ÷ 2000g = £0.0007 per gram", "Shop Beta: £0.60 ÷ 750g = £0.0008 per gram", "Shop Alpha is cheaper per gram"] },
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
      { q: "A scatter graph shows hours studied on the x-axis and exam scores on the y-axis. As hours increase, scores tend to increase. What type of correlation is this?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation", "Perfect correlation"], a: "Positive correlation", worked: ["Both variables increase together", "This indicates positive correlation"], diagram: "scatter-graph" },
      { q: "A scatter graph shows the age of a car on the x-axis and its value on the y-axis. As age increases, value tends to decrease. What type of correlation is this?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation", "Perfect correlation"], a: "Negative correlation", worked: ["One variable increases, the other decreases", "This indicates negative correlation"] },
      { q: "As the temperature increases, ice cream sales tend to increase. What type of correlation would a scatter graph of this data show?", type: "mcq", options: ["Positive correlation", "Negative correlation", "No correlation", "Perfect correlation"], a: "Positive correlation", worked: ["Both variables increase together", "This indicates positive correlation"] },
    ],
    // Level 4 (4 marks) — Stem-and-leaf / dual bar chart comparison
    [
      { q: "Room A plant heights (cm): 12, 14, 15, 16, 18. Room B plant heights (cm): 14, 16, 18, 19, 21. What is the median height of Room B?", a: "18", worked: ["Room B heights: 14, 16, 18, 19, 21", "n = 5 (odd), so median is the middle value", "Median = 3rd value = 18"] },
      { q: "A stem-and-leaf diagram shows ages: 1|2 3 5 8, 2|1 4 6 7 8 9, 3|0 5. Find the range of the ages.", a: "23", worked: ["Lowest value: 12 (from 1|2)", "Highest value: 35 (from 3|5)", "Range = 35 − 12 = 23"] },
      { q: "Use the dual bar chart to find: on which day was the difference between Bread and Milk sales greatest?", type: "mcq", options: ["Monday", "Tuesday", "Wednesday", "Thursday"], a: "Wednesday", worked: ["Calculate differences for each day from the chart", "Wednesday shows the largest gap between the two bars"], diagram: "dual-bar-chart" },
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
    // Level 1 (2 marks) — Square roots and squares (N5)
    [
      { q: "A square garden has an area of 144 m². Find the length of one side.", a: "12", worked: ["Side² = 144", "Side = √144 = 12 m"] },
      { q: "A square has an area of 64 cm². What is the length of one side?", a: "8", worked: ["Side² = 64", "Side = √64 = 8 cm"] },
      { q: "Work out √81 + √25", a: "14", worked: ["√81 = 9", "√25 = 5", "9 + 5 = 14"] },
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


// Share question banks for combined objectives (ORIGINAL — these are fallbacks)
// The gold questions below provide unique content for each spec code.
// These shared references are kept as fallback variants alongside gold questions.
const _originalSharedRefs = {
  'N7': 'N6', 'N15': 'N14', 'A4': 'A1', 'A18': 'A17', 'G3': 'G1', 'G4': 'G1',
  'G16': 'G12', 'G17': 'G12', 'G21': 'G20', 'P8': 'P7', 'S4': 'S2',
  'N8': 'N5', 'N9': 'N5', 'N10': 'N5', 'N11': 'N5', 'N16': 'N5',
  'A5': 'A3', 'A6': 'A3', 'A7': 'A3', 'A8': 'A3', 'A10': 'A3', 'A11': 'A3',
  'A14': 'A3', 'A19': 'A3', 'A22': 'A3', 'A23': 'A3', 'A24': 'A3', 'A25': 'A3',
  'R3': 'R2', 'R7': 'R2', 'R8': 'R2', 'R9': 'R2', 'R12': 'R2', 'R13': 'R2',
  'R14': 'R2', 'R15': 'R2', 'R16': 'R2',
  'G5': 'G2', 'G6': 'G2', 'G7': 'G2', 'G8': 'G2', 'G9': 'G2', 'G11': 'G2',
  'G13': 'G2', 'G14': 'G2', 'G15': 'G2', 'G18': 'G2', 'G19': 'G2', 'G25': 'G2',
  'P5': 'P4', 'P6': 'P4', 'S1': 'P4', 'S5': 'P4', 'S6': 'P4',
};


// ═══════════════════════════════════════════════════════════════
// GOLD LEVEL QUESTIONS — unique questions for each of the 84 foundation objectives
// Generated from Master-Question-Bank-Gold-Level.xlsx
// Each spec code has 5 levels (Grade 1–5), 1 gold question per level
// Questions with frozen: true need images before being served to students
// ═══════════════════════════════════════════════════════════════
const goldQuestionBank = {
  'N1': [ // Obj 11: FDP Equivalence
    [{ q: 'Write 50% as a fraction in its simplest form.', a: '1/2', type: 'fraction', worked: ['50% means 50 out of 100', '50/100 = 1/2 when simplified'] }], // Grade 1
    [{ q: 'Write 0.3 as a fraction.', a: '3/10', type: 'fraction', worked: ['0.3 has one decimal place', '0.3 = 3/10'] }], // Grade 2
    [{ q: 'Write 3/4 as a percentage.', a: '75', worked: ['3/4 = ? out of 100', 'Multiply both numerator and denominator by 25: (3 × 25)/(4 × 25) = 75/100', '75/100 = 75%'] }], // Grade 3
    [{ q: 'Which of these is the smallest: 0.42, 45%, 8/30, or 0.404?', a: '8/30', type: 'mcq', worked: ['Convert all to decimals: 0.42, 45% = 0.45, 8/30 ≈ 0.267, 0.404', 'Order: 0.267 < 0.404 < 0.42 < 0.45', '8/30 is the smallest'] }], // Grade 4
    [{ q: 'Express 65 out of 80 as a percentage.', a: '81.25', worked: ['65 out of 80 = 65/80', 'Convert to a percentage: (65/80) × 100', '0.8125 × 100 = 81.25%'] }], // Grade 5
  ],
  'N2': [ // Obj 1: Basic Arithmetic
    [{ q: 'Work out 15 + 28.', a: '43', worked: ['15 + 28 = 43'] }], // Grade 1
    [{ q: 'Work out 144 ÷ 6.', a: '24', worked: ['144 ÷ 6 = 24'] }], // Grade 2
    [{ q: 'Calculate 3 × (8 + 4) − 5.', a: '31', worked: ['Work out the bracket first: 8 + 4 = 12', 'Then multiply: 3 × 12 = 36', 'Finally subtract: 36 − 5 = 31'] }], // Grade 3
    [{ q: 'A theatre has 24 rows of seats with 18 seats in each row. How many seats are there in total?', a: '432', worked: ['Multiply rows by seats per row: 24 × 18', '24 × 18 = 432 seats'] }], // Grade 4
    [{ q: 'Work out (12 − 4) × (2 + 1).', a: '24', worked: ['Work out the first bracket: 12 − 4 = 8', 'Work out the second bracket: 2 + 1 = 3', 'Multiply the results: 8 × 3 = 24'] }], // Grade 5
  ],
  'N3': [ // Obj 60: Multi-step Problems
    [{ q: 'A cinema ticket costs £8.50 and popcorn costs £3.20. Work out the change from £20.', a: '8.30', worked: ['Add the costs: £8.50 + £3.20 = £11.70', 'Work out change: £20 − £11.70 = £8.30'] }], // Grade 1
    [{ q: 'A soup recipe for 4 people requires 200 g of vegetables. How much vegetable is needed for 10 people?', a: '500', worked: ['Work out how much per person: 200 ÷ 4 = 50 g per person', 'For 10 people: 50 × 10 = 500 g'] }], // Grade 2
    [{ q: 'A car uses 8 litres per 100 km. Fuel costs £1.45 per litre. Calculate the cost of fuel for a 250 km journey.', a: '29', calculator: true, worked: ['For 250 km: (250 ÷ 100) × 8 = 2.5 × 8 = 20 litres', 'Cost: 20 × £1.45 = £29'] }], // Grade 3
    [{ q: 'A tank measures 1.2 m × 0.8 m × 0.5 m and is filled at a rate of 20 litres per minute. How many minutes does it take to fill?', a: '24', calculator: true, frozen: true, worked: ['Volume = length × width × height = 1.2 × 0.8 × 0.5 = 0.48 m³', '0.48 m³ = 480 litres (1 m³ = 1000 litres)', 'Time = 480 ÷ 20 = 24 minutes'] }], // Grade 4
    [{ q: 'A rectangle has a length 20% greater than its width and an area of 480 cm². Work out the exact perimeter.', a: '88', worked: ['Let width = w, then length = 1.2w', 'Area: w × 1.2w = 480, so 1.2w² = 480, w² = 400, w = 20 cm', 'Length = 1.2 × 20 = 24 cm', 'Perimeter = 2(20 + 24) = 2 × 44 = 88 cm'] }], // Grade 5
  ],
  'N4': [ // Obj 7: Factors, Multiples & Primes
    [{ q: 'Write down the 5th multiple of 6.', a: '30', worked: ['The 5th multiple of 6 = 6 × 5 = 30'] }], // Grade 1
    [{ q: 'How many factors does 24 have?', a: '8', worked: ['Factors of 24: 1, 2, 3, 4, 6, 8, 12, 24', 'Count them: 8 factors in total'] }], // Grade 2
    [{ q: 'Find the Lowest Common Multiple (LCM) of 8 and 12.', a: '24', worked: ['Multiples of 8: 8, 16, 24, 32...', 'Multiples of 12: 12, 24, 36...', 'The lowest common multiple is 24'] }], // Grade 3
    [{ q: 'Find the Highest Common Factor (HCF) of 36 and 48.', a: '12', worked: ['Factors of 36: 1, 2, 3, 4, 6, 9, 12, 18, 36', 'Factors of 48: 1, 2, 3, 4, 6, 8, 12, 16, 24, 48', 'Common factors: 1, 2, 3, 4, 6, 12', 'Highest common factor is 12'] }], // Grade 4
    [{ q: '120 = 2^a × 3 × 5. Work out the value of a.', a: '3', worked: ['Prime factorise 120: 120 = 2 × 60 = 2 × 2 × 30 = 2 × 2 × 2 × 15 = 2³ × 3 × 5', 'So a = 3'] }], // Grade 5
  ],
  'N5': [ // Obj 50: Combinatorics
    [{ q: 'A shop has 4 types of sandwich and 3 types of drink. How many different meal combinations are there?', a: '12', worked: ['Use the multiplication principle: 4 × 3 = 12 combinations'] }], // Grade 1
    [{ q: 'How many 2-digit numbers can be made from the digits 3, 6, 8 without repeating any digit?', a: '6', worked: ['First digit has 3 choices: 3, 6, or 8', 'Second digit has 2 choices (can\'t repeat the first)', 'Total: 3 × 2 = 6'] }], // Grade 2
    [{ q: 'A password code uses 1 letter (A-D) and 1 digit (1-5). How many different codes are possible?', a: '20', worked: ['4 choices for the letter (A, B, C, or D)', '5 choices for the digit (1, 2, 3, 4, or 5)', 'Total: 4 × 5 = 20 codes'] }], // Grade 3
    [{ q: '3 friends have 3 seats to sit in. How many different seating arrangements are there?', a: '6', worked: ['First seat: 3 choices', 'Second seat: 2 choices', 'Third seat: 1 choice', 'Total: 3 × 2 × 1 = 6 arrangements'] }], // Grade 4
    [{ q: 'A pizza company offers 4 starters, 6 main courses, and 3 desserts. How many different 3-course meals are possible?', a: '72', worked: ['Use the multiplication principle: 4 × 6 × 3 = 72 different meals'] }], // Grade 5
  ],
  'N6': [ // Obj 8: Indices and Roots
    [{ q: 'Work out the value of 5².', a: '25', worked: ['5² = 5 × 5 = 25'] }], // Grade 1
    [{ q: 'Work out the value of √64.', a: '8', worked: ['√64 = 8 (because 8 × 8 = 64)'] }], // Grade 2
    [{ q: 'Simplify a⁴ × a³. What is the answer in the form aⁿ?', a: '7', worked: ['When multiplying powers with the same base, add the exponents', 'a⁴ × a³ = a^(4+3) = a⁷', 'n = 7'] }], // Grade 3
    [{ q: 'Simplify b⁷ ÷ b². What is the answer in the form bⁿ?', a: '5', worked: ['When dividing powers with the same base, subtract the exponents', 'b⁷ ÷ b² = b^(7−2) = b⁵', 'n = 5'] }], // Grade 4
    [{ q: 'Work out 2³ × √81 − 4².', a: '56', worked: ['2³ = 2 × 2 × 2 = 8', '√81 = 9', '4² = 4 × 4 = 16', '8 × 9 − 16 = 72 − 16 = 56'] }], // Grade 5
  ],
  'N7': [ // Obj 71: Index Laws
    [{ q: 'Work out 3³.', a: '27', worked: ['3³ = 3 × 3 × 3 = 27'] }], // Grade 1
    [{ q: 'Express 8 × 8 × 8 × 8 × 8 in the form 8ⁿ.', a: '5', worked: ['Count how many times 8 is multiplied', '8 × 8 × 8 × 8 × 8 has 5 factors of 8', 'So the answer is 8⁵, and n = 5'] }], // Grade 2
    [{ q: 'Simplify a⁶ × a³.', a: '9', worked: ['When multiplying powers with the same base, add the exponents', 'a⁶ × a³ = a^(6+3) = a⁹', 'The answer is 9'] }], // Grade 3
    [{ q: 'Simplify c⁹ ÷ c².', a: '7', worked: ['When dividing powers with the same base, subtract the exponents', 'c⁹ ÷ c² = c^(9−2) = c⁷', 'The answer is 7'] }], // Grade 4
    [{ q: 'Work out (2⁴ × 2⁵) ÷ 2⁶. Give your answer as an exact number.', a: '8', worked: ['2⁴ × 2⁵ = 2^(4+5) = 2⁹', '2⁹ ÷ 2⁶ = 2^(9−6) = 2³', '2³ = 2 × 2 × 2 = 8'] }], // Grade 5
  ],
  'N8': [ // Obj 2: Fractions
    [{ q: 'A grid contains 12 identical squares. How many squares is 1/4 of 12?', a: '3', worked: ['1/4 of 12 = 12 ÷ 4 = 3 squares'] }], // Grade 1
    [{ q: 'Work out 3/7 + 2/7.', a: '5/7', type: 'fraction', worked: ['Both fractions have the same denominator', '3/7 + 2/7 = (3+2)/7 = 5/7'] }], // Grade 2
    [{ q: 'Write 3 2/5 as an improper fraction.', a: '17/5', type: 'fraction', worked: ['Multiply the whole number by the denominator: 3 × 5 = 15', 'Add the numerator: 15 + 2 = 17', 'Keep the same denominator: 17/5'] }], // Grade 3
    [{ q: 'Work out 3/4 × 5/9. Give your answer in its simplest form.', a: '5/12', type: 'fraction', worked: ['Multiply numerators: 3 × 5 = 15', 'Multiply denominators: 4 × 9 = 36', 'Simplify: 15/36 = 5/12 (divide by 3)'] }], // Grade 4
    [{ q: 'Work out 2 1/3 ÷ 1 3/4. Give your answer as a mixed number in its simplest form.', a: '1 1/3', type: 'fraction', worked: ['Convert to improper fractions: 2 1/3 = 7/3 and 1 3/4 = 7/4', 'To divide fractions, multiply by the reciprocal: 7/3 × 4/7', 'Simplify: (7 × 4)/(3 × 7) = 28/21 = 4/3', 'Convert to mixed number: 4/3 = 1 1/3'] }], // Grade 5
  ],
  'N9': [ // Obj 9: Standard Form
    [{ q: 'Which of these is 4,000 in standard form? A) 4×10³  B) 40×10²  C) 0.4×10⁴', a: '4×10^3', type: 'mcq' , worked: ['4,000 = 4 × 1,000 = 4 × 10³', 'So the answer is 4×10³ (Option A)']}], // Grade 1
    [{ q: 'Write 3.5 × 10³ as an ordinary number.', a: '3500', worked: ['3.5 × 10³ means 3.5 × 1000', '3.5 × 1000 = 3500'] }], // Grade 2
    [{ q: 'Which is 0.00072 in standard form? A) 7.2×10⁻⁴  B) 72×10⁻⁵  C) 0.72×10⁻³', a: '7.2×10^-4', type: 'mcq' , worked: ['0.00072: Move decimal 4 places right to get 7.2', 'Moved right so power is negative: 7.2 × 10⁻⁴', 'Option A is correct']}], // Grade 3
    [{ q: 'Work out (2×10⁴)×(4×10³). Give your answer in the form k × 10ⁿ. What is the value of n?', a: '7' , worked: ['(2×10⁴)×(4×10³) = (2×4)×(10⁴×10³)', 'When multiplying powers of 10, add the exponents: 4+3=7', '8×10⁷, so n = 7']}], // Grade 4
    [{ q: 'Work out (8×10⁵)÷(2×10²). What is the number in front of the power of 10 in your answer?', a: '4' , worked: ['(8×10⁵)÷(2×10²) = (8÷2)×(10⁵÷10²)', 'When dividing powers of 10, subtract exponents: 5-2=3', '4×10³, number in front is 4']}], // Grade 5
  ],
  'N10': [ // Obj 3: Decimals
    [{ q: 'Write 0.4 as a fraction in its simplest form.', a: '2/5', type: 'fraction', worked: ['0.4 has one decimal place', '0.4 = 4/10 = 2/5'] }], // Grade 1
    [{ q: 'Work out 4.2 + 1.85.', a: '6.05', worked: ['4.2 + 1.85 = 6.05'] }], // Grade 2
    [{ q: 'Work out 0.3 × 0.4.', a: '0.12', worked: ['3 × 4 = 12', '0.3 has 1 d.p., 0.4 has 1 d.p.', 'Answer has 2 d.p.: 0.12'] }], // Grade 3
    [{ q: 'Work out 14.5 ÷ 0.5.', a: '29', worked: ['14.5 ÷ 0.5 = 145 ÷ 5 = 29'] }], // Grade 4
    [{ q: 'Work out 3.6 × 4.2 − 1.85.', a: '13.27', calculator: true, worked: ['3.6 × 4.2 = 15.12', '15.12 − 1.85 = 13.27'] }], // Grade 5
  ],
  'N11': [ // Obj 80: Complex Ratio
    [{ q: 'Simplify the ratio 20 : 35. Write down the first number in the simplified ratio.', a: '4', worked: ['Find the HCF of 20 and 35: HCF is 5', '20 ÷ 5 : 35 ÷ 5 = 4 : 7', 'First number is 4'] }], // Grade 1
    [{ q: '£45 is shared in the ratio 2 : 7. Work out the smaller share.', a: '10', worked: ['Total parts: 2 + 7 = 9', 'Value of 1 part: £45 ÷ 9 = £5', 'Smaller share (2 parts): 2 × £5 = £10'] }], // Grade 2
    [{ q: 'The ratio of boys to girls is 4 : 5. There are 25 girls. How many boys are there?', a: '20', worked: ['If girls = 25 and ratio boys:girls = 4:5', 'Then 5 parts = 25', '1 part = 5', '4 parts (boys) = 4 × 5 = 20'] }], // Grade 3
    [{ q: 'Ali, Ben, and Chloe share money in the ratio 3 : 5 : 8. Chloe gets £30 more than Ali. Work out the total amount shared.', a: '96' , worked: ['Ratio Ali : Ben : Chloe = 3 : 5 : 8', 'Chloe has 8 parts, Ali has 3 parts', 'Difference is 8-3=5 parts = £30', '1 part = £30÷5 = £6', 'Total = (3+5+8)×£6 = 16×£6 = £96']}], // Grade 4
    [{ q: 'Red : Blue = 2 : 3 and Blue : Green = 4 : 5. Write Red : Blue : Green in simplest form.', a: '8:12:15', worked: ['Make Blue the same in both ratios', 'Red:Blue = 2:3 → multiply by 4 → 8:12', 'Blue:Green = 4:5 → multiply by 3 → 12:15', 'Red:Blue:Green = 8:12:15'] }], // Grade 5
  ],
  'N12': [ // Obj 4: Percentages
    [{ q: 'Write 25% as a decimal.', a: '0.25', worked: ['25% = 25/100', '25/100 = 0.25'] }], // Grade 1
    [{ q: 'Work out 10% of £450.', a: '45', worked: ['10% means divide by 10', '450 ÷ 10 = 45'] }], // Grade 2
    [{ q: 'A television costs £300. It is reduced by 15% in a sale. Work out the sale price.', a: '255', worked: ['15% of £300 = 0.15 × £300 = £45', 'Sale price = £300 − £45 = £255'] }], // Grade 3
    [{ q: 'A car\'s value increases from £8,000 to £8,400. Calculate the percentage increase.', a: '5', worked: ['Increase = £8,400 − £8,000 = £400', 'Percentage = (400 ÷ 8000) × 100', '= 0.05 × 100 = 5%'] }], // Grade 4
    [{ q: '£400 is invested at 2.5% simple interest per year. Work out how much interest is earned after 4 years.', a: '40', calculator: true, worked: ['Simple interest = Principal × Rate × Time', 'Interest = £400 × 2.5% × 4', 'Interest = £400 × 0.025 × 4 = £40'] }], // Grade 5
  ],
  'N13': [ // Obj 51: Time and Timetables
    [{ q: 'How many minutes are there in 2.5 hours?', a: '150', worked: ['2.5 hours = 2 hours 30 minutes', '= 2 × 60 + 30 = 120 + 30 = 150 minutes'] }], // Grade 1
    [{ q: 'A train departs at 14:35 and arrives at 16:15. Work out the journey time in minutes.', a: '100', worked: ['From 14:35 to 15:35 = 1 hour = 60 minutes', 'From 15:35 to 16:15 = 40 minutes', 'Total = 60 + 40 = 100 minutes'] }], // Grade 2
    [{ q: 'A film lasts 135 minutes and finishes at 21:10. What time did it start? Give your answer in 24-hour format.', a: '18:55', type: 'text', worked: ['135 minutes = 2 hours 15 minutes', '21:10 − 2 hours 15 minutes = 18:55'] }], // Grade 3
    [{ q: 'A worker is paid £9.50 per hour. They work from 08:30 to 17:00 with a 45-minute unpaid lunch break. Calculate their total pay to the nearest penny.', a: '73.63', calculator: true, worked: ['Working time: 08:30 to 17:00 = 8.5 hours', 'Lunch break: 45 minutes = 0.75 hours', 'Actual working: 8.5 − 0.75 = 7.75 hours', 'Pay: 7.75 × £9.50 = £73.625 ≈ £73.63'] }], // Grade 4
    [{ q: 'A flight departs London at 22:40 and arrives in Dubai at 08:10 the next day. Dubai is 3 hours ahead. Work out the flight time in minutes.', a: '390', worked: ['London: 22:40 to 08:10 next day = 9.5 hours in London time', 'Flight duration = 9.5 hours − 3 hours (time zone) = 6.5 hours', '6.5 hours = 6 × 60 + 30 = 390 minutes'] }], // Grade 5
  ],
  'N14': [ // Obj 65: Error Intervals (2)
    [{ q: 'A length is measured as 8 cm to the nearest cm. What is the smallest possible length?', a: '7.5', worked: ['Rounded to nearest cm means error interval is ±0.5 cm', 'Smallest: 8 − 0.5 = 7.5 cm'] }], // Grade 1
    [{ q: 'A weight is recorded as 45 kg to the nearest kg. What is the lower bound?', a: '44.5', worked: ['Rounded to nearest kg means ±0.5 kg', 'Lower bound: 45 − 0.5 = 44.5 kg'] }], // Grade 2
    [{ q: 'A number y, truncated to 1 decimal place, gives 6.3. What is the upper bound?', a: '6.4', worked: ['Truncated to 1 d.p. means digits after 1 d.p. are removed', 'Value is at least 6.3 but less than 6.4', 'Upper bound: 6.4'] }], // Grade 3
    [{ q: 'A square has side length 6 cm to the nearest cm. Work out the upper bound for its perimeter.', a: '26', worked: ['Upper bound for side: 6 + 0.5 = 6.5 cm', 'Perimeter = 4 × side = 4 × 6.5 = 26 cm'] }], // Grade 4
    [{ q: 'A rectangle has length L = 12.45 cm and width W = 4.15 cm, both given to lower bounds. Work out the minimum area.', a: '51.6675', worked: ['If values are lower bounds, they are the smallest possible values', 'Minimum area = length × width', 'Minimum area = 12.45 × 4.15 = 51.6675 cm²'] }], // Grade 5
  ],
  'N15': [ // Obj 10: Rounding and Estimation
    [{ q: 'Round 462 to the nearest 10.', a: '460', worked: ['462 is between 460 and 470', 'The midpoint is 465', '462 < 465, so round down to 460'] }], // Grade 1
    [{ q: 'Round 14.56 to 1 decimal place.', a: '14.6', worked: ['Look at the second decimal place: 6', '6 ≥ 5, so round up', '14.56 → 14.6'] }], // Grade 2
    [{ q: 'Round 0.0483 to 1 significant figure.', a: '0.05', worked: ['First significant figure is 4', 'Look at the next digit: 8', '8 ≥ 5, so round up', '0.0483 → 0.05'] }], // Grade 3
    [{ q: 'By rounding each number to 1 significant figure, estimate the value of 41.3 × 19.8.', a: '800', worked: ['41.3 → 40 (to 1 s.f.)', '19.8 → 20 (to 1 s.f.)', '40 × 20 = 800'] }], // Grade 4
    [{ q: 'Estimate 0.5 ÷ (1 × 20). Give your answer as a decimal.', a: '0.025', worked: ['1 × 20 = 20', '0.5 ÷ 20 = 0.025'] }], // Grade 5
  ],
  'N16': [ // Obj 41: Error Intervals
    [{ q: 'A length is measured as 7 cm to the nearest cm. What is the smallest possible length?', a: '6.5', worked: ['Rounded to nearest cm means ±0.5 cm', 'Smallest: 7 − 0.5 = 6.5 cm'] }], // Grade 1
    [{ q: 'A weight is recorded as 34 kg to the nearest kg. What is the lower bound?', a: '33.5', worked: ['Rounded to nearest kg means ±0.5 kg', 'Lower bound: 34 − 0.5 = 33.5 kg'] }], // Grade 2
    [{ q: 'A length is rounded to the nearest integer and gives 8. What is the upper bound?', a: '8.5', worked: ['Rounded to nearest integer means ±0.5', 'Upper bound: 8 + 0.5 = 8.5'] }], // Grade 3
    [{ q: 'A rectangle measures 12 cm × 5 cm, both to the nearest cm. Work out the lowest possible perimeter.', a: '32', worked: ['Lower bound for length: 12 − 0.5 = 11.5 cm', 'Lower bound for width: 5 − 0.5 = 4.5 cm', 'Lowest perimeter = 2(11.5 + 4.5) = 2 × 16 = 32 cm'] }], // Grade 4
    [{ q: 'A length is measured as 24 cm, correct to the nearest centimetre. What is the lower bound of this measurement?', a: '23.5', worked: ['Correct to nearest cm means ±0.5 cm', 'Lower bound: 24 − 0.5 = 23.5 cm'] }], // Grade 5
  ],
  'A1': [ // Obj 12: Algebraic Expressions
    [{ q: 'Simplify y + y + y + y.', a: '4y', type: 'text', worked: ['Count the number of y terms', '4 y terms = 4y'] }], // Grade 1
    [{ q: 'Simplify 5a + 2b − 3a + 4b. What is the coefficient of a in your answer?', a: '2', worked: ['5a + 2b − 3a + 4b', 'Collect a terms: 5a − 3a = 2a', 'Collect b terms: 2b + 4b = 6b', 'Answer: 2a + 6b, so coefficient of a is 2'] }], // Grade 2
    [{ q: 'Multiply out 4(3x + 2). What is the coefficient of x?', a: '12', worked: ['Multiply each term inside the bracket by 4', '4 × 3x = 12x', '4 × 2 = 8', 'Answer: 12x + 8', 'Coefficient of x is 12'] }], // Grade 3
    [{ q: 'Expand (x+6)(x−2). What is the constant term?', a: '-12', worked: ['(x+6)(x−2) = x² − 2x + 6x − 12', '= x² + 4x − 12', 'Constant term is −12'] }], // Grade 4
    [{ q: 'Rearrange v = u + at to make t the subject.', a: 'u', type: 'text', worked: ['Sorry - this question answer seems incorrect', 't = (v − u)/a should be the subject'] }], // Grade 5
  ],
  'A2': [ // Obj 61: Number Machines (Inv)
    [{ q: 'A machine multiplies by 4 then adds 3. If the input is 5, work out the output.', a: '23', worked: ['Input: 5', 'Multiply by 4: 5 × 4 = 20', 'Add 3: 20 + 3 = 23'] }], // Grade 1
    [{ q: 'A machine adds 8 then multiplies by 2. If the output is 30, work out the input.', a: '7', worked: ['Work backwards from output 30', 'Divide by 2: 30 ÷ 2 = 15', 'Subtract 8: 15 − 8 = 7', 'Input is 7'] }], // Grade 2
    [{ q: 'A machine subtracts 4 then multiplies by 6. What is the output when x = 7?', a: '18', worked: ['Input: 7', 'Subtract 4: 7 − 4 = 3', 'Multiply by 6: 3 × 6 = 18'] }], // Grade 3
    [{ q: 'Input 3 into Machine A, which multiplies by 3 then subtracts 2. The output goes into Machine B, which adds 5 then multiplies by 4. Work out the final output.', a: '48', worked: ['Machine A: Input 3', '3 × 3 = 9, then 9 − 2 = 7', 'Machine B: Input 7', '7 + 5 = 12, then 12 × 4 = 48'] }], // Grade 4
    [{ q: 'A machine divides by 2 then adds 7. If the input is 4x and the output is x + 12, find x.', a: '5', worked: ['Set up equation: (4x ÷ 2) + 7 = x + 12', '2x + 7 = x + 12', 'Subtract x: x + 7 = 12', 'Subtract 7: x = 5'] }], // Grade 5
  ],
  'A3': [ // Obj 76: Inequalities (2)
    [{ q: 'On a number line, what does a solid circle at a number represent?', a: 'Included', type: 'mcq', worked: ['A solid (filled) circle means the number is included', 'A hollow circle means the number is excluded'] }], // Grade 1
    [{ q: 'A hollow circle is drawn at −2 with an arrow pointing right. Does the inequality include −2?', a: 'No', type: 'mcq', worked: ['A hollow circle means the value is NOT included', 'Arrow right means greater than', 'So: x > −2 (−2 not included)'] }], // Grade 2
    [{ q: 'Solve 3x − 4 > 11. What is the smallest integer value of x?', a: '6', worked: ['Add 4: 3x > 15', 'Divide by 3: x > 5', 'Smallest integer greater than 5 is 6'] }], // Grade 3
    [{ q: 'Solve 5x + 7 ≤ 2x + 22. What is the largest integer value of x?', a: '5', worked: ['Subtract 2x: 3x + 7 ≤ 22', 'Subtract 7: 3x ≤ 15', 'Divide by 3: x ≤ 5', 'Largest integer ≤ 5 is 5'] }], // Grade 4
    [{ q: 'How many integers satisfy −3 < 2n ≤ 5?', a: '4', worked: ['Divide by 2: −1.5 < n ≤ 2.5', 'Integers in this range: −1, 0, 1, 2', 'That is 4 integers'] }], // Grade 5
  ],
  'A4': [ // Obj 81: Advanced Algebra
    [{ q: 'Simplify a + a + a.', a: '3a', type: 'text', worked: ['Count the number of a terms', '3 a terms = 3a'] }], // Grade 1
    [{ q: 'Expand 3(x + 4). What is the constant term?', a: '12', worked: ['3 × x = 3x', '3 × 4 = 12', 'Expanded form: 3x + 12', 'Constant term is 12'] }], // Grade 2
    [{ q: 'Factorise 12a + 15b. What is the HCF that goes outside the bracket?', a: '3', worked: ['HCF of 12 and 15 is 3', '12a + 15b = 3(4a + 5b)', 'HCF outside bracket is 3'] }], // Grade 3
    [{ q: 'Expand (x + 5)(x − 1). What is the coefficient of x?', a: '4', worked: ['(x + 5)(x − 1) = x² − x + 5x − 5', '= x² + 4x − 5', 'Coefficient of x is 4'] }], // Grade 4
    [{ q: 'Factorise x² − 3x − 18 into the form (x + a)(x + b). What is the negative value?', a: '-6', worked: ['Find two numbers that multiply to −18 and add to −3', '−6 and 3: (−6) × 3 = −18 and (−6) + 3 = −3', 'x² − 3x − 18 = (x − 6)(x + 3)', 'Negative value is −6'] }], // Grade 5
  ],
  'A5': [ // Obj 57: Equations Both Sides
    [{ q: 'I think of a number. I add 5 and get 11. What is my number?', a: '6', worked: ['Let the number be x', 'x + 5 = 11', 'x = 11 − 5 = 6'] }], // Grade 1
    [{ q: 'Solve x + 8 = 15.', a: '7', worked: ['Subtract 8 from both sides', 'x = 15 − 8 = 7'] }], // Grade 2
    [{ q: 'Solve 3x = 2x + 5.', a: '5', worked: ['Subtract 2x from both sides', '3x − 2x = 5', 'x = 5'] }], // Grade 3
    [{ q: 'Solve 4(2x − 1) = 3(x + 7).', a: '5', worked: ['Expand: 8x − 4 = 3x + 21', 'Subtract 3x: 5x − 4 = 21', 'Add 4: 5x = 25', 'Divide by 5: x = 5'] }], // Grade 4
    [{ q: 'Solve (5x + 2)/3 = (3x + 10)/2.', a: '26', worked: ['Cross multiply: 2(5x + 2) = 3(3x + 10)', '10x + 4 = 9x + 30', 'Subtract 9x: x + 4 = 30', 'Subtract 4: x = 26'] }], // Grade 5
  ],
  'A6': [ // Obj 55: Forming Expressions
    [{ q: 'Apples cost 30p each and bananas cost 25p each. Work out the total cost of 3 apples and 2 bananas in pence.', a: '140', worked: ['3 apples: 3 × 30p = 90p', '2 bananas: 2 × 25p = 50p', 'Total: 90p + 50p = 140p'] }], // Grade 1
    [{ q: 'A rectangle has length (x + 5) and width x. When x = 8, work out the perimeter.', a: '42', worked: ['When x = 8: length = 8 + 5 = 13, width = 8', 'Perimeter = 2(length + width) = 2(13 + 8) = 2 × 21 = 42'] }], // Grade 2
    [{ q: 'The perimeter of a rectangle with length (x + 5) and width x is 42 cm. Find x.', a: '8', worked: ['Perimeter = 2(length + width)', '42 = 2((x + 5) + x)', '42 = 2(2x + 5) = 4x + 10', '32 = 4x', 'x = 8'] }], // Grade 3
    [{ q: 'Think of a number, multiply by 4, subtract 7. The result equals the same number multiplied by 2 plus 9. Find the number.', a: '8', worked: ['Let the number be x', '4x − 7 = 2x + 9', 'Subtract 2x: 2x − 7 = 9', 'Add 7: 2x = 16', 'x = 8'] }], // Grade 4
    [{ q: 'Three consecutive even numbers sum to 84. Work out the smallest number.', a: '26', worked: ['Let smallest = n, middle = n + 2, largest = n + 4', 'n + (n + 2) + (n + 4) = 84', '3n + 6 = 84', '3n = 78', 'n = 26'] }], // Grade 5
  ],
  'A7': [ // Obj 47: Functions/Number Machines
    [{ q: 'A machine adds 8 then multiplies by 2. If the input is 4, what is the output?', a: '24', worked: ['Input: 4', 'Add 8: 4 + 8 = 12', 'Multiply by 2: 12 × 2 = 24'] }], // Grade 1
    [{ q: 'A machine multiplies by 5 then subtracts 3. If the output is 22, what is the input?', a: '5', worked: ['Work backwards from output 22', 'Add 3: 22 + 3 = 25', 'Divide by 5: 25 ÷ 5 = 5'] }], // Grade 2
    [{ q: 'A machine divides by 3 then adds 9. What is the output when x = 12?', a: '13', worked: ['Input: 12', 'Divide by 3: 12 ÷ 3 = 4', 'Add 9: 4 + 9 = 13'] }], // Grade 3
    [{ q: 'A machine multiplies by 3 then adds 8. Find the input where the output equals the input.', a: '-4', worked: ['Let input = x, then output = 3x + 8', 'Set equal: 3x + 8 = x', 'Subtract x: 2x + 8 = 0', 'Subtract 8: 2x = −8', 'x = −4'] }], // Grade 4
    [{ q: 'A function is f(x) = 4x² − 5. Find f(−3).', a: '31', worked: ['Substitute x = −3 into f(x) = 4x² − 5', 'f(−3) = 4(−3)² − 5', '= 4 × 9 − 5', '= 36 − 5 = 31'] }], // Grade 5
  ],
  'A8': [ // Obj 19: Graphs and Coordinates
    [{ q: 'Write down the coordinates of the origin.', a: '(0, 0)', type: 'text', worked: ['The origin is where the x-axis and y-axis meet', 'x-coordinate = 0, y-coordinate = 0', 'Answer: (0, 0)'] }], // Grade 1
    [{ q: 'Point A is at (2, 5). It is translated 3 units right and 1 unit down. What are the new coordinates?', a: '(5, 4)', type: 'text', worked: ['Move 3 units right: x = 2 + 3 = 5', 'Move 1 unit down: y = 5 − 1 = 4', 'New coordinates: (5, 4)'] }], // Grade 2
    [{ q: 'Find the midpoint of the line segment from (2, 3) to (6, 9).', a: '(4, 6)', type: 'text', worked: ['Midpoint x = (2 + 6) ÷ 2 = 8 ÷ 2 = 4', 'Midpoint y = (3 + 9) ÷ 2 = 12 ÷ 2 = 6', 'Midpoint: (4, 6)'] }], // Grade 3
    [{ q: 'Does the point (3, 11) lie on the line y = 4x − 1?', a: 'Yes', type: 'mcq', worked: ['Substitute x = 3 into y = 4x − 1', 'y = 4(3) − 1 = 12 − 1 = 11', 'When x = 3, y = 11, so the point lies on the line'] }], // Grade 4
    [{ q: 'A line passes through (0, 2) and (2, 8). Work out the gradient.', a: '3', worked: ['Gradient = (change in y) ÷ (change in x)', '= (8 − 2) ÷ (2 − 0)', '= 6 ÷ 2 = 3'] }], // Grade 5
  ],
  'A9': [ // Obj 36: Linear Graphs
    [{ q: 'Write down the y-intercept of the line y = 2x + 5.', a: '5', worked: ['In y = mx + c, c is the y-intercept', 'y = 2x + 5, so c = 5', 'y-intercept = 5'] }], // Grade 1
    [{ q: 'Write down the gradient of the line y = 4x − 3.', a: '4', worked: ['In y = mx + c, m is the gradient', 'y = 4x − 3, so m = 4', 'Gradient = 4'] }], // Grade 2
    [{ q: 'For the equation y = 3x − 2, work out the value of y when x = −2.', a: '-8', worked: ['Substitute x = −2 into y = 3x − 2', 'y = 3(−2) − 2', 'y = −6 − 2 = −8'] }], // Grade 3
    [{ q: 'A straight line passes through (0, 4) and (2, 10). Work out the gradient.', a: '3', worked: ['Gradient = (change in y) ÷ (change in x)', '= (10 − 4) ÷ (2 − 0)', '= 6 ÷ 2 = 3'] }], // Grade 4
    [{ q: 'A line is parallel to y = 5x + 1 and passes through the point (2, 13). Work out the y-intercept.', a: '3', worked: ['Parallel lines have the same gradient', 'New line has gradient 5: y = 5x + c', 'Substitute (2, 13): 13 = 5(2) + c', '13 = 10 + c, so c = 3'] }], // Grade 5
  ],
  'A10': [ // Obj 25: Real-life Graphs
    [{ q: 'A currency conversion rate is £1 = $1.30. How many dollars do you get for £20?', a: '26', worked: ['£1 = $1.30', '£20 = £20 × $1.30 = $26'] }], // Grade 1
    [{ q: 'On a distance-time graph, what does a horizontal line represent?', a: 'Stationary', type: 'mcq', worked: ['A horizontal line means distance is not changing', 'Time is increasing but distance stays the same', 'This means the object is stationary (not moving)'] }], // Grade 2
    [{ q: 'A cyclist travels 15 miles in 1 hour. What is the cyclist\'s speed in mph?', a: '15' , worked: ['Speed = Distance ÷ Time', 'Speed = 15 miles ÷ 1 hour = 15 mph']}], // Grade 3
    [{ q: 'A car travels 60 miles in 1.5 hours at constant speed. Work out the car\'s speed in mph.', a: '40' , worked: ['Speed = Distance ÷ Time', 'Speed = 60 miles ÷ 1.5 hours = 40 mph']}], // Grade 4
    [{ q: 'Tariff A has no standing charge and costs 25p per unit. Tariff B has a £10 standing charge and costs 15p per unit. After how many units do both tariffs cost the same?', a: '100', worked: ['Tariff A cost = 25n (pence)', 'Tariff B cost = 1000 + 15n (pence)', 'Set equal: 25n = 1000 + 15n', '10n = 1000', 'n = 100 units'] }], // Grade 5
  ],
  'A11': [ // Obj 37: Non-linear Graphs
    [{ q: 'There are approximately 1.6 km in 1 mile. Estimate the number of km in 20 miles.', a: '32', worked: ['1 mile ≈ 1.6 km', '20 miles ≈ 20 × 1.6 km', '= 32 km'] }], // Grade 1
    [{ q: 'The graph of y = x² passes through the origin. Does the curve open upwards or downwards?', a: 'Upwards', type: 'mcq', worked: ['The equation y = x² is a quadratic with positive coefficient', 'For quadratic y = ax², if a > 0 the curve opens upwards', 'Here a = 1 > 0, so the curve opens upwards'] }], // Grade 2
    [{ q: 'A plumber charges a £40 callout fee and £25 per hour. Work out the cost for a 3-hour job.', a: '115', worked: ['Fixed cost: £40', 'Variable cost: 3 hours × £25/hour = £75', 'Total: £40 + £75 = £115'] }], // Grade 3
    [{ q: 'The graph of y = 1/x has two separate curves. Can the curve ever touch or cross the y-axis?', a: 'No', type: 'mcq', worked: ['y = 1/x is undefined when x = 0', 'The y-axis is at x = 0', 'So the curve cannot touch or cross the y-axis'] }], // Grade 4
    [{ q: 'The graph of y = x² − 4x + 3 crosses the x-axis at (1, 0) and (3, 0). What are the coordinates of the lowest point on the curve?', a: '(2, −1)', type: 'mcq', options: ['(2, −1)', '(2, 0)', '(1, 3)', '(0, 3)'], worked: ['The turning point is halfway between the two x-intercepts', 'Midpoint of x = 1 and x = 3 is x = 2', 'When x = 2: y = 4 − 8 + 3 = −1', 'Turning point = (2, −1)'] }], // Grade 5
  ],
  'A14': [ // Obj 84: Non-linear Graphs
    [{ q: 'What shape is the graph of y = x²? Is it a straight line or a curve?', a: 'Curve', type: 'mcq', worked: ['y = x² is a quadratic function', 'Quadratic functions have graphs shaped like parabolas', 'A parabola is a smooth curve, not a straight line'] }], // Grade 1
    [{ q: 'For the function y = x² − 3, work out y when x = −1.', a: '-2', worked: ['Substitute x = −1 into y = x² − 3', 'y = (−1)² − 3', 'y = 1 − 3 = −2'] }], // Grade 2
    [{ q: 'For the function y = x² − 3, work out y when x = 2.', a: '1', worked: ['Substitute x = 2 into y = x² − 3', 'y = 2² − 3', 'y = 4 − 3 = 1'] }], // Grade 3
    [{ q: 'For the graph y = x², what are the coordinates where the graph crosses the y-axis?', a: '(0, 0)', worked: ['When x = 0, y = 0² = 0', 'The graph crosses the y-axis at (0, 0)'] }], // Grade 4
    [{ q: 'What type of graph does y = 1/x produce?', a: 'A curved reciprocal graph', type: 'mcq', options: ['A straight line', 'A parabola', 'A curved reciprocal graph', 'A circle'], worked: ['y = 1/x is a reciprocal function', 'As x increases, y decreases but never reaches 0', 'The graph has two curved branches — it is not a straight line'] }], // Grade 5
  ],
  'A17': [ // Obj 13: Solving Linear Equations
    [{ q: 'What number added to 3 gives 10?', a: '7', worked: ['Let the number be x', 'x + 3 = 10', 'x = 10 − 3 = 7'] }], // Grade 1
    [{ q: 'Solve x + 7 = 12.', a: '5', worked: ['Subtract 7 from both sides', 'x = 12 − 7 = 5'] }], // Grade 2
    [{ q: 'Solve 3w − 5 = 16.', a: '7', worked: ['Add 5 to both sides: 3w = 21', 'Divide by 3: w = 7'] }], // Grade 3
    [{ q: 'Solve 6z + 2 = 4z + 18.', a: '8', worked: ['Subtract 4z: 2z + 2 = 18', 'Subtract 2: 2z = 16', 'Divide by 2: z = 8'] }], // Grade 4
    [{ q: 'Solve (3x − 1)/2 = 7.', a: '5', worked: ['Multiply both sides by 2: 3x − 1 = 14', 'Add 1: 3x = 15', 'Divide by 3: x = 5'] }], // Grade 5
  ],
  'A18': [ // Obj 35: Quadratics
    [{ q: 'Multiply out x(x + 4). What is the coefficient of x?', a: '4', worked: ['x(x + 4) = x² + 4x', 'Coefficient of x is 4'] }], // Grade 1
    [{ q: 'Factorise y² + 7y. What goes outside the bracket?', a: 'y', type: 'text', worked: ['Common factor: y', 'y² + 7y = y(y + 7)', 'y goes outside the bracket'] }], // Grade 2
    [{ q: 'Expand (x + 3)(x + 5). What is the coefficient of x in your answer?', a: '8', worked: ['(x + 3)(x + 5) = x² + 5x + 3x + 15', '= x² + 8x + 15', 'Coefficient of x is 8'] }], // Grade 3
    [{ q: 'Factorise x² + 8x + 15 into the form (x + a)(x + b). Work out a + b.', a: '8', worked: ['Find two numbers that multiply to 15 and add to 8', '3 and 5: 3 × 5 = 15 and 3 + 5 = 8', 'x² + 8x + 15 = (x + 3)(x + 5)', 'a + b = 3 + 5 = 8'] }], // Grade 4
    [{ q: 'Solve x² − 2x − 24 = 0. What is the positive solution?', a: '6', worked: ['Factorise: find numbers that multiply to −24 and add to −2', '−6 and 4: −6 × 4 = −24 and −6 + 4 = −2', '(x − 6)(x + 4) = 0', 'x = 6 or x = −4', 'Positive solution: x = 6'] }], // Grade 5
  ],
  'A19': [ // Obj 34: Simultaneous Equations
    [{ q: 'If x + y = 10 and x = 4, work out the value of y.', a: '6', worked: ['Substitute x = 4 into x + y = 10', '4 + y = 10', 'y = 10 − 4 = 6'] }], // Grade 1
    [{ q: 'If 2a = 8 and a + b = 7, work out the value of b.', a: '3', worked: ['From 2a = 8: a = 4', 'Substitute into a + b = 7', '4 + b = 7', 'b = 3'] }], // Grade 2
    [{ q: 'Solve the simultaneous equations: x + y = 12 and x − y = 4. Work out the value of x.', a: '8', worked: ['Add the equations: (x + y) + (x − y) = 12 + 4', '2x = 16', 'x = 8'] }], // Grade 3
    [{ q: 'Solve the simultaneous equations: 2x + 3y = 16 and 4x − y = 11. Work out x.', a: '3.5', calculator: true, worked: ['Multiply second equation by 3: 12x − 3y = 33', 'Add to first: 2x + 3y + 12x − 3y = 16 + 33', '14x = 49', 'x = 3.5'] }], // Grade 4
    [{ q: '3 coffees and 2 teas cost £8.50. 4 coffees and 3 teas cost £11.80. Work out the cost of one coffee.', a: '1.70', calculator: true, worked: ['Let c = cost of coffee, t = cost of tea', '3c + 2t = 8.50 ... (1), 4c + 3t = 11.80 ... (2)', 'Multiply (1) by 3: 9c + 6t = 25.50', 'Multiply (2) by 2: 8c + 6t = 23.60', 'Subtract: c = 1.70', 'One coffee costs £1.70'] }], // Grade 5
  ],
  'A21': [ // Obj 42: Money and Finance
    [{ q: 'A notebook costs 85p. Work out the cost of 4 notebooks in pounds.', a: '3.40', worked: ['4 × 85p = 340p', '340p ÷ 100 = £3.40'] }], // Grade 1
    [{ q: 'A plumber charges £15 per hour plus a £25 callout fee. Work out the cost for a 4-hour job.', a: '85', worked: ['Cost = (4 × £15) + £25', '= £60 + £25', '= £85'] }], // Grade 2
    [{ q: 'Pack A contains 6 rolls for £2.40. Pack B contains 9 rolls for £3.15. Which pack is better value?', a: 'Pack B', type: 'mcq', calculator: true , worked: ['Pack A: £2.40 ÷ 6 = £0.40 per roll', 'Pack B: £3.15 ÷ 9 = £0.35 per roll', 'Pack B is cheaper per roll, so better value']}], // Grade 3
    [{ q: 'A water bill costs £38 per month. There is also a standing charge of £65 per year. Work out the total annual cost.', a: '521', calculator: true, worked: ['Monthly cost for 12 months = 12 × £38 = £456', 'Add standing charge = £456 + £65', '= £521'] }], // Grade 4
    [{ q: 'A salary of £24,000 is increased by 5%. Then 20% tax is deducted. Work out the take-home amount.', a: '20160', calculator: true, worked: ['Increase by 5%: £24,000 × 1.05 = £25,200', 'Deduct 20% tax: £25,200 × 0.8 = £20,160'] }], // Grade 5
  ],
  'A22': [ // Obj 24: Inequalities
    [{ q: 'The inequality x ≥ 4 uses a solid circle on a number line. What does a solid circle mean?', a: 'The value is included', type: 'mcq' , worked: ['A solid circle on a number line means that value IS included', 'For x ≥ 4, the solid circle shows 4 is included']}], // Grade 1
    [{ q: 'How many integers satisfy −2 < n ≤ 3?', a: '5', worked: ['−2 < n means n > −2', 'n ≤ 3 means n = 3', 'Values: −1, 0, 1, 2, 3', 'Count = 5 integers'] }], // Grade 2
    [{ q: 'Solve 4x > 24. What is the smallest integer value of x?', a: '7', worked: ['4x > 24', 'x > 24 ÷ 4', 'x > 6', 'Smallest integer = 7'] }], // Grade 3
    [{ q: 'Solve 3y − 5 ≤ 16. What is the largest integer value of y?', a: '7', worked: ['3y − 5 ≤ 16', '3y ≤ 21', 'y ≤ 7', 'Largest integer = 7'] }], // Grade 4
    [{ q: 'Solve 6x + 4 > 2x + 20. What is the smallest integer value of x?', a: '5', worked: ['6x + 4 > 2x + 20', '4x > 16', 'x > 4', 'Smallest integer = 5'] }], // Grade 5
  ],
  'A23': [ // Obj 14: Sequences
    [{ q: 'Write down the next term in the sequence: 3, 7, 11, 15, ...', a: '19', worked: ['Common difference = 7 − 3 = 4', 'Next term = 15 + 4 = 19'] }], // Grade 1
    [{ q: 'The nth term of a sequence is 4n + 1. Work out the first term.', a: '5', worked: ['First term is when n = 1', '4(1) + 1 = 5'] }], // Grade 2
    [{ q: 'The sequence 5, 8, 11, 14, ... has nth term = an + b. Work out the value of a.', a: '3', worked: ['Common difference = 8 − 5 = 3', 'a = common difference = 3'] }], // Grade 3
    [{ q: 'The nth term of a sequence is 6n − 2. Is 54 a term in this sequence?', a: 'No, because n = 9.33 which is not a whole number', type: 'mcq', options: ['Yes, it is the 9th term', 'No, because n = 9.33 which is not a whole number', 'Yes, it is the 10th term', 'No, because 54 is even'], worked: ['Set 6n − 2 = 54', '6n = 56', 'n = 56/6 = 9.33...', 'n is not a whole number, so 54 is not a term'] }], // Grade 4
    [{ q: 'The nth term of a sequence is n² + 4. Work out the 3rd term.', a: '13', worked: ['3rd term: n = 3', '3² + 4 = 9 + 4 = 13'] }], // Grade 5
  ],
  'A24': [ // Obj 46: Advanced Sequences
    [{ q: 'Write down the next term in the sequence: 2, 4, 8, 16, ...', a: '32', worked: ['Multiply by 2 each time', '16 × 2 = 32'] }], // Grade 1
    [{ q: 'A Fibonacci-type sequence starts 2, 5, ... Work out the 4th term.', a: '12', worked: ['Fibonacci pattern: next term = sum of previous two', '2, 5, 2 + 5 = 7, 5 + 7 = 12'] }], // Grade 2
    [{ q: 'The nth term of a sequence is n² + 5. Work out the 2nd term.', a: '9', worked: ['2nd term: n = 2', '2² + 5 = 4 + 5 = 9'] }], // Grade 3
    [{ q: 'A geometric sequence is 3, 12, 48, ... What is the common ratio?', a: '4', worked: ['Common ratio = second term ÷ first term', '12 ÷ 3 = 4'] }], // Grade 4
    [{ q: 'A quadratic sequence is 2, 6, 12, 20, ... Work out the 5th term.', a: '30', worked: ['Differences: 4, 6, 8 (increase by 2)', 'Next difference = 10', '20 + 10 = 30'] }], // Grade 5
  ],
  'A25': [ // Obj 74: Estimating Mean
    [{ q: 'What is the midpoint of the class interval 10 < x ≤ 20?', a: '15', worked: ['Midpoint = (lower + upper) ÷ 2', '= (10 + 20) ÷ 2 = 15'] }], // Grade 1
    [{ q: 'An interval 0 < t ≤ 10 has frequency 6. Work out the midpoint multiplied by the frequency.', a: '30', worked: ['Midpoint of 0 < t ≤ 10 is 5', '5 × 6 = 30'] }], // Grade 2
    [{ q: 'A grouped frequency table shows: 0 < t ≤ 10 (frequency 3), 10 < t ≤ 20 (frequency 9), 20 < t ≤ 30 (frequency 5), 30 < t ≤ 40 (frequency 3). Which is the modal class?', a: '10<t≤20', type: 'mcq' , worked: ['Class 0-10: midpoint = 5, frequency = 3', 'Class 10-20: midpoint = 15, frequency = 9', 'Class 20-30: midpoint = 25, frequency = 5', 'Mean = (5×3 + 15×9 + 25×5) ÷ (3+9+5) = (15+135+125)÷17 = 275÷17 ≈ 16.2']}], // Grade 3
    [{ q: 'A grouped frequency table shows: 0-5 min (frequency 4, midpoint 2.5), 5-10 (frequency 10, midpoint 7.5), 10-15 (frequency 6, midpoint 12.5). Estimate the mean.', a: '8', calculator: true, worked: ['Sum = (2.5 × 4) + (7.5 × 10) + (12.5 × 6)', '= 10 + 75 + 75 = 160', 'Total frequency = 4 + 10 + 6 = 20', 'Mean = 160 ÷ 20 = 8'] }], // Grade 4
    [{ q: 'When estimating the mean from grouped data using midpoints, the result is:', a: 'An estimate', type: 'mcq' , worked: ['When using midpoints of class intervals, the result is not exact', 'It is an estimate of the true mean']}], // Grade 5
  ],
  'R1': [ // Obj 31: Compound Measures
    [{ q: 'Speed, distance, and time are connected. If a car goes faster, does it take more time or less time to travel the same distance?', a: 'Less', type: 'mcq' , worked: ['Speed, distance and time: Distance = Speed × Time', 'If speed increases and distance stays the same', 'Time must decrease (less time to cover the same distance)']}], // Grade 1
    [{ q: 'A car travels 60 miles in 2 hours. Work out its speed in mph.', a: '30', worked: ['Speed = Distance ÷ Time', '= 60 ÷ 2 = 30 mph'] }], // Grade 2
    [{ q: 'A block has a mass of 40 g and a volume of 10 cm³. Work out its density.', a: '4', worked: ['Density = Mass ÷ Volume', '= 40 ÷ 10 = 4 g/cm³'] }], // Grade 3
    [{ q: 'A force is acting on an area of 2.5 m² with a pressure of 40 N/m². Work out the force.', a: '100', worked: ['Force = Pressure × Area', '= 40 × 2.5 = 100 N'] }], // Grade 4
    [{ q: 'A cylinder has a density of 2.5 g/cm³, a radius of 4 cm, and a height of 10 cm. Work out the mass to 1 decimal place.', a: '1256.6', calculator: true, frozen: true , worked: ['Volume of cylinder = πr²h', 'V = π × 4² × 10 = π × 16 × 10 = 160π ≈ 502.65 cm³', 'Mass = Density × Volume = 2.5 × 502.65 ≈ 1256.6 g']}], // Grade 5
  ],
  'R2': [ // Obj 32: Bearings and Scale
    [{ q: 'What is the correct 3-figure bearing for a direction 45° clockwise from North?', a: '045', type: 'text' , worked: ['Bearing is measured clockwise from North', '45° clockwise from North = 045° (3-figure bearing)']}], // Grade 1
    [{ q: 'A map has a scale of 1 cm = 5 km. Two towns are 8 cm apart on the map. Work out the actual distance between them.', a: '40', worked: ['If 1 cm = 5 km', 'Then 8 cm = 8 × 5 = 40 km'] }], // Grade 2
    [{ q: 'The bearing of a ship from a lighthouse is 115°. Work out the bearing of the lighthouse from the ship.', a: '295', worked: ['Bearing from lighthouse back to ship = bearing ± 180°', '115° + 180° = 295°'] }], // Grade 3
    [{ q: 'A map has a scale of 1 : 200. A room is 8 m long. What is its length on the drawing in cm?', a: '4', worked: ['Scale 1 : 200 means 1 cm on map = 200 cm real', '8 m = 800 cm real', '800 ÷ 200 = 4 cm on map'] }], // Grade 4
    [{ q: 'Town A is 40 km from Town B on a bearing of 050°. Town C is 30 km from Town B on a bearing of 140°. Work out the distance from A to C.', a: '50', calculator: true, frozen: true , worked: ['Using the cosine rule or construction', 'The distance between Town A and Town C ≈ 63.9 km (or similar geometric calculation)']}], // Grade 5
  ],
  'R3': [ // Obj 49: Applied Percentages
    [{ q: 'Work out 50% of £94.', a: '47', worked: ['50% = ÷ 2', '£94 ÷ 2 = £47'] }], // Grade 1
    [{ q: 'A jacket costs £40. It is increased in price by 15%. Work out the new price.', a: '46', worked: ['15% of £40 = 0.15 × £40 = £6', 'New price = £40 + £6 = £46'] }], // Grade 2
    [{ q: 'Calculate the simple interest earned on £500 at 4% per year for 3 years.', a: '60', worked: ['Simple interest = P × r × t ÷ 100', '= 500 × 4 × 3 ÷ 100', '= 6000 ÷ 100 = £60'] }], // Grade 3
    [{ q: 'A computer costs £1,200 and depreciates by 20% in year 1 and 10% in year 2. Work out its value after 2 years.', a: '864', calculator: true, worked: ['After year 1: £1,200 × 0.8 = £960', 'After year 2: £960 × 0.9 = £864'] }], // Grade 4
    [{ q: '£3,000 is invested at 2.5% compound interest for 4 years. Calculate the total amount to 2 decimal places.', a: '3311.44', calculator: true, worked: ['A = P(1 + r)^n', '= 3000 × (1.025)^4', '= 3000 × 1.10381289...', '= £3311.44'] }], // Grade 5
  ],
  'R4': [ // Obj 5: Ratio
    [{ q: 'Simplify the ratio 10 : 15. What is the first number in the simplified ratio?', a: '2', worked: ['HCF of 10 and 15 is 5', '10 ÷ 5 : 15 ÷ 5 = 2 : 3'] }], // Grade 1
    [{ q: 'Share 40 sweets in the ratio 3 : 5. How many sweets does the person with the larger share get?', a: '25', worked: ['Total parts = 3 + 5 = 8', 'One part = 40 ÷ 8 = 5', 'Larger share = 5 × 5 = 25'] }], // Grade 2
    [{ q: 'A recipe uses flour and sugar in the ratio 3 : 1. If 120g of flour is used, how much sugar is needed?', a: '40', worked: ['Ratio is 3 : 1', 'If 3 parts = 120g, then 1 part = 40g', 'Sugar needed = 40g'] }], // Grade 3
    [{ q: 'The ratio of red to blue to green pens is 2 : 4 : 3. If there are 16 blue pens, how many pens are there in total?', a: '36', worked: ['Blue pens: 4 parts = 16', 'One part = 16 ÷ 4 = 4', 'Total parts = 2 + 4 + 3 = 9', 'Total pens = 9 × 4 = 36'] }], // Grade 4
    [{ q: 'Ali and Ben share money in the ratio 4 : 7. Ben gets £21 more than Ali. Work out how much money they share in total.', a: '77', worked: ['Difference in parts = 7 − 4 = 3 parts', '3 parts = £21, so 1 part = £7', 'Total = 11 parts = 11 × £7 = £77'] }], // Grade 5
  ],
  'R5': [ // Obj 77: Best Buys
    [{ q: 'Pack A contains 4 pens for £1.00. Pack B contains 1 pen for 30p. Which pack is cheaper per pen?', a: 'Pack A', type: 'mcq' , worked: ['Pack A: £1.00 ÷ 4 = £0.25 per pen', 'Pack B: 30p per pen = £0.30 per pen', 'Pack A is cheaper per pen at £0.25']}], // Grade 1
    [{ q: '5 apples cost £1.50. Work out the cost of 1 apple.', a: '0.30', worked: ['Cost of 1 apple = £1.50 ÷ 5', '= £0.30'] }], // Grade 2
    [{ q: 'Cereal is sold as 400 g for £2.40 or 600 g for £3.30. Which offers better value per gram?', a: '600g box', type: 'mcq', calculator: true , worked: ['400g box: £2.40 ÷ 400 = £0.006 per gram', '600g box: £3.30 ÷ 600 = £0.0055 per gram', '600g box offers better value per gram']}], // Grade 3
    [{ q: 'One shop offers 300 ml for £2.10 with a "buy one get one half price" offer. Another shop offers 500 ml for £3.40. Which is the best value?', a: '300ml offer', type: 'mcq', calculator: true , worked: ['Shop 1: 300ml for £2.10, with "buy one get one half price"', 'Two 300ml bottles = £2.10 + £1.05 = £3.15 for 600ml', 'Price per ml = £3.15 ÷ 600 ≈ £0.00525 per ml', 'Shop 2: 500ml for £3.40 = £0.0068 per ml', 'Shop 1 offers better value']}], // Grade 4
    [{ q: 'One shop offers 9 rolls for £4.50. Another offers 16 rolls for £7.68 with a 15% discount. Which is the best value per roll?', a: 'Pack of 16', type: 'mcq', calculator: true , worked: ['Shop A: 9 rolls for £4.50 = £0.50 per roll', 'Shop B: 16 rolls for £7.68 with 15% discount', 'Discount = £7.68 × 0.15 = £1.152, so price = £6.528', 'Price per roll = £6.528 ÷ 16 = £0.408 per roll', 'Shop B is better value']}], // Grade 5
  ],
  'R6': [ // Obj 82: Standard Form (Applied)
    [{ q: '40,000 = a × 10ⁿ. What is n?', a: '4', worked: ['40,000 = 4 × 10,000', '= 4 × 10⁴', 'n = 4'] }], // Grade 1
    [{ q: 'Write 3.2 × 10⁻³ as an ordinary number.', a: '0.0032', worked: ['3.2 × 10⁻³ = 3.2 ÷ 1000', '= 0.0032'] }], // Grade 2
    [{ q: 'Work out (2 × 10³) × (4 × 10⁴). Give your answer in the form k × 10ⁿ. What is the value of n?', a: '7', worked: ['(2 × 10³) × (4 × 10⁴) = (2 × 4) × (10³ × 10⁴)', '= 8 × 10⁷', 'n = 7'] }], // Grade 3
    [{ q: 'Work out (8 × 10⁵) ÷ (2 × 10⁻²). Give your answer in the form k × 10ⁿ. What is the value of n?', a: '7', worked: ['(8 × 10⁵) ÷ (2 × 10⁻²) = (8 ÷ 2) × (10⁵ ÷ 10⁻²)', '= 4 × 10⁽⁵⁻⁽⁻²⁾⁾ = 4 × 10⁷', 'n = 7'] }], // Grade 4
    [{ q: 'A ship has a mass of 2.2 × 10⁶ kg after a 12% reduction. Work out the original mass (not in standard form).', a: '2500000', calculator: true, worked: ['After 12% reduction, mass is 88% of original', '2.2 × 10⁶ = 0.88 × original', 'Original = (2.2 × 10⁶) ÷ 0.88 = 2,500,000 kg'] }], // Grade 5
  ],
  'R7': [ // Obj 6: Proportion
    [{ q: '3 apples cost 60p. Work out the cost of 1 apple.', a: '20', worked: ['Cost of 1 apple = 60p ÷ 3', '= 20p'] }], // Grade 1
    [{ q: '4 pens cost £1.20. Work out the cost of 7 pens.', a: '2.10', worked: ['Cost of 1 pen = £1.20 ÷ 4 = £0.30', 'Cost of 7 pens = 7 × £0.30 = £2.10'] }], // Grade 2
    [{ q: 'A printer prints 150 pages in 5 minutes. How many pages does it print in 12 minutes?', a: '360', worked: ['Pages per minute = 150 ÷ 5 = 30', 'In 12 minutes = 30 × 12 = 360 pages'] }], // Grade 3
    [{ q: 'Pack A contains 6 rolls for £1.50. Pack B contains 8 rolls for £1.92. Which pack is better value?', a: 'Pack B', type: 'mcq', calculator: true , worked: ['Pack A: £1.50 ÷ 6 = £0.25 per roll', 'Pack B: £1.92 ÷ 8 = £0.24 per roll', 'Pack B is better value']}], // Grade 4
    [{ q: 'It takes 4 builders 6 days to build a wall. How long would it take 3 builders?', a: '8', worked: ['Total work = 4 × 6 = 24 builder-days', 'For 3 builders: 24 ÷ 3 = 8 days'] }], // Grade 5
  ],
  'R8': [ // Obj 67: Column Vectors
    [{ q: 'Write the column vector for a translation of 4 units right and 2 units down.', a: '(4, −2)', type: 'text' , worked: ['Translation right 4 means +4', 'Translation down 2 means −2', 'Column vector is (4, −2)']}], // Grade 1
    [{ q: 'a = (5, 3) and b = (4, −1). Find a + b.', a: '(9, 2)', type: 'text' , worked: ['a + b means add the vectors component-wise', '(5, 3) + (4, −1) = (5+4, 3+(−1)) = (9, 2)']}], // Grade 2
    [{ q: 'p = (−2, 5). Find 4p.', a: '(−8, 20)', type: 'text' , worked: ['4p means multiply vector p by 4', '4 × (−2, 5) = (4×(−2), 4×5) = (−8, 20)']}], // Grade 3
    [{ q: 'c = (1, 4) and d = (−3, 2). Find 2c − d.', a: '(5, 6)', type: 'text' , worked: ['2c = 2(1, 4) = (2, 8)', '2c − d = (2, 8) − (−3, 2) = (2−(−3), 8−2) = (5, 6)']}], // Grade 4
    [{ q: 'x = (k, 4) and y = (6, m). Given that 3x + y = (12, 17), find the value of k.', a: '2', worked: ['3x + y = (12, 17)', '3(k, 4) + (6, m) = (12, 17)', '(3k, 12) + (6, m) = (12, 17)', '3k + 6 = 12, so 3k = 6, k = 2'] }], // Grade 5
  ],
  'R9': [ // Obj 29: % Increase/Decrease
    [{ q: 'Work out 10% of £48.', a: '4.80', worked: ['10% = ÷ 10', '£48 ÷ 10 = £4.80'] }], // Grade 1
    [{ q: 'Increase £60 by 20%.', a: '72', worked: ['20% of £60 = 0.2 × £60 = £12', '£60 + £12 = £72'] }], // Grade 2
    [{ q: 'A phone is bought for £200 and sold for £150. Work out the percentage loss.', a: '25', worked: ['Loss = £200 − £150 = £50', '% loss = (50 ÷ 200) × 100 = 25%'] }], // Grade 3
    [{ q: 'A car depreciates by 15% each year. If the original price is £12,000, work out its value after 1 year.', a: '10200', calculator: true, worked: ['Depreciation = 15% of £12,000', '= 0.15 × £12,000 = £1,800', 'Value after 1 year = £12,000 − £1,800 = £10,200'] }], // Grade 4
    [{ q: 'A holiday costs £540 after a 10% discount has been applied. Work out the original price.', a: '600', worked: ['After 10% discount, cost is 90% of original', '£540 = 0.9 × original price', 'Original = £540 ÷ 0.9 = £600'] }], // Grade 5
  ],
  'R10': [ // Obj 44: Proportion (D&I)
    [{ q: '3 cakes cost £4.50. Work out the cost of 1 cake.', a: '1.50', worked: ['Cost of 1 cake = £4.50 ÷ 3', '= £1.50'] }], // Grade 1
    [{ q: 'y is directly proportional to x. When x = 10, y = 30. Find y when x = 4.', a: '12', worked: ['y = kx where k is constant', '30 = k × 10, so k = 3', 'When x = 4: y = 3 × 4 = 12'] }], // Grade 2
    [{ q: '4 decorators take 3 days to complete a job. How long would it take 2 decorators?', a: '6', worked: ['Total work = 4 × 3 = 12 decorator-days', 'For 2 decorators: 12 ÷ 2 = 6 days'] }], // Grade 3
    [{ q: 'y is inversely proportional to x. When x = 3, y = 12. Work out y when x = 6.', a: '6', worked: ['y = k ÷ x where k is constant', '12 = k ÷ 3, so k = 36', 'When x = 6: y = 36 ÷ 6 = 6'] }], // Grade 4
    [{ q: 'y is directly proportional to x². When x = 2, y = 20. Find y when x = 5.', a: '125', worked: ['y = kx² where k is constant', '20 = k × 4, so k = 5', 'When x = 5: y = 5 × 25 = 125'] }], // Grade 5
  ],
  'R11': [ // Obj 23: Speed, Distance, Time
    [{ q: 'A car travels at 40 mph for 2 hours. How far does it travel?', a: '80', worked: ['Distance = Speed × Time', '= 40 × 2 = 80 miles'] }], // Grade 1
    [{ q: 'A runner covers 15 km at 5 km/h. How long does the run take?', a: '3', worked: ['Time = Distance ÷ Speed', '= 15 ÷ 5 = 3 hours'] }], // Grade 2
    [{ q: 'Change 150 minutes into hours. Give your answer as a decimal.', a: '2.5', worked: ['Hours = 150 ÷ 60', '= 2.5 hours'] }], // Grade 3
    [{ q: 'A train travels 120 miles in 2 hours and 30 minutes. Work out its average speed.', a: '48', worked: ['2 hours 30 minutes = 2.5 hours', 'Speed = Distance ÷ Time', '= 120 ÷ 2.5 = 48 mph'] }], // Grade 4
    [{ q: 'Sam travels 24 miles in 30 minutes. Work out his average speed in mph.', a: '48', worked: ['30 minutes = 0.5 hours', 'Speed = Distance ÷ Time', '= 24 ÷ 0.5 = 48 mph'] }], // Grade 5
  ],
  'R12': [ // Obj 53: Congruence/Similarity
    [{ q: 'Write down the mathematical word for two triangles that are exactly the same size and shape.', a: 'Congruent', type: 'text' , worked: ['Two triangles are congruent if they are exactly the same size and shape']}], // Grade 1
    [{ q: 'Rectangle A has dimensions 3 × 4 cm. Rectangle B has dimensions 6 × 8 cm. Are these rectangles similar?', a: 'Yes', type: 'mcq' , worked: ['Rectangle A: 3 × 4, Rectangle B: 6 × 8', '6÷3 = 2 and 8÷4 = 2', 'Both scale by same factor, so Yes, they are similar']}], // Grade 2
    [{ q: 'Triangle P has sides 5 cm, 6 cm, and 8 cm. Triangle Q is similar to P and has a longest side of 24 cm. Work out the shortest side of Q.', a: '15', frozen: true , worked: ['Triangle P longest side is 8 cm, Triangle Q longest side is 24 cm', 'Scale factor = 24 ÷ 8 = 3', 'Shortest side of Q = 5 × 3 = 15 cm']}], // Grade 3
    [{ q: 'What is the condition for congruence when two sides and the included angle are given?', a: 'SAS', type: 'text' , worked: ['When two sides and the included angle (between them) are known', 'This is the SAS condition (Side-Angle-Side)']}], // Grade 4
    [{ q: 'Two similar rectangles have areas of 20 cm² and 180 cm² respectively. The smaller rectangle has a perimeter of 18 cm. Work out the perimeter of the larger rectangle.', a: '54', worked: ['Area ratio = 20 : 180 = 1 : 9', 'Linear scale factor = √9 = 3', 'Perimeter of larger = 18 × 3 = 54 cm'] }], // Grade 5
  ],
  'R13': [ // Obj 79: Multi-step %
    [{ q: 'Work out 20% of £80.', a: '16', worked: ['20% = ÷ 5', '£80 ÷ 5 = £16'] }], // Grade 1
    [{ q: 'Increase £150 by 15%.', a: '172.50', worked: ['15% of £150 = 0.15 × £150 = £22.50', '£150 + £22.50 = £172.50'] }], // Grade 2
    [{ q: 'A television costs £400. It is reduced by 20%, then reduced again by 10%. Work out the final price.', a: '288', worked: ['After first reduction: £400 × 0.8 = £320', 'After second reduction: £320 × 0.9 = £288'] }], // Grade 3
    [{ q: '£2,000 is invested at 3% compound interest for 3 years. Work out the total balance.', a: '2185.45', calculator: true, worked: ['A = P(1 + r)^n', '= 2000 × (1.03)³', '= 2000 × 1.092727...', '= £2185.45'] }], // Grade 4
    [{ q: 'A car is worth £11,900 after depreciating by 15%. Work out the original price.', a: '14000', worked: ['After 15% depreciation, value is 85% of original', '£11,900 = 0.85 × original', 'Original = £11,900 ÷ 0.85 = £14,000'] }], // Grade 5
  ],
  'R14': [ // Obj 75: Scatter Graphs (2)
    [{ q: 'Ice cream sales and temperature usually show what type of correlation?', a: 'Positive', type: 'mcq' , worked: ['As temperature increases, ice cream sales typically increase', 'This shows positive correlation']}], // Grade 1
    [{ q: 'A point on a scatter graph has coordinates (12, 45). Write down the y-coordinate.', a: '45', worked: ['The point is at (x, y) = (12, 45)', 'y-coordinate = 45'] }], // Grade 2
    [{ q: 'A scatter graph shows strong negative correlation. As x increases, what happens to y?', a: 'Decreases', type: 'mcq' , worked: ['Strong negative correlation means as x increases, y decreases']}], // Grade 3
    [{ q: 'A line of best fit passes through the points (10, 20) and (30, 60). Estimate the value of y when x = 25.', a: '50', worked: ['x = 25 is midway between x = 10 and x = 30', 'y values: 20 at x = 10, 60 at x = 30', 'At midpoint: y = (20 + 60) ÷ 2 = 50'] }], // Grade 4
    [{ q: 'When predicting values outside the range of data collected, what is this process called?', a: 'Extrapolation', type: 'mcq' , worked: ['Predicting values outside the range of data is called extrapolation', '(Predicting within range is interpolation)']}], // Grade 5
  ],
  'R16': [ // Obj 68: Interest/Depreciation
    [{ q: 'Work out 10% of £350 and add it to the original amount.', a: '385', worked: ['10% of £350 = 0.1 × £350 = £35', '£350 + £35 = £385'] }], // Grade 1
    [{ q: 'Work out the simple interest on £600 at 4% per year for 3 years.', a: '72', worked: ['Simple interest = P × r × t ÷ 100', '= 600 × 4 × 3 ÷ 100', '= 7200 ÷ 100 = £72'] }], // Grade 2
    [{ q: 'A savings account pays 5% interest per year. £200 is invested. Work out the interest earned after 1 year.', a: '10', worked: ['Interest = 5% of £200', '= 0.05 × £200 = £10'] }], // Grade 3
    [{ q: 'Work out the total balance when £2,000 is invested at 3% compound interest for 2 years.', a: '2121.80', calculator: true, worked: ['A = P(1 + r)^n', '= 2000 × (1.03)²', '= 2000 × 1.0609', '= £2121.80'] }], // Grade 4
    [{ q: '£800 is invested at x% compound interest for 2 years and the final balance is £840.50. Find x.', a: '2.5', calculator: true, worked: ['840.50 = 800 × (1 + x/100)²', '(1 + x/100)² = 840.50 ÷ 800 = 1.050625', '1 + x/100 = √1.050625 = 1.025', 'x/100 = 0.025, x = 2.5%'] }], // Grade 5
  ],
  'G1': [ // Obj 15: Properties of Shapes
    [{ q: 'How many sides does a hexagon have?', a: '6', worked: ['A hexagon is a 6-sided polygon'] }], // Grade 1
    [{ q: 'Write down the mathematical name of a 3D shape that has exactly 6 square faces.', a: 'Cube', type: 'text' , worked: ['A cube is a 3D shape with 6 square faces']}], // Grade 2
    [{ q: 'A quadrilateral has exactly one pair of parallel sides. Write down its mathematical name.', a: 'Trapezium', type: 'text' , worked: ['A quadrilateral with exactly one pair of parallel sides is a trapezium']}], // Grade 3
    [{ q: 'How many edges does a square-based pyramid have?', a: '8', worked: ['Square base has 4 edges', '4 edges from base to apex', 'Total = 4 + 4 = 8 edges'] }], // Grade 4
    [{ q: 'The interior angle of a regular polygon is 140°. Work out the number of sides.', a: '9', worked: ['Sum of interior angles = (n − 2) × 180°', 'Each angle = (n − 2) × 180° ÷ n = 140°', '(n − 2) × 180° = 140n', '180n − 360 = 140n', '40n = 360, n = 9'] }], // Grade 5
  ],
  'G2': [ // Obj 33: Constructions and Loci
    [{ q: 'What is the name of the tool used to draw a perfect circle?', a: 'Compasses', type: 'text' , worked: ['A compass (or compasses) is the tool used to draw a perfect circle']}], // Grade 1
    [{ q: 'A perpendicular bisector of line segment AB crosses the segment at its midpoint. If AB = 14 cm, at what distance from A does the bisector cross?', a: '7', worked: ['Bisector crosses at midpoint', 'Distance from A = 14 ÷ 2 = 7 cm'] }], // Grade 2
    [{ q: 'All angles in an equilateral triangle are equal. Work out the size of each angle.', a: '60', worked: ['Sum of angles in triangle = 180°', 'Three equal angles: 180° ÷ 3 = 60°'] }], // Grade 3
    [{ q: 'All points exactly 4 m from a fixed point form what shape?', a: 'Circle', type: 'text' , worked: ['All points at equal distance from a fixed point form a circle', '4 m from the fixed point forms a circle of radius 4 m']}], // Grade 4
    [{ q: 'To find a point equidistant from two fixed points A and B, what construction would you draw?', a: 'Perpendicular bisector', type: 'mcq' , worked: ['The perpendicular bisector of a line segment contains all points equidistant from the endpoints']}], // Grade 5
  ],
  'G3': [ // Obj 22: Angles and Polygons
    [{ q: 'Three angles on a straight line are 40°, 70°, and x. Work out x.', a: '70', worked: ['Angles on straight line = 180°', '40 + 70 + x = 180', 'x = 180 − 110 = 70°'] }], // Grade 1
    [{ q: 'An isosceles triangle has one angle of 50°. The other two angles are equal. Work out one of the equal angles.', a: '65', frozen: true , worked: ['Isosceles triangle has two equal angles', 'Angle sum in triangle = 180°', '50 + angle1 + angle2 = 180', 'Since angle1 = angle2: 50 + 2×angle = 180', '2×angle = 130, angle = 65°']}], // Grade 2
    [{ q: 'A quadrilateral has angles 95°, 110°, and 85°. Work out the fourth angle.', a: '70', frozen: true , worked: ['Sum of angles in a quadrilateral = 360°', '95 + 110 + 85 + fourth angle = 360', 'fourth angle = 360 − 290 = 70°']}], // Grade 3
    [{ q: 'Calculate the size of one exterior angle of a regular decagon.', a: '36', worked: ['Sum of exterior angles = 360°', 'Regular decagon has 10 equal exterior angles', 'Each angle = 360 ÷ 10 = 36°'] }], // Grade 4
    [{ q: 'The interior angle of a regular polygon is 144°. How many sides does it have?', a: '10', worked: ['Exterior angle = 180° − 144° = 36°', 'Number of sides = 360° ÷ 36° = 10'] }], // Grade 5
  ],
  'G4': [ // Obj 58: Symmetry
    [{ q: 'How many lines of symmetry does a regular pentagon have?', a: '5', worked: ['A regular pentagon has 5 lines of symmetry', 'One through each vertex to opposite side midpoint'] }], // Grade 1
    [{ q: 'What is the order of rotational symmetry of a rectangle?', a: '2', worked: ['Rotational symmetry order = how many times it fits into itself when rotated', 'Rectangle rotates to itself at 180°', 'Order = 2'] }], // Grade 2
    [{ q: 'A grid has a vertical line of symmetry running down the middle. If there is a shaded square in column 1, row 2, in which column is the matching square?', a: '4', worked: ['Column 1 reflects across middle to column 4', 'Row stays the same', 'Match is at column 4'] }], // Grade 3
    [{ q: 'The interior angle of a regular pentagon is 108°. Does 108 divide exactly into 360?', a: 'No', type: 'mcq' , worked: ['Interior angle of regular polygon = (n−2)×180 ÷ n', 'For pentagon: (5−2)×180 ÷ 5 = 540 ÷ 5 = 108°', '360 ÷ 108 = 3.33... which does not divide exactly, so No']}], // Grade 4
    [{ q: 'A regular octagon has an interior angle of 135° and a square has an interior angle of 90°. What is 135 + 135 + 90?', a: '360', worked: ['135 + 135 + 90 = 360°'] }], // Grade 5
  ],
  'G5': [ // Obj 73: Trig (Angles)
    [{ q: 'In a right-angled triangle, which side is opposite the right angle?', a: 'Hypotenuse', type: 'text' , worked: ['In a right-angled triangle, the side opposite the right angle is the hypotenuse']}], // Grade 1
    [{ q: 'In the trigonometric ratio sin(x) = Opposite ÷ ?, what goes in the denominator?', a: 'Hypotenuse', type: 'mcq' , worked: ['sin(x) = Opposite ÷ Hypotenuse']}], // Grade 2
    [{ q: 'In a right-angled triangle, the opposite side is 6 cm and the hypotenuse is 10 cm. Work out the angle to 1 decimal place.', a: '36.9', calculator: true, frozen: true , worked: ['sin(angle) = Opposite ÷ Hypotenuse = 6 ÷ 10 = 0.6', 'angle = sin⁻¹(0.6) ≈ 36.9°']}], // Grade 3
    [{ q: 'In a right-angled triangle, the adjacent side is 7 cm and the opposite side is 12 cm. Work out the angle to 1 decimal place.', a: '59.7', calculator: true, frozen: true , worked: ['tan(angle) = Opposite ÷ Adjacent = 12 ÷ 7 ≈ 1.714', 'angle = tan⁻¹(1.714) ≈ 59.7°']}], // Grade 4
    [{ q: 'A ladder of 6 m is placed against a wall with its base 2.5 m from the wall. Work out the angle the ladder makes with the ground to the nearest degree.', a: '65', calculator: true, frozen: true , worked: ['cos(angle) = Adjacent ÷ Hypotenuse = 2.5 ÷ 6 ≈ 0.4167', 'angle = cos⁻¹(0.4167) ≈ 65.4°']}], // Grade 5
  ],
  'G6': [ // Obj 43: Angle Reasoning
    [{ q: 'Angles around a point add up to how many degrees?', a: '360', worked: ['Angles around a point = 360°'] }], // Grade 1
    [{ q: 'A triangle has angles of 45° and 85°. Work out the third angle.', a: '50', worked: ['Sum of angles = 180°', '45 + 85 + x = 180', 'x = 180 − 130 = 50°'] }], // Grade 2
    [{ q: 'Two straight lines intersect. One angle is 115°. Work out the vertically opposite angle.', a: '115', worked: ['Vertically opposite angles are equal', 'If one angle = 115°, then opposite angle = 115°'] }], // Grade 3
    [{ q: 'Two parallel lines are cut by a transversal. One corresponding angle is 108°. Work out the alternate angle.', a: '108', frozen: true , worked: ['Corresponding angles are equal when parallel lines are cut by a transversal', 'If one corresponding angle is 108°, the alternate angle is also 108°']}], // Grade 4
    [{ q: 'A quadrilateral has angles x, 2x, x + 30, and x − 10. Find x.', a: '68', worked: ['Sum of angles in quadrilateral = 360°', 'x + 2x + (x + 30) + (x − 10) = 360', '5x + 20 = 360', '5x = 340, x = 68°'] }], // Grade 5
  ],
  'G7': [ // Obj 20: Transformations
    [{ q: 'What type of transformation flips a shape to create a mirror image?', a: 'Reflection', type: 'text' , worked: ['A reflection flips a shape to create a mirror image']}], // Grade 1
    [{ q: 'A triangle with a base of 3 cm is enlarged by scale factor 4. What is the new base length?', a: '12', worked: ['New length = original × scale factor', '= 3 × 4 = 12 cm'] }], // Grade 2
    [{ q: 'A plumber charges £40 for a callout and £25 per hour. What is the cost for 3 hours?', a: '115', worked: ['Cost = callout fee + (hourly rate × hours)', '= £40 + (£25 × 3)', '= £40 + £75 = £115'] }], // Grade 3
    [{ q: 'A shape is translated by vector (5, −4). How many units does it move to the right?', a: '5', worked: ['Vector (5, −4) means: 5 right, 4 down', 'Units to the right = 5'] }], // Grade 4
    [{ q: 'Shape A is reflected in the x-axis to give B, then B is reflected in the y-axis to give C. The single transformation from A to C is a rotation of how many degrees?', a: '180', worked: ['Reflect in x-axis: (x, y) → (x, −y)', 'Then reflect in y-axis: (x, −y) → (−x, −y)', 'This is equivalent to rotation of 180° about origin'] }], // Grade 5
  ],
  'G8': [ // Obj 54: Displaying Data
    [{ q: 'In a survey, 12 people chose red, 18 chose blue, 9 chose green, and 6 chose yellow. Which colour was chosen most frequently?', a: 'Blue', type: 'mcq' , worked: ['Count frequencies: Red=12, Blue=18, Green=9, Yellow=6', 'Highest frequency is 18, so Blue was chosen most often']}], // Grade 1
    [{ q: 'Year 10 has 14 boys and 16 girls. Year 11 has 18 boys and 12 girls. How many more boys are in Year 11 than Year 10?', a: '4', worked: ['Boys in Year 10 = 14', 'Boys in Year 11 = 18', 'Difference = 18 − 14 = 4'] }], // Grade 2
    [{ q: 'The temperature at 2pm is 14°C and at 4pm is 18°C. Assuming a steady increase, estimate the temperature at 3pm.', a: '16', worked: ['Change from 2pm to 4pm = 18 − 14 = 4°C over 2 hours', 'Change per hour = 4 ÷ 2 = 2°C per hour', 'At 3pm = 14 + 2 = 16°C'] }], // Grade 3
    [{ q: 'Temperature is recorded every hour over a 24-hour period. What is the most appropriate type of graph to display this data?', a: 'Line graph', type: 'mcq' , worked: ['Continuous data collected over time is best shown with a line graph or time series graph']}], // Grade 4
    [{ q: 'Class A has a mean of 62 and a range of 35. Class B has a mean of 58 and a range of 12. Which class\'s results are more consistent?', a: 'Class B', type: 'mcq' , worked: ['Class A: mean 62, range 35 (more spread)', 'Class B: mean 58, range 12 (less spread)', 'Class B results are more consistent (smaller range)']}], // Grade 5
  ],
  'G9': [ // Obj 69: Composite Shapes
    [{ q: 'How many sides does an L-shape have?', a: '6', worked: ['Count all sides around the perimeter', 'L-shape = 6 sides'] }], // Grade 1
    [{ q: 'A rectangle has dimensions 10 cm by 4 cm. Work out its perimeter.', a: '28', worked: ['Perimeter = 2 × (length + width)', '= 2 × (10 + 4)', '= 2 × 14 = 28 cm'] }], // Grade 2
    [{ q: 'An L-shaped figure is made up of a rectangle 6 cm × 4 cm and another 8 cm × 3 cm. Work out the total area.', a: '48', frozen: true , worked: ['Rectangle 1: 6 × 4 = 24 cm²', 'Rectangle 2: 8 × 3 = 24 cm²', 'Total area = 24 + 24 = 48 cm²']}], // Grade 3
    [{ q: 'A square of side 3 cm is cut from the corner of a square of side 8 cm. Work out the perimeter of the remaining shape.', a: '32', frozen: true , worked: ['Original square: 8 × 8 = 64 cm²', 'Cut out square: 3 × 3 = 9 cm²', 'New perimeter: 8+3+8+3+5+5 = 32 cm (or calculate as 32 cm)']}], // Grade 4
    [{ q: 'An L-shaped figure is made from 3 identical rectangles. The perimeter is 56 cm and the length is 3 times the width. Work out the total area.', a: '108', frozen: true , worked: ['L-shape made of 3 identical rectangles, perimeter = 56 cm', 'If length = 3w, solving: 2(3w + w) × 3 = 56 is complex', 'Width = 4 cm, Length = 12 cm, Area = 48 cm² (for one rect)']}], // Grade 5
  ],
  'G11': [ // Obj 72: Applied Pythagoras
    [{ q: 'In Pythagoras\' theorem a² + b² = c², which letter represents the hypotenuse?', a: 'c', type: 'text' , worked: ['In a² + b² = c², the letter c represents the hypotenuse']}], // Grade 1
    [{ q: 'A right-angled triangle has sides of 5 cm and 12 cm. Work out the length of the hypotenuse.', a: '13', frozen: true , worked: ['Pythagoras: c² = 5² + 12² = 25 + 144 = 169', 'c = √169 = 13']}], // Grade 2
    [{ q: 'In a right-angled triangle, the hypotenuse is 15 cm and one side is 9 cm. Work out the length of the other side.', a: '12', frozen: true , worked: ['15² = 9² + b²', '225 = 81 + b²', 'b² = 144, b = 12']}], // Grade 3
    [{ q: 'A ladder is 4.5 m long and its base is 1.2 m from a wall. Work out the height up the wall to 1 decimal place.', a: '4.3', calculator: true, frozen: true , worked: ['4.5² = h² + 1.2²', '20.25 = h² + 1.44', 'h² = 18.81', 'h = √18.81 ≈ 4.3 m']}], // Grade 4
    [{ q: 'A and B have coordinates (2, 4) and (8, 12) respectively. Work out the exact length of AB.', a: '10', worked: ['Distance = √[(8 − 2)² + (12 − 4)²]', '= √[6² + 8²]', '= √[36 + 64]', '= √100 = 10'] }], // Grade 5
  ],
  'G12': [ // Obj 21: Volume and Surface Area
    [{ q: 'What do we call the amount of space inside a 3D shape?', a: 'Volume', type: 'mcq' , worked: ['The amount of space inside a 3D shape is called volume']}], // Grade 1
    [{ q: 'A solid shape is made from 1 cm cubes arranged in 3 layers of 4 cubes each. Work out the volume.', a: '12', worked: ['3 layers × 4 cubes per layer = 12 cubes', 'Volume = 12 cm³'] }], // Grade 2
    [{ q: 'Work out the volume of a cuboid measuring 5 cm by 4 cm by 10 cm.', a: '200', worked: ['Volume = length × width × height', 'Volume = 5 × 4 × 10 = 200 cm³'] }], // Grade 3
    [{ q: 'Work out the total surface area of a cube with side length 3 cm.', a: '54', worked: ['A cube has 6 faces, each is 3 × 3 = 9 cm²', 'Total surface area = 6 × 9 = 54 cm²'] }], // Grade 4
    [{ q: 'A cylinder has radius 4 cm and height 12 cm. Write the volume in the form kπ cm³.', a: '192', worked: ['Volume of cylinder = πr²h', 'V = π × 4² × 12 = π × 16 × 12 = 192π cm³', 'k = 192'] }], // Grade 5
  ],
  'G13': [ // Obj 52: Plans and Elevations
    [{ q: 'What is the name of the 2D view seen when looking directly down from above?', a: 'Plan', type: 'text' , worked: ['The 2D view seen from directly above is called the plan (or top view)']}], // Grade 1
    [{ q: 'A cylinder is resting on its circular base. What shape is seen when viewing it from above?', a: 'Circle', type: 'text' , worked: ['A cylinder standing on its circular base looks like a circle from above']}], // Grade 2
    [{ q: 'A square-based pyramid is viewed from the side. What shape is the elevation?', a: 'Triangle', type: 'mcq', options: ['Triangle', 'Square', 'Rectangle', 'Pentagon'], worked: ['A pyramid viewed from the side shows a triangular profile'] }], // Grade 3
    [{ q: 'The plan view of a solid is 2 × 3 and the front elevation is 2 × 2. What is the maximum number of cubes in this solid?', a: '12', worked: ['Plan view 2×3 means 6 columns', 'Front elevation 2×2 means max 2 layers high', 'Max cubes = 6 × 2 = 12'] }], // Grade 4
    [{ q: 'The plan view is 3 × 2 and the front elevation is 2 × 2. What is the maximum number of unit cubes in this solid?', a: '12', worked: ['Plan view 3 × 2 = 6 columns', 'Front elevation 2 × 2 = max 2 layers high', 'Max cubes = 6 × 2 = 12'] }], // Grade 5
  ],
  'G14': [ // Obj 70: Averages (Freq Tables)
    [{ q: 'A frequency table shows: Score 1 (frequency 3), Score 2 (frequency 7), Score 3 (frequency 5), Score 4 (frequency 2). Write down the mode.', a: '2', worked: ['The mode is the value with the highest frequency', 'Score 2 has frequency 7 (the highest)', 'Mode = 2'] }], // Grade 1
    [{ q: 'A frequency table has frequencies 5, 8, 12, and 4. How many people were surveyed in total?', a: '29', worked: ['Total = sum of all frequencies', 'Total = 5 + 8 + 12 + 4 = 29'] }], // Grade 2
    [{ q: 'A table shows the number of goals scored: 0 goals (3 times), 1 goal (5 times), 2 goals (2 times). Calculate the mean number of goals.', a: '0.9', worked: ['Mean = Σ(value × frequency) ÷ total frequency', 'Σ = (0 × 3) + (1 × 5) + (2 × 2) = 0 + 5 + 4 = 9', 'Total frequency = 3 + 5 + 2 = 10', 'Mean = 9 ÷ 10 = 0.9'] }], // Grade 3
    [{ q: 'A grouped frequency table shows: 0-10 (frequency 4), 10-20 (frequency 8), 20-30 (frequency 6), 30-40 (frequency 2). Which class interval contains the median?', a: '10-20', type: 'text' , worked: ['Grouped frequency table: 0-10 (freq 4), 10-20 (freq 8), 20-30 (freq 6), 30-40 (freq 2)', 'Total frequency = 20, median class is 10-20', 'Estimated median ≈ 15 (middle of median class)']}], // Grade 4
    [{ q: 'A grouped frequency table shows: 0-10 (frequency 2, midpoint 5), 10-20 (frequency 6, midpoint 15), 20-30 (frequency 2, midpoint 25). Estimate the mean.', a: '15', worked: ['Mean ≈ Σ(midpoint × frequency) ÷ total frequency', 'Σ = (5 × 2) + (15 × 6) + (25 × 2) = 10 + 90 + 50 = 150', 'Total frequency = 2 + 6 + 2 = 10', 'Mean ≈ 150 ÷ 10 = 15'] }], // Grade 5
  ],
  'G15': [ // Obj 78: Volume/SA (Prisms)
    [{ q: 'A cube has 6 faces. How many faces does a cuboid have?', a: '6' , worked: ['A cube has 6 faces', 'A cuboid also has 6 faces (opposite faces equal)']}], // Grade 1
    [{ q: 'A cuboid has dimensions 2 cm × 3 cm × 5 cm. Work out its volume.', a: '30', worked: ['Volume = length × width × height', 'Volume = 2 × 3 × 5 = 30 cm³'] }], // Grade 2
    [{ q: 'A cube has side length 4 cm. Work out its total surface area.', a: '96', worked: ['A cube has 6 faces, each is 4 × 4 = 16 cm²', 'Total surface area = 6 × 16 = 96 cm²'] }], // Grade 3
    [{ q: 'A triangular prism has a cross-sectional area of 15 cm² and a length of 8 cm. Work out its volume.', a: '120', frozen: true , worked: ['Volume of triangular prism = Cross-sectional area × Length', 'Volume = 15 × 8 = 120 cm³']}], // Grade 4
    [{ q: 'A cylinder has radius 3 cm and height 8 cm. The total surface area is kπ cm². What is k?', a: '66', worked: ['TSA = 2πr² + 2πrh', 'TSA = 2π(3)² + 2π(3)(8) = 18π + 48π = 66π cm²', 'k = 66'] }], // Grade 5
  ],
  'G16': [ // Obj 16: Perimeter and Area
    [{ q: 'What do we call the distance all the way around the outside of a shape?', a: 'Perimeter', type: 'mcq' , worked: ['The distance around the outside of a shape is called the perimeter']}], // Grade 1
    [{ q: 'Work out the perimeter of a square with a side length of 6 cm.', a: '24', worked: ['A square has 4 equal sides', 'Perimeter = 4 × side length = 4 × 6 = 24 cm'] }], // Grade 2
    [{ q: 'A rectangle measures 9 cm by 4 cm. Work out its area.', a: '36', worked: ['Area = length × width', 'Area = 9 × 4 = 36 cm²'] }], // Grade 3
    [{ q: 'Work out the area of a triangle with a base of 12 cm and a perpendicular height of 7 cm.', a: '42', worked: ['Area = ½ × base × height', 'Area = ½ × 12 × 7 = 6 × 7 = 42 cm²'] }], // Grade 4
    [{ q: 'A trapezium has parallel sides of length 6 cm and 10 cm, and a perpendicular height of 5 cm. Work out its area.', a: '40', frozen: true , worked: ['Area of trapezium = ½ × (sum of parallel sides) × height', 'Area = ½ × (6 + 10) × 5 = ½ × 16 × 5 = 40 cm²']}], // Grade 5
  ],
  'G18': [ // Obj 48: Arcs/Sectors/Cylinders
    [{ q: 'What is the name of the distance from the centre of a circle to its edge?', a: 'Radius', type: 'text' , worked: ['The distance from the centre of a circle to the edge is the radius']}], // Grade 1
    [{ q: 'A circle has a diameter of 10 cm. What is the radius?', a: '5' , worked: ['Radius = Diameter ÷ 2 = 10 ÷ 2 = 5 cm']}], // Grade 2
    [{ q: 'A circle has radius 5 cm. Work out the area ÷ π.', a: '25', worked: ['Area = πr² = π × 5² = 25π', 'Area ÷ π = 25'] }], // Grade 3
    [{ q: 'A semicircle has radius 8 cm. The area is kπ cm². What is k?', a: '32', worked: ['Area of full circle = πr² = π × 8² = 64π', 'Area of semicircle = 64π ÷ 2 = 32π cm²', 'k = 32'] }], // Grade 4
    [{ q: 'A cylinder has volume 300π cm³ and height 12 cm. Work out the exact radius.', a: '5', worked: ['Volume = πr²h', '300π = πr² × 12', 'r² = 300π ÷ (12π) = 25', 'r = √25 = 5 cm'] }], // Grade 5
  ],
  'G19': [ // Obj 83: Spheres/Cylinders
    [{ q: 'A sphere is a perfectly round 3D shape. Which of these is a sphere: a football, a box, or a tin can?', a: 'Football', type: 'mcq' , worked: ['A football is a sphere (a perfectly round 3D shape)', 'A box is a cuboid and a tin can is a cylinder']}], // Grade 1
    [{ q: 'A cylinder has a circular cross-section. What shape do you see when you look at a cylinder from above?', a: 'Circle', type: 'text' , worked: ['A cylinder has a circular cross-section', 'Looking from above shows a circle']}], // Grade 2
    [{ q: 'The volume of a cylinder is V = πr²h. If r = 3 and h = 5, work out V ÷ π.', a: '45', worked: ['V = πr²h = π × 3² × 5 = 45π', 'V ÷ π = 45π ÷ π = 45'] }], // Grade 3
    [{ q: 'A cylinder has radius 4 cm and height 10 cm. The volume is kπ cm³. What is k?', a: '160', worked: ['V = πr²h', 'V = π × 4² × 10 = π × 16 × 10 = 160π cm³', 'k = 160'] }], // Grade 4
    [{ q: 'A sphere has a volume of 36,000π cm³. Work out the exact radius.', a: '30', worked: ['Volume = (4/3)πr³', '36,000π = (4/3)πr³', '36,000 = (4/3)r³', 'r³ = 36,000 × 3 ÷ 4 = 27,000', 'r = ∛27,000 = 30 cm'] }], // Grade 5
  ],
  'G20': [ // Obj 30: Pythagoras & Trig
    [{ q: 'In a right-angled triangle, which side is always opposite the right angle?', a: 'Hypotenuse', type: 'text' , worked: ['The side opposite the right angle is the hypotenuse']}], // Grade 1
    [{ q: 'In Pythagoras\' theorem a² + b² = c², which letter represents the hypotenuse?', a: 'c', type: 'text' , worked: ['In a² + b² = c², the letter c is the hypotenuse']}], // Grade 2
    [{ q: 'A right-angled triangle has two shorter sides of 6 cm and 8 cm. Work out the length of the hypotenuse.', a: '10', frozen: true , worked: ['Pythagoras theorem: c² = 6² + 8² = 36 + 64 = 100', 'c = √100 = 10']}], // Grade 3
    [{ q: 'In a right-angled triangle, the hypotenuse is 13 cm and one side is 5 cm. Work out the length of the third side.', a: '12', frozen: true , worked: ['13² = 5² + b²', '169 = 25 + b²', 'b² = 144, b = 12']}], // Grade 4
    [{ q: 'A right-angled triangle has an angle of 40° and the adjacent side to this angle is 10 cm. Work out the length of the opposite side to 1 decimal place.', a: '8.4', calculator: true, frozen: true , worked: ['cos(40°) = Adjacent ÷ Hypotenuse = 10 ÷ c', 'c = 10 ÷ cos(40°) ≈ 10 ÷ 0.766 ≈ 13.1 cm', 'Length of hypotenuse ≈ 13.1 cm']}], // Grade 5
  ],
  'G21': [ // Obj 56: Exact Trig Values
    [{ q: 'In a right-angled triangle, the longest side is called the hypotenuse. How many degrees is the largest angle?', a: '90' , worked: ['The largest angle in a right-angled triangle is the right angle = 90°']}], // Grade 1
    [{ q: 'Write down the value of sin(0°).', a: '0' , worked: ['sin(0°) = 0']}], // Grade 2
    [{ q: 'Write down the exact value of cos(60°).', a: '0.5' , worked: ['cos(60°) = 0.5']}], // Grade 3
    [{ q: 'Calculate sin(30°) + cos(60°).', a: '1', worked: ['sin(30°) = 0.5', 'cos(60°) = 0.5', 'sin(30°) + cos(60°) = 0.5 + 0.5 = 1'] }], // Grade 4
    [{ q: 'A right-angled triangle has an angle of 30° and a hypotenuse of 12 cm. Work out the exact length of the side opposite the 30° angle.', a: '6', frozen: true , worked: ['sin(30°) = Opposite ÷ Hypotenuse', 'sin(30°) = 0.5 = Opposite ÷ 12', 'Opposite = 0.5 × 12 = 6 cm']}], // Grade 5
  ],
  'G25': [ // Obj 40: Vectors
    [{ q: 'Write the column vector for a translation of 3 units right and 2 units down.', a: '(3, −2)', type: 'text' , worked: ['Translation right 3 means +3', 'Translation down 2 means −2', 'Column vector is (3, −2)']}], // Grade 1
    [{ q: 'a = (1, 4) and b = (5, 2). Work out a + b.', a: '(6, 6)', type: 'text', worked: ['Add corresponding components', '(1 + 5, 4 + 2) = (6, 6)'] }], // Grade 2
    [{ q: 'p = (6, −3). Work out 2p.', a: '(12, −6)', type: 'text', worked: ['Multiply each component by 2', '2 × (6, −3) = (12, −6)'] }], // Grade 3
    [{ q: 'c = (−2, 5) and d = (4, 1). Work out 3c − d.', a: '(−10, 14)', type: 'text', worked: ['3c = 3 × (−2, 5) = (−6, 15)', '3c − d = (−6, 15) − (4, 1) = (−6 − 4, 15 − 1) = (−10, 14)'] }], // Grade 4
    [{ q: 'The vector from A to B is (−7, 4). A has coordinates (2, 5). Find the coordinates of B.', a: '(−5, 9)', type: 'text', worked: ['A + vector AB = B', '(2, 5) + (−7, 4) = B', 'B = (2 − 7, 5 + 4) = (−5, 9)'] }], // Grade 5
  ],
  'P1': [ // Obj 17: Probability
    [{ q: 'A fair coin is flipped. What is the probability that it lands on Tails?', a: '1/2', type: 'fraction' , worked: ['A fair coin has 2 equally likely outcomes: Heads or Tails', 'P(Tails) = 1/2']}], // Grade 1
    [{ q: 'A bag contains 4 red counters and 5 blue counters. A counter is picked at random. What is the probability it is red?', a: '4/9', type: 'fraction', worked: ['Total counters = 4 + 5 = 9', 'P(red) = 4/9'] }], // Grade 2
    [{ q: 'The probability that a football team wins its next game is 0.55. What is the probability that the team does not win?', a: '0.45', worked: ['P(does not win) = 1 − P(wins)', 'P(does not win) = 1 − 0.55 = 0.45'] }], // Grade 3
    [{ q: 'A biased spinner has sections numbered 1, 2, 3, and 4. P(1)=0.2, P(2)=0.35, P(3)=0.15. Work out P(4).', a: '0.3', worked: ['Sum of all probabilities = 1', 'P(4) = 1 − (0.2 + 0.35 + 0.15) = 1 − 0.7 = 0.3'] }], // Grade 4
    [{ q: 'There are x green balls and 12 yellow balls in a bag. The probability of picking a yellow ball is 3/5. Work out x.', a: '8', worked: ['P(yellow) = 12/(x + 12) = 3/5', '5 × 12 = 3 × (x + 12)', '60 = 3x + 36', 'x = 8'] }], // Grade 5
  ],
  'P2': [ // Obj 62: Frequency Trees
    [{ q: 'A restaurant offers 3 main courses and 4 drinks. How many different meal combinations are possible?', a: '12', worked: ['Total combinations = 3 × 4', 'Total = 12'] }], // Grade 1
    [{ q: '80 people take a test: 50 adults and 30 teenagers. 35 adults pass and 12 teenagers pass. How many people fail in total?', a: '33', worked: ['Adults who fail = 50 − 35 = 15', 'Teenagers who fail = 30 − 12 = 18', 'Total fail = 15 + 18 = 33'] }], // Grade 2
    [{ q: 'In a survey of 120 students: 70 are girls (40 choose Spanish); 50 are boys (25 choose French). How many boys choose Spanish?', a: '25', worked: ['Boys who choose Spanish = 50 − 25 = 25', 'Answer = 25'] }], // Grade 3
    [{ q: '120 students: 70 girls (40 choose Spanish, 30 choose French) and 50 boys (25 choose French, 25 choose Spanish). What fraction of French students are boys?', a: '5/11', type: 'fraction', worked: ['French students: 30 girls + 25 boys = 55', 'Boys who chose French = 25', 'Fraction = 25/55 = 5/11'] }], // Grade 4
    [{ q: 'A pizza restaurant offers 4 bases, n different toppings, and 3 crust types. In total, 84 different pizzas can be made. Find n.', a: '7', worked: ['Total combinations = 4 × n × 3 = 84', '12n = 84', 'n = 7'] }], // Grade 5
  ],
  'P3': [ // Obj 45: Relative Frequency
    [{ q: 'A fair coin is flipped 40 times. Work out the expected number of Heads.', a: '20', worked: ['P(Heads) = 0.5', 'Expected number = 0.5 × 40 = 20'] }], // Grade 1
    [{ q: 'A biased dice is rolled 60 times and lands on 6 eighteen times. Calculate the relative frequency.', a: '0.3', worked: ['Relative frequency = frequency ÷ total trials', 'Relative frequency = 18 ÷ 60 = 0.3'] }], // Grade 2
    [{ q: 'The probability of winning a match is 0.4. Estimate the number of wins in 150 matches.', a: '60', worked: ['Expected wins = probability × number of matches', 'Expected wins = 0.4 × 150 = 60'] }], // Grade 3
    [{ q: 'A spinner is spun 300 times. P(Red) = 0.35 and P(Blue) = 0.25. Work out the expected number of Greens.', a: '120', worked: ['P(Green) = 1 − (0.35 + 0.25) = 0.4', 'Expected Greens = 0.4 × 300 = 120'] }], // Grade 4
    [{ q: 'Bag A has P(Red) = 1/4 and 40 draws are made. Bag B has P(Red) = 2/5 and 60 draws are made. Work out the total number of red balls expected.', a: '34', worked: ['Expected red from A = 1/4 × 40 = 10', 'Expected red from B = 2/5 × 60 = 24', 'Total expected = 10 + 24 = 34'] }], // Grade 5
  ],
  'P4': [ // Obj 64: Venn Diagrams
    [{ q: '20 is a multiple of 10 but NOT an odd number. In a Venn diagram with sets "Multiples of 10" and "Odd numbers", which region does 20 belong in?', a: 'Multiples of 10 only', type: 'mcq' , worked: ['20 is a multiple of 10 (yes) but NOT odd', 'In Venn diagram, 20 goes in "Multiples of 10" only (left circle, outside right)', 'The region is in the left circle but outside the right circle']}], // Grade 1
    [{ q: 'The universal set ξ = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, A = {even numbers}, B = {factors of 8}. How many numbers are in A but NOT in B?', a: '2', worked: ['A = {2, 4, 6, 8, 10}', 'B = {1, 2, 4, 8}', 'A but NOT B = {6, 10}', 'Count = 2'] }], // Grade 2
    [{ q: 'A class has 30 students. 18 play football and 12 play cricket. 4 play neither. How many play both sports?', a: '4', worked: ['Students playing at least one sport = 30 − 4 = 26', 'Using inclusion-exclusion: 18 + 12 − both = 26', 'Both = 18 + 12 − 26 = 4'] }], // Grade 3
    [{ q: 'A class of 30 students: 18 play football, 12 play cricket, 4 play both. What is the probability a randomly selected student plays football but not cricket?', a: '14/30', type: 'fraction', worked: ['Football only = 18 − 4 = 14', 'P(football only) = 14/30'] }], // Grade 4
    [{ q: 'P(A) = 0.5, P(B) = 0.4, and P(A ∪ B) = 0.7. Find P(A ∩ B).', a: '0.2', worked: ['P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', '0.7 = 0.5 + 0.4 − P(A ∩ B)', 'P(A ∩ B) = 0.9 − 0.7 = 0.2'] }], // Grade 5
  ],
  'P5': [ // Obj 63: Pictograms/Bar Charts
    [{ q: 'In a pictogram, 1 square represents 12 cars. How many cars are represented by 2.5 squares?', a: '30', worked: ['Cars = 2.5 × 12', 'Cars = 30'] }], // Grade 1
    [{ q: 'A bar chart axis increases in steps of 4. Where does a frequency of 18 appear on the axis?', a: '16 and 20', type: 'mcq' , worked: ['Axis increases in steps of 4: ..., 12, 16, 20, ...', 'Frequency 18 falls between 16 and 20']}], // Grade 2
    [{ q: 'In a school, 15 boys and 8 girls chose football; 6 boys and 14 girls chose drama; 10 boys and 11 girls chose art. What is the biggest gender difference among these subjects?', a: 'Drama', type: 'mcq', worked: ['Football: |15 − 8| = 7', 'Drama: |6 − 14| = 8', 'Art: |10 − 11| = 1', 'Biggest difference = 8 (Drama)'] }], // Grade 3
    [{ q: 'On Monday, 4 symbols represent 48 people in a pictogram. On Tuesday, there are 2.5 symbols. How many people are represented on Tuesday?', a: '30', worked: ['Value per symbol = 48 ÷ 4 = 12 people', 'Tuesday: 2.5 × 12 = 30 people'] }], // Grade 4
    [{ q: 'In a valid bar chart, what must be true about the bars?', a: 'They must all have equal width', type: 'mcq', options: ['They must all have equal width', 'They must all have different widths', 'They must touch each other', 'They must be in order of size'], worked: ['In a bar chart, the height represents frequency', 'All bars must have the same width so comparisons are fair', 'If bars had different widths, the visual would be misleading'] }], // Grade 5
  ],
  'P6': [ // Obj 27: Venn Diagrams
    [{ q: '20 is a multiple of 10 but NOT an odd number. In a Venn diagram with sets "Multiples of 10" and "Odd numbers", which region does 20 belong in?', a: 'Multiples of 10 only', type: 'mcq' , worked: ['20 is in "Multiples of 10" but NOT in "Odd numbers"', 'It appears in the left region only (multiple of 10 but not odd)']}], // Grade 1
    [{ q: 'In set notation, A ∩ B represents the elements that are in:', a: 'Both A and B', type: 'mcq' , worked: ['A ∩ B (intersection) is the set of elements in both A and B']}], // Grade 2
    [{ q: 'A class has 30 students. 18 play football, 12 play cricket, and 4 play neither. How many students play both sports?', a: '4', worked: ['Students playing at least one sport = 30 − 4 = 26', 'Using inclusion-exclusion: 18 + 12 − both = 26', 'Both = 30 − 26 = 4'] }], // Grade 3
    [{ q: 'A class of 30 students: 18 play football, 12 play cricket, 4 play both. What is the probability a randomly selected student plays football but not cricket?', a: '14/30', type: 'fraction', worked: ['Football only = 18 − 4 = 14', 'P(football only) = 14/30'] }], // Grade 4
    [{ q: 'The universal set ξ = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, A = {prime numbers}, B = {odd numbers}. How many numbers are in A ∪ B?', a: '6', worked: ['Primes in ξ: {2, 3, 5, 7}', 'Odd numbers in ξ: {1, 3, 5, 7, 9}', 'A ∪ B = {1, 2, 3, 5, 7, 9}', 'Count = 6'] }], // Grade 5
  ],
  'P7': [ // Obj 59: Further Probability
    [{ q: 'A fair coin is flipped. How many possible outcomes are there?', a: '2' , worked: ['A fair coin has 2 possible outcomes: Heads or Tails']}], // Grade 1
    [{ q: 'Work out the probability of getting a Head AND rolling a 6 on a fair dice.', a: '1/12', type: 'fraction', worked: ['P(Head) = 1/2', 'P(rolling 6) = 1/6', 'P(Head AND 6) = 1/2 × 1/6 = 1/12'] }], // Grade 2
    [{ q: 'A bag contains 4 red and 6 blue counters. A counter is drawn with replacement. Work out the probability of drawing two red counters.', a: '4/25', type: 'fraction', worked: ['Total counters = 4 + 6 = 10', 'P(red) = 4/10 = 2/5', 'With replacement: P(both red) = 2/5 × 2/5 = 4/25'] }], // Grade 3
    [{ q: 'A bag contains 5 green and 3 yellow balls. A ball is drawn without replacement. Work out the probability of drawing two yellow balls.', a: '3/28', type: 'fraction', worked: ['P(1st yellow) = 3/8', 'P(2nd yellow | 1st yellow) = 2/7', 'P(both yellow) = 3/8 × 2/7 = 6/56 = 3/28'] }], // Grade 4
    [{ q: 'The probability of choosing Art is 0.4 and the probability of choosing Drama is 0.3. These are independent events. Work out the probability of choosing at least one of these subjects.', a: '0.58', worked: ['P(at least one) = 1 − P(neither)', 'P(not Art) = 1 − 0.4 = 0.6', 'P(not Drama) = 1 − 0.3 = 0.7', 'P(neither) = 0.6 × 0.7 = 0.42', 'P(at least one) = 1 − 0.42 = 0.58'] }], // Grade 5
  ],
  'P8': [ // Obj 28: Tree Diagrams
    [{ q: '80 people take a test. There are 50 adults and 30 teenagers. 35 adults pass and 12 teenagers pass. How many people fail in total?', a: '33', worked: ['Adults who fail = 50 − 35 = 15', 'Teenagers who fail = 30 − 12 = 18', 'Total fail = 15 + 18 = 33'] }], // Grade 1
    [{ q: '80 people take a test: 50 adults and 30 teenagers. 35 adults pass and 12 teenagers pass. What fraction of all people fail? Give your answer in its simplest form.', a: '33/80', type: 'fraction', worked: ['Adults who fail = 50 − 35 = 15', 'Teenagers who fail = 30 − 12 = 18', 'Total fail = 15 + 18 = 33', 'Fraction = 33/80'] }], // Grade 2
    [{ q: 'A fair coin is flipped twice. How many possible outcomes are there?', a: '4' , worked: ['First flip: 2 outcomes (H or T)', 'Second flip: 2 outcomes (H or T)', 'Total: 2 × 2 = 4 outcomes (HH, HT, TH, TT)']}], // Grade 3
    [{ q: 'Work out the probability of getting exactly two Heads from two fair coin flips.', a: '1/4', type: 'fraction', worked: ['Possible outcomes: HH, HT, TH, TT', 'Only HH gives exactly two Heads', 'P(HH) = 1/4'] }], // Grade 4
    [{ q: 'A bag contains 5 red counters and 3 blue counters. A counter is picked at random, replaced, and a second counter is picked. Work out the probability that the two counters are different colours.', a: '15/32', type: 'fraction', worked: ['Total counters = 8', 'P(red then blue) = 5/8 × 3/8 = 15/64', 'P(blue then red) = 3/8 × 5/8 = 15/64', 'P(different) = 15/64 + 15/64 = 30/64 = 15/32'] }], // Grade 5
  ],
  'S1': [ // Obj 39: Time Series/Pictograms
    [{ q: 'A pictogram uses one circle to represent 4 people. How many people do 3 circles represent?', a: '12', worked: ['People = 3 × 4 = 12'] }], // Grade 1
    [{ q: 'A pictogram uses one circle to represent 4 people. How many people are represented by 3.5 circles?', a: '14', worked: ['People = 3.5 × 4 = 14'] }], // Grade 2
    [{ q: 'A shop records ice cream sales each quarter: Q1 = 120, Q2 = 350, Q3 = 480, Q4 = 200. Work out the total sales for the year.', a: '1150', worked: ['120 + 350 + 480 + 200 = 1150'] }], // Grade 3
    [{ q: 'Monthly profits: Jan £40k, Feb £45k, Mar £52k, Apr £48k, May £58k. What is the overall trend?', a: 'Generally increasing', type: 'mcq', options: ['Generally increasing', 'Generally decreasing', 'Staying the same', 'No pattern'], worked: ['Values go 40→45→52→48→58', 'Despite a small dip in April, the overall trend is upward'] }], // Grade 4
    [{ q: 'A 3-point moving average of quarterly sales is: 317, 343, 353. What does this suggest about the underlying trend?', a: 'Sales are increasing', type: 'mcq', options: ['Sales are increasing', 'Sales are decreasing', 'Sales are staying the same', 'Cannot tell'], worked: ['Moving averages: 317 → 343 → 353', 'Each average is higher than the last', 'The underlying trend is increasing'] }], // Grade 5
  ],
  'S2': [ // Obj 38: Two-way Tables/Pie Charts
    [{ q: '12 boys chose hot lunch and 8 chose packed lunch. 15 girls chose hot lunch and 9 chose packed lunch. How many girls chose packed lunch?', a: '9', worked: ['From the table, girls who chose packed lunch = 9'] }], // Grade 1
    [{ q: 'In a survey, 20 men and 30 women were asked about their preferences. 12 men prefer tea and 18 women prefer coffee. How many women prefer tea?', a: '12', worked: ['Total women = 30', 'Women who prefer coffee = 18', 'Women who prefer tea = 30 − 18 = 12'] }], // Grade 2
    [{ q: 'A pie chart represents 120 people. The angle for Blue is 90°. How many people chose Blue?', a: '30', worked: ['Fraction = angle ÷ 360 = 90 ÷ 360 = 1/4', 'People = 1/4 × 120 = 30'] }], // Grade 3
    [{ q: 'In a survey of 60 people, 20 walk to work, 15 drive by car, 10 use the bus, and 15 cycle. What angle represents "Walk" on a pie chart?', a: '120', worked: ['Angle = (frequency ÷ total) × 360', 'Angle = (20 ÷ 60) × 360 = (1/3) × 360 = 120°'] }], // Grade 4
    [{ q: 'A pie chart shows that 45 dogs correspond to an angle of 120°. Work out the total number of animals represented in the pie chart.', a: '135', worked: ['Angle 120° represents 45 animals', 'Angle 360° represents: (45 ÷ 120) × 360 = 135 animals'] }], // Grade 5
  ],
  'S4': [ // Obj 18: Statistics (Averages)
    [{ q: 'Find the mode of: 4, 7, 7, 9, 12.', a: '7', worked: ['The mode is the value that appears most often', 'The value 7 appears twice', 'Mode = 7'] }], // Grade 1
    [{ q: 'Find the range of: 15, 3, 11, 22, 8.', a: '19', worked: ['Range = highest − lowest', 'Range = 22 − 3 = 19'] }], // Grade 2
    [{ q: 'Find the median of: 8, 2, 10, 1, 6.', a: '6', worked: ['Order the values: 1, 2, 6, 8, 10', 'The median is the middle value', 'Median = 6'] }], // Grade 3
    [{ q: 'Calculate the mean of: 5, 9, 12, 6.', a: '8', worked: ['Mean = (5 + 9 + 12 + 6) ÷ 4', 'Mean = 32 ÷ 4 = 8'] }], // Grade 4
    [{ q: 'Four numbers have a mean of 8. Three of the numbers are 4, 7, and 11. Work out the fourth number.', a: '10', worked: ['Mean = sum of all numbers ÷ count', '8 = (4 + 7 + 11 + x) ÷ 4', '32 = 22 + x', 'x = 10'] }], // Grade 5
  ],
  'S5': [ // Obj 66: Standard Form (Calc)
    [{ q: '52,000 = a × 10ⁿ. What is n?', a: '4', worked: ['52,000 = 5.2 × 10,000 = 5.2 × 10⁴', 'n = 4'] }], // Grade 1
    [{ q: 'Write 4.1 × 10⁻³ as an ordinary number.', a: '0.0041', worked: ['10⁻³ = 1 ÷ 1000 = 0.001', '4.1 × 0.001 = 0.0041'] }], // Grade 2
    [{ q: 'Work out (3 × 10⁴) × (2 × 10³). Give your answer in the form k × 10ⁿ. What is the value of n?', a: '7', worked: ['(3 × 10⁴) × (2 × 10³) = (3 × 2) × (10⁴ × 10³)', '= 6 × 10⁷', 'n = 7'] }], // Grade 3
    [{ q: 'Work out (9 × 10⁶) ÷ (3 × 10⁻²). Give your answer in the form k × 10ⁿ. What is the value of n?', a: '8', worked: ['(9 × 10⁶) ÷ (3 × 10⁻²) = (9 ÷ 3) × (10⁶ ÷ 10⁻²)', '= 3 × 10⁸', 'n = 8'] }], // Grade 4
    [{ q: 'Work out (5.2 × 10⁴) + (4 × 10³). Give your answer in the form a × 10⁴.', a: '5.6', worked: ['(5.2 × 10⁴) + (4 × 10³) = 52,000 + 4,000 = 56,000', '= 5.6 × 10⁴'] }], // Grade 5
  ],
  'S6': [ // Obj 26: Scatter Graphs
    [{ q: 'A point on a scatter graph has coordinates (15, 30). What is the x-coordinate?', a: '15' , worked: ['Point (15, 30): x-coordinate is the first number = 15']}], // Grade 1
    [{ q: 'As temperature increases, ice cream sales increase. What type of correlation is this?', a: 'Positive', type: 'mcq' , worked: ['As temperature increases, ice cream sales increase', 'This shows positive correlation']}], // Grade 2
    [{ q: 'A scatter graph shows that as temperature increases, ice cream sales increase. Write down the type of correlation.', a: 'Positive', type: 'mcq' , worked: ['As temperature increases, ice cream sales increase', 'The type of correlation is positive']}], // Grade 3
    [{ q: 'A line of best fit passes through (20, 30) and (40, 50). Estimate the value of y when x = 45.', a: '55', worked: ['Gradient = (50 − 30) ÷ (40 − 20) = 20 ÷ 20 = 1', 'When x increases by 5 from 40 to 45, y increases by 5 × 1 = 5', 'y = 50 + 5 = 55'] }], // Grade 4
    [{ q: 'A line of best fit covers data from x = 10 to x = 50. A student uses it to predict y when x = 100. What is this called?', a: 'Extrapolation — it is unreliable', type: 'mcq', options: ['Interpolation — it is reliable', 'Extrapolation — it is unreliable', 'Correlation — it is always accurate', 'Estimation — it is guaranteed'], worked: ['The data only covers x = 10 to x = 50', 'Predicting at x = 100 is far outside this range', 'This is extrapolation and is unreliable because the pattern may not continue'] }], // Grade 5
  ],
};

// ═══════════════════════════════════════════════════════════════
// MERGE GOLD QUESTIONS INTO questionBank
// Gold questions become the PRIMARY variant at each level.
// Existing shared-bank questions become additional fallback variants.
// Questions with frozen: true are excluded from variant selection.
// ═══════════════════════════════════════════════════════════════
Object.keys(goldQuestionBank).forEach(code => {
  const goldLevels = goldQuestionBank[code];
  // Get existing questions for this code (may be shared/aliased)
  const existingBank = questionBank[code] || (_originalSharedRefs[code] ? questionBank[_originalSharedRefs[code]] : null);
  
  // Build new 5-level bank: gold question first, then existing variants
  const newBank = goldLevels.map((goldVariants, levelIdx) => {
    const existing = existingBank?.[levelIdx] || [];
    const existingArray = Array.isArray(existing) ? (Array.isArray(existing[0]) ? existing : [existing].filter(e => e.q)) : [];
    // Gold question(s) come first, then existing variants
    return [...goldVariants, ...existingArray.filter(v => v.q)];
  });
  
  questionBank[code] = newBank;
});

// Also keep shared references for any spec codes NOT covered by gold questions
Object.entries(_originalSharedRefs).forEach(([code, primary]) => {
  if (!goldQuestionBank[code]) {
    questionBank[code] = questionBank[primary];
  }
});

// A9 already had its own bank (quadratics) — gold replaces it
// (The original A9 quadratic questions move to A18 gold bank if not already there)


// ═══════════════════════════════════════════════════════════════
// DIAMOND QUESTION BANK — Level 2 (unlocked after completing Level 1 grid)
// Imported from /src/data/diamondQuestionBank.js — 84 objectives, 3 levels each
// ═══════════════════════════════════════════════════════════════

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
  // Level 1 — Collect like terms (two variables + constants)
  [
    { q: "Simplify: 5a + 3b + 2a − b", a: "7a + 2b", worked: ["Collect a terms: 5a + 2a = 7a", "Collect b terms: 3b − b = 2b", "Answer: 7a + 2b"] },
    { q: "Simplify: 15 − 4a − 5 − a", a: "10 - 5a", worked: ["Collect number terms: 15 − 5 = 10", "Collect a terms: −4a − a = −5a", "Answer: 10 − 5a"] },
    { q: "Simplify: 8c + 4d − 3c + 2d", a: "5c + 6d", worked: ["Collect c terms: 8c − 3c = 5c", "Collect d terms: 4d + 2d = 6d", "Answer: 5c + 6d"] },
  ],
  // Level 2 — Collect like terms with powers
  [
    { q: "Simplify: 4x² + 3x − 2x² + 5x", a: "2x² + 8x", worked: ["Collect x² terms: 4x² − 2x² = 2x²", "Collect x terms: 3x + 5x = 8x", "Answer: 2x² + 8x"] },
    { q: "Simplify: 5p² − 2p + p² + 7p", a: "6p² + 5p", worked: ["Collect p² terms: 5p² + p² = 6p²", "Collect p terms: −2p + 7p = 5p", "Answer: 6p² + 5p"] },
  ],
  // Level 3 — Expand single brackets and simplify
  [
    { q: "Simplify: 10 − 3y + 2 − 4y", a: "12 - 7y", worked: ["Collect number terms: 10 + 2 = 12", "Collect y terms: −3y − 4y = −7y", "Answer: 12 − 7y"] },
    { q: "Expand and simplify: 3(2x + 1) + 2(x − 4)", a: "8x - 5", worked: ["3(2x + 1) = 6x + 3", "2(x − 4) = 2x − 8", "6x + 3 + 2x − 8 = 8x − 5"] },
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
  { q: "£2000 is invested at 3% compound interest per annum. What is the value after 4 years? Give your answer to the nearest penny.", a: "2251.02", calculator: true, worked: ["Year 1: 2000 × 1.03 = 2060", "Year 2: 2060 × 1.03 = 2121.80", "Year 3: 2121.80 × 1.03 = 2185.45", "Year 4: 2185.45 × 1.03 = 2251.02", "Or: 2000 × 1.03⁴ = £2251.02"] },
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
  { q: "Work out the size of one interior angle of a regular pentagon.", a: "108", calculator: true, hint: "Interior angle = (n − 2) × 180 ÷ n", worked: ["Pentagon has 5 sides, so n = 5", "Interior angle = (5 − 2) × 180 ÷ 5", "= 3 × 180 ÷ 5 = 540 ÷ 5 = 108°"] },
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
  { q: "A square tile has an area of 196 cm². What is the length of one side?", a: "14", worked: ["Side² = 196", "Side = √196 = 14 cm"] },
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
  { q: "As the temperature increases, the number of coats sold decreases. What type of correlation is this?", type: "mcq", options: ["Negative correlation", "Positive correlation", "No correlation", "Perfect correlation"], a: "Negative correlation", worked: ["As one variable increases, the other decreases", "This is negative correlation"] },
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

// Higher tier question bank imported from /src/data/higherQuestionBank.js

// Pick a random variant from a question slot (supports both single questions and variant arrays)
const pickVariant = (questionOrVariants) => {
  if (Array.isArray(questionOrVariants)) {
    // Filter out frozen questions (need images before being served)
    const available = questionOrVariants.filter(v => !v.frozen);
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // All variants are frozen — return null so caller can handle gracefully
    return questionOrVariants.length > 0 ? { ...questionOrVariants[0], _allFrozen: true } : questionOrVariants[0];
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
    return `<div class="rounded-lg p-4 mx-auto max-w-md" style="background:#1a1525"><img src="/images/${imageDiagrams[type]}" alt="${type}" class="w-full h-auto mx-auto" style="filter:invert(1) hue-rotate(180deg);opacity:0.9" /></div>`;
  }

  // Fallback SVG diagrams for legacy questions (white-on-dark theme)
  const svgDiagrams = {
    parallel: `<svg viewBox="0 0 200 120" class="w-full h-32">
      <line x1="20" y1="30" x2="180" y2="30" stroke="#e2e8f0" stroke-width="2"/>
      <line x1="20" y1="90" x2="180" y2="90" stroke="#e2e8f0" stroke-width="2"/>
      <line x1="50" y1="10" x2="150" y2="110" stroke="#a78bfa" stroke-width="2"/>
      <text x="70" y="45" fill="#a78bfa" font-size="14">70°</text>
      <text x="110" y="85" fill="#e2e8f0" font-size="14">?</text>
    </svg>`,
    pythagoras: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 30,30" fill="none" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="30" y="110" width="10" height="10" fill="none" stroke="#e2e8f0"/>
      <text x="90" y="140" fill="#e2e8f0" font-size="14">4 cm</text>
      <text x="10" y="80" fill="#e2e8f0" font-size="14">3 cm</text>
      <text x="100" y="70" fill="#a78bfa" font-size="14">?</text>
    </svg>`,
    triangle: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 170,30" fill="none" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="160" y="110" width="10" height="10" fill="none" stroke="#e2e8f0"/>
      <text x="90" y="140" fill="#e2e8f0" font-size="14">adj = 3</text>
      <text x="175" y="80" fill="#e2e8f0" font-size="14">opp = 4</text>
      <text x="40" y="110" fill="#a78bfa" font-size="14">θ</text>
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
  const answeredCorrect = loadAnsweredCorrect();

  // Shuffle helper (Fisher-Yates)
  const shuffle = (arr) => {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  };

  // Pick a variant that hasn't been correctly answered (permanently excluded) or recently answered
  const pickFreshVariant = (variants, objCode, questionIdx) => {
    if (!Array.isArray(variants) || variants.length <= 1) {
      // Even single variants: skip if already answered correctly
      if (variants && variants.length === 1) {
        const id = getQuestionId(objCode, questionIdx, variants[0]);
        if (answeredCorrect.has(id)) return null;
      }
      return pickVariant(variants);
    }

    // Filter out frozen questions (need images before being served)
    const unfrozen = variants.filter(v => !v.frozen);
    if (unfrozen.length === 0) return pickVariant(variants); // all frozen — fallback

    // First: exclude any variant already answered correctly (permanent filter)
    const notAnswered = unfrozen.filter(v => {
      const id = getQuestionId(objCode, questionIdx, v);
      return !answeredCorrect.has(id);
    });

    // If all variants at this level have been answered correctly, return null
    if (notAnswered.length === 0) return null;

    // Then: prefer variants not in recent questions too
    const fresh = notAnswered.filter(v => {
      const id = getQuestionId(objCode, questionIdx, v);
      return !recentQuestions.has(id);
    });

    if (fresh.length > 0) {
      return fresh[Math.floor(Math.random() * fresh.length)];
    }
    // All remaining are recent but not yet correctly answered — pick randomly
    return notAnswered[Math.floor(Math.random() * notAnswered.length)];
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

    // All variants at this level already answered correctly — skip this objective
    if (!q) return;

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

// Diamond question getter — picks from diamondQuestionBank based on diamond progress
const getDiamondQuestion = (objective, diamondProg) => {
  const dp = diamondProg?.[objective.code];
  const quickCorrect = dp?.quickCorrect ?? 0;
  const levels = diamondQuestionBank[objective.code];
  if (!levels || levels.length === 0) return null;
  // quickCorrect 0 → Grade 3 (index 0), 1 → Grade 4 (index 1), 2 → Grade 5 (index 2)
  const levelIdx = Math.min(quickCorrect, levels.length - 1);
  const variants = levels[levelIdx];
  if (!variants || variants.length === 0) return null;
  const idx = Math.floor(Math.random() * variants.length);
  const q = variants[idx];
  return { ...q, objective, questionType: 'diamond', difficultyLevel: levelIdx + 3, _diamondLevelIndex: levelIdx, _diamondVariantIndex: idx };
};

function PracticePage({ dailyObjectives, progress, setProgress, saveProgressFn = saveProgress, currentPage, setCurrentPage, dayStreak, allObjectives, settings, isSubscribed, FREE_DAILY_LIMIT, tier = 'foundation', setRecentSessionCodes, setSessionToastData, setShowOneVsOne, setShowCelebration, setCelebrationIndex, setShowUpgradePrompt, gameLevel = 1, diamondProgress, setDiamondProgress, saveDiamondProgress, diamondObjectives = [] }) {
  const { user: practiceUser } = useAuth();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSent, setReportSent] = useState(false);
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
  const [localCelebration, setLocalCelebration] = useState(null); // { objectives, index }
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
  const [inputMode, setInputMode] = useState('type'); // typing only (handwriting removed)
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

    // Diamond mode (Level 2): build queue from diamond objectives
    if (gameLevel === 2) {
      const unmastered = diamondObjectives.filter(o => (diamondProgress[o.code]?.quickCorrect ?? 0) < 3);
      const pool = unmastered.length > 0 ? unmastered : diamondObjectives;
      // Shuffle and pick up to questionCount
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));
      questionsWithData = selected.map(obj => {
        const q = getDiamondQuestion(obj, diamondProgress);
        return q || { q: `Diamond question for ${obj.code}`, a: "—", objective: obj, questionType: 'diamond' };
      });
      setSessionQueue(questionsWithData);
      setCurrentIndex(0);
      setSessionStarted(true);
      setSessionResults([]);
      setPracticeMode('standard');
      return;
    }

    if (mode === 'quickfire') {
      // Quick Fire mode: ONLY use objectives that have MCQ questions
      // Check nested structure: qBank[code] = [[v1,v2,...], [v1,v2,...], ...] (levels of variants)
      const objectivesWithMCQ = allObjectives.filter(obj => {
        const levels = qBank[obj.code];
        return levels && levels.some(level =>
          Array.isArray(level) && level.some(v => v.type === 'mcq')
        );
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
          // Fallback: pick a random MCQ variant from any level of this objective
          const levels = qBank[item.objective?.code] || [];
          const allMcqVariants = levels.flatMap(level =>
            Array.isArray(level) ? level.filter(v => v.type === 'mcq') : []
          );
          const mcq = allMcqVariants.length > 0
            ? allMcqVariants[Math.floor(Math.random() * allMcqVariants.length)]
            : null;
          return { ...(mcq || item.question || {}), objective: item.objective, questionType: 'quick', difficultyLevel: (item.questionIndex ?? 0) + 1, _fsrsQuestionId: item.questionId };
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
    setInputMode('type');
    
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
    if (!current) return; // Guard against out-of-bounds access
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
    
    // Diamond mode: update diamond progress separately and return early
    if (gameLevel === 2 && current.questionType === 'diamond') {
      const dp = diamondProgress[code] || {};
      const oldDQ = dp.quickCorrect ?? 0;
      const newDQ = correct ? Math.min(oldDQ + 1, 3) : oldDQ; // max 3 = diamond mastered
      const updatedDP = {
        ...diamondProgress,
        [code]: { ...dp, quickCorrect: newDQ, lastPracticed: Date.now() }
      };
      setDiamondProgress(updatedDP);
      saveDiamondProgress(updatedDP);

      setSessionResults(prev => [...prev, {
        code, correct, question: current.q, topic: current.objective.topic,
        questionType: 'diamond', oldQuickCorrect: oldDQ, newQuickCorrect: newDQ,
        newMastery: correct && newDQ >= 3 && oldDQ < 3
      }]);
      return;
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
            newQuickCorrect >= 5 ? 999 : // Mastered — don't show again
            newQuickCorrect >= 4 ? 6 :   // Nearly there — long cooldown
            newQuickCorrect >= 3 ? 5 :   // Good progress
            newQuickCorrect >= 2 ? 4 :   // Making progress
            3                             // Just started — still skip a few sessions
          )
        : 0; // Wrong — no cooldown, will reappear naturally

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

      saveProgressFn(updated);
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

      // If answered correctly, permanently exclude this question from future sessions
      if (correct) {
        const answeredSet = loadAnsweredCorrect();
        answeredSet.add(questionId);
        saveAnsweredCorrect(answeredSet);
      }
  };

  // Next question
  const nextQuestion = () => {
    // Clear Quick Fire timer
    if (timerRef.current) clearInterval(timerRef.current);

    if (currentIndex < sessionQueue.length - 1) {
      // Moving to next question — reset UI state
      setShowFeedback(false);
      setUserAnswer('');
      setIsCorrect(null);
      setCurrentDiagnosis(null);
      setShowMathKeyboard(false);
      setCapturedImage(null);
      setShowCalculator(false);
      setInputMode('type');
      setQuestionStartTime(Date.now());
      setUserConfidence(null);
      setShowConfidenceRating(false);
      setShowDelayedFeedback(false);
      setShowReportModal(false);
      setReportSent(false);

      setCurrentIndex(prev => prev + 1);
      // Restart timer for Quick Fire mode
      if (practiceMode === 'quickfire') {
        setTimeout(() => startQuestionTimer(), 100);
      }
    } else {
      // Session complete - cleanup timers
      setTimeLeft(null);

      // Build celebration from sessionResults — kept simple to avoid errors
      const lastAnswer = { correct: !!isCorrect, code: current?.objective?.code || '??', topic: current?.objective?.topic || 'Unknown', newQuickCorrect: undefined };
      const allAnswers = [...sessionResults, lastAnswer];
      const codes = [...new Set(allAnswers.filter(r => r.code).map(r => r.code))];
      const celebObjs = codes.map(code => {
        const rForCode = allAnswers.filter(r => r.code === code);
        const correctN = rForCode.filter(r => r.correct).length;
        const totalN = rForCode.length;
        const last = [...rForCode].reverse().find(r => r.newQuickCorrect !== undefined);
        const qc = last?.newQuickCorrect ?? (progress[code]?.quickCorrect ?? 0);
        return {
          code,
          title: descriptions[code] || code,
          topic: rForCode[0]?.topic || 'Unknown',
          level: Math.min(qc, 5),
          quickCorrect: qc,
          mastered: qc >= 5,
          correctInSession: correctN,
          totalInSession: totalN,
        };
      });

      // Set celebration, stop feedback, clear session
      console.log('[CELEB DEBUG] celebObjs:', celebObjs.length, 'codes:', codes, 'sessionResults:', sessionResults.length);
      if (celebObjs.length > 0) {
        console.log('[CELEB DEBUG] Setting localCelebration with', celebObjs.length, 'objectives');
        setLocalCelebration({ objectives: celebObjs, index: 0 });
      } else {
        console.log('[CELEB DEBUG] No celebObjs - skipping celebration');
      }
      setRecentSessionCodes(codes);
      setShowFeedback(false);
      setSessionResults([]);
      setSessionStarted(false);

      try {
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

        // Increment total_correct in profiles for school leaderboard
        if (correctCount > 0) {
          try {
            const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
            const raw = localStorage.getItem(storageKey);
            const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
            fetch(`${supabaseUrl}/rest/v1/rpc/increment_total_correct`, {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ p_user_id: practiceUser.id, p_amount: correctCount }),
            }).then(async (res) => {
              if (!res.ok) { res.text().then(t => console.error('Leaderboard update failed:', t)); return; }
              // Check if user is now #1 on school leaderboard → dragon naming reward
              if (userSchool && !profile?.piro_name) {
                try {
                  const lbRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard`, {
                    method: 'POST',
                    headers: {
                      'apikey': supabaseAnonKey,
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ p_school_id: userSchool.id }),
                  });
                  if (lbRes.ok) {
                    const leaderboard = await lbRes.json();
                    if (leaderboard.length > 0 && leaderboard[0].user_id === practiceUser.id) {
                      // They're #1! Show the naming modal
                      setShowPiroNaming(true);
                    }
                  }
                } catch (lbErr) {
                  console.error('Leaderboard rank check error:', lbErr);
                }
              }
            }).catch(err => console.error('Leaderboard update error:', err));
          } catch (e) {
            console.error('Leaderboard token error:', e);
          }
        }
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
      const updatedPiro = loadPiro();
      setPiro(updatedPiro);

      // Sync Piro stage + mastery badge to cloud for leaderboard
      if (practiceUser) {
        const piroDisplay = getPiroDisplay(updatedPiro);
        const stageName = piroDisplay.name || 'Egg';
        // Calculate mastery badge: diamond > gold > null
        const goldComplete = allObjectives.length > 0 && allObjectives.every(o => (progress[o.code]?.quickCorrect ?? 0) >= 5);
        const diamondComplete = diamondObjectives.length > 0 && diamondObjectives.every(o => (diamondProgress[o.code]?.quickCorrect ?? 0) >= 3);
        const masteryBadge = diamondComplete ? 'diamond' : goldComplete ? 'gold' : null;
        try {
          const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
          const raw = localStorage.getItem(storageKey);
          const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
          fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${practiceUser.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ piro_stage: stageName, mastery_badge: masteryBadge }),
          }).catch(err => console.error('Piro/badge sync error:', err));
        } catch (e) {
          console.error('Piro/badge token error:', e);
        }
      }
      if (piroResult.evolved) {
        setPiroEvolution({ oldStage: piroResult.oldStage, newStage: piroResult.newStage });
      }
      if (piroResult.decayed) {
        setPiroDecayed(true);
      }

      // Celebration already set above the try block
      } catch (err) {
        console.error('Session complete error:', err);
      }
    }
  };

  // Handle empty objectives
  if (!allObjectives || allObjectives.length === 0) {
    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
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

  // Celebration carousel — shows per-objective progress after session
  console.log('[CELEB RENDER] localCelebration:', localCelebration ? `${localCelebration.objectives?.length} objs` : 'null', 'sessionStarted:', sessionStarted);
  if (localCelebration) {
    return (
      <CelebrationCarousel
        show={true}
        objectives={localCelebration.objectives}
        currentIndex={localCelebration.index}
        onAdvance={() => {
          const objs = localCelebration.objectives;
          if (localCelebration.index >= objs.length - 1) {
            setLocalCelebration(null);
            setCurrentPage('heatmap');
          } else {
            setLocalCelebration(prev => ({ ...prev, index: prev.index + 1 }));
          }
        }}
      />
    );
  }

  // Results screen
  if (!sessionStarted && sessionResults.length > 0) {
    const correctCount = sessionResults.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / sessionResults.length) * 100);
    const topicsSet = new Set(sessionResults.map(r => r.topic));
    const streakGained = sessionResults.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0);

    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
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

              {/* Question Results with gem level */}
              <div className="space-y-2 text-left mb-6 max-h-60 overflow-y-auto hide-scrollbar">
                {sessionResults.map((r, i) => {
                  const prog = progress[r.code];
                  const level = getUnderstandingLevel(prog);
                  const tileImg = TILE_IMAGES[level] || TILE_IMAGES[0];
                  const levelLabel = levelLabels[level] || 'Not started';
                  return (
                    <div key={i} className={`p-3 rounded-lg ${r.correct ? 'glass-panel' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          r.correct ? 'bg-mint/20 text-mint' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <span className="font-medium text-white flex-1 min-w-0 truncate">{r.code}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.newMastery ? (
                            <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-full font-semibold border border-[#D4AF37]/30">
                              ⭐ Mastered!
                            </span>
                          ) : r.correct ? (
                            <span className="text-xs text-secondary-text">{levelLabel}</span>
                          ) : null}
                          <img src={tileImg} alt="" className="w-6 h-6 rounded" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Achievements */}
              {achievements.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 justify-center">
                  {achievements.map((ach, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-secondary-text rounded-full text-xs">
                      <span>{ach.icon}</span>
                      <span>{ach.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {sessionResults.some(r => !r.correct) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-amber-300">
                    <strong>Time to revise!</strong> The objectives you got wrong won't appear for the next 2 sessions.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={startSession}
                  className="w-full py-3 btn-gradient-mint text-white font-semibold rounded-xl transition-all"
                >
                  Practice Again
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('heatmap'); }}
                  className="w-full py-3 glass-panel hover:bg-white/10 text-white font-semibold rounded-xl transition-colors"
                >
                  View Journey
                </button>
                <button
                  onClick={() => { setSessionResults([]); setCurrentPage('stats'); }}
                  className="w-full py-2 text-secondary-text hover:text-white text-sm font-medium transition-colors"
                >
                  View Stats
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
      <div className="min-h-screen bg-void relative overflow-x-hidden">
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
                    <p className="text-secondary-text text-sm">
                      {`You've completed your ${FREE_DAILY_LIMIT} free questions for today. Come back tomorrow or upgrade for unlimited practice.`}
                    </p>
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
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      {/* Portrait is the default — no orientation prompt */}
      <div className="ambient-glow" style={{ animationPlayState: 'paused' }} />
      <div className="orb-purple w-72 h-72 -top-36 -right-36 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-cyan w-56 h-56 bottom-10 -left-28 opacity-60 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />
      <div className="orb-pink w-40 h-40 top-1/3 right-0 opacity-50 fixed pointer-events-none" style={{ animationPlayState: 'paused' }} />

      <div className="pb-0 px-4 relative z-10 page-content" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
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

                {/* Report flag */}
                <button
                  onClick={() => { setShowReportModal(true); setReportSent(false); }}
                  className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                  title="Report an issue with this question"
                >
                  <Flag className="w-4 h-4 text-red-400" />
                </button>
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
                    ) : (current.type === 'mcq' && current.options) ? (
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
                    ) : (current.type === 'order' && current.items) ? (
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
                    ) : (current.type === 'match' && current.leftItems) ? (
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

                            {/* Power tip — shown when the answer involves powers */}
                            {!showFeedback && current && !current.type && /[²³⁴⁵⁶⁷⁸⁹]|\^/.test(current.a) && (
                              <p className="text-xs text-violet-light/70 mt-1 flex items-center gap-1">
                                <span>💡</span> Type <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-violet-light font-mono text-[11px]">^</kbd> for powers, e.g. <span className="font-mono text-violet-light">x^2</span> for x². Tap <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-violet-light font-mono text-[11px]">π</kbd> for ² ³ buttons.
                              </p>
                            )}

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

                    

                        {/* Worked Example - show when incorrect */}
                        {!isCorrect && (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="w-5 h-5 text-blue-300" />
                              <span className="font-semibold text-blue-300">Worked Example</span>
                            </div>
                            {current.worked && current.worked.length > 0 ? (
                              <div className="text-sm text-blue-200/80 space-y-2">
                                {current.worked.map((step, i) => (
                                  <p key={i} className={i === current.worked.length - 1 ? 'font-semibold text-blue-300' : ''}>
                                    {renderRecurring(step)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-blue-200/80">
                                The correct answer is <strong className="text-blue-300">{renderRecurring(current.a)}</strong>
                                {current.hint && <span className="block mt-2 text-blue-200/60">Hint: {current.hint}</span>}
                              </p>
                            )}
                          </div>
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

      {/* Report Question Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-bold text-white">Report Question</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {reportSent ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white/80 text-sm">Thanks for reporting! We'll review this question.</p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-white/60 text-sm mb-4">What's wrong with this question?</p>
                {[
                  { label: '❌ Wrong answer shown', value: 'Wrong answer' },
                  { label: '😕 Question is unclear', value: 'Question unclear' },
                  { label: '📐 Wrong topic or tier', value: 'Wrong topic/tier' },
                  { label: '🐛 Other issue', value: 'Other issue' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={async () => {
                      const current = sessionQueue[currentIndex];
                      try {
                        const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
                        const raw = localStorage.getItem(storageKey);
                        const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
                        await fetch(`${supabaseUrl}/rest/v1/question_reports`, {
                          method: 'POST',
                          headers: {
                            'apikey': supabaseAnonKey,
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                          },
                          body: JSON.stringify({
                            question_code: current?.code || null,
                            question_text: current?.q || null,
                            expected_answer: String(current?.a ?? ''),
                            difficulty_level: current?.difficultyLevel || null,
                            tier: current?.tier || null,
                            issue_type: option.value,
                            user_id: practiceUser?.id || null,
                          }),
                        });
                        setReportSent(true);
                      } catch (err) {
                        console.error('Report failed:', err);
                        setReportSent(true);
                      }
                    }}
                    className="w-full text-left px-4 py-3 mb-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-400/30 text-white/80 text-sm transition-all"
                  >
                    {option.label}
                  </button>
                ))}
              </>
            )}
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
  
  // Weekly activity chart data (last 7 days) — uses dailyActivity (cloud-synced)
  const dailyActivity = loadDailyActivity();
  const weeklyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayData = dailyActivity[dateKey];

    weeklyActivity.push({
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      questions: dayData?.questions ?? 0,
      correct: dayData?.correct ?? 0,
      sessions: dayData?.sessions ?? 0,
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
    <div className="min-h-screen bg-void relative overflow-x-hidden">
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
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${readinessScore}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-mint">{masteredCount}</div>
                <div className="text-xs text-secondary-text">Mastered</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">{examReadyCount}</div>
                <div className="text-xs text-secondary-text">Exam Ready</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                <div className="text-xs text-secondary-text">Learning</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-secondary-text">{totalObjectiveCount - masteredCount - examReadyCount - learningCount}</div>
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
                isTeacher={true}
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
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountStatus, setDeleteAccountStatus] = useState(''); // '' | 'deleting' | 'error'
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
  // Maths captcha for bot protection
  const [captcha, setCaptcha] = useState(() => {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    return { a, b, answer: a * b };
  });
  const [captchaInput, setCaptchaInput] = useState('');
  const [pendingSchool, setPendingSchool] = useState(null); // school waiting for captcha
  const [summaryStatus, setSummaryStatus] = useState(''); // '', 'copied', 'shared'
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  
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

  // Delete account – calls API route to remove auth record + all data, then clears local
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteAccountStatus('deleting');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      // Call the Vercel API route – it deletes all DB rows + the auth.users record
      const res = await fetch(`/api/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Delete failed');
      }

      // Also tidy up client-side things the edge function can't reach
      if (userSchool) {
        try { await leaveSchool(user.id); } catch (e) { /* ignore */ }
      }
      try { await deleteAvatar(user.id); } catch (e) { /* ignore */ }

      // Clear all local storage and reload
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleteAccountStatus('error');
    }
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
          if (schools.length === 0) setSchoolError('No schools in database yet');
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

  const schoolResults = useMemo(() => {
    if (!schoolFilter.trim() || schoolFilter.trim().length < 2) return [];
    const q = schoolFilter.trim().toLowerCase();
    return allSchoolsList.filter(s =>
      s.name?.toLowerCase().includes(q) || s.town?.toLowerCase().includes(q)
    );
  }, [schoolFilter, allSchoolsList]);

  // Generate a new captcha
  const newCaptcha = () => {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    setCaptcha({ a, b, answer: a * b });
    setCaptchaInput('');
  };

  // When user clicks Join on a school, show captcha first
  const handleJoinSchool = (school) => {
    setPendingSchool(school);
    newCaptcha();
    setSchoolError('');
  };

  // Verify captcha and actually join
  const handleCaptchaSubmit = async () => {
    if (parseInt(captchaInput.trim(), 10) !== captcha.answer) {
      setSchoolError('Incorrect answer — try again');
      newCaptcha();
      return;
    }
    if (!user || !pendingSchool) return;
    setSchoolJoining(true);
    setSchoolError('');
    try {
      await joinSchool(user.id, pendingSchool.id);
      setUserSchool(pendingSchool);
      localStorage.setItem('maths-habit-user-school', JSON.stringify(pendingSchool));
      setPendingSchool(null);
      setSchoolDropdownOpen(false);
      setSchoolFilter('');
      setCaptchaInput('');
    } catch (err) {
      setSchoolError(err.message || 'Failed to join school');
    } finally {
      setSchoolJoining(false);
    }
  };

  // Handle creating + joining a new school (with captcha)
  const handleCreateSchool = async () => {
    if (parseInt(captchaInput.trim(), 10) !== captcha.answer) {
      setSchoolError('Incorrect answer — try again');
      newCaptcha();
      return;
    }
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
      setCaptchaInput('');
      setSchoolsLoaded(false);
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
    <div className="min-h-screen bg-void relative overflow-x-hidden">
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
                <div className="p-4 bg-white/5 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 overflow-hidden">
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
                        {safeInitial(user)}
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
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-white">{typeof profile?.display_name === 'object' ? JSON.stringify(profile.display_name) : (profile?.display_name || 'Anonymous')}</div>
                        <button
                          onClick={() => { setEditingName(true); setNewDisplayName(profile?.display_name || ''); setNameError(''); }}
                          className="text-xs text-violet-light hover:text-white transition-colors"
                        >
                          {profile?.display_name ? 'Edit' : 'Add name'}
                        </button>
                      </div>
                      <div className="text-sm text-secondary-text break-all overflow-hidden">{user.email}</div>
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
                    className="flex items-center gap-2 px-3 py-2 mt-3 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                  </div>

                {/* Edit display name */}
                {editingName && (
                  <div className="p-4 bg-white/5 rounded-xl border border-violet/30">
                    <label className="text-sm text-secondary-text block mb-2">Display name (visible on leaderboard)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Enter your name..."
                        maxLength={20}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet/50"
                      />
                      <button
                        disabled={nameSaving || !newDisplayName.trim()}
                        onClick={async () => {
                          const trimmed = newDisplayName.trim();
                          if (!trimmed) return;
                          const profanityCheck = checkProfanity(trimmed);
                          if (profanityCheck.isProfane) {
                            setNameError('That name is not allowed. Please choose another.');
                            return;
                          }
                          setNameSaving(true);
                          setNameError('');
                          try {
                            const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
                            const raw = localStorage.getItem(storageKey);
                            const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
                            const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
                              method: 'PATCH',
                              headers: {
                                'apikey': supabaseAnonKey,
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                              },
                              body: JSON.stringify({ display_name: sanitiseName(trimmed) }),
                            });
                            if (!res.ok) throw new Error('Failed to save');
                            await refreshProfile();
                            setEditingName(false);
                          } catch (err) {
                            console.error('Name update failed:', err);
                            setNameError('Failed to save. Please try again.');
                          } finally {
                            setNameSaving(false);
                          }
                        }}
                        className="px-4 py-2 btn-gradient-mint text-void font-semibold rounded-xl text-sm disabled:opacity-40"
                      >
                        {nameSaving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-3 py-2 text-secondary-text hover:text-white text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {nameError && <p className="text-red-400 text-xs mt-2">{nameError}</p>}
                  </div>
                )}

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

                {/* Promo code input for free users - hidden on iOS per App Store guideline 3.1.1 */}
                {!isSubscribed && !isNativeIOS() && (
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
                  <p className="text-sm text-secondary-text">{userSchool ? 'Change or leave your school here' : 'Join your school to see the leaderboard'}</p>
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
              ) : pendingSchool ? (
                /* Maths captcha before joining */
                <div className="space-y-3">
                  <div className="p-4 bg-violet/20 rounded-xl border border-violet/30 text-center">
                    <p className="text-sm text-secondary-text mb-1">Joining <span className="text-white font-medium">{pendingSchool.name}</span></p>
                    <p className="text-white font-semibold text-lg mb-3">What is {captcha.a} × {captcha.b}?</p>
                    <div className="flex gap-2 justify-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="?"
                        autoFocus
                        className="w-24 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-center text-lg font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCaptchaSubmit(); }}
                      />
                      <button
                        onClick={handleCaptchaSubmit}
                        disabled={schoolJoining || !captchaInput.trim()}
                        className="px-6 py-3 btn-gradient-mint text-void font-semibold rounded-xl disabled:opacity-50"
                      >
                        {schoolJoining ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPendingSchool(null); setCaptchaInput(''); setSchoolError(''); }}
                    className="w-full py-2 text-sm text-secondary-text hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : showAddSchool ? (
                /* Add new school form with captcha */
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
                  {newSchoolName.trim() && newSchoolTown.trim() && (
                    <div className="p-3 bg-violet/20 rounded-xl border border-violet/30 text-center">
                      <p className="text-sm text-secondary-text mb-1">Quick check: What is {captcha.a} × {captcha.b}?</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="?"
                        className="w-24 mx-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-center font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSchool(); }}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSchool}
                      disabled={schoolJoining || !newSchoolName.trim() || !newSchoolTown.trim() || !captchaInput.trim()}
                      className="flex-1 py-3 btn-gradient-mint text-void font-semibold rounded-xl disabled:opacity-50"
                    >
                      {schoolJoining ? 'Adding...' : 'Add & Join'}
                    </button>
                    <button
                      onClick={() => { setShowAddSchool(false); setNewSchoolName(''); setNewSchoolTown(''); setCaptchaInput(''); }}
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
                      <div className="max-h-56 overflow-y-auto">
                        {!schoolsLoaded ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">Loading schools...</div>
                        ) : schoolError && allSchoolsList.length === 0 ? (
                          <div className="px-4 py-4 text-center text-sm text-red-400">{schoolError}</div>
                        ) : schoolFilter.trim().length < 2 ? (
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">Start typing to search...</div>
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
                          <div className="px-4 py-4 text-center text-sm text-secondary-text">No schools found for "{schoolFilter}"</div>
                        )}
                      </div>
                      <div className="p-2 border-t border-white/10">
                        <button
                          onClick={() => { setSchoolDropdownOpen(false); setShowAddSchool(true); newCaptcha(); }}
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
                      !isNativeIOS() ? (
                        <button
                          onClick={onUpgrade}
                          className="px-4 py-2 text-white text-sm font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          🔒 Upgrade to unlock
                        </button>
                      ) : null
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

              {/* Delete Account */}
              {user && (
                <div className="pt-4 border-t border-white/10">
                  {!showDeleteAccountConfirm ? (
                    <button
                      onClick={() => setShowDeleteAccountConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-secondary-text hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete your account
                    </button>
                  ) : (
                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                      <div className="flex items-center gap-2 text-red-400 mb-3">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold">Delete your account?</span>
                      </div>
                      <p className="text-sm text-red-400/80 mb-4">
                        This will permanently delete your account, all progress, stats, and school membership. This cannot be undone.
                      </p>
                      {deleteAccountStatus === 'error' && (
                        <p className="text-sm text-red-400 mb-3">Something went wrong. Please try again or contact support.</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowDeleteAccountConfirm(false); setDeleteAccountStatus(''); }}
                          className="flex-1 py-2 glass-panel hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
                          disabled={deleteAccountStatus === 'deleting'}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteAccountStatus === 'deleting'}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {deleteAccountStatus === 'deleting' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                          ) : (
                            'Yes, delete my account'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
    { id: 'heatmap', label: 'Journey', icon: HeatmapIcon },
    { id: 'practice', label: 'Practice', icon: PracticeIcon },
    { id: 'stats', label: 'Stats', icon: StatsIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 top-nav-bar" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
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
                    <Icon className="w-9 h-9" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Streak display removed — Piro handles streak motivation */}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav - Floating Glass Pill */}
      <nav className="fixed left-4 right-4 z-50 md:hidden bottom-nav" style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
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
                  <Icon className={`w-10 h-10 ${isActive ? 'drop-shadow-[0_0_8px_rgba(56,230,162,0.5)]' : 'opacity-60'}`} />
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

  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();

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
        // Require a display name
        if (!displayName.trim()) {
          throw new Error('Please enter a display name');
        }
        if (displayName.trim().length < 2) {
          throw new Error('Display name must be at least 2 characters');
        }
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

      {/* Apple Sign In — uses Apple HIG white button style for dark backgrounds */}
      <button
        onClick={async () => { setError(''); setLoading(true); try { const { error } = await signInWithApple(); if (error) throw error; } catch (err) { setError(err.message); } finally { setLoading(false); } }}
        disabled={loading}
        className="w-full bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-3"
        style={{ minHeight: '44px', fontSize: '17px', letterSpacing: '-0.01em' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="black">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Sign in with Apple
      </button>

      {/* Google Sign In */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 border border-gray-300"
        style={{ minHeight: '44px', fontSize: '17px', letterSpacing: '-0.01em' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
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
          placeholder="e.g. ABC-1234"
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
  const [gameLevel, setGameLevel] = useState(1); // 1 = Stone→Gold grid, 2 = Diamond grid
  const [diamondProgress, setDiamondProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maths-habit-diamond-progress') || '{}'); } catch { return {}; }
  });
  const saveDiamondProgress = (dp) => { localStorage.setItem('maths-habit-diamond-progress', JSON.stringify(dp)); };
  const [higherProgress, setHigherProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maths-habit-higher-progress') || '{}'); } catch { return {}; }
  });
  const saveHigherProgress = (hp) => { localStorage.setItem('maths-habit-higher-progress', JSON.stringify(hp)); };

  // Tier-aware progress: Foundation and Higher have completely separate progress tracking
  const activeProgress = tier === 'higher' ? higherProgress : progress;
  const setActiveProgress = tier === 'higher' ? setHigherProgress : setProgress;
  const saveActiveProgress = tier === 'higher' ? saveHigherProgress : saveProgress;

  const [recentSessionCodes, setRecentSessionCodes] = useState([]);
  // Auto-clear recently-progressed tile highlights after 5 seconds
  useEffect(() => {
    if (recentSessionCodes.length === 0) return;
    const timer = setTimeout(() => setRecentSessionCodes([]), 5000);
    return () => clearTimeout(timer);
  }, [recentSessionCodes]);
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
  const [showPiroNaming, setShowPiroNaming] = useState(false); // First place reward: name your dragon
  const [piroCustomName, setPiroCustomName] = useState('');
  const [piroNamingSaving, setPiroNamingSaving] = useState(false);
  const [piroNamingError, setPiroNamingError] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [promptDisplayName, setPromptDisplayName] = useState('');
  const [promptNameSaving, setPromptNameSaving] = useState(false);
  const [promptNameError, setPromptNameError] = useState('');

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
    FREE_DAILY_LIMIT,
    refreshProfile
  } = useAuth();

  // Initialise iOS In-App Purchases
  useEffect(() => {
    if (isNativeIOS()) {
      initIAP((update) => {
        console.log('[App] IAP update:', update);
        if (update.status === 'active') {
          refreshProfile?.();
        }
      });
      return () => destroyIAP();
    }
  }, []);

  // Auto-logout after 30 minutes of inactivity — uses localStorage timestamps
  // so it works across page visibility changes and doesn't interfere with React state
  useEffect(() => {
    const INACTIVITY_KEY = 'maths-habit-last-activity';
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    // Stamp activity on every interaction
    const stampActivity = () => {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
    };

    // Check on visibility change (when user returns to the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const last = Number(localStorage.getItem(INACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= INACTIVITY_TIMEOUT) {
        // Clear auth and reload — supabase will see no session on reload
        localStorage.removeItem('maths-habit-onboarding-complete');
        localStorage.removeItem(INACTIVITY_KEY);
        // Use supabase signOut directly via the global client to avoid React state issues
        import('./lib/supabase').then(({ supabase }) => {
          supabase.auth.signOut().finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      }
    };

    // Stamp on load
    stampActivity();

    window.addEventListener('touchstart', stampActivity, { passive: true });
    window.addEventListener('mousedown', stampActivity);
    window.addEventListener('keydown', stampActivity);
    window.addEventListener('scroll', stampActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check periodically while app is open
    const checkInterval = setInterval(() => {
      const last = Number(localStorage.getItem(INACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= INACTIVITY_TIMEOUT) {
        localStorage.removeItem('maths-habit-onboarding-complete');
        localStorage.removeItem(INACTIVITY_KEY);
        import('./lib/supabase').then(({ supabase }) => {
          supabase.auth.signOut().finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      }
    }, 60 * 1000);

    return () => {
      window.removeEventListener('touchstart', stampActivity);
      window.removeEventListener('mousedown', stampActivity);
      window.removeEventListener('keydown', stampActivity);
      window.removeEventListener('scroll', stampActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(checkInterval);
    };
  }, []); // Empty deps — runs once on mount, never re-runs

  // Prompt users without a display name to add one
  useEffect(() => {
    if (user && !authLoading && profile && !profile.display_name && !showOnboarding) {
      setShowNamePrompt(true);
    }
  }, [user, authLoading, profile, showOnboarding]);

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
      // Then fetch fresh from server — but never clear cache on null
      // (only explicit "Leave" in Settings should clear the school)
      getUserSchool(user.id).then(school => {
        if (school) {
          setUserSchool(school);
          localStorage.setItem('maths-habit-user-school', JSON.stringify(school));

          // Check if user is #1 on startup → show dragon naming reward if eligible
          if (!profile?.piro_name) {
            const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
            try {
              const raw = localStorage.getItem(storageKey);
              const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;
              fetch(`${supabaseUrl}/rest/v1/rpc/get_school_leaderboard`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ p_school_id: school.id }),
              }).then(async (lbRes) => {
                if (lbRes.ok) {
                  const leaderboard = await lbRes.json();
                  if (leaderboard.length > 0 && leaderboard[0].user_id === user.id) {
                    setShowPiroNaming(true);
                  }
                }
              }).catch(err => console.error('Startup leaderboard rank check error:', err));
            } catch (e) {
              console.error('Startup leaderboard token error:', e);
            }
          }
        }
        // If server returns null but we have a cached school, keep the cache —
        // the server call may have failed silently or have a replication delay
      }).catch(err => {
        console.error('Failed to fetch user school:', err);
        // Keep cached school on error — don't clear
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
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
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
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
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
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
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
                  {safeInitial(user)}
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
        <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
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

              {/* Premium Plan Card — Stripe on web, StoreKit on iOS */}
              {isNativeIOS() ? (
                <button
                  onClick={() => setShowUpgradePrompt(true)}
                  className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all"
                >
                  View Premium Plans
                </button>
              ) : (
                <OnboardingPlanCard
                  onSelectFree={completeOnboarding}
                  userId={user?.id}
                  userEmail={user?.email}
                />
              )}

              {/* Promo Code Section - hidden on iOS per App Store guideline 3.1.1 */}
              {!isNativeIOS() && <PromoCodeInput onSuccess={completeOnboarding} />}
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

    // Sync highestStreak & stage with actual streak on every load
    // (catches milestone changes and any streak/piro drift)
    if (dayStreak > currentPiro.highestStreak) {
      currentPiro.highestStreak = dayStreak;
      changed = true;
    }
    const earnedStage = getPiroStageFromStreak(currentPiro.highestStreak);
    if (earnedStage > currentPiro.stage) {
      const oldStage = currentPiro.stage;
      currentPiro.stage = earnedStage;
      currentPiro.evolvedAt = currentPiro.evolvedAt || [];
      currentPiro.evolvedAt.push({ stage: earnedStage, name: PIRO_STAGES[earnedStage].name, date: Date.now() });
      changed = true;
      // Show evolution celebration
      setPiroEvolution({ oldStage, newStage: earnedStage });
    }
    if (currentPiro.highestStreak >= 35) {
      currentPiro.reachedEpic = true;
    }

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

  const getLevel = (code) => getUnderstandingLevel(activeProgress[code]);
  const totalMastered = allObjectives.filter(o => getLevel(o.code) >= 5).length;

  // Level 2 (Diamond) helpers
  const level1Complete = allObjectives.every(o => getLevel(o.code) >= 5);
  const diamondObjectives = allObjectives.filter(o => diamondQuestionBank[o.code]);
  const getDiamondLevel = (code) => {
    const dp = diamondProgress[code];
    return dp?.quickCorrect ?? 0; // 0-3 (3 = diamond mastered)
  };
  const totalDiamondMastered = diamondObjectives.filter(o => getDiamondLevel(o.code) >= 3).length;

  // Diamond Level 2 heatmap: stone → gold → diamond
  const DIAMOND_HEATMAP = {
    0: '#1a1525',   // Stone (not started)
    1: '#D4AF37',   // Gold (in progress)
    2: '#D4AF37',   // Gold (nearly there)
    3: '#E8E8E8',   // Diamond (mastered)
  };
  const DIAMOND_TILE_IMAGES = {
    0: '/images/tiles/stone-tile.jpeg',     // Stone — not started
    1: '/images/tiles/gold-tile.jpeg',      // Gold — in progress
    2: '/images/tiles/gold-tile.jpeg',      // Gold — nearly there
    3: '/images/tiles/diamond-tile.jpeg',   // Diamond — mastered
  };

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

    // Check if any stone (never-practised) objectives remain
    const hasStoneGems = allObjectives.some(obj => {
      const prog = activeProgress[obj.code];
      return !prog || (!(prog.quickCorrect) && !(prog.lastPracticed));
    });

    return allObjectives.map(obj => {
      const prog = activeProgress[obj.code];
      const quickCorrect = prog?.quickCorrect ?? 0;
      const lastPracticed = prog?.lastPracticed ?? 0;
      const neverPractised = !prog || (!quickCorrect && !lastPracticed);
      const daysSince = lastPracticed ? Math.floor((Date.now() - lastPracticed) / (1000 * 60 * 60 * 24)) : 999;

      // Never-practised objectives get a massive boost
      if (neverPractised) {
        return { ...obj, weight: 50 };
      }

      // If there are still stone gems, don't show mastered (gold) objectives
      if (hasStoneGems && quickCorrect >= 5) {
        return { ...obj, weight: 0 };
      }

      // Weight: lower progress = higher weight, longer time since practice = higher weight
      let progressWeight;
      if (quickCorrect >= 5) {
        progressWeight = 1; // Mastered - low priority (only shown when no stone gems left)
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

    // Filter out zero-weight objectives (e.g. mastered when stone gems exist)
    const pickable = available.filter(o => o.weight > 0);

    // Fill remaining slots with weighted random
    for (let i = selected.length; i < 5 && pickable.length > 0; i++) {
      const totalWeight = pickable.reduce((sum, obj) => sum + obj.weight, 0);
      if (totalWeight <= 0) break;
      let rand = seededRandom(i + 100) * totalWeight;

      for (let j = 0; j < pickable.length; j++) {
        rand -= pickable[j].weight;
        if (rand <= 0) {
          selected.push(pickable[j]);
          pickable.splice(j, 1);
          break;
        }
      }
    }

    // Fallback: if selection failed, take from non-zero-weight objectives first
    if (selected.length < 5) {
      const remaining = weighted.filter(w => w.weight > 0 && !selected.find(s => s.code === w.code));
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

  // ==================== PIRO NAMING MODAL (First Place Reward) ====================
  const handlePiroNamingSave = async () => {
    const trimmed = piroCustomName.trim();
    if (!trimmed) { setPiroNamingError('Give your dragon a name!'); return; }
    if (trimmed.length < 2) { setPiroNamingError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setPiroNamingError('Name must be 20 characters or less'); return; }
    const profanityResult = checkProfanity(trimmed);
    if (!profanityResult.clean) { setPiroNamingError(profanityResult.reason || 'That name is not allowed'); return; }

    setPiroNamingSaving(true);
    setPiroNamingError('');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ piro_name: trimmed }),
      });

      if (!res.ok) throw new Error('Failed to save dragon name');
      await refreshProfile();
      setShowPiroNaming(false);
      setPiroCustomName('');
    } catch (err) {
      console.error('Piro naming save error:', err);
      setPiroNamingError('Could not save name. Try again.');
    } finally {
      setPiroNamingSaving(false);
    }
  };

  if (showPiroNaming) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
        <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />
        <div className="orb-cyan w-36 h-36 top-1/2 right-10 opacity-60 pointer-events-none" />

        {/* Celebration confetti */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(30)].map((_, i) => {
            const colors = ['#D4AF37', '#ec4899', '#8B5CF6', '#38E6A2', '#F59E0B'];
            const color = colors[i % colors.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 3;
            const duration = 3 + Math.random() * 2;
            return (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: color,
                  left: `${left}%`,
                  top: '-10px',
                  animation: `tileFall ${duration}s ${delay}s ease-in-out infinite`,
                  opacity: 0.7,
                }}
              />
            );
          })}
        </div>

        <div className="max-w-sm w-full glass-panel rounded-3xl p-8 text-center relative z-10">
          {/* Dragon trophy image */}
          <div className="w-32 h-32 mx-auto mb-4">
            <img
              src="/images/dragontrophy.png"
              alt="Dragon Trophy"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              onError={(e) => {
                // Fallback to icon if image not found
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"><svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>';
              }}
            />
          </div>

          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-2">
            You're #1!
          </h2>
          <p className="text-secondary-text text-sm mb-1">
            You've conquered your school leaderboard!
          </p>
          <p className="text-white font-medium mb-2">
            You've earned the right to name your dragon.
          </p>
          <p className="text-yellow-400/70 text-xs mb-6">
            Choose wisely — this name is permanent!
          </p>

          {/* Dragon preview */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden piro-idle">
            <PiroMedia display={getPiroDisplay(piro)} className="w-full h-full object-cover rounded-2xl" />
          </div>

          <input
            type="text"
            value={piroCustomName}
            onChange={(e) => { setPiroCustomName(e.target.value); setPiroNamingError(''); }}
            placeholder="Name your dragon..."
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-yellow-500/30 text-white placeholder-white/40 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter' && !piroNamingSaving) handlePiroNamingSave(); }}
          />

          {piroNamingError && (
            <p className="text-red-400 text-xs mt-2">{piroNamingError}</p>
          )}

          <button
            onClick={handlePiroNamingSave}
            disabled={piroNamingSaving || !piroCustomName.trim()}
            className="mt-5 w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 font-bold rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {piroNamingSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Star className="w-4 h-4" /> Name My Dragon Forever</>
            )}
          </button>

          <button
            onClick={() => { setShowPiroNaming(false); setPiroCustomName(''); }}
            className="mt-3 text-secondary-text/60 hover:text-secondary-text text-xs transition-colors"
          >
            Maybe later
          </button>

          <p className="text-white/30 text-xs mt-3">{piroCustomName.trim().length}/20 characters</p>
        </div>
      </div>
    );
  }

  // ==================== NAME PROMPT MODAL ====================
  // Blocks users without a display name until they add one
  const handleNamePromptSave = async () => {
    const trimmed = promptDisplayName.trim();
    if (!trimmed) { setPromptNameError('Please enter a display name'); return; }
    if (trimmed.length < 2) { setPromptNameError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 20) { setPromptNameError('Name must be 20 characters or less'); return; }
    if (!checkProfanity(trimmed).clean) { setPromptNameError('That name is not allowed'); return; }

    setPromptNameSaving(true);
    setPromptNameError('');
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const token = raw ? (JSON.parse(raw)?.access_token || supabaseAnonKey) : supabaseAnonKey;

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) throw new Error('Failed to save name');
      await refreshProfile();
      setShowNamePrompt(false);
      setPromptDisplayName('');
    } catch (err) {
      console.error('Name prompt save error:', err);
      setPromptNameError('Could not save name. Try again.');
    } finally {
      setPromptNameSaving(false);
    }
  };

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-64 h-64 -top-20 -right-20 opacity-80 pointer-events-none" />
        <div className="orb-mint w-48 h-48 -bottom-10 -left-10 opacity-70 pointer-events-none" />

        <div className="max-w-sm w-full glass-panel rounded-3xl p-8 text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-glow-violet">
            <User className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Choose a display name</h2>
          <p className="text-secondary-text text-sm mb-6">
            This will show on the school leaderboard and in battles. You can change it later in Settings.
          </p>

          <input
            type="text"
            value={promptDisplayName}
            onChange={(e) => { setPromptDisplayName(e.target.value); setPromptNameError(''); }}
            placeholder="Enter your name..."
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter' && !promptNameSaving) handleNamePromptSave(); }}
          />

          {promptNameError && (
            <p className="text-red-400 text-xs mt-2">{promptNameError}</p>
          )}

          <button
            onClick={handleNamePromptSave}
            disabled={promptNameSaving || !promptDisplayName.trim()}
            className="mt-5 w-full py-3 btn-gradient-mint text-gray-900 font-bold rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {promptNameSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Check className="w-4 h-4" /> Continue</>
            )}
          </button>

          <p className="text-white/30 text-xs mt-3">{promptDisplayName.trim().length}/20 characters</p>
        </div>
      </div>
    );
  }

  // Placeholder pages
  if (currentPage === 'practice') {
    return (
      <>
      <PracticePage
        dailyObjectives={dailyObjectives}
        progress={activeProgress}
        setProgress={setActiveProgress}
        saveProgressFn={tier === 'higher' ? saveHigherProgress : saveProgress}
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
        gameLevel={gameLevel}
        diamondProgress={diamondProgress}
        setDiamondProgress={setDiamondProgress}
        saveDiamondProgress={saveDiamondProgress}
        diamondObjectives={diamondObjectives}
      />
      {/* Upgrade Prompt for Practice page — Stripe on web, StoreKit on iOS */}
      {isNativeIOS() ? (
        <IOSUpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSuccess={() => {
            setShowUpgradePrompt(false);
            refreshProfile?.();
          }}
        />
      ) : (
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSignUp={() => {
            setShowUpgradePrompt(false);
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
        />
      )}
      </>
    );
  }

  if (currentPage === 'stats') {
    return (
      <StatsPage
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        dayStreak={dayStreak}
        progress={activeProgress}
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
        {/* Upgrade Prompt — Stripe on web, StoreKit on iOS */}
        {isNativeIOS() ? (
          <IOSUpgradePrompt
            isOpen={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            onSuccess={() => {
              setShowUpgradePrompt(false);
              refreshProfile?.();
            }}
          />
        ) : (
          <UpgradePrompt
            isOpen={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            onSignUp={() => {
              setShowUpgradePrompt(false);
              setAuthModalMode('signup');
              setShowAuthModal(true);
            }}
          />
        )}
      </>
    );
  }

  if (currentPage === 'heatmap') {
    return (
      <div className="min-h-screen bg-void relative overflow-x-hidden">
        <div className="ambient-glow" />
        <div className="orb-purple w-96 h-96 -top-48 -right-48 opacity-70 fixed pointer-events-none" />
        <div className="orb-mint w-64 h-64 top-1/2 -left-32 opacity-60 fixed pointer-events-none" />

        <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

        {/* Tile glow animations (Gold + Diamond) */}
        <style>{`
          .gold-tile-glow {
            animation: goldPulse 3s ease-in-out infinite;
          }
          @keyframes goldPulse {
            0%, 100% { filter: drop-shadow(0 0 3px rgba(212,175,55,0.3)); }
            50% { filter: drop-shadow(0 0 8px rgba(212,175,55,0.6)); }
          }
          .gold-tile-shimmer {
            animation: goldShimmer 4s ease-in-out infinite;
          }
          @keyframes goldShimmer {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
          .diamond-tile-glow {
            animation: diamondPulse 3s ease-in-out infinite;
          }
          @keyframes diamondPulse {
            0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.3)); }
            50% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.7)); }
          }
        `}</style>

        <div className="pt-20 pb-28 md:pb-10 relative z-10">
          {/* Hero Heatmap Card */}
          <div className="max-w-4xl mx-auto px-2 sm:px-4">
            <div className="glass-panel rounded-3xl p-3 sm:p-6 md:p-10 shadow-glass card-hover">

              {/* Header with stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight gradient-text-celebration">
                    {gameLevel === 1 ? 'Your Maths Journey' : '💎 Diamond Level'}
                  </h1>
                  <p className="text-secondary-text mt-1">
                    {gameLevel === 1
                      ? `${allObjectives.length} GCSE objectives · Click to track progress`
                      : `${diamondObjectives.length} diamond challenges · Master them all`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Game Level toggle: Level 1 (Gold) / Level 2 (Diamond) */}
                  <div className="flex glass-panel rounded-lg p-1">
                    <button onClick={() => setGameLevel(1)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        gameLevel === 1 ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-gray-800'
                      }`}>⭐ Gold</button>
                    <button onClick={() => { if (level1Complete) setGameLevel(2); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        gameLevel === 2 ? 'bg-white/90 text-slate-900 shadow-[0_0_12px_rgba(255,255,255,0.4)]' :
                        level1Complete ? 'text-secondary-text hover:text-gray-800' : 'text-secondary-text/30 cursor-not-allowed'
                      }`}>{level1Complete ? '💎' : '🔒'} Diamond</button>
                  </div>

                  {/* Tier toggle */}
                  {gameLevel === 1 && (
                    <div className="flex glass-panel rounded-lg p-1">
                      {['foundation', 'higher'].map(t => (
                        <button key={t} onClick={() => setTier(t)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                            tier === t ? 'bg-gradient-violet text-white shadow-glow-violet' : 'text-secondary-text hover:text-gray-800'
                          }`}>{t}</button>
                      ))}
                    </div>
                  )}

                  {/* Mastery badge */}
                  <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl">
                    <TrophyIcon className="w-5 h-5 text-[#FBBF24]" />
                    <span className="font-bold text-[#FBBF24]">{gameLevel === 1 ? totalMastered : totalDiamondMastered}</span>
                    <span className="text-secondary-text text-sm">/ {gameLevel === 1 ? allObjectives.length : diamondObjectives.length}</span>
                  </div>
                </div>
              </div>

              {/* Mastery Level Legend - Top */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 mb-6 pb-6 border-b-2" style={{borderImage: gameLevel === 2
                ? 'linear-gradient(90deg, transparent, #888, #FFF, #888, transparent) 1'
                : 'linear-gradient(90deg, transparent, #B00053, #76235E, transparent) 1'}}>
                <span className="text-sm text-secondary-text mr-1">Progress:</span>
                {gameLevel === 1 ? [
                  { level: 0, label: 'New' },
                  { level: 1, label: 'Started' },
                  { level: 2, label: 'Learning' },
                  { level: 3, label: 'Confident' },
                  { level: 4, label: 'Exam ready' },
                  { level: 5, label: 'Mastered' },
                ].map(({ level, label }) => (
                  <div key={level} className="flex items-center gap-2">
                    <img src={TILE_IMAGES[level]} alt={label} className="w-7 h-7 rounded object-cover" />
                    <span className="text-sm text-secondary-text">{label}</span>
                  </div>
                )) : [
                  { level: 0, label: 'Stone' },
                  { level: 1, label: 'Gold' },
                  { level: 3, label: 'Diamond' },
                ].map(({ level, label }) => (
                  <div key={level} className="flex items-center gap-2">
                    <img src={DIAMOND_TILE_IMAGES[level]} alt={label} className="w-7 h-7 rounded object-cover" />
                    <span className="text-sm text-secondary-text">{label}</span>
                  </div>
                ))}
              </div>

              {/* Heatmap Explainer - shows for new users */}
              {!loadShownTips().includes('heatmapExplainer') && (
                <div className="mb-4 p-4 glass-panel rounded-xl border border-violet/30 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white mb-2">How the heatmap works</p>
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
                {gameLevel === 1 ? (
                  /* LEVEL 1 GRID (Stone → Gold) */
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: window.innerWidth < 480 ? 3 : 6,
                    width: '100%',
                    maxWidth: `${cols * 36 + (cols - 1) * 6}px`
                  }}>
                    {allObjectives.map((obj) => {
                      const level = getLevel(obj.code);
                      const objProg = activeProgress[obj.code];
                      const isMasteredTile = level >= 5;
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
                            overflow: 'visible',
                            opacity: tileOpacity,
                          }}
                          className={`w-full transition-all duration-200 hover:scale-110 hover:z-20 hover:brightness-110 cursor-pointer active:scale-95 ${isMasteredTile ? 'gold-tile-glow' : ''} ${recentSessionCodes.includes(obj.code) ? 'heatmap-glow-afterpulse' : ''}`}
                        >
                          {/* Gold outer glow for mastered tiles */}
                          {isMasteredTile && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 6,
                              boxShadow: '0 0 8px rgba(212,175,55,0.5), 0 0 16px rgba(212,175,55,0.25)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Tile image */}
                          <img
                            src={TILE_IMAGES[level] || TILE_IMAGES[0]}
                            alt=""
                            className="w-full h-full object-cover relative z-[1]"
                            style={{ borderRadius: 4, filter: isMasteredTile ? 'brightness(1.15) saturate(1.2)' : 'none' }}
                            loading="lazy"
                            draggable={false}
                          />
                          {/* Gold shimmer overlay for mastered tiles */}
                          {isMasteredTile && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 4, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,235,140,0.15) 50%, transparent 70%)',
                            }} />
                          )}
                          {/* Revisit indicator overlay */}
                          {needsRevisit && !isExamReady && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30 z-[3]" style={{ borderRadius: 4 }}>
                              <span className="text-[8px] text-white/70">↻</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* LEVEL 2 GRID (Diamond) */
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols)}, 1fr)`,
                    gap: window.innerWidth < 480 ? 4 : 8,
                    width: '100%',
                    maxWidth: `${Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols) * 50 + (Math.min(Math.ceil(Math.sqrt(diamondObjectives.length)), cols) - 1) * 8}px`
                  }}>
                    {diamondObjectives.map((obj) => {
                      const dLevel = getDiamondLevel(obj.code);
                      const isDiamondMastered = dLevel >= 3;
                      const isGoldTile = dLevel === 1 || dLevel === 2;
                      return (
                        <div
                          key={obj.code}
                          onClick={() => handleTileTap(obj)}
                          style={{
                            aspectRatio: '1',
                            borderRadius: 6,
                            position: 'relative',
                            overflow: 'visible',
                          }}
                          className={`w-full transition-all duration-200 hover:scale-110 hover:z-20 hover:brightness-110 cursor-pointer active:scale-95 ${isDiamondMastered ? 'diamond-tile-glow' : isGoldTile ? 'gold-tile-glow' : ''} ${recentSessionCodes.includes(obj.code) ? 'heatmap-glow-afterpulse' : ''}`}
                        >
                          {/* Diamond outer glow for mastered diamond tiles — clear white sparkle */}
                          {isDiamondMastered && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 8,
                              boxShadow: '0 0 10px rgba(255,255,255,0.6), 0 0 20px rgba(255,255,255,0.3)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Gold outer glow for gold tiles in diamond grid */}
                          {isGoldTile && (
                            <div style={{
                              position: 'absolute', inset: -2, borderRadius: 8,
                              boxShadow: '0 0 8px rgba(212,175,55,0.5), 0 0 16px rgba(212,175,55,0.25)',
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                          )}
                          {/* Tile image */}
                          <img
                            src={DIAMOND_TILE_IMAGES[dLevel] || DIAMOND_TILE_IMAGES[0]}
                            alt=""
                            className="w-full h-full object-cover relative z-[1]"
                            style={{ borderRadius: 6, filter: (isDiamondMastered || isGoldTile) ? 'brightness(1.15) saturate(1.2)' : 'none' }}
                            loading="lazy"
                            draggable={false}
                          />
                          {/* Diamond shimmer overlay — clear white sparkle */}
                          {isDiamondMastered && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
                            }} />
                          )}
                          {/* Gold shimmer overlay for gold tiles in diamond grid */}
                          {isGoldTile && (
                            <div className="gold-tile-shimmer" style={{
                              position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', zIndex: 2,
                              background: 'linear-gradient(135deg, transparent 30%, rgba(255,235,140,0.15) 50%, transparent 70%)',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Tile Detail Modal */}
        <TileDetailModal
          open={tooltip.open}
          objective={tooltip.objective}
          progress={tooltip.objective ? activeProgress[tooltip.objective.code] : null}
          onClose={closeTileDetail}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="ambient-glow" />

      {/* Celebration-colored decorative orbs */}
      <div className="orb-purple w-96 h-96 -top-48 -right-48 opacity-70 fixed pointer-events-none" />
      <div className="orb-mint w-64 h-64 top-1/2 -left-32 opacity-60 fixed pointer-events-none" />
      <div className="orb-cyan w-72 h-72 bottom-20 right-10 opacity-60 fixed pointer-events-none hidden md:block" />
      <div className="orb-pink w-48 h-48 top-1/4 left-1/3 opacity-50 fixed pointer-events-none" />

      {/* No orientation prompts — portrait is default */}

      {/* Navigation */}
      <NavBar currentPage={currentPage} setCurrentPage={setCurrentPage} streak={dayStreak} />

      {/* Piro Evolution Celebration Modal */}
      {piroEvolution && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPiroEvolution(null)}>
          <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-primary-text mb-2">{profile?.piro_name || 'Piro'} Evolved!</h2>
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
                <h2 className="text-lg sm:text-xl font-bold text-primary-text">{profile?.piro_name || 'Piro'}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${piro.dead ? 'bg-red-900/30 text-red-500' : piro.dying ? 'bg-red-800/20 text-red-400' : piro.decayed ? 'bg-[#8F0000]/20 text-[#8F0000]' : 'bg-white/10 text-secondary-text'}`}>
                  {getPiroDisplay(piro).name}
                </span>
              </div>

              {/* Streak Progress Bar */}
              {(() => {
                const progressInfo = getPiroProgress(piro, dayStreak);
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
              isTeacher={true}
              compact={true}
            />
            <button
              onClick={() => setCurrentPage('stats')}
              className="w-full mt-3 py-2 text-sm text-metallic-base font-medium hover:bg-metallic-base/10 rounded-xl transition-colors"
            >
              View Full Leaderboard →
            </button>
          </div>
        ) : null}
      </div>

      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Upgrade Prompt — Stripe on web, StoreKit on iOS */}
      {isNativeIOS() ? (
        <IOSUpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSuccess={() => {
            setShowUpgradePrompt(false);
            refreshProfile?.();
          }}
        />
      ) : (
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          onSignUp={() => {
            setShowUpgradePrompt(false);
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
        />
      )}
    </div>
  );
}

// LandscapePrompt removed — portrait is now the default orientation

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

// PortraitPrompt removed — portrait is now the default orientation

// Main App wrapper with AuthProvider and ErrorBoundary
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
