import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// Normalize string: lowercase, remove accents
const normalize = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Transform full cartera address to short format
// "ALONSO DE CAMARGO 8916 Departamento 91, Las Condes..." -> "ALONSO DE CAMARGO 8916 D91"
const transformAddress = (full) => {
  const short = full.split(',')[0].trim();
  return short
    .replace(/\bDepartamento\s+/gi, 'D')
    .replace(/\bCasa\s+/gi, 'C');
};

// raw: si es true, no transforma la nomenclatura y usa la dirección
// exactamente como está registrada en la tabla properties (Cartera)
export default function PropertyAutocomplete({ value, onChange, placeholder = 'Dirección *', hasError = false, inputStyle = {}, raw = false }) {
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  // Load all properties once
  useEffect(() => {
    const load = async () => {
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('properties').select('propiedad').range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = [...all, ...data.map(p => p.propiedad)];
        if (data.length < 1000) break;
        from += 1000;
      }
      setProperties(all);
    };
    load();
  }, []);

  // Filter suggestions: every word must appear somewhere in the address
  const suggestions = useMemo(() => {
    if (!value || value.trim().length < 2) return [];
    const words = normalize(value.trim()).split(/\s+/).filter(Boolean);
    return properties
      .filter(p => {
        const norm = normalize(p);
        return words.every(w => norm.includes(w));
      })
      .slice(0, 8);
  }, [value, properties]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (prop) => {
    onChange(raw ? prop : transformAddress(prop));
    setOpen(false);
  };

  const showDropdown = open && focused && suggestions.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        style={{
          border: hasError ? '1px solid #ea4335' : '1px solid #dadce0',
          borderRadius: 6,
          padding: '4px 6px',
          fontSize: 12,
          outline: 'none',
          fontFamily: 'inherit',
          width: '100%',
          ...inputStyle,
        }}
      />
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #dadce0',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 999,
          marginTop: 2,
          overflow: 'hidden',
        }}>
          {suggestions.map((prop, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(prop)}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f3f4' : 'none',
                color: '#202124',
                lineHeight: 1.4,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {raw ? (
                <div style={{ fontWeight: 600 }}>{prop}</div>
              ) : (
                <>
                  <div style={{ fontWeight: 600 }}>{transformAddress(prop)}</div>
                  <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 1 }}>{prop}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
