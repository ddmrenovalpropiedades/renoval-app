import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, X, FileText, Trash2, BarChart2, ChevronLeft, ChevronRight, Search, Download, Paperclip, Image as ImageIcon } from 'lucide-react';
import PropertyAutocomplete from '../components/PropertyAutocomplete';
import { useExcelExport } from '../hooks/useExcelExport';
import FichaSidebar, { FichaCellWrap } from '../components/FichaSidebar';

const normalize = (str) =>
  String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// La celda de propiedad de esta página se guarda con la misma dirección
// abreviada que usa PropertyAutocomplete (transformAddress internamente),
// distinta al nombre completo que vive en Cartera. Se duplica la función acá
// (igual patrón que en Pizarra Arriendo/Venta) solo para poder armar el mapa
// inverso necesario para la Ficha.
const transformAddress = (full) => {
  const short = full.split(',')[0].trim();
  return short.replace(/\bDepartamento\s+/gi, 'D').replace(/\bCasa\s+/gi, 'C');
};

// ── Adjuntos de Notas (JPG/PDF por pago) ────────────────────────
// Mismo bucket que usa la Ficha de propiedad; tabla distinta (pago_files)
// porque acá el adjunto pertenece a un pago puntual, no a la propiedad.
const FILES_BUCKET = 'ficha-adjuntos';
const FILE_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'application/pdf'];
const FILE_ACCEPTED_EXT = /\.(jpe?g|pdf)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const genFileId = () => (
  typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Descarga forzada vía blob — un <a download> normal no funciona confiable
// para URLs de otro origen (como las de Supabase Storage).
async function forceDownload(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error('Error al descargar, se abre en pestaña nueva:', e);
    window.open(url, '_blank');
  }
}

const PAGADO_POR_OPTIONS = ['DD', 'FD'];
const ESTADO_OPTIONS = ['P', 'D', 'PG'];
const TIPO_OPTIONS = ['T', 'C', 'A'];
const PAGE_SIZE = 100;

const formatCLP = (n) => {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^0-9.-]/g, '')) : n;
  if (isNaN(num)) return '';
  return '$' + Math.round(num).toLocaleString('es-CL');
};

const parseCLP = (str) => {
  if (!str && str !== 0) return null;
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
};

const antiguedad = (fechaStr) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr + 'T12:00:00');
  const diff = (new Date() - fecha) / (1000 * 60 * 60 * 24);
  return diff > 90 ? '+ 3 meses' : '- 3 meses';
};

const today = () => new Date().toISOString().split('T')[0];

// La columna CAJA es calculada, no editable a mano: vale "FUERA" cuando el
// pago está en estado "D" (descontado) y su fecha de caja todavía no llegó
// (es posterior a hoy). En cualquier otro caso queda vacía. Se recalcula en
// cada render con la fecha de hoy, así nunca queda desactualizada (a
// diferencia de guardar el texto "FUERA" a mano, que dejaba de ser válido
// apenas pasaba la fecha y nadie lo actualizaba).
const isCajaFuera = (pago) => pago?.estado === 'D' && !!pago?.fecha_caja && pago.fecha_caja > today();

const ESTADO_COLORS = {
  P:  { bg: '#fce8e6', color: '#c62828' },
  D:  { bg: '#e6f4ea', color: '#2e7d32' },
  PG: { bg: '#fff3e0', color: '#f57c00' },
};

// ── MoneyInput ─────────────────────────────────────────────────
// - Doble clic para entrar en modo edición (permite copiar con clic simple)
// - Ancho fijo del input para no expandir la columna
function MoneyInput({ value, onChange, style = {}, alwaysVisible = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = () => {
    const n = parseCLP(value);
    setRaw(n != null ? String(Math.round(n)) : '');
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const n = parseCLP(raw);
    onChange(n != null ? n : null);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 6px', background: '#fff', width: 110, boxSizing: 'border-box', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#9aa0a6', marginRight: 2 }}>$</span>
        <input
          autoFocus
          value={raw ? parseInt(raw || '0').toLocaleString('es-CL') : ''}
          onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, fontFamily: 'inherit' }}
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={start}
      title="Doble clic para editar"
      style={{
        cursor: 'text', fontSize: 12, padding: '2px 6px', borderRadius: 6,
        width: 110, boxSizing: 'border-box', flexShrink: 0,
        border: alwaysVisible ? '1px solid #dadce0' : 'none',
        background: alwaysVisible ? '#fff' : 'transparent',
        userSelect: 'text',
        ...style,
      }}
    >
      {value != null && value !== ''
        ? formatCLP(value)
        : <span style={{ color: alwaysVisible ? '#9aa0a6' : '#dadce0' }}>{alwaysVisible ? '$—' : '—'}</span>
      }
    </div>
  );
}

