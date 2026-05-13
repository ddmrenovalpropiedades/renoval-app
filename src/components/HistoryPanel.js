import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const CATEGORY_COLORS = {
  'Entrada': '#1565C0', 'Salida': '#2E7D32', 'Equipo': '#6A1B9A',
  'Solicitudes': '#E65100', 'Misceláneo': '#37474F',
};

export default function HistoryPanel({ onClose, ownerEmail }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchHistory(); }, [ownerEmail]); // eslint-disable-line

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks_history')
      .select('*')
      .eq('owner_email', ownerEmail)
      .order('completed_at', { ascending: false })
      .limit(100);
    setHistory(data || []);
    setLoading(false);
  };

  const categories = ['all', 'Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];
  const filtered = filter === 'all' ? history : history.filter(h => h.category === filter);

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>Historial</h2>
          <div style={styles.headerRight}>
            <button onClick={fetchHistory} style={styles.iconBtn} title="Actualizar">
              <RefreshCw size={15} color="#5f6368" />
            </button>
            <button onClick={onClose} style={styles.iconBtn}>
              <X size={18} color="#5f6368" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={styles.filters}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                ...styles.filterBtn,
                ...(filter === cat ? {
                  background: cat === 'all' ? '#e8f0fe' : `${CATEGORY_COLORS[cat]}22`,
                  color: cat === 'all' ? '#1a73e8' : CATEGORY_COLORS[cat],
                  borderColor: cat === 'all' ? '#1a73e8' : CATEGORY_COLORS[cat],
                  fontWeight: 600,
                } : {}),
              }}
            >
              {cat === 'all' ? 'Todas' : cat}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>No hay tareas completadas aún.</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} style={styles.item}>
                <div style={{ ...styles.categoryDot, background: CATEGORY_COLORS[item.category] || '#9aa0a6' }} />
                <div style={styles.itemContent}>
                  <span style={styles.itemTitle}>{item.title}</span>
                  {item.notes && <span style={styles.itemNotes}>{item.notes}</span>}
                </div>
                <div style={styles.itemMeta}>
                  <span style={styles.itemCategory}>{item.category}</span>
                  <span style={styles.itemDate}>
                    {new Date(item.completed_at).toLocaleDateString('es-CL', {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 900 },
  panel: { width: 420, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 700, color: '#202124', margin: 0 },
  headerRight: { display: 'flex', gap: 4 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' },
  filters: { display: 'flex', gap: 6, padding: '12px 16px', flexWrap: 'wrap', borderBottom: '1px solid #f1f3f4', flexShrink: 0 },
  filterBtn: { padding: '4px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  list: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  empty: { padding: 32, color: '#9aa0a6', fontSize: 14, textAlign: 'center' },
  item: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: '1px solid #f8f9fa' },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5 },
  itemContent: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 14, color: '#202124', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemNotes: { fontSize: 12, color: '#9aa0a6', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  itemCategory: { fontSize: 10, fontWeight: 600, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemDate: { fontSize: 11, color: '#9aa0a6' },
};
