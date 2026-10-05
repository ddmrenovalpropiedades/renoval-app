// ════════════════════════════════════════════════════════════════
// Plantilla de contrato — solo admins
// Vista "Probar":    datos de prueba → vista previa en vivo + Word
//                    (puede usar el borrador sin guardar).
// Vista "Editar":    editor de la plantilla; "Guardar" crea una versión nueva.
//                    El borrador se respalda en este navegador.
// Vista "Historial": versiones guardadas; restaurar crea una versión nueva.
// El generador de contratos (ContratoGeneratorPage.js) usa la versión vigente.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, PenLine, AlertTriangle, Save, RotateCcw, Undo } from 'lucide-react';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';
import { renderPlantilla, contarFaltantes } from '../lib/plantillas/render';
import { docxABlob } from '../lib/plantillas/docx';
import { PLANTILLA_ARRIENDO_BASE, SLUG_ARRIENDO } from '../lib/plantillas/plantillaBase';
import { CONFIG_PRUEBA_INICIAL, datosDesdeConfig } from '../lib/plantillas/datosPrueba';
import VistaPrevia from '../lib/plantillas/VistaPrevia';
import PlantillaEditor from '../lib/plantillas/PlantillaEditor';
import useEsAdminDocs from '../lib/plantillas/useEsAdminDocs';

const VISTAS = [
  { id: 'probar', label: 'Probar', icon: FileText },
  { id: 'editar', label: 'Editar plantilla', icon: PenLine, soloAdmin: true },
  { id: 'historial', label: 'Historial', icon: History },
];

const CLAVE_BORRADOR = `docv2_borrador_${SLUG_ARRIENDO}`;