function InlineText({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) return (
    <input autoFocus value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => { setEditing(false); if (raw !== value) onChange(raw); }}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      style={{ border: '1px solid #1a73e8', borderRadius: 5, padding: '3px 5px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }} />
  );
  return (
    <div onClick={() => { setRaw(value || ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, padding: '2px 2px', minHeight: 20 }}>
      {value || <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

function InlineSelect({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', width: '100%' }}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function DatePicker({ value, onChange, style = {} }) {
  const ref = React.useRef(null);
  const fmt = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const handleClick = () => {
    if (ref.current) {
      try { ref.current.showPicker(); } catch(e) { ref.current.click(); }
    }
  };
  return (
    <div onClick={handleClick} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', ...style }}>
      <span style={{ fontSize: 11, fontFamily: 'inherit', color: value ? 'inherit' : '#9aa0a6', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {value ? fmt(value) : 'dd/mm/aaaa'}
      </span>
      <input ref={ref} type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, border: 'none', padding: 0, margin: 0 }} />
    </div>
  );
}

function NotesPanel({ pago, onClose, onSave }) {
  const { profile } = useAuth();
  const [text, setText] = useState(pago.notas || '');

  // Archivos adjuntos del pago
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    const { data } = await supabase.from('pago_files').select('*').eq('pago_id', String(pago.id)).order('created_at', { ascending: false });
    setFiles(data || []);
    setLoadingFiles(false);
  }, [pago.id]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    const channel = supabase
      .channel('pago_files_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pago_files' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.pago_id !== String(pago.id)) return;
        if (payload.eventType === 'INSERT') {
          setFiles(prev => prev.some(f => f.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setFiles(prev => prev.filter(f => f.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [pago.id]);

  const handleSave = () => { onSave(pago.id, text); onClose(); };

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validType = FILE_ACCEPTED_TYPES.includes(file.type) || FILE_ACCEPTED_EXT.test(file.name);
    if (!validType) { alert('Solo se permiten archivos JPG o PDF.'); return; }
    if (file.size > MAX_FILE_SIZE) { alert('El archivo no puede superar los 10 MB.'); return; }
    setUploadingFile(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const path = `${genFileId()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);
      const payload = {
        pago_id: String(pago.id),
        archivo_url: urlData.publicUrl,
        archivo_path: path,
        archivo_nombre: file.name,
        archivo_tipo: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        archivo_size: file.size,
        autor_email: profile?.email || null,
        autor_iniciales: profile?.iniciales || null,
      };
      const { data, error } = await supabase.from('pago_files').insert(payload).select().single();
      if (error) throw error;
      if (data) setFiles(prev => prev.some(f => f.id === data.id) ? prev : [data, ...prev]);
    } catch (e) {
      console.error('Error subiendo archivo:', e);
      alert('No se pudo subir el archivo: ' + e.message);
    }
    setUploadingFile(false);
  };

  const handleDeleteFile = async (id) => {
    const file = files.find(f => f.id === id);
    await supabase.from('pago_files').delete().eq('id', id);
    if (file?.archivo_path) supabase.storage.from(FILES_BUCKET).remove([file.archivo_path]).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== id));
    setConfirmDeleteFileId(null);
  };

  return (
    <div style={panelStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.prop}>{pago.propiedad}</div>
            <div style={panelStyles.desc}>{pago.descripcion}</div>
          </div>
          <button onClick={onClose} style={panelStyles.closeBtn}><X size={18} /></button>
        </div>

        <div style={panelStyles.body}>
          <label style={panelStyles.label}>Notas</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Ingresa notas sobre este pago..."
            style={panelStyles.textarea} autoFocus />
        </div>

        <div style={panelStyles.filesSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
            <label style={panelStyles.label}>Archivos</label>
            <button onClick={handleFileButtonClick} disabled={uploadingFile} style={panelStyles.uploadBtn}>
              <Paperclip size={12} /> {uploadingFile ? 'Subiendo...' : 'Subir'}
            </button>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,application/pdf,image/jpeg" style={{ display: 'none' }} onChange={handleFileInputChange} />
          </div>
          <div style={panelStyles.filesList}>
            {loadingFiles ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 10 }}>Cargando...</div>
            ) : files.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 10, fontStyle: 'italic' }}>Sin archivos cargados.</div>
            ) : files.map(file => (
              <div key={file.id} style={panelStyles.fileItem}>
                {file.archivo_tipo?.startsWith('image') ? <ImageIcon size={14} color="#5f6368" style={{ flexShrink: 0 }} /> : <FileText size={14} color="#5f6368" style={{ flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.archivo_nombre}>{file.archivo_nombre}</div>
                  <div style={{ fontSize: 10, color: '#9aa0a6' }}>{formatFileSize(file.archivo_size)}{file.autor_iniciales ? ` · ${file.autor_iniciales}` : ''}</div>
                </div>
                <button onClick={() => forceDownload(file.archivo_url, file.archivo_nombre)} title="Descargar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#1a73e8', display: 'flex', flexShrink: 0 }}><Download size={13} /></button>
                {confirmDeleteFileId === file.id ? (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => handleDeleteFile(file.id)} style={{ background: '#fce8e6', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '4px 5px', color: '#ea4335', display: 'flex' }} title="Confirmar eliminar"><Trash2 size={12} /></button>
                    <button onClick={() => setConfirmDeleteFileId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', color: '#5f6368', display: 'flex' }} title="Cancelar"><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteFileId(file.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9aa0a6', display: 'flex', flexShrink: 0 }}><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyles.footer}>
          <button onClick={handleSave} style={panelStyles.saveBtn}>Guardar</button>
          <button onClick={onClose} style={panelStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const panelStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 3000 },
  panel: { background: '#fff', width: 380, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { padding: '20px 20px 16px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  prop: { fontSize: 15, fontWeight: 700, color: '#202124', marginBottom: 4 },
  desc: { fontSize: 12, color: '#5f6368' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368', borderRadius: 6 },
  body: { flexShrink: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368' },
  textarea: { minHeight: 130, border: '1px solid #dadce0', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' },
  filesSection: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 20px 0', borderTop: '1px solid #e8eaed' },
  filesList: { flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10 },
  fileItem: { display: 'flex', alignItems: 'center', gap: 8, background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: '7px 9px', flexShrink: 0 },
  uploadBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #dadce0', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5f6368', cursor: 'pointer', fontFamily: 'inherit' },
  footer: { padding: '12px 20px', borderTop: '1px solid #e8eaed', display: 'flex', gap: 8, flexShrink: 0 },
  saveBtn: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

function MetricsView({ onClose }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const fmt = formatCLP;

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      let all = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase.from('pagos').select('cxc, estado, fecha, pagado_por, fecha_caja').range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < batchSize) break;
        from += batchSize;
      }
      setPagos(all);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── TOTALES ──────────────────────────────────────────────────
  // Total fuera: P + PG + (D con caja "FUERA", es decir fecha_caja futura)
  const totalFuera = pagos
    .filter(p => p.estado === 'P' || p.estado === 'PG' || isCajaFuera(p))
    .reduce((s, p) => s + (p.cxc || 0), 0);
  const pendientesRenoval = pagos.filter(p => p.estado === 'P').reduce((s, p) => s + (p.cxc || 0), 0);
  const pendientesGarantia = pagos.filter(p => p.estado === 'PG').reduce((s, p) => s + (p.cxc || 0), 0);
  // Solo descontado: todas las CxC cuya columna CAJA vale "FUERA"
  const soloDescontado = pagos.filter(p => isCajaFuera(p)).reduce((s, p) => s + (p.cxc || 0), 0);

  // ── Resto de bloques (sin cambios por ahora) ────────────────────
  const noD = pagos.filter(p => p.estado !== 'D');
  const recientes = noD.filter(p => antiguedad(p.fecha) === '- 3 meses');
  const esAntigua = (p) => antiguedad(p.fecha) === '+ 3 meses';
  const cxcRecientes = recientes.reduce((s, p) => s + (p.cxc || 0), 0);
  const totalAntiguas = pagos
    .filter(p => esAntigua(p) && (p.estado === 'P' || p.estado === 'PG' || isCajaFuera(p)))
    .reduce((s, p) => s + (p.cxc || 0), 0);
  const pAntiguas = pagos.filter(p => p.estado === 'P' && esAntigua(p)).reduce((s, p) => s + (p.cxc || 0), 0);
  const pgAntiguas = pagos.filter(p => p.estado === 'PG' && esAntigua(p)).reduce((s, p) => s + (p.cxc || 0), 0);
  const dd = noD.filter(p => p.pagado_por === 'DD');
  const fd = noD.filter(p => p.pagado_por === 'FD');
  const nn = noD.filter(p => !p.pagado_por);
  const cxcDDAnt = dd.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcDDRec = dd.filter(p => antiguedad(p.fecha) === '- 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcFDAnt = fd.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcFDRec = fd.filter(p => antiguedad(p.fecha) === '- 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcNNAnt = nn.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);

  const MetricCard = ({ title, rows }) => (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#5f6368', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {rows.map(([label, value, highlight], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < rows.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
          <span style={{ fontSize: 13, color: '#3c4043' }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: highlight || '#202124' }}>{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#f8f9fa', borderRadius: 16, width: 640, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#202124' }}>Métricas de Pagos</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }}><X size={20} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 }}>Cargando métricas...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <MetricCard title="Totales" rows={[
              ['Total fuera', fmt(totalFuera), '#ea4335'],
              ['Pendientes Renoval (P)', fmt(pendientesRenoval)],
              ['Pendientes garantía (PG)', fmt(pendientesGarantia)],
              ['Solo descontado', fmt(soloDescontado)],
            ]} />
            <MetricCard title="Recientes" rows={[['CxC -3 meses', fmt(cxcRecientes)]]} />
            <MetricCard title="Antiguos" rows={[
              ['Total antiguas', fmt(totalAntiguas), '#ea4335'],
              ['P antiguas', fmt(pAntiguas)],
              ['PG antiguas', fmt(pgAntiguas)],
            ]} />
            <MetricCard title="DD" rows={[['CxC antiguas', fmt(cxcDDAnt)],['CxC recientes', fmt(cxcDDRec)]]} />
            <MetricCard title="FD" rows={[['CxC antiguas', fmt(cxcFDAnt)],['CxC recientes', fmt(cxcFDRec)]]} />
            {cxcNNAnt > 0 && <MetricCard title="N/N" rows={[['CxC antiguas', fmt(cxcNNAnt)]]} />}
          </div>
        )}
      </div>
    </div>
  );
}

function PagoRow({ pago, onUpdate, onDelete, onOpenNotes, fichaPropiedadResuelta, onOpenFicha }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const update = async (field, value) => {
    const updates = { [field]: value };
    await supabase.from('pagos').update(updates).eq('id', pago.id);
    onUpdate({ ...pago, ...updates });
  };

  const ant = antiguedad(pago.fecha);
  const estadoStyle = ESTADO_COLORS[pago.estado] || {};
  const hasNotes = !!(pago.notas && pago.notas.trim());
  const cajaFuera = isCajaFuera(pago);

  return (
    <tr style={{ background: hovered ? '#f8f9fa' : '#fff', transition: 'background 0.1s' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={s.td}>
        <FichaCellWrap propiedad={fichaPropiedadResuelta} onOpenFicha={onOpenFicha}>
          <InlineText value={pago.propiedad} onChange={v => update('propiedad', v.toUpperCase())} />
        </FichaCellWrap>
      </td>
      <td style={s.td}><InlineText value={pago.descripcion} onChange={v => update('descripcion', v.toUpperCase())} /></td>
      <td style={s.tdCenter}><MoneyInput value={pago.cxc} onChange={v => update('cxc', v)} /></td>
      <td style={s.tdCenter}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, background: estadoStyle.bg, color: estadoStyle.color, minWidth: 32 }}>
          <InlineSelect value={pago.estado} options={ESTADO_OPTIONS} onChange={v => update('estado', v)} />
        </div>
      </td>
      <td style={s.tdCenter}><DatePicker value={pago.fecha} onChange={v => update('fecha', v)} /></td>
      <td style={s.tdCenter}><InlineSelect value={pago.pagado_por} options={PAGADO_POR_OPTIONS} onChange={v => update('pagado_por', v)} /></td>
      <td style={s.tdCenter}><InlineSelect value={pago.tipo} options={TIPO_OPTIONS} onChange={v => update('tipo', v)} /></td>
      <td style={s.tdCenter}><MoneyInput value={pago.comision} onChange={v => update('comision', v)} /></td>
      <td style={s.tdCenter}><DatePicker value={pago.fecha_caja} onChange={v => update('fecha_caja', v)} /></td>
      <td style={{ ...s.tdCenter, fontSize: 11, fontWeight: 600, color: ant === '+ 3 meses' ? '#ea4335' : '#34a853', whiteSpace: 'nowrap' }}>{ant}</td>
      <td style={{ ...s.tdCenter, fontSize: 11, fontWeight: cajaFuera ? 700 : 400, color: cajaFuera ? '#c62828' : '#dadce0' }}
        title="Calculado automáticamente: 'FUERA' cuando el estado es D y la fecha de caja aún no llega">
        {cajaFuera ? 'FUERA' : '—'}
      </td>
      <td style={s.tdActions}>
        <button onClick={() => onOpenNotes(pago)} style={{ ...s.actionBtn, background: hasNotes ? '#e8f0fe' : 'none', color: hasNotes ? '#1a73e8' : '#9aa0a6' }} title="Notas"><FileText size={13} /></button>
        {confirmDelete ? (
          <>
            <button onClick={async () => { await supabase.from('pagos').delete().eq('id', pago.id); onDelete(pago.id); }} style={{ ...s.actionBtn, background: '#fce8e6', color: '#ea4335' }} title="Confirmar"><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar"><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ ...s.actionBtn, color: '#9aa0a6' }} title="Eliminar"><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

function NewPagoRow({ onSave, onCancel, maxPosition }) {
  const [form, setForm] = useState({ propiedad: '', descripcion: '', cxc: '', estado: 'P', orden: '', fecha: today(), pagado_por: '', tipo: '', comision: '', fecha_caja: '', notas: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.propiedad.trim()) return;
    const newPosition = (maxPosition || 0) + 1;
    const { data } = await supabase.from('pagos').insert({ propiedad: form.propiedad.trim(), descripcion: form.descripcion || null, cxc: parseCLP(form.cxc), estado: form.estado || null, orden: form.orden || null, fecha: form.fecha || today(), pagado_por: form.pagado_por || null, tipo: form.tipo || null, comision: parseCLP(form.comision), fecha_caja: form.fecha_caja || null, notas: form.notas || null, position: newPosition }).select().single();
    if (data) onSave(data);
  };
  const previewCajaFuera = isCajaFuera({ estado: form.estado, fecha_caja: form.fecha_caja });
  return (
    <tr style={{ background: '#f0f7ff' }}>
      <td style={s.td}><PropertyAutocomplete value={form.propiedad} onChange={v => set('propiedad', v.toUpperCase())} placeholder="Propiedad *" hasError={false} /></td>
      <td style={s.td}><input value={form.descripcion} onChange={e => set('descripcion', e.target.value.toUpperCase())} placeholder="Descripción" style={inputStyle} /></td>
      <td style={s.tdCenter}><MoneyInput value={form.cxc} onChange={v => set('cxc', v)} alwaysVisible /></td>
      <td style={s.tdCenter}><select value={form.estado} onChange={e => set('estado', e.target.value)} style={selectStyle}>{ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><DatePicker value={form.fecha} onChange={v => set('fecha', v)} style={{ border: '1px solid #dadce0', borderRadius: 5, padding: '3px 6px', background: '#fff' }} /></td>
      <td style={s.tdCenter}><select value={form.pagado_por} onChange={e => set('pagado_por', e.target.value)} style={selectStyle}><option value="">—</option>{PAGADO_POR_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={selectStyle}><option value="">—</option>{TIPO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><MoneyInput value={form.comision} onChange={v => set('comision', v)} alwaysVisible /></td>
      <td style={s.tdCenter}><DatePicker value={form.fecha_caja} onChange={v => set('fecha_caja', v)} style={{ border: '1px solid #dadce0', borderRadius: 5, padding: '3px 6px', background: '#fff' }} /></td>
      <td style={{ ...s.tdCenter, fontSize: 11, color: '#9aa0a6' }}>{form.fecha ? antiguedad(form.fecha) : '—'}</td>
      <td style={{ ...s.tdCenter, fontSize: 11, fontWeight: previewCajaFuera ? 700 : 400, color: previewCajaFuera ? '#c62828' : '#dadce0' }}>{previewCajaFuera ? 'FUERA' : '—'}</td>
      <td style={s.tdActions}>
        <button onClick={handleSave} style={{ ...s.actionBtn, background: '#e6f4ea', color: '#34a853' }} title="Guardar">✓</button>
        <button onClick={onCancel} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar"><X size={13} /></button>
      </td>
    </tr>
  );
}

const inputStyle = { border: '1px solid #dadce0', borderRadius: 5, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' };
const selectStyle = { border: '1px solid #dadce0', borderRadius: 5, padding: '3px 4px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff' };

function Pagination({ page, totalCount, pageSize, onPageChange }) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid #e8eaed', flexShrink: 0, background: '#fafafa' }}>
      <span style={{ fontSize: 12, color: '#5f6368' }}>{from}–{to} de {totalCount}</span>
      <button onClick={() => onPageChange(page - 1)} disabled={page === 0} style={{ ...paginationBtn, opacity: page === 0 ? 0.35 : 1 }}><ChevronLeft size={15} /></button>
      <span style={{ fontSize: 12, color: '#3c4043', minWidth: 60, textAlign: 'center' }}>Página {page + 1} de {totalPages}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} style={{ ...paginationBtn, opacity: page >= totalPages - 1 ? 0.35 : 1 }}><ChevronRight size={15} /></button>
    </div>
  );
}

const paginationBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid #dadce0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#5f6368', padding: 0 };

export default function PagosPage() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [notesFor, setNotesFor] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [filterPor, setFilterPor] = useState([]);
  const [filterEstado, setFilterEstado] = useState([]);
  const [filterAntiguedad, setFilterAntiguedad] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [carteraReverseMap, setCarteraReverseMap] = useState(new Map());
  const [fichaPropiedad, setFichaPropiedad] = useState(null);
  const { exportToExcel } = useExcelExport();

  // Mapa inverso: nomenclatura abreviada (la que guarda esta página, vía
  // PropertyAutocomplete) -> nombre canónico en Cartera. Ver misma nota en
  // Pizarra Arriendo/Venta.
  useEffect(() => {
    const loadCartera = async () => {
      let all = [], from = 0;
      while (true) {
        const { data, error } = await supabase.from('properties').select('propiedad').range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = [...all, ...data.map(p => p.propiedad)];
        if (data.length < 1000) break;
        from += 1000;
      }
      const map = new Map();
      all.forEach(p => map.set(transformAddress(p), p));
      setCarteraReverseMap(map);
    };
    loadCartera();
  }, []);

  const fetchPagos = useCallback(async (currentPage, porFilter, estadoFilter, searchText, antiguedadFilter) => {
    setLoading(true);
    let query = supabase.from('pagos').select('*', { count: 'exact' });
    if (porFilter.length === 1) query = query.eq('pagado_por', porFilter[0]);
    else if (porFilter.length > 1) query = query.in('pagado_por', porFilter);
    if (estadoFilter.length === 1) query = query.eq('estado', estadoFilter[0]);
    else if (estadoFilter.length > 1) query = query.in('estado', estadoFilter);
    if (antiguedadFilter) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      if (antiguedadFilter === 'reciente') query = query.gte('fecha', cutoffStr);
      else if (antiguedadFilter === 'antigua') query = query.lt('fecha', cutoffStr);
    }
    if (searchText.trim()) {
      const words = normalize(searchText.trim()).split(/\s+/).filter(Boolean);
      const COLS = ['propiedad', 'descripcion', 'estado', 'pagado_por', 'tipo'];
      for (const word of words) query = query.or(COLS.map(col => `${col}.ilike.%${word}%`).join(','));
    }
    const from = currentPage * PAGE_SIZE;
    const { data, count } = await query.order('position', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    setPagos(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPagos(page, filterPor, filterEstado, search, filterAntiguedad); }, [fetchPagos, page, filterPor, filterEstado, search, filterAntiguedad]);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleFilter = (arr, setArr, val) => { setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]); setPage(0); };
  const handleUpdate = (updated) => setPagos(prev => prev.map(p => p.id === updated.id ? updated : p));
  const handleDelete = (id) => { setPagos(prev => prev.filter(p => p.id !== id)); setTotalCount(prev => prev - 1); };
  const handleSaveNew = (newPago) => { setPagos(prev => [newPago, ...prev]); setTotalCount(prev => prev + 1); setAddingNew(false); };
  const maxPosition = pagos.length > 0 ? Math.max(...pagos.map(p => p.position ?? 0)) : 0;
  const handleSaveNotes = async (id, notas) => { await supabase.from('pagos').update({ notas }).eq('id', id); setPagos(prev => prev.map(p => p.id === id ? { ...p, notas } : p)); };
  const handlePageChange = (newPage) => { setPage(newPage); const wrapper = document.getElementById('pagos-table-wrapper'); if (wrapper) wrapper.scrollTop = 0; };

  const handleExport = async () => {
    setExporting(true);
    let all = [];
    let from = 0;
    while (true) {
      const { data } = await supabase.from('pagos').select('*').order('position', { ascending: true }).range(from, from + 999);
      if (!data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }
    // La columna Caja se calcula al momento de exportar (no se guarda en la
    // base), para que el Excel siempre refleje el estado actual.
    const withComputedCaja = all.map(p => ({ ...p, caja: isCajaFuera(p) ? 'FUERA' : '' }));
    exportToExcel(withComputedCaja, [
      { key: 'propiedad',   label: 'Propiedad' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'cxc',         label: 'CxC' },
      { key: 'estado',      label: 'Estado' },
      { key: 'fecha',       label: 'Fecha' },
      { key: 'pagado_por',  label: 'Pagado Por' },
      { key: 'tipo',        label: 'Tipo' },
      { key: 'comision',    label: 'Comisión' },
      { key: 'fecha_caja',  label: 'Fecha Caja' },
      { key: 'caja',        label: 'Caja' },
      { key: 'notas',       label: 'Notas' },
    ], 'Pagos');
    setExporting(false);
  };

  const activeFilters = filterPor.length > 0 || filterEstado.length > 0 || filterAntiguedad || search.trim().length > 0;
  const HEADERS = ['PROPIEDAD', 'DESCRIPCIÓN', 'CxC', 'ESTADO', 'FECHA', 'PAGADO POR', 'TIPO', 'COMISIÓN', 'FECHA CAJA', 'ANTIGÜEDAD', 'CAJA', ''];

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Pagos</h1>
          <p style={s.subtitle}>{activeFilters ? `${totalCount} registros (filtrados)` : `${totalCount} registros`}</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.searchWrapper}>
            <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar propiedad, descripción..." style={s.searchInput} />
            {searchInput && <button onClick={() => { setSearchInput(''); setSearch(''); setPage(0); }} style={s.clearSearch}><X size={12} /></button>}
          </div>
          <div style={s.filterGroup}>{PAGADO_POR_OPTIONS.map(v => <button key={v} onClick={() => toggleFilter(filterPor, setFilterPor, v)} style={{ ...s.filterBtn, ...(filterPor.includes(v) ? s.filterBtnActive : {}) }}>{v}</button>)}</div>
          <div style={s.filterGroup}>{ESTADO_OPTIONS.map(v => <button key={v} onClick={() => toggleFilter(filterEstado, setFilterEstado, v)} style={{ ...s.filterBtn, ...(filterEstado.includes(v) ? { ...s.filterBtnActive, background: (ESTADO_COLORS[v]?.bg || '#e8eaed'), color: (ESTADO_COLORS[v]?.color || '#202124'), borderColor: (ESTADO_COLORS[v]?.color || '#dadce0') } : {}) }}>{v}</button>)}</div>
          <div style={s.filterGroup}>{[{ val: 'reciente', label: '- 3m' }, { val: 'antigua', label: '+ 3m' }].map(({ val, label }) => <button key={val} onClick={() => { setFilterAntiguedad(prev => prev === val ? '' : val); setPage(0); }} style={{ ...s.filterBtn, ...(filterAntiguedad === val ? s.filterBtnActive : {}) }}>{label}</button>)}</div>
          {activeFilters && <button onClick={() => { setFilterPor([]); setFilterEstado([]); setFilterAntiguedad(''); setSearch(''); setSearchInput(''); setPage(0); }} style={s.clearFilter}>Limpiar</button>}
          <button onClick={handleExport} disabled={exporting} title="Exportar a Excel"
           style={{ display:'flex', alignItems:'center', padding:'8px 10px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:exporting?'not-allowed':'pointer', opacity:exporting?0.6:1 }}>
           <Download size={15} color="#34a853" />
          </button>
          <button onClick={() => setShowMetrics(true)} style={s.metricsBtn}><BarChart2 size={14} style={{ marginRight: 5 }} /> Métricas</button>
          <button onClick={() => setAddingNew(true)} disabled={addingNew} style={s.addBtn}><Plus size={14} style={{ marginRight: 5 }} /> Nuevo pago</button>
        </div>
      </div>

      <div id="pagos-table-wrapper" style={s.tableWrapper}>
        {loading ? <div style={s.loading}>Cargando pagos...</div> : (
          <table style={s.table}>
            <thead><tr>{HEADERS.map((h, i) => <th key={i} style={{ ...s.th, textAlign: i < 2 ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
            <tbody>
              {addingNew && <NewPagoRow onSave={handleSaveNew} onCancel={() => setAddingNew(false)} maxPosition={maxPosition} />}
              {pagos.length === 0 && !addingNew
                ? <tr><td colSpan={13} style={s.empty}>No hay pagos registrados.</td></tr>
                : pagos.map(p => (
                  <PagoRow key={p.id} pago={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpenNotes={setNotesFor}
                    fichaPropiedadResuelta={carteraReverseMap.get(p.propiedad) || null}
                    onOpenFicha={setFichaPropiedad} />
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={handlePageChange} />
      {notesFor && <NotesPanel pago={notesFor} onClose={() => setNotesFor(null)} onSave={handleSaveNotes} />}
      {showMetrics && <MetricsView onClose={() => setShowMetrics(false)} />}
      {fichaPropiedad && <FichaSidebar propiedad={fichaPropiedad} onClose={() => setFichaPropiedad(null)} />}
    </div>
  );
}

const s = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#5f6368', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: { padding: '5px 11px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  filterBtnActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 700 },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  metricsBtn: { display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#fff', border: '1px solid #dadce0', color: '#3c4043', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', verticalAlign: 'middle', minWidth: 120 },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #e8eaed', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { paddingLeft: 30, paddingRight: 28, paddingTop: 7, paddingBottom: 7, border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 220 },
  clearSearch: { position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#9aa0a6' },
};
