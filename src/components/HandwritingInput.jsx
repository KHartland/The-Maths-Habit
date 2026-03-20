import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Check, X, Pencil, Loader2 } from 'lucide-react';

/**
 * HandwritingInput - Canvas-based handwriting input with Mathpix recognition
 * Similar to Arc Maths' handwriting experience
 */

const HandwritingInput = ({
  onSubmit,
  onCancel,
  placeholder = "Write your answer...",
  mathpixAppId,  // kept for backward compat but no longer used client-side
  mathpixAppKey  // kept for backward compat but no longer used client-side
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]); // Array of stroke objects
  const [currentStroke, setCurrentStroke] = useState([]); // Current stroke points
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState('');
  const recognitionTimeoutRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size to match container
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawStrokes();
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Redraw all strokes
  const redrawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw all completed strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });

    // Draw current stroke
    if (currentStroke.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      currentStroke.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redrawStrokes();
  }, [redrawStrokes]);

  // Get position from event (works for both mouse and touch)
  const getPosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
        t: Date.now()
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now()
    };
  };

  // Start drawing
  const handleStart = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPosition(e);
    setCurrentStroke([pos]);
  };

  // Continue drawing
  const handleMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPosition(e);
    setCurrentStroke(prev => [...prev, pos]);
  };

  // End drawing
  const handleEnd = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    if (currentStroke.length > 1) {
      const newStroke = {
        points: currentStroke,
        id: Date.now()
      };
      setStrokes(prev => [...prev, newStroke]);

      // Trigger recognition after a short delay
      triggerRecognition([...strokes, newStroke]);
    }
    setCurrentStroke([]);
  };

  // Convert strokes to Mathpix format
  const strokesToMathpixFormat = (strokesArray) => {
    return {
      strokes: strokesArray.map(stroke => ({
        x: stroke.points.map(p => Math.round(p.x)),
        y: stroke.points.map(p => Math.round(p.y))
      }))
    };
  };

  // Call Mathpix API for recognition
  const triggerRecognition = useCallback(async (strokesToRecognize) => {
    // Clear any pending recognition
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }

    // Debounce - wait 500ms after last stroke
    recognitionTimeoutRef.current = setTimeout(async () => {
      setIsRecognizing(true);
      setError('');

      try {
        // Convert canvas to base64 image with white background
        // (canvas is transparent by default — Mathpix needs solid background)
        const canvas = canvasRef.current;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.fillStyle = '#FFFFFF';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(canvas, 0, 0);
        const imageData = exportCanvas.toDataURL('image/png');

        // Log API call for monitoring (dev only)
        if (import.meta.env.DEV) console.log('[Mathpix] API call triggered via server proxy', { timestamp: new Date().toISOString() });

        // Send image to our server-side proxy (keys stay secret on server)
        const response = await fetch('/api/mathpix-recognize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ src: imageData })
        });

        if (!response.ok) {
          throw new Error(`Recognition failed: ${response.status}`);
        }

        const data = await response.json();

        // Extract the recognized text - always use LaTeX for maths accuracy
        let recognized = '';
        const latex = data.latex_simplified || data.latex || data.text || '';
        recognized = latex
            // Remove LaTeX delimiters
            .replace(/\\\(/g, '')
            .replace(/\\\)/g, '')
            .replace(/\$/g, '')
            // Convert fractions
            .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1/$2')
            // Convert inequality symbols
            .replace(/\\leqslant/g, '≤')
            .replace(/\\geqslant/g, '≥')
            .replace(/\\leq/g, '≤')
            .replace(/\\geq/g, '≥')
            .replace(/\\le\b/g, '≤')
            .replace(/\\ge\b/g, '≥')
            .replace(/\\lt\b/g, '<')
            .replace(/\\gt\b/g, '>')
            .replace(/\\neq/g, '≠')
            .replace(/\\ne\b/g, '≠')
            .replace(/\\approx/g, '≈')
            // Convert common symbols
            .replace(/\\cdot/g, '×')
            .replace(/\\times/g, '×')
            .replace(/\\div/g, '÷')
            .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
            .replace(/\\pi/g, 'π')
            // Convert powers (strip braces first, then convert common superscripts)
            .replace(/\^\{([^}]+)\}/g, '^$1')
            .replace(/\^2/g, '²')
            .replace(/\^3/g, '³')
            .replace(/\^4/g, '⁴')
            .replace(/\^5/g, '⁵')
            .replace(/\^6/g, '⁶')
            .replace(/\^7/g, '⁷')
            .replace(/\^8/g, '⁸')
            .replace(/\^9/g, '⁹')
            .replace(/\^0/g, '⁰')
            .replace(/\^n/g, 'ⁿ')
            .replace(/\^{1}/g, '¹')
            // Clean up whitespace
            .replace(/\s+/g, '')
            .trim();

        setRecognizedText(recognized || '');
      } catch (err) {
        console.error('Recognition error:', err);
        setError('Recognition failed. Please try again.');
      } finally {
        setIsRecognizing(false);
      }
    }, 500);
  }, []);

  // Clear canvas
  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setRecognizedText('');
    setError('');
    sessionIdRef.current = null;
  };

  // Undo last stroke
  const handleUndo = () => {
    if (strokes.length > 0) {
      const newStrokes = strokes.slice(0, -1);
      setStrokes(newStrokes);
      if (newStrokes.length > 0) {
        triggerRecognition(newStrokes);
      } else {
        setRecognizedText('');
      }
    }
  };

  // Submit recognized answer
  const handleSubmit = () => {
    if (recognizedText) {
      onSubmit(recognizedText);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden handwriting-wrapper">
      {/* Header */}
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between handwriting-header">
        <div className="flex items-center gap-1.5 text-gray-600">
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 text-gray-500"
            title="Undo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 text-gray-500"
            title="Clear"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative h-40 bg-white cursor-crosshair handwriting-canvas"
        style={{
          backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="absolute inset-0 touch-none"
        />

        {/* Placeholder removed — grid overlay is sufficient */}
      </div>

      {/* Recognition result */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 handwriting-footer">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isRecognizing ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Recognizing...</span>
              </div>
            ) : error ? (
              <span className="text-xs text-red-500">{error}</span>
            ) : recognizedText ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Read:</span>
                <span className="text-sm font-mono font-semibold text-gray-800 truncate">{recognizedText}</span>
              </div>
            ) : strokes.length > 0 ? (
              <span className="text-xs text-gray-400">Keep writing...</span>
            ) : (
              <span className="text-xs text-gray-400">Draw with finger or stylus</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onCancel}
              className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!recognizedText || isRecognizing}
              className="px-3 py-1 btn-gradient-mint text-gray-800 font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1 text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandwritingInput;