const fechaHora = (iso) => new Date(iso).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Respaldo local del borrador (por si se cierra la pestaña o se cambia de módulo)
function leerRespaldo() {
  try {
    const raw = window.localStorage.getItem(CLAVE_BORRADOR);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function escribirRespaldo(valor) {
  try {
    if (valor) window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(valor));
    else window.localStorage.removeItem(CLAVE_BORRADOR);
  } catch (e) {
    // sin almacenamiento local: el borrador vive solo en memoria
  }
}

export default function ContratosV2Page() {
  const esAdmin = useEsAdminDocs();
  const [vista, setVista] = useState('probar');
  const [versiones, setVersiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [borrador, setBorrador] = useState(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('doc_plantillas')
      .select('id, slug, tipo, nombre, version, contenido, nota, created_by, created_at')
      .eq('slug', SLUG_ARRIENDO)
      .order('version', { ascending: false });
    if (err) setError(`No se pudieron cargar las plantillas: ${err.message}`);
    else setVersiones(data || []);
    setCargando(false);
    return data || [];
  }, []);

  // Carga inicial + recuperación del borrador respaldado (si corresponde a la versión vigente)
  useEffect(() => {
    cargar().then((data) => {
      const resp = leerRespaldo();
      const versionVigente = data[0]?.version || 0;
      if (resp && resp.baseVersion === versionVigente && resp.contenido) {
        setBorrador(resp.contenido);
        setAviso('Se recuperó un borrador sin guardar de tu sesión anterior.');
      } else if (resp) {
        escribirRespaldo(null);
      }
    });
  }, [cargar]);

  const vigente = versiones[0] || null;
  const contenidoVigente = vigente ? vigente.contenido : PLANTILLA_ARRIENDO_BASE;
  const sucio = !!borrador && JSON.stringify(borrador) !== JSON.stringify(contenidoVigente);

  // Respaldar borrador en cada cambio
  useEffect(() => {
    if (cargando) return;
    escribirRespaldo(sucio ? { baseVersion: vigente?.version || 0, contenido: borrador } : null);
  }, [borrador, sucio, vigente, cargando]);

  // Avisar al cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!sucio) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sucio]);

  const insertarVersion = async (contenido, notaVersion) => {
    const siguiente = (vigente?.version || 0) + 1;
    const { error: err } = await supabase.from('doc_plantillas').insert({
      slug: SLUG_ARRIENDO,
      tipo: 'contrato_arriendo',
      nombre: vigente?.nombre || 'Arriendo habitacional',
      version: siguiente,
      contenido,
      nota: notaVersion || null,
    });
    if (err) {
      setError(err.code === '23505'
        ? 'Otra persona guardó una versión mientras editabas. Recarga la página para ver la última versión (tu borrador queda respaldado).'
        : `No se pudo guardar: ${err.message}`);
      return false;
    }
    return siguiente;
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const v = await insertarVersion(borrador, nota.trim());
    setGuardando(false);
    if (!v) return;
    setBorrador(null);
    setNota('');
    escribirRespaldo(null);
    await cargar();
    setAviso(`Versión ${v} guardada. Desde ahora es la plantilla vigente.`);
  };

  const descartar = () => {
    setBorrador(null);
    setNota('');
    escribirRespaldo(null);
    setAviso('Cambios descartados.');
  };

  const restaurar = async (version) => {
    setError('');
    const v = await insertarVersion(version.contenido, `Restaurada desde la versión ${version.version}`);
    if (!v) return;
    setBorrador(null);
    escribirRespaldo(null);
    await cargar();
    setAviso(`Se restauró la versión ${version.version} como versión ${v}.`);
  };

  const vistas = VISTAS.filter((v) => !v.soloAdmin || esAdmin);

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Plantilla de contrato</h1>
          <p style={s.subtitle}>
            {cargando ? 'Cargando plantilla…'
              : vigente ? `Plantilla vigente: ${vigente.nombre} — versión ${vigente.version}`
                : 'Usando la plantilla base del sistema (aún no guardada)'}
            {sucio && <span style={s.sucio}> · Borrador sin guardar</span>}
          </p>
        </div>
        <div style={s.segmented}>
          {vistas.map((v) => {
            const Icon = v.icon;
            const activo = vista === v.id;
            return (
              <button key={v.id} onClick={() => setVista(v.id)} style={{ ...s.segBtn, ...(activo ? s.segBtnActivo : {}) }}>
                <Icon size={14} />{v.label}
                {v.id === 'editar' && sucio && <span style={s.punto} />}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div style={s.error}><AlertTriangle size={15} />{error}<button style={s.cerrar} onClick={() => setError('')}>×</button></div>}
      {aviso && !error && <div style={s.aviso}>{aviso}<button style={s.cerrar} onClick={() => setAviso('')}>×</button></div>}

      {vista === 'probar' && (
        <VistaProbar contenidoVigente={contenidoVigente} borrador={sucio ? borrador : null} vigente={vigente} />
      )}

      {vista === 'editar' && esAdmin && !cargando && (
        <div style={s.editorWrap}>
          <div style={s.barraGuardar}>
            <span style={s.barraTexto}>
              {sucio ? 'Tienes cambios sin guardar.' : 'Sin cambios.'} Al guardar se crea la versión {(vigente?.version || 0) + 1}.
            </span>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota del cambio (opcional): ej. se ajusta cláusula de garantía"
              style={s.inputNota}
            />
            <button onClick={descartar} disabled={!sucio} style={{ ...s.btnSec, ...(!sucio ? s.deshab : {}) }}>
              <Undo size={14} /> Descartar
            </button>
            <button onClick={guardar} disabled={!sucio || guardando} style={{ ...s.btnPrimario, ...(!sucio || guardando ? s.deshab : {}) }}>
              <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar versión'}
            </button>
          </div>
          <PlantillaEditor contenido={borrador || contenidoVigente} onChange={setBorrador} />
        </div>
      )}

      {vista === 'historial' && (
        <VistaHistorial versiones={versiones} esAdmin={esAdmin} sucio={sucio} onRestaurar={restaurar} />
      )}
    </div>
  );
}

// ── Vista: probar con datos inventados ──────────────────────────
function VistaProbar({ contenidoVigente, borrador, vigente }) {
  const [cfg, setCfg] = useState(CONFIG_PRUEBA_INICIAL);
  const [usarBorrador, setUsarBorrador] = useState(true);
  const [generando, setGenerando] = useState(false);

  const contenido = borrador && usarBorrador ? borrador : contenidoVigente;

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
      const v = contenido === borrador ? 'borrador' : vigente ? `v${vigente.version}` : 'base';
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
        {borrador && (
          <label style={s.checkBorrador}>
            <input type="checkbox" checked={usarBorrador} onChange={(e) => setUsarBorrador(e.target.checked)} />
            Probar con el borrador sin guardar
          </label>
        )}

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
          <p style={s.avisoTexto}>{faltantes} dato{faltantes > 1 ? 's' : ''} faltante{faltantes > 1 ? 's' : ''} (en amarillo)</p>
        )}
      </div>

      <div style={s.previewWrap}>
        <VistaPrevia bloques={bloques} />
      </div>
    </div>
  );
}

