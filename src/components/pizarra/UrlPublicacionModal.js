
import React, { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';

export default function UrlPublicacionModal({ row, onSave, onClose }) {
  const [url, setUrl] = useState(row.url_publicacion || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(url.trim() || null);
    setSaving(false);
    onClose();
  };

  const isValidUrl = !url || /^https?:\/\//i.test(url.trim());

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>URL de publicación</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <p style={styles.prop}>{row.propiedad}</p>

        <label style={styles.label}>URL del portal inmobiliario</label>
        <textarea
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.portalinmobiliario.com/..."
          rows={3}
          style={styles.textarea}
          autoFocus
        />

        {!isValidUrl && (
          <div style={styles.warning}>La URL debe comenzar con http:// o https://</div>
        )}

        {url.trim() && isValidUrl && (
          <a href={url.trim()} target="_blank" rel="noopener noreferrer" style={styles.preview}>
            <ExternalLink size={14} style={{ marginRight: 6, flexShrink: 0 }} />
            <span style={styles.previewText}>{url.trim()}</span>
          </a>
        )}

        <div style={styles.actions}>
          <button
            onClick={handleSave}
            disabled={saving || !isValidUrl}
            style={{
              ...styles.saveBtn,
              ...((saving || !isValidUrl) ? { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' } : {}),
            }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 24, width: 440,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: 700, color: '#202124', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 4, display: 'flex' },
  prop: { fontSize: 13, color: '#5f6368', margin: '0 0 16px', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  textarea: {
    width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
  },
  warning: { fontSize: 12, color: '#ea4335', marginTop: 6 },
  preview: {
    display: 'flex', alignItems: 'center', marginTop: 10, padding: '8px 12px',
    background: '#e8f0fe', borderRadius: 8, fontSize: 12, color: '#1a73e8',
    textDecoration: 'none', overflow: 'hidden',
  },
  previewText: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  actions: { display: 'flex', gap: 8, marginTop: 20 },
  saveBtn: {
    flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8,
    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368',
  },
};
