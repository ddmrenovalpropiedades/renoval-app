import React, { useState } from 'react';

export default function AnimatedCheckbox({ onClick, size = 20, color = '#1a73e8', urgent = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const activeColor = urgent ? '#ea4335' : color;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        border: `2px solid ${hovered ? activeColor : urgent ? '#ea433566' : '#dadce0'}`,
        background: pressed ? activeColor : hovered ? `${activeColor}22` : 'none',
        cursor: 'pointer', flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
        transform: pressed ? 'scale(0.9)' : 'scale(1)',
      }}
      title="Completar"
    >
      {hovered && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 12 12">
          <polyline
            points="1.5,6 4.5,9 10.5,3"
            fill="none"
            stroke={pressed ? '#fff' : activeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
