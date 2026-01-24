import { useState, useRef } from 'react';

export function DragDropMatch({ leftItems, rightItems, onMatchChange, disabled = false }) {
  const [matches, setMatches] = useState({}); // { leftIndex: rightIndex }
  const [draggedLeft, setDraggedLeft] = useState(null);
  const [dragOverRight, setDragOverRight] = useState(null);
  const touchCurrentItem = useRef(null);

  const handleDragStart = (e, leftIndex) => {
    if (disabled) return;
    setDraggedLeft(leftIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, rightIndex) => {
    e.preventDefault();
    setDragOverRight(rightIndex);
  };

  const handleDragLeave = () => {
    setDragOverRight(null);
  };

  const handleDrop = (e, rightIndex) => {
    e.preventDefault();
    if (draggedLeft === null) return;

    // Remove any existing match for this right item
    const newMatches = { ...matches };
    Object.keys(newMatches).forEach(key => {
      if (newMatches[key] === rightIndex) {
        delete newMatches[key];
      }
    });

    // Add new match
    newMatches[draggedLeft] = rightIndex;

    setMatches(newMatches);
    setDraggedLeft(null);
    setDragOverRight(null);

    // Convert to array of pairs for callback
    const matchPairs = Object.entries(newMatches).map(([left, right]) => ({
      left: leftItems[parseInt(left)],
      right: rightItems[right]
    }));
    onMatchChange(matchPairs, newMatches);
  };

  const handleDragEnd = () => {
    setDraggedLeft(null);
    setDragOverRight(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e, leftIndex) => {
    if (disabled) return;
    touchCurrentItem.current = leftIndex;
    setDraggedLeft(leftIndex);
  };

  const handleTouchMove = (e) => {
    if (touchCurrentItem.current === null) return;

    const touch = e.touches[0];
    const elements = document.querySelectorAll('[data-right-index]');

    let found = false;
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const index = parseInt(el.getAttribute('data-right-index'));
        setDragOverRight(index);
        found = true;
      }
    });
    if (!found) setDragOverRight(null);
  };

  const handleTouchEnd = () => {
    if (dragOverRight !== null && touchCurrentItem.current !== null) {
      const newMatches = { ...matches };
      Object.keys(newMatches).forEach(key => {
        if (newMatches[key] === dragOverRight) {
          delete newMatches[key];
        }
      });
      newMatches[touchCurrentItem.current] = dragOverRight;

      setMatches(newMatches);

      const matchPairs = Object.entries(newMatches).map(([left, right]) => ({
        left: leftItems[parseInt(left)],
        right: rightItems[right]
      }));
      onMatchChange(matchPairs, newMatches);
    }

    setDraggedLeft(null);
    setDragOverRight(null);
    touchCurrentItem.current = null;
  };

  const clearMatch = (leftIndex) => {
    if (disabled) return;
    const newMatches = { ...matches };
    delete newMatches[leftIndex];
    setMatches(newMatches);

    const matchPairs = Object.entries(newMatches).map(([left, right]) => ({
      left: leftItems[parseInt(left)],
      right: rightItems[right]
    }));
    onMatchChange(matchPairs, newMatches);
  };

  const getMatchedRightIndex = (leftIndex) => matches[leftIndex];
  const isRightMatched = (rightIndex) => Object.values(matches).includes(rightIndex);

  return (
    <div
      className="space-y-4"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left items (draggable) */}
      <div className="space-y-2">
        <p className="text-xs text-secondary-text font-medium mb-2">Drag to match:</p>
        {leftItems.map((item, index) => {
          const matchedTo = getMatchedRightIndex(index);
          const isMatched = matchedTo !== undefined;

          return (
            <div
              key={index}
              draggable={!disabled && !isMatched}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              className={`
                flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                ${!isMatched && !disabled ? 'cursor-grab active:cursor-grabbing' : ''}
                ${draggedLeft === index ? 'opacity-50 scale-95 border-violet bg-violet/20' : ''}
                ${isMatched ? 'border-mint/50 bg-mint/10' : 'border-white/20 bg-white/5'}
              `}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet/30 text-violet-light text-sm font-bold">
                {index + 1}
              </div>
              <span className="flex-1 font-medium text-primary-text text-sm">{item}</span>
              {isMatched && (
                <button
                  onClick={() => clearMatch(index)}
                  className="p-1 rounded-full bg-white/10 hover:bg-red-500/30 text-secondary-text hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {isMatched && (
                <span className="text-xs text-mint">→ {String.fromCharCode(65 + matchedTo)}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Right items (drop targets) */}
      <div className="space-y-2">
        <p className="text-xs text-secondary-text font-medium mb-2">Drop here:</p>
        {rightItems.map((item, index) => {
          const isMatched = isRightMatched(index);
          const matchedLeftIndex = Object.keys(matches).find(key => matches[key] === index);

          return (
            <div
              key={index}
              data-right-index={index}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`
                flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                ${dragOverRight === index ? 'border-mint bg-mint/20 scale-105' : ''}
                ${isMatched ? 'border-mint/50 bg-mint/10' : 'border-white/20 border-dashed bg-white/5'}
              `}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/30 text-amber-400 text-sm font-bold">
                {String.fromCharCode(65 + index)}
              </div>
              <span className="flex-1 font-medium text-primary-text text-sm">{item}</span>
              {isMatched && (
                <span className="text-xs text-mint">← {parseInt(matchedLeftIndex) + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DragDropMatch;
