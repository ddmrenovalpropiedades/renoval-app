import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { X } from 'lucide-react';

const HORA_INICIO = 8;
const HORA_FIN    = 23; // exclusivo (último slot empieza a las 22:30)
const DIAS_HORIZONTE = 10;

// Genera los slots de 30 min entre HORA_INICIO y HORA_FIN
const SLOTS = (() => {
  const arr = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    arr.push(`${String(h).padStart(2, '0')}:00`);
    arr.push(`${String(h).padStart(2, '0')}:30`);
  }
  return arr;
})();

// Genera las fechas del horizonte (YYYY-MM-DD)
function getFechas() {
  const out = [];
  const today = new Date();
  for (let i = 0; i < DIAS_HORIZONTE; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push({ iso: `${y}-${m}-${day}`, date: d });
  }
  return out;
}

const DIA_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function DisponibilidadSidebar({ row, currentUser, onClose }) {
  const [slotsActivos, setSlotsActivos] = useState(new Set()); // keys "fecha|hora"
  const [loading, setLoading] = useState(true);
  const fechas = useMemo(() => getFechas(), []);

  const puedeEditar = currentUser?.isOwner === true || currentUser?.iniciales === row.e2;

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wa_disponibilidad_slots')
      .select('fecha, hora_inicio')
      .eq('propiedad_id', row.id);

    const set = new Set((data || []).map(s => `${s.fecha}|${s.hora_inicio.slice(0, 5)}`));
    setSlotsActivos(set);
    setLoading(false);
  }, [row.id]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const toggleSlot = async (fechaIso, hora) => {
    if (!puedeEditar) return;
    const key = `${fechaIso}|${hora}`;
    const active = slotsActivos.has(key);

    // Optimistic update
    setSlotsActivos(prev => {
      const next = new Set(prev);
      if (active) next.delete(key); else next.add(key);
      return next;
    });

    if (active) {
      await supabase
        .from('wa_disponibilidad_slots')
        .delete()
        .eq('propiedad_id', row.id)
        .eq('fecha', fechaIso)
        .eq('hora_inicio', hora);
    } else {
      await supabase
        .from('wa_disponibilidad_slots')
        .insert({
          propiedad_id: row.id,
          agent_id: currentUser?.id || null,
          fecha: fechaIso,
          hora_inicio: hora,
        });
    }
  };

  // Calcula bloques agrupados (slots contiguos) para mostrar resumen
  const bloquesResumen = useMemo(() => {
    const porFecha = {};
    fechas.forEach(f => { porFecha[f.iso] = []; });

    slotsActivos.forEach(key => {
      const [fecha, hora] = key.split('|');
      if (porFecha[fecha]) porFecha[fecha].push(hora);
    });

    const resumen = [];
    Object.entries(porFecha).forEach(([fecha, horas]) => {
      if (horas.length === 0) return;
      const sorted = [...horas].sort();
      let inicio = sorted[0];
      let prev = sorted[0];

      const toMinutes = (h) => {
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
      };
      const toLabel = (mins) => {
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i];
        const isContiguo = curr && (toMinutes(curr) - toMinutes(prev) === 30);
        if (!isContiguo) {
          const finMins = toMinutes(prev) + 30;
          resumen.push({ fecha, inicio, fin: toLabel(finMins) });
          inicio = curr;
        }
        prev = curr;
      }
    });
    return resumen;
  }, [slotsActivos, fechas]);

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Disponibilidad para visitas</h3>
            <p style={styles.prop}>{row.propiedad}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        {!puedeEditar && (
          <div style={styles.readonlyNote}>
            Solo la encargada ({row.e2 || '—'}) o un administrador pueden editar esta disponibilidad.
          </div>
        )}

        {loading ? (
          <div style={styles.loading}>Cargando disponibilidad...</div>
        ) : (
          <>
            {/* Grid */}
            <div style={styles.gridWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thHora}></th>
                    {fechas.map(f => (
                      <th key={f.iso} style={styles.thDia}>
                        <div style={styles.diaLabel}>{DIA_LABELS[f.date.getDay()]}</div>
                        <div style={styles.fechaLabel}>{f.date.getDate()}/{f.date.getMonth() + 1}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(hora => (
                    <tr key={hora}>
                      <td style={styles.tdHora}>{hora}</td>
                      {fechas.map(f => {
                        const key = `${f.iso}|${hora}`;
                        const active = slotsActivos.has(key);
                        return (
                          <td key={key} style={styles.tdSlot}>
                            <div
                              onClick={() => toggleSlot(f.iso, hora)}
                              style={{
                                ...styles.cell,
                                background: active ? '#34a853' : '#f1f3f4',
                                cursor: puedeEditar ? 'pointer' : 'default',
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen de bloques */}
            <div style={styles.resumenBox}>
              <div style={styles.resumenTitle}>
                Bloques disponibles ({bloquesResumen.length})
              </div>
              {bloquesResumen.length === 0 ? (
                <div style={styles.resumenEmpty}>Sin bloques marcados</div>
              ) : (
                <div style={styles.resumenList}>
                  {bloquesResumen.map((b, i) => {
                    const [y, m, d] = b.fecha.split('-');
                    return (
                      <div key={i} style={styles.resumenItem}>
                        {d}/{m} · {b.inicio} - {b.fin}
                      </div>
                    );
                  })}
                </div>
              )}
              {bloquesResumen.length > 3 && (
                <div style={styles.resumenWarning}>
                  Se mostrarán solo los 3 bloques más próximos a la fecha de consulta.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 3000,
  },
  sidebar: {
    background: '#fff', width: 720, maxWidth: '95vw', height: '100%',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif", overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px', borderBottom: '1px solid #e8eaed',
  },
  title: { fontSize: 17, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  prop: { fontSize: 13, color: '#5f6368', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 4, display: 'flex' },
  readonlyNote: {
    margin: '12px 24px 0', padding: '10px 14px', background: '#fef7e0', color: '#5f6368',
    borderRadius: 8, fontSize: 12,
  },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6' },
  gridWrapper: { flex: 1, overflow: 'auto', padding: '16px 24px' },
  table: { borderCollapse: 'collapse', width: '100%' },
  thHora: { width: 50, position: 'sticky', left: 0, background: '#fff', zIndex: 2 },
  thDia: {
    fontSize: 11, fontWeight: 600, color: '#5f6368', padding: '4px 2px',
    borderBottom: '1px solid #e8eaed', minWidth: 48,
  },
  diaLabel: { textTransform: 'uppercase' },
  fechaLabel: { fontWeight: 700, color: '#202124', fontSize: 12 },
  tdHora: {
    fontSize: 11, color: '#9aa0a6', textAlign: 'right', paddingRight: 8,
    position: 'sticky', left: 0, background: '#fff', whiteSpace: 'nowrap',
  },
  tdSlot: { padding: 1, textAlign: 'center' },
  cell: {
    width: 30, height: 16, borderRadius: 3, margin: '0 auto',
    transition: 'background 0.1s',
  },
  resumenBox: {
    borderTop: '1px solid #e8eaed', padding: '16px 24px', background: '#f8f9fa',
  },
  resumenTitle: { fontSize: 13, fontWeight: 700, color: '#202124', marginBottom: 8 },
  resumenEmpty: { fontSize: 12, color: '#9aa0a6' },
  resumenList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  resumenItem: {
    fontSize: 12, color: '#1a73e8', background: '#e8f0fe', borderRadius: 16,
    padding: '4px 12px', fontWeight: 600,
  },
  resumenWarning: { fontSize: 11, color: '#ea4335', marginTop: 8 },
};
