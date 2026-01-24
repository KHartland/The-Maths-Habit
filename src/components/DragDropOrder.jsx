import { useState, useRef } from 'react';

export function DragDropOrder({ items, onOrderChange, disabled = false }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [order, setOrder] = useState(items.map((_, i) => i));
  const touchStartY = useRef(null);
  const touchCurrentItem = useRef(null);

  const handleDragStart = (e, index) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...order];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);

    setOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
    onOrderChange(newOrder.map(i => items[i]));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e, index) => {
    if (disabled) return;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentItem.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e) => {
    if (touchCurrentItem.current === null) return;

    const touch = e.touches[0];
    const elements = document.querySelectorAll('[data-drop-index]');

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const index = parseInt(el.getAttribute('data-drop-index'));
        if (index !== touchCurrentItem.current) {
          setDragOverIndex(index);
        }
      }
    });
  };

  const handleTouchEnd = () => {
    if (dragOverIndex !== null && touchCurrentItem.current !== null && dragOverIndex !== touchCurrentItem.current) {
      const newOrder = [...order];
      const [draggedItem] = newOrder.splice(touchCurrentItem.current, 1);
      newOrder.splice(dragOverIndex, 0, draggedItem);

      setOrder(newOrder);
      onOrderChange(newOrder.map(i => items[i]));
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    touchStartY.current = null;
    touchCurrentItem.current = null;
  };

  return (
    <div
      className="space-y-2"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {order.map((itemIndex, displayIndex) => (
        <div
          key={itemIndex}
          data-drop-index={displayIndex}
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, displayIndex)}
          onDragOver={(e) => handleDragOver(e, displayIndex)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, displayIndex)}
          onDragEnd={handleDragEnd}
          onTouchStart={(e) => handleTouchStart(e, displayIndex)}
          className={`
            flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            ${draggedIndex === displayIndex ? 'opacity-50 scale-95 border-violet bg-violet/20' : ''}
            ${dragOverIndex === displayIndex && draggedIndex !== displayIndex ? 'border-mint bg-mint/20 scale-105' : 'border-white/20 bg-white/5'}
          `}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-secondary-text">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <span className="flex-1 font-medium text-primary-text">{items[itemIndex]}</span>
          <span className="text-sm text-secondary-text">#{displayIndex + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default DragDropOrder;