// ── Vista: historial de versiones ───────────────────────────────
function VistaHistorial({ versiones, esAdmin, sucio, onRestaurar }) {
  const [confirmar, setConfirmar] = useState(null);

  return (
    <div style={s.body}>
      <div style={s.card}>
        <div style={{ ...s.panelTitle, marginBottom: 12 }}>Arriendo habitacional — versiones</div>

        {versiones.length === 0 ? (
          <p style={s.texto}>
            Todavía no hay versiones guardadas. Se está usando la plantilla base del sistema;
            al guardar desde &quot;Editar plantilla&quot; se crea la versión 1.
          </p>
        ) : (
          <table style={s.tabla}>
            <thead>
              <tr>
                <th style={s.th}>Versión</th>
                <th style={s.th}>Fecha</th>
                <th style={s.th}>Autor</th>
                <th style={s.th}>Nota</th>
                {esAdmin && <th style={s.th} />}
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
                  {esAdmin && (
                    <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {i > 0 && (confirmar === v.id ? (
                        <span style={s.confirmar}>
                          {sucio ? 'Se perderá tu borrador. ' : ''}¿Restaurar?
                          <button style={s.btnMini} onClick={() => { setConfirmar(null); onRestaurar(v); }}>Sí</button>
                          <button style={s.btnMiniSec} onClick={() => setConfirmar(null)}>No</button>
                        </span>
                      ) : (
                        <button style={s.btnLink} onClick={() => setConfirmar(v.id)}>
                          <RotateCcw size={13} /> Restaurar
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ ...s.texto, marginTop: 14, color: '#80868b' }}>
          Restaurar no borra nada: crea una versión nueva con el contenido de la versión elegida.
        </p>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
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
  sucio: { color: '#b06000', fontWeight: 600 },
  segmented: { display: 'flex', background: '#f1f3f4', borderRadius: 8, padding: 3, gap: 2 },
  segBtn: { position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 13, color: '#5f6368', cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActivo: { background: '#fff', color: '#1a73e8', fontWeight: 600, boxShadow: '0 1px 2px rgba(60,64,67,0.2)' },
  punto: { width: 7, height: 7, borderRadius: '50%', background: '#f9ab00' },
  error: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fce8e6', color: '#c5221f', borderRadius: 8, fontSize: 13, marginBottom: 12, flexShrink: 0 },
  aviso: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#e6f4ea', color: '#137333', borderRadius: 8, fontSize: 13, marginBottom: 12, flexShrink: 0 },
  cerrar: { marginLeft: 'auto', border: 'none', background: 'none', fontSize: 18, lineHeight: 1, cursor: 'pointer', color: 'inherit' },
  editorWrap: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 },
  barraGuardar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, flexShrink: 0 },
  barraTexto: { fontSize: 13, color: '#5f6368' },
  inputNota: { flex: 1, minWidth: 220, border: '1px solid #dadce0', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  deshab: { opacity: 0.45, cursor: 'default' },
  split: { flex: 1, display: 'flex', gap: 16, overflow: 'hidden', minHeight: 0 },
  panel: { width: 300, flexShrink: 0, overflowY: 'auto', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#202124' },
  checkBorrador: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#fef7e0', border: '1px solid #fde49b', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#a05a00', cursor: 'pointer' },
  grupo: { display: 'flex', flexDirection: 'column', gap: 4 },
  fila: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  grid2: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
  checks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3c4043', cursor: 'pointer' },
  label: { fontSize: 11, fontWeight: 600, color: '#5f6368' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #dadce0', borderRadius: 7, padding: '7px 9px', fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 },
  select: { boxSizing: 'border-box', maxWidth: '100%', border: '1px solid #dadce0', borderRadius: 7, padding: '7px 9px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  btnPrimario: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fff', color: '#3c4043', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  avisoTexto: { fontSize: 12, color: '#b06000', margin: 0 },
  previewWrap: { flex: 1, overflowY: 'auto', background: '#f1f3f4', borderRadius: 12, padding: 24, minWidth: 0 },
  body: { flex: 1, overflowY: 'auto' },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 20, maxWidth: 960 },
  texto: { fontSize: 13, color: '#3c4043', lineHeight: 1.5, margin: '0 0 12px' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e8eaed', color: '#5f6368', fontWeight: 600, fontSize: 12 },
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f3f4', color: '#202124' },
  vigente: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#188038', background: '#e6f4ea', padding: '2px 6px', borderRadius: 4 },
  btnLink: { display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: '#1a73e8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmar: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b06000', fontWeight: 600 },
  btnMini: { padding: '3px 10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniSec: { padding: '3px 10px', background: '#fff', color: '#3c4043', border: '1px solid #dadce0', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
};
