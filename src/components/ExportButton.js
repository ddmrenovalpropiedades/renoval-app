// src/components/ExportButton.js
import React from 'react';
import { Download } from 'lucide-react';

export default function ExportButton({ onClick, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Exportar a Excel"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', background: '#fff',
        border: '1px solid #dadce0', borderRadius: 8,
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        color: '#3c4043', fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}>
      <Download size={14} color="#34a853" />
      Excel
    </button>
  );
}
