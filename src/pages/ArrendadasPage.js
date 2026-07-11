import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Save, Edit2, Trash2, Check, X, Download, FileText } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         AlignmentType, BorderStyle, WidthType, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const formatMes = (mes) => { const [y, m] = mes.split('-'); return `${MESES_ES[parseInt(m) - 1]} ${y}`; };
const formatCLP = (val) => {
  if (!val) return '';
  const n = parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.'));
  if (isNaN(n)) return val;
  return '$' + Math.round(n).toLocaleString('es-CL');
};
const parseNumeric = (val) => {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};
const formatDateCL = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL');
};

const ESTADO_OPTIONS = ['Pendiente', 'Listo'];
const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };
const BadgeE = ({ val }) => val ? (
  <span style={{ background: `${ENCARGADO_COLORS[val] || '#9aa0a6'}22`, color: ENCARGADO_COLORS[val] || '#9aa0a6', border: `1px solid ${ENCARGADO_COLORS[val] || '#9aa0a6'}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{val}</span>
) : null;

const EstadoCell = ({ value, onChange }) => (
  <select value={value || 'Pendiente'} onChange={e => onChange(e.target.value)}
    style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: value === 'Listo' ? '#34a853' : '#ea4335', WebkitAppearance: 'menulist' }}>
    {ESTADO_OPTIONS.map(o => <option key={o} value={o} style={{ color: '#202124', fontWeight: 400 }}>{o}</option>)}
  </select>
);

function MoneyInput({ value, onChange, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const displayVal = value ? formatCLP(value) : '';
  if (readOnly) return <span style={{ fontSize: 12 }}>{displayVal}</span>;
  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 4px', background: '#fff' }}>
        <span style={{ fontSize: 12, color: '#5f6368', marginRight: 1 }}>$</span>
        <input autoFocus value={raw ? parseInt(raw).toLocaleString('es-CL') : ''}
          onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => { setEditing(false); if (raw) onChange(raw); }}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, fontFamily: 'inherit' }} />
      </div>
    );
  }
  return (
    <div onClick={() => { setRaw(value ? String(value).replace(/[^0-9]/g,'') : ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, minWidth: 60, padding: '2px 4px', borderRadius: 6 }}>
      {displayVal || <span style={{ color: '#dadce0' }}>$</span>}
    </div>
  );
}

// Estos dos componentes deben vivir a nivel de módulo (no adentro de
// ArrendadaRow). Si se definen dentro de otro componente, React los trata
// como un tipo de componente nuevo en cada render — y como escribir en el
// input dispara un re-render (setForm), el <input> del DOM se destruye y se
// vuelve a crear después de CADA carácter, perdiendo el foco cada vez.
function InlineInput({ value, onChange, style = {} }) {
  return (
    <input value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', ...style }} />
  );
}
function InlineSel({ value, onChange, opts }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', width: '100%' }}>
      <option value="">—</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const TIPO_OPTS = ['Nuevo','Renovación'];
const ADMIN_OPTS = ['Sí','No'];
const E1_OPTS = ['DD','FD'];
const E2_OPTS = ['EA','FG'];

function ArrendadaRow({ row, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...row });
  const [edits, setEdits] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const merged = { ...row, ...edits };
  const set = (k, v) => setEdits(prev => ({ ...prev, [k]: v }));
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await supabase.from('arrendadas').update(edits).eq('id', row.id);
    onUpdate(row.id, edits);
    setEdits({});
  };
  const handleEditSave = async () => {
    await supabase.from('arrendadas').update(form).eq('id', row.id);
    onUpdate(row.id, form);
    setEditing(false);
  };
  const handleEstado = async (k, v) => {
    await supabase.from('arrendadas').update({ [k]: v }).eq('id', row.id);
    onUpdate(row.id, { [k]: v });
  };
  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete(row.id);
  };

  if (editing) {
    return (
      <tr style={{ background: '#f0f7ff', borderBottom: '1px solid #e8eaed' }}>
        <td style={styles.td}><InlineInput value={form.propiedad} onChange={v => setF('propiedad', v)} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.arriendo} onChange={v => setF('arriendo', v)} style={{ width: 80 }} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.comision} onChange={v => setF('comision', v)} style={{ width: 80 }} /></td>
        <td style={styles.tdCenter}><InlineSel value={form.tipo} onChange={v => setF('tipo', v)} opts={TIPO_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel value={form.admin} onChange={v => setF('admin', v)} opts={ADMIN_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel value={form.e1} onChange={v => setF('e1', v)} opts={E1_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel value={form.e2} onChange={v => setF('e2', v)} opts={E2_OPTS} /></td>
        <td style={styles.tdCenter}><input type="date" value={form.entrega || ''} onChange={e => setF('entrega', e.target.value)} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 4px', fontSize: 11, outline: 'none' }} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.contrato} onChange={v => setF('contrato', v)} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.liquidacion} onChange={v => setF('liquidacion', v)} /></td>
        <td style={styles.tdCenter}><input type="date" value={form.fecha_gar || ''} onChange={e => setF('fecha_gar', e.target.value)} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 4px', fontSize: 11, outline: 'none' }} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.dev_gar} onChange={v => setF('dev_gar', v)} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.cuentas} onChange={v => setF('cuentas', v)} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.promocion} onChange={v => setF('promocion', v)} style={{ width: 70 }} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.meses} onChange={v => setF('meses', v)} /></td>
        <td style={styles.tdActions}>
          <button onClick={handleEditSave} style={styles.actionBtnGreen}><Check size={13} /></button>
          <button onClick={() => setEditing(false)} style={styles.actionBtnGray}><X size={13} /></button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ background: '#fff', borderBottom: '1px solid #f1f3f4' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={styles.td}>{row.propiedad}</td>
      <td style={styles.tdCenter}><MoneyInput value={row.arriendo || ''} onChange={() => {}} readOnly /></td>
      <td style={styles.tdCenter}><MoneyInput value={edits.comision !== undefined ? edits.comision : (row.comision || '')} onChange={v => set('comision', v)} /></td>
      <td style={styles.tdCenter}>{row.tipo}</td>
      <td style={styles.tdCenter}>{row.admin}</td>
      <td style={styles.tdCenter}><BadgeE val={row.e1} /></td>
      <td style={styles.tdCenter}><BadgeE val={row.e2} /></td>
      <td style={styles.tdCenter}>{formatDateCL(row.entrega)}</td>
      <td style={styles.tdCenter}><EstadoCell value={merged.contrato} onChange={v => handleEstado('contrato', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.liquidacion} onChange={v => handleEstado('liquidacion', v)} /></td>
      <td style={styles.tdCenter}>{formatDateCL(row.fecha_gar)}</td>
      <td style={styles.tdCenter}><EstadoCell value={merged.dev_gar} onChange={v => handleEstado('dev_gar', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.cuentas} onChange={v => handleEstado('cuentas', v)} /></td>
      <td style={styles.tdCenter}>{row.promocion ? formatCLP(row.promocion) : ''}</td>
      <td style={styles.tdCenter}>{row.meses}</td>
      <td style={styles.tdActions}>
        {Object.keys(edits).length > 0 && (
          <button onClick={handleSave} style={styles.saveBtn}><Save size={13} /></button>
        )}
        <button onClick={() => { setForm({...row}); setEditing(true); }} style={styles.actionBtnGray}><Edit2 size={13} /></button>
        {confirmDelete ? (
          <>
            <button onClick={handleDelete} style={styles.actionBtnRed}><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={styles.actionBtnGray}><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={styles.actionBtnGray}><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

// ── Modal de comisiones ───────────────────────────────────────
function ComisionesModal({ rows, currentMes, onClose, onGenerate }) {
  const USUARIOS = [
    { label: 'Diego Domenech y Francisco Domenech', pct: 0.25 },
    { label: 'Edith Adriazola', pct: 0.05 },
  ];
  const [usuario, setUsuario] = useState(null);
  const [propSeleccionada, setPropSeleccionada] = useState('');
  const [comisionModif, setComisionModif] = useState('');

  const rowsConModif = rows.map(r => {
    if (propSeleccionada && r.propiedad === propSeleccionada && comisionModif) {
      return { ...r, comision: comisionModif };
    }
    return r;
  });

  const total = rowsConModif.reduce((s, r) => s + (parseNumeric(r.comision) || 0), 0);

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.modal}>
        <div style={ms.header}>
          <span style={ms.title}>Generar liquidación de comisiones</span>
          <button onClick={onClose} style={ms.closeBtn}><X size={18} color="#5f6368" /></button>
        </div>

        <div style={ms.body}>
          {/* Selección de usuario */}
          <div style={ms.field}>
            <label style={ms.label}>¿Para quién se emite el documento? *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {USUARIOS.map(u => (
                <button key={u.label} onClick={() => setUsuario(u)}
                  style={{ ...ms.userBtn, ...(usuario?.label === u.label ? ms.userBtnActive : {}) }}>
                  <div style={ms.userBtnLabel}>{u.label}</div>
                  <div style={ms.userBtnPct}>{(u.pct * 100).toFixed(0)}%</div>
                </button>
              ))}
            </div>
          </div>

          {/* Modificación de comisión */}
          <div style={ms.field}>
            <label style={ms.label}>¿Hay alguna comisión que modificar para el cálculo?</label>
            <p style={ms.hint}>Opcional — si una propiedad tiene un valor de comisión distinto al registrado</p>
            <select value={propSeleccionada} onChange={e => { setPropSeleccionada(e.target.value); setComisionModif(''); }}
              style={ms.select}>
              <option value="">— Ninguna —</option>
              {rows.map(r => (
                <option key={r.id} value={r.propiedad}>{r.propiedad} ({formatCLP(r.comision)})</option>
              ))}
            </select>
            {propSeleccionada && (
              <div style={{ marginTop: 8 }}>
                <label style={ms.label}>Comisión a usar para "{propSeleccionada}"</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #dadce0', borderRadius: 7, overflow: 'hidden', marginTop: 4 }}>
                  <span style={{ background: '#f8f9fa', padding: '8px 10px', fontSize: 13, color: '#5f6368', borderRight: '1px solid #dadce0' }}>$</span>
                  <input
                    value={comisionModif ? parseInt(comisionModif).toLocaleString('es-CL') : ''}
                    onChange={e => setComisionModif(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    style={{ border: 'none', outline: 'none', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', flex: 1 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview del total */}
          {usuario && (
            <div style={ms.preview}>
              <div style={ms.previewRow}>
                <span>Total comisiones</span>
                <strong>{formatCLP(total)}</strong>
              </div>
              <div style={ms.previewRow}>
                <span>{usuario.label} ({(usuario.pct * 100).toFixed(0)}%)</span>
                <strong style={{ color: '#1a73e8' }}>{formatCLP(Math.round(total * usuario.pct))}</strong>
              </div>
            </div>
          )}
        </div>

        <div style={ms.footer}>
          <button
            onClick={() => usuario && onGenerate({ usuario, rowsConModif, total })}
            disabled={!usuario}
            style={{ ...ms.generateBtn, ...(!usuario ? { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' } : {}) }}
          >
            <FileText size={15} style={{ marginRight: 6 }} />
            Generar Word (.docx)
          </button>
          <button onClick={onClose} style={ms.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Generador de Word ─────────────────────────────────────────
function buildComisionesDoc({ usuario, rowsConModif, total, currentMes }) {
  const mesLabel = currentMes ? formatMes(currentMes).toUpperCase() : '';
  const pct = usuario.pct;
  const resultado = Math.round(total * pct);
  const pctLabel = `${(pct * 100).toFixed(0)}%`;

  const run = (t, opts = {}) => new TextRun({ text: t, font: 'Arial', size: 22, ...opts });
  const bold = (t) => run(t, { bold: true });
  const br = () => new Paragraph({ children: [run('')], spacing: { after: 0, line: 280, lineRule: 'exact' } });
  const p = (children, extra = {}) => new Paragraph({ children, spacing: { after: 120, line: 280, lineRule: 'exact' }, ...extra });

  // Título
  const titulo = new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: `COMISIONES ${mesLabel} ${usuario.label.toUpperCase()}`, bold: true, font: 'Arial', size: 24 })],
    spacing: { after: 240, line: 280, lineRule: 'exact' },
  });

  // Tabla: Propiedad | Comisión
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cellStyle = (children, shading) => new TableCell({
    borders,
    width: { size: 4503, type: WidthType.DXA },
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children,
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders,
        width: { size: 4503, type: WidthType.DXA },
        shading: { fill: '1A73E8', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'PROPIEDAD', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })], spacing: { after: 0 } })],
      }),
      new TableCell({
        borders,
        width: { size: 4503, type: WidthType.DXA },
        shading: { fill: '1A73E8', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'COMISIÓN', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })], spacing: { after: 0 } })],
      }),
    ],
  });

  const dataRows = rowsConModif.map((r, i) => new TableRow({
    children: [
      cellStyle([new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: r.propiedad || '', font: 'Arial', size: 20 })], spacing: { after: 0 } })], i % 2 === 1 ? 'F8F9FA' : undefined),
      cellStyle([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: r.comision ? formatCLP(r.comision) : '—', font: 'Arial', size: 20 })], spacing: { after: 0 } })], i % 2 === 1 ? 'F8F9FA' : undefined),
    ],
  }));

  const tabla = new Table({
    width: { size: 9006, type: WidthType.DXA },
    columnWidths: [4503, 4503],
    rows: [headerRow, ...dataRows],
  });

  // Textos finales
  const children = [
    titulo,
    br(),
    tabla,
    br(),
    p([run('Total comisión: '), bold(formatCLP(total))]),
    br(),
    p([run(`Comisiones renovaciones y arriendos nuevos (${pctLabel}): `), bold(formatCLP(resultado))]),
  ];

  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1417, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children,
    }],
  });
}

// ── Página principal ──────────────────────────────────────────
export default function ArrendadasPage() {
  const [meses, setMeses] = useState([]);
  const [currentMes, setCurrentMes] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComisionesModal, setShowComisionesModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { exportToExcel } = useExcelExport();

  const fetchMeses = useCallback(async () => {
    const { data } = await supabase.from('arrendadas_meses').select('mes').order('mes', { ascending: false });
    const list = (data || []).map(d => d.mes);
    setMeses(list);
    if (list.length > 0 && !currentMes) setCurrentMes(list[0]);
  }, [currentMes]);

  const fetchRows = useCallback(async () => {
    if (!currentMes) return;
    setLoading(true);
    const { data } = await supabase.from('arrendadas').select('*')
      .eq('mes', currentMes).order('position', { ascending: true }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [currentMes]);

  useEffect(() => { fetchMeses(); }, [fetchMeses]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (!currentMes) return;
    const channel = supabase
      .channel(`arrendadas_realtime_${currentMes}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrendadas', filter: `mes=eq.${currentMes}` }, (payload) => {
        if (payload.eventType === 'INSERT') setRows(prev => [...prev, payload.new]);
        else if (payload.eventType === 'UPDATE') setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        else if (payload.eventType === 'DELETE') setRows(prev => prev.filter(r => r.id !== payload.old.id));
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentMes]);

  const handleUpdate = (id, updates) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const handleDelete = async (id) => {
    await supabase.from('arrendadas').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleExport = () => exportToExcel(rows, [
    { key: 'propiedad',   label: 'Propiedad' },
    { key: 'arriendo',    label: 'Arriendo' },
    { key: 'comision',    label: 'Comisión' },
    { key: 'tipo',        label: 'Tipo' },
    { key: 'admin',       label: 'Admin' },
    { key: 'e1',          label: 'E1' },
    { key: 'e2',          label: 'E2' },
    { key: 'entrega',     label: 'Fecha Entrega' },
    { key: 'contrato',    label: 'Contrato' },
    { key: 'liquidacion', label: 'Liquidación' },
    { key: 'fecha_gar',   label: 'Fecha Gar.' },
    { key: 'dev_gar',     label: 'Dev Gar' },
    { key: 'cuentas',     label: 'Cuentas' },
    { key: 'promocion',   label: 'Promoción' },
    { key: 'meses',       label: 'Meses promo' },
  ], `Arrendadas_${currentMes}`);

  const handleGenerate = async ({ usuario, rowsConModif, total }) => {
    setGenerating(true);
    setShowComisionesModal(false);
    try {
      const doc = buildComisionesDoc({ usuario, rowsConModif, total, currentMes });
      const blob = await Packer.toBlob(doc);
      const mesLabel = currentMes ? formatMes(currentMes).replace(' ', '_') : 'Comisiones';
      const nombreUsuario = usuario.label.includes('Edith') ? 'Edith' : 'Diego_Francisco';
      saveAs(blob, `Comisiones_${mesLabel}_${nombreUsuario}.docx`);
    } catch (e) {
      alert('Error generando documento: ' + e.message);
    }
    setGenerating(false);
  };

  const mesIdx = meses.indexOf(currentMes);
  const canPrev = mesIdx < meses.length - 1;
  const canNext = mesIdx > 0;
  const totalComisiones = rows.reduce((sum, r) => sum + (parseNumeric(r.comision) || 0), 0);

  const HEADERS = ['PROPIEDAD','ARRIENDO','COMISION','TIPO','ADMIN','E1','E2','ENTREGA','CONTRATO','LIQUIDACION','FECHA GAR','DEV GAR','CUENTAS','PROMOCION','MESES',''];
  const WIDE_HEADERS = ['CONTRATO','LIQUIDACION','DEV GAR','CUENTAS','ENTREGA','FECHA GAR'];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Propiedades Arrendadas</h1>
          <p style={styles.subtitle}>{rows.length} propiedades · {currentMes ? formatMes(currentMes) : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Botón liquidación comisiones */}
          <button
            onClick={() => setShowComisionesModal(true)}
            disabled={rows.length === 0 || generating}
            title="Generar liquidación de comisiones"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #dadce0', borderRadius: 8, cursor: rows.length === 0 ? 'not-allowed' : 'pointer', opacity: rows.length === 0 ? 0.5 : 1, fontSize: 13, color: '#3c4043', fontFamily: 'inherit' }}
          >
            <FileText size={15} color="#1a73e8" />
            {generating ? 'Generando...' : 'Comisiones'}
          </button>
          {/* Botón Excel */}
          <button onClick={handleExport} disabled={loading} title="Exportar a Excel"
            style={{ display:'flex', alignItems:'center', padding:'8px 10px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:loading?'not-allowed':'pointer', opacity:loading?0.5:1 }}>
            <Download size={15} color="#34a853" />
          </button>
          <div style={styles.monthNav}>
            <button onClick={() => setCurrentMes(meses[mesIdx + 1])} disabled={!canPrev} style={styles.navBtn}><ChevronLeft size={18} /></button>
            <span style={styles.monthLabel}>{currentMes ? formatMes(currentMes) : ''}</span>
            <button onClick={() => setCurrentMes(meses[mesIdx - 1])} disabled={!canNext} style={styles.navBtn}><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} style={{ ...(WIDE_HEADERS.includes(h) ? styles.thWide : styles.th), textAlign: h === 'PROPIEDAD' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={16} style={styles.empty}>No hay propiedades arrendadas en {currentMes ? formatMes(currentMes) : ''}.</td></tr>
              ) : (
                rows.map(row => (
                  <ArrendadaRow key={row.id} row={row} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.totalsRow}>
        <span style={styles.totalsLabel}>TOTAL COMISIONES</span>
        <span style={styles.totalsValue}>{formatCLP(totalComisiones)}</span>
      </div>

      {showComisionesModal && (
        <ComisionesModal
          rows={rows}
          currentMes={currentMes}
          onClose={() => setShowComisionesModal(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}

// ── Modal styles ──────────────────────────────────────────────
const ms = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 },
  modal: { background: '#fff', borderRadius: 16, width: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans','Segoe UI',sans-serif", overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#202124' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#202124' },
  hint: { fontSize: 12, color: '#9aa0a6', margin: 0 },
  select: { border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  userBtn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #dadce0', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' },
  userBtnActive: { border: '2px solid #1a73e8', background: '#e8f0fe' },
  userBtnLabel: { fontSize: 14, fontWeight: 500, color: '#202124' },
  userBtnPct: { fontSize: 13, fontWeight: 700, color: '#1a73e8', background: '#e8f0fe', padding: '2px 10px', borderRadius: 20 },
  preview: { background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  previewRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#3c4043' },
  footer: { display: 'flex', gap: 8, padding: '16px 24px', borderTop: '1px solid #e8eaed', flexShrink: 0 },
  generateBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  monthNav: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '6px 12px' },
  monthLabel: { fontSize: 15, fontWeight: 600, color: '#202124', minWidth: 140, textAlign: 'center' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#5f6368', borderRadius: 6 },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #d0d5dd', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  thWide: { padding: '10px 16px', minWidth: 75, background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #d0d5dd', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap', textAlign: 'center' },
  td: { padding: '8px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle' },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle' },
  saveBtn: { background: '#e8f0fe', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#1a73e8', display: 'inline-flex', alignItems: 'center' },
  actionBtnGray: { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#5f6368' },
  actionBtnGreen: { background: '#e6f4ea', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#34a853' },
  actionBtnRed: { background: '#fce8e6', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#ea4335' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  totalsRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', marginTop: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, flexShrink: 0 },
  totalsLabel: { fontSize: 14, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8 },
  totalsValue: { fontSize: 17, fontWeight: 700, color: '#202124' },
};
