import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';

// ── Límites del plan gratuito ─────────────────────────────────
const LIMITS = {
  // Supabase
  sb_database_mb:   { label: 'Base de datos',    max: 500,  unit: 'MB',  color: '#1a73e8', service: 'Supabase' },
  sb_storage_gb:    { label: 'Almacenamiento',    max: 1,    unit: 'GB',  color: '#1a73e8', service: 'Supabase' },
  // Vercel
  vc_bandwidth_gb:  { label: 'Bandwidth',         max: 100,  unit: 'GB',  color: '#000',    service: 'Vercel'   },
  vc_functions_m:   { label: 'Invocaciones',       max: 1,    unit: 'M',   color: '#000',    service: 'Vercel'   },
  vc_cpu_hrs:       { label: 'CPU activo',         max: 4,    unit: 'hrs', color: '#000',    service: 'Vercel'   },
  vc_blob_gb:       { label: 'Blob storage',       max: 1,    unit: 'GB',  color: '#000',    service: 'Vercel'   },
  vc_blob_tx_gb:    { label: 'Blob transferencia', max: 10,   unit: 'GB',  color: '#000',    service: 'Vercel'   },
};

const LINKS = [
  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard/project/yyxsurlhzvazwgmerglc', service: 'Supabase' },
  { label: 'Supabase Usage',     url: 'https://supabase.com/dashboard/project/yyxsurlhzvazwgmerglc/settings/billing', service: 'Supabase' },
  { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard', service: 'Vercel' },
  { label: 'Vercel Usage',       url: 'https://vercel.com/account/usage', service: 'Vercel' },
];

// ── Barra de progreso ─────────────────────────────────────────
function UsageBar({ metricKey, value, onEdit }) {
  const cfg = LIMITS[metricKey];
  const pct = value != null ? Math.min(100, (value / cfg.max) * 100) : 0;
  const hasValue = value != null && value !== '';
  const barColor = pct >= 90 ? '#ea4335' : pct >= 70 ? '#f57c00' : '#34a853';

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#202124' }}>{cfg.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasValue && (
            <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
              {value} / {cfg.max} {cfg.unit}
            </span>
          )}
          <button onClick={() => onEdit(metricKey, value)}
            style={{ fontSize: 11, color: '#1a73e8', background: 'none', border: '1px solid #dadce0', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {hasValue ? 'Editar' : 'Ingresar'}
          </button>
        </div>
      </div>
      <div style={{ background: '#f1f3f4', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        {hasValue && (
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 6, transition: 'width 0.3s' }} />
        )}
      </div>
      {!hasValue && <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 3 }}>Sin datos — haz clic en "Ingresar" para registrar</div>}
    </div>
  );
}

// ── Historial ─────────────────────────────────────────────────
function HistoryTable({ records, onDelete }) {
  if (!records.length) return <div style={{ fontSize: 13, color: '#9aa0a6', padding: '8px 0' }}>Sin registros históricos.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e8eaed' }}>
            <th style={th}>Fecha</th>
            {Object.keys(LIMITS).map(k => <th key={k} style={th}>{LIMITS[k].label}<br /><span style={{ fontWeight: 400, color: '#9aa0a6' }}>{LIMITS[k].unit}</span></th>)}
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
              <td style={td}>{fmtDate(r.recorded_at)}</td>
              {Object.keys(LIMITS).map(k => {
                const v = r[k];
                const cfg = LIMITS[k];
                const pct = v != null ? (v / cfg.max) * 100 : null;
                const c = pct == null ? '#9aa0a6' : pct >= 90 ? '#ea4335' : pct >= 70 ? '#f57c00' : '#202124';
                return <td key={k} style={{ ...td, color: c, fontWeight: pct >= 70 ? 700 : 400 }}>{v != null ? v : '—'}</td>;
              })}
              <td style={td}>
                <button onClick={() => onDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 2 }}><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', fontSize: 10 };
const td = { padding: '6px 10px', textAlign: 'right', color: '#202124' };
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }); };

