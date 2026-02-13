import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function DragDropOrder({ items, onOrderChange, disabled = false }) {
  const [order, setOrder] = useState(items.map((_, i) => i));
  const [selectedIndex, setSelectedIndex] = useState(null);

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= order.length) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, item);
    setOrder(newOrder);
    setSelectedIndex(toIndex);
    onOrderChange(newOrder.map(i => items[i]));
  };

  const handleTap = (displayIndex) => {
    if (disabled) return;
    if (selectedIndex === null) {
      // Select this item
      setSelectedIndex(displayIndex);
    } else if (selectedIndex === displayIndex) {
      // Deselect
      setSelectedIndex(null);
    } else {
      // Move selected item to this position
      moveItem(selectedIndex, displayIndex);
      setSelectedIndex(null);
    }
  };

  return (
    <div className="space-y-1.5">
      {order.map((itemIndex, displayIndex) => {
        const isSelected = selectedIndex === displayIndex;
        return (
          <div
            key={itemIndex}
            className={`
              flex items-center gap-2 rounded-xl border-2 transition-all
              ${disabled ? 'opacity-60' : 'cursor-pointer'}
              ${isSelected
                ? 'border-violet bg-violet/20 shadow-glow-violet'
                : selectedIndex !== null
                  ? 'border-mint/40 bg-mint/5 hover:bg-mint/10'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              }
            `}
          >
            {/* Up/Down arrows */}
            <div className="flex flex-col shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(displayIndex, displayIndex - 1); setSelectedIndex(null); }}
                disabled={disabled || displayIndex === 0}
                className="p-1 text-secondary-text hover:text-primary-text disabled:opacity-20 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(displayIndex, displayIndex + 1); setSelectedIndex(null); }}
                disabled={disabled || displayIndex === order.length - 1}
                className="p-1 text-secondary-text hover:text-primary-text disabled:opacity-20 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Item content — tappable */}
            <div
              onClick={() => handleTap(displayIndex)}
              className="flex-1 py-3 pr-3 flex items-center gap-2"
            >
              <span className="flex-1 font-medium text-primary-text text-sm">{items[itemIndex]}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                isSelected ? 'bg-violet text-white' : 'bg-white/10 text-secondary-text'
              }`}>
                {displayIndex + 1}
              </span>
            </div>
          </div>
        );
      })}
      {selectedIndex !== null && (
        <p className="text-xs text-mint text-center mt-1">Tap where to place it</p>
      )}
    </div>
  );
}

export default DragDropOrder;
