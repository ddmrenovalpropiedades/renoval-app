// ════════════════════════════════════════════════════════════════
// Contratos v2 (beta) — solo admins
// Vista "Probar": genera contratos con datos de prueba desde la plantilla
//                 vigente en Supabase (vista previa en vivo + Word).
// Vista "Plantilla": versión vigente, historial y carga inicial.
//                 (El editor llega en la próxima entrega.)
// No toca el generador actual (ContratoGeneratorPage.js).
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, Upload, AlertTriangle } from 'lucide-react';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';
import { renderPlantilla, contarFaltantes } from '../lib/plantillas/render';
import { docxABlob } from '../lib/plantillas/docx';
import { PLANTILLA_ARRIENDO_BASE, SLUG_ARRIENDO } from '../lib/plantillas/plantillaBase';
import { CONFIG_PRUEBA_INICIAL, datosDesdeConfig } from '../lib/plantillas/datosPrueba';
import VistaPrevia from '../lib/plantillas/VistaPrevia';
import useEsAdminDocs from '../lib/plantillas/useEsAdminDocs';

const VISTAS = [
  { id: 'probar', label: 'Probar', icon: FileText },
  { id: 'plantilla', label: 'Plantilla', icon: History },
];

const fechaHora = (iso) => new Date(iso).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function ContratosV2Page() {
  const esAdmin = useEsAdminDocs();
  const [vista, setVista] = useState('probar');
  const [versiones, setVersiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('doc_plantillas')
      .select('id, slug, nombre, version, contenido, nota, created_by, created_at')
      .eq('slug', SLUG_ARRIENDO)
      .order('version', { ascending: false });
    if (err) setError(`No se pudieron cargar las plantillas: ${err.message}`);
    else setVersiones(data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const vigente = versiones[0] || null;
  // Si aún no hay versión guardada, se usa la plantilla base del código
  const contenido = vigente ? vigente.contenido : PLANTILLA_ARRIENDO_BASE;

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Contratos v2 <span style={s.beta}>BETA</span></h1>
          <p style={s.subtitle}>
            {cargando ? 'Cargando plantilla…'
              : vigente ? `Plantilla vigente: ${vigente.nombre} — versión ${vigente.version}`
                : 'Usando la plantilla base del sistema (aún no guardada en Supabase)'}
          </p>
        </div>
        <div style={s.segmented}>
          {VISTAS.map((v) => {
            const Icon = v.icon;
            const activo = vista === v.id;
            return (
              <button key={v.id} onClick={() => setVista(v.id)} style={{ ...s.segBtn, ...(activo ? s.segBtnActivo : {}) }}>
                <Icon size={14} />{v.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div style={s.error}><AlertTriangle size={15} />{error}</div>}

      {vista === 'probar' && <VistaProbar contenido={contenido} vigente={vigente} />}
      {vista === 'plantilla' && (
        <VistaPlantilla versiones={versiones} esAdmin={esAdmin} onGuardado={cargar} onError={setError} />
      )}
    </div>
  );
}

// ── Vista: probar con datos inventados ──────────────────────────
function VistaProbar({ contenido, vigente }) {
  const [cfg, setCfg] = useState(CONFIG_PRUEBA_INICIAL);
  const [generando, setGenerando] = useState(false);

  const set = (k, v) => setCfg((prev) => ({ ...prev, [k]: v }));
  const setCantidad = (k, n) => setCfg((prev) => ({
    ...prev,
    [k]: Array.from({ length: n }, (_, i) => prev[k][i] || 'M'),
  }));
  const setGenero = (k, i, g) => setCfg((prev) => {
    const lista = [...prev[k]];
    lista[i] = g;
    return { ...prev, [k]: lista };
  });

  const datos = useMemo(() => datosDesdeConfig(cfg), [cfg]);
  const bloques = useMemo(() => renderPlantilla(contenido, datos), [contenido, datos]);
  const faltantes = contarFaltantes(bloques);

  const descargar = async () => {
    setGenerando(true);
    try {
      const blob = await docxABlob(bloques);
      const v = vigente ? `v${vigente.version}` : 'base';
      saveAs(blob, `Contrato_prueba_${v}.docx`);
    } finally {
      setGenerando(false);
    }
  };

  const personas = [
    { k: 'gProp', label: 'Propietarios', min: 1 },
    { k: 'gArr', label: 'Arrendatarios', min: 1 },
    { k: 'gFia', label: 'Fiadores', min: 0 },
  ];

  return (
    <div style={s.split}>
      <div style={s.panel}>
        <div style={s.panelTitle}>Datos de prueba</div>

        {personas.map(({ k, label, min }) => (
          <div key={k} style={s.grupo}>
            <label style={s.label}>{label}</label>
            <div style={s.fila}>
              <select value={cfg[k].length} onChange={(e) => setCantidad(k, parseInt(e.target.value, 10))} style={{ ...s.select, width: 64 }}>
                {[0, 1, 2, 3].filter((n) => n >= min).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {cfg[k].map((g, i) => (
                <select key={i} value={g} onChange={(e) => setGenero(k, i, e.target.value)} style={s.select}>
                  <option value="M">Hombre</option>
                  <option value="F">Mujer</option>
                </select>
              ))}
            </div>
          </div>
        ))}

        <div style={s.grid2}>
          <Campo label="Tipo">
            <select value={cfg.tipoProp} onChange={(e) => set('tipoProp', e.target.value)} style={s.select}>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
            </select>
          </Campo>
          <Campo label="Número">
            <input value={cfg.numeroProp} onChange={(e) => set('numeroProp', e.target.value)} style={s.input} placeholder="(vacío)" />
          </Campo>
          <Campo label="Moneda">
            <select
              value={cfg.monedaArriendo}
              onChange={(e) => setCfg((prev) => ({ ...prev, monedaArriendo: e.target.value, arriendo: e.target.value === 'UF' ? '28' : '450000' }))}
              style={s.select}
            >
              <option value="CLP">Pesos</option>
              <option value="UF">UF</option>
            </select>
          </Campo>
          <Campo label={cfg.monedaArriendo === 'UF' ? 'Renta (UF)' : 'Renta ($)'}>
            <input value={cfg.arriendo} onChange={(e) => set('arriendo', e.target.value.replace(/[^0-9.,]/g, ''))} style={s.input} />
          </Campo>
          <Campo label="Fecha de inicio">
            <input type="date" value={cfg.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} style={s.input} />
          </Campo>
          {cfg.monedaArriendo === 'CLP' && (
            <Campo label="Reajuste">
              <select value={cfg.reajuste} onChange={(e) => set('reajuste', e.target.value)} style={s.select}>
                <option>IPC (cada 6 meses)</option>
                <option>IPC (cada 12 meses)</option>
              </select>
            </Campo>
          )}
        </div>

        <div style={s.checks}>
          {[
            ['bodega', 'Bodega'],
            ['estacionamiento', 'Estacionamiento'],
            ['amoblado', 'Amoblado'],
            ['promo', 'Renta promocional'],
          ].map(([k, label]) => (
            <label key={k} style={s.check}>
              <input type="checkbox" checked={cfg[k]} onChange={(e) => set(k, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        <button onClick={descargar} disabled={generando} style={s.btnPrimario}>
          <Download size={15} />{generando ? 'Generando…' : 'Descargar Word (.docx)'}
        </button>
        {faltantes > 0 && (
          <p style={s.aviso}>{faltantes} dato{faltantes > 1 ? 's' : ''} faltante{faltantes > 1 ? 's' : ''} (en amarillo)</p>
        )}
      </div>

      <div style={s.previewWrap}>
        <VistaPrevia bloques={bloques} />
      </div>
    </div>
  );
}

// ── Vista: plantilla vigente e historial ────────────────────────
function VistaPlantilla({ versiones, esAdmin, onGuardado, onError }) {
  const [guardando, setGuardando] = useState(false);

  const guardarBase = async () => {
    setGuardando(true);
    const { error } = await supabase.from('doc_plantillas').insert({
      slug: SLUG_ARRIENDO,
      tipo: 'contrato_arriendo',
      nombre: 'Arriendo habitacional',
      version: 1,
      contenido: PLANTILLA_ARRIENDO_BASE,
      nota: 'Plantilla inicial (texto del generador actual)',
    });
    setGuardando(false);
    if (error) onError(`No se pudo guardar: ${error.message}`);
    else onGuardado();
  };

  return (
    <div style={s.body}>
      <div style={s.card}>
        <div style={{ ...s.panelTitle, marginBottom: 12 }}>Arriendo habitacional</div>

        {versiones.length === 0 ? (
          <div>
            <p style={s.texto}>
              Todavía no hay versiones guardadas. La vista &quot;Probar&quot; está usando la plantilla base del sistema,
              que reproduce el texto del generador actual.
            </p>
            {esAdmin ? (
              <button onClick={guardarBase} disabled={guardando} style={s.btnPrimario}>
                <Upload size={15} />{guardando ? 'Guardando…' : 'Guardar plantilla base como versión 1'}
              </button>
            ) : (
              <p style={s.aviso}>Solo los administradores pueden guardar plantillas.</p>
            )}
          </div>
        ) : (
          <table style={s.tabla}>
            <thead>
              <tr>
                <th style={s.th}>Versión</th>
                <th style={s.th}>Fecha</th>
                <th style={s.th}>Autor</th>
                <th style={s.th}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {versiones.map((v, i) => (
                <tr key={v.id}>
                  <td style={s.td}>
                    v{v.version}{i === 0 && <span style={s.vigente}>vigente</span>}
                  </td>
                  <td style={s.td}>{fechaHora(v.created_at)}</td>
                  <td style={s.td}>{v.created_by}</td>
                  <td style={s.td}>{v.nota || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ ...s.texto, marginTop: 16, color: '#80868b' }}>
          El editor de plantillas llega en la próxima entrega.
        </p>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  wrapper: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexShrink: 0, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 },
  beta: { fontSize: 10, fontWeight: 700, color: '#f57c00', background: '#fff3e0', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: '#5f6368', margin: 0 },
  segmented: { display: 'flex', background: '#f1f3f4', borderRadius: 8, padding: 3, gap: 2 },
  segBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 13, color: '#5f6368', cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActivo: { background: '#fff', color: '#1a73e8', fontWeight: 600, boxShadow: '0 1px 2px rgba(60,64,67,0.2)' },
  error: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fce8e6', color: '#c5221f', borderRadius: 8, fontSize: 13, marginBottom: 12, flexShrink: 0 },
  split: { flex: 1, display: 'flex', gap: 16, overflow: 'hidden', minHeight: 0 },
  panel: { width: 300, flexShrink: 0, overflowY: 'auto', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#202124' },
  grupo: { display: 'flex', flexDirection: 'column', gap: 4 },
  fila: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  grid2: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
  checks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3c4043', cursor: 'pointer' },
  label: { fontSize: 11, fontWeight: 600, color: '#5f6368' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #dadce0', borderRadius: 7, padding: '7px 9px', fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 },
  select: { boxSizing: 'border-box', maxWidth: '100%', border: '1px solid #dadce0', borderRadius: 7, padding: '7px 9px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  btnPrimario: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  aviso: { fontSize: 12, color: '#b06000', margin: 0 },
  previewWrap: { flex: 1, overflowY: 'auto', background: '#f1f3f4', borderRadius: 12, padding: 24, minWidth: 0 },
  body: { flex: 1, overflowY: 'auto' },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 20, maxWidth: 860 },
  texto: { fontSize: 13, color: '#3c4043', lineHeight: 1.5, margin: '0 0 12px' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e8eaed', color: '#5f6368', fontWeight: 600, fontSize: 12 },
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f3f4', color: '#202124' },
  vigente: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#188038', background: '#e6f4ea', padding: '2px 6px', borderRadius: 4 },
};