// ── Modal edición ─────────────────────────────────────────────
function EditModal({ metricKey, currentValue, onSave, onClose }) {
  const cfg = LIMITS[metricKey];
  const [val, setVal] = useState(currentValue != null ? String(currentValue) : '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#202124', marginBottom: 4 }}>{cfg.label}</div>
        <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 16 }}>Límite: {cfg.max} {cfg.unit} · Servicio: {cfg.service}</div>
        <input autoFocus type="number" step="any" min="0" value={val} onChange={e => setVal(e.target.value)}
          style={{ width: '100%', border: '1px solid #dadce0', borderRadius: 7, padding: '8px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          placeholder={`Valor en ${cfg.unit}`}
          onKeyDown={e => e.key === 'Enter' && onSave(metricKey, val)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => onSave(metricKey, val)} style={{ padding: '7px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function InfraPage() {
  const [records, setRecords] = useState([]);
  const [current, setCurrent] = useState({});
  const [editing, setEditing] = useState(null); // { key, value }
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('infra_metrics')
      .select('*')
      .order('recorded_at', { ascending: false });
    setRecords(data || []);
    if (data && data.length > 0) {
      // El más reciente es el current
      const latest = data[0];
      const c = {};
      Object.keys(LIMITS).forEach(k => { if (latest[k] != null) c[k] = latest[k]; });
      setCurrent(c);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (key, value) => setEditing({ key, value });

  const handleSave = async (key, rawVal) => {
    const val = rawVal === '' ? null : parseFloat(rawVal);
    const updated = { ...current, [key]: val };
    setCurrent(updated);
    setEditing(null);
    setSaving(true);
    // Guardar como nuevo registro con fecha hoy
    const today = new Date().toISOString().split('T')[0];
    // Buscar si ya hay registro de hoy
    const { data: existing } = await supabase
      .from('infra_metrics')
      .select('id')
      .gte('recorded_at', today + 'T00:00:00')
      .lte('recorded_at', today + 'T23:59:59')
      .maybeSingle();

    if (existing) {
      await supabase.from('infra_metrics').update({ [key]: val }).eq('id', existing.id);
    } else {
      const row = { recorded_at: new Date().toISOString() };
      Object.keys(LIMITS).forEach(k => { row[k] = k === key ? val : (current[k] ?? null); });
      await supabase.from('infra_metrics').insert(row);
    }
    await load();
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await supabase.from('infra_metrics').delete().eq('id', id);
    await load();
  };

  const sbMetrics = Object.keys(LIMITS).filter(k => LIMITS[k].service === 'Supabase');
  const vcMetrics = Object.keys(LIMITS).filter(k => LIMITS[k].service === 'Vercel');

  const ServiceCard = ({ title, color, metricKeys, linkService }) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaed', padding: '20px 24px', flex: 1, minWidth: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#202124', letterSpacing: 0.2 }}>{title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {LINKS.filter(l => l.service === linkService).map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: color, textDecoration: 'none', border: `1px solid ${color}33`, borderRadius: 6, padding: '3px 9px', fontFamily: 'inherit' }}>
              <ExternalLink size={10} /> {l.label.replace(`${linkService} `, '')}
            </a>
          ))}
        </div>
      </div>
      {metricKeys.map(k => (
        <UsageBar key={k} metricKey={k} value={current[k] ?? null} onEdit={handleEdit} />
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>Infraestructura</h1>
          <p style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>Monitoreo de uso — Supabase &amp; Vercel (plan gratuito)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 12, color: '#9aa0a6' }}>Guardando...</span>}
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#3c4043', fontFamily: 'inherit' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <ServiceCard title="Supabase" color="#1a73e8" metricKeys={sbMetrics} linkService="Supabase" />
        <ServiceCard title="Vercel" color="#000" metricKeys={vcMetrics} linkService="Vercel" />
      </div>

      {/* Nota */}
      <div style={{ background: '#fffde7', border: '1px solid #f9a825', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#795548', marginBottom: 20 }}>
        <strong>Nota:</strong> Los valores se ingresan manualmente desde los dashboards de cada servicio. Se guarda un registro por día — si ingresas varios valores el mismo día, se actualiza el registro de ese día.
      </div>

      {/* Historial */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaed', padding: '16px 20px' }}>
        <button onClick={() => setShowHistory(h => !h)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#202124', fontFamily: 'inherit', padding: 0, marginBottom: showHistory ? 16 : 0 }}>
          Historial de registros
          <span style={{ fontSize: 12, color: '#9aa0a6', fontWeight: 400 }}>({records.length} entradas)</span>
        </button>
        {showHistory && <HistoryTable records={records} onDelete={handleDelete} />}
      </div>

      {editing && (
        <EditModal metricKey={editing.key} currentValue={editing.value} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
