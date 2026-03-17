import React from 'react';

interface TooltipProps {
  x: number;
  y: number;
  visible: boolean;
  content: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ x, y, visible, content }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 12,
        top: y - 8,
        zIndex: 9999,
        pointerEvents: 'none',
        maxWidth: 280,
      }}
      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white shadow-2xl"
    >
      {content}
    </div>
  );
};

export default Tooltip;
