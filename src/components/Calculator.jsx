import React, { useState } from 'react';
import { Check } from 'lucide-react';

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

export default Calculator;
