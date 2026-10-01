// ════════════════════════════════════════════════════════════════
// Editor de plantilla completa
// Columna izquierda: General · Secciones · Fragmentos · Formatos de persona
// Panel derecho: edición del elemento seleccionado.
//
// props: contenido (borrador), onChange(nuevoContenido)
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  ArrowUp, ArrowDown, Plus, Trash2, Lock, Settings, Puzzle, Users, FileText, GitBranch,
} from 'lucide-react';
import EditorTexto from './EditorTexto';
import { CONDICIONES } from './variables';
import { ordinal } from './render';
import { doc as docDsl, p as pDsl } from './dsl';

const clonar = (o) => JSON.parse(JSON.stringify(o));
const nuevoId = (pref) => `${pref}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const NOMBRE_BLOQUE = {
  portada: 'Portada (título y nombres)',
  firmas: 'Firmas',
};

// ¿Algún documento de la plantilla usa este fragmento?
function usosDeFragmento(contenido, idFrag) {
  let usos = 0;
  const recorrer = (nodo) => {
    if (!nodo || typeof nodo !== 'object') return;
    if (nodo.type === 'fragmento' && nodo.attrs?.id === idFrag) usos += 1;
    (nodo.content || []).forEach(recorrer);
  };
  (contenido.secciones || []).forEach((sec) => recorrer(sec.cuerpo));
  Object.entries(contenido.fragmentos || {}).forEach(([id, f]) => { if (id !== idFrag) recorrer(f.cuerpo); });
  return usos;
}

export default function PlantillaEditor({ contenido, onChange }) {
  const [sel, setSel] = useState({ tipo: 'seccion', id: contenido.secciones.find((x) => x.tipo === 'clausula')?.id });
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);

  const actualizar = (fn) => {
    const copia = clonar(contenido);
    fn(copia);
    onChange(copia);
  };

  // Numeración visible de cláusulas (sin considerar condiciones)
  let n = 0;
  const numeros = {};
  contenido.secciones.forEach((sec) => { if (sec.tipo === 'clausula') { n += 1; numeros[sec.id] = n; } });

  // ── Operaciones sobre secciones ──
  const moverSeccion = (id, delta) => actualizar((c) => {
    const i = c.secciones.findIndex((x) => x.id === id);
    const j = i + delta;
    if (j < 0 || j >= c.secciones.length) return;
    if (c.secciones[j].tipo === 'bloque') return; // portada y firmas quedan fijas
    [c.secciones[i], c.secciones[j]] = [c.secciones[j], c.secciones[i]];
  });

  const agregarClausula = () => {
    const id = nuevoId('c');
    actualizar((c) => {
      const iSel = c.secciones.findIndex((x) => x.id === sel.id);
      const iFirmas = c.secciones.findIndex((x) => x.bloque === 'firmas');
      let pos = iSel >= 0 && sel.tipo === 'seccion' ? iSel + 1 : iFirmas;
      if (iFirmas >= 0 && pos > iFirmas) pos = iFirmas;
      if (pos < 0) pos = c.secciones.length;
      c.secciones.splice(pos, 0, {
        id, tipo: 'clausula', titulo: 'NUEVA CLÁUSULA', condicion: null, cuerpo: docDsl(pDsl('Escribe aquí el texto de la cláusula.')),
      });
    });
    setSel({ tipo: 'seccion', id });
  };

  const borrarSeccion = (id) => {
    actualizar((c) => { c.secciones = c.secciones.filter((x) => x.id !== id); });
    setConfirmarBorrar(null);
    setSel({ tipo: 'general' });
  };

  // ── Operaciones sobre fragmentos ──
  const agregarFragmento = () => {
    const id = nuevoId('f');
    actualizar((c) => {
      c.fragmentos = c.fragmentos || {};
      c.fragmentos[id] = { nombre: 'Nuevo fragmento', condicion: null, cuerpo: docDsl(pDsl(' texto del fragmento')) };
    });
    setSel({ tipo: 'fragmento', id });
  };

  const borrarFragmento = (id) => {
    actualizar((c) => { delete c.fragmentos[id]; });
    setConfirmarBorrar(null);
    setSel({ tipo: 'general' });
  };

  // ── Elemento seleccionado ──
  const seccion = sel.tipo === 'seccion' ? contenido.secciones.find((x) => x.id === sel.id) : null;
  const fragmento = sel.tipo === 'fragmento' ? contenido.fragmentos?.[sel.id] : null;
  const formato = sel.tipo === 'formato' ? contenido.formatosPersona?.[sel.id] : null;

  const esSel = (tipo, id) => sel.tipo === tipo && sel.id === id;

  return (
    <div style={s.layout}>
      {/* ── Navegación ── */}
      <nav style={s.nav}>
        <ItemNav activo={sel.tipo === 'general'} onClick={() => setSel({ tipo: 'general' })} icono={Settings}>
          General
        </ItemNav>

        <div style={s.navTitulo}>Secciones</div>
        {contenido.secciones.map((sec) => (
          <ItemNav
            key={sec.id}
            activo={esSel('seccion', sec.id)}
            onClick={() => setSel({ tipo: 'seccion', id: sec.id })}
            icono={sec.tipo === 'bloque' ? Lock : FileText}
            atenuado={sec.tipo === 'bloque'}
            insignia={sec.condicion ? <GitBranch size={12} color="#b06000" /> : null}
          >
            {sec.tipo === 'clausula' && <b style={s.ord}>{ordinal(numeros[sec.id])}</b>}
            {sec.tipo === 'clausula' && <span>{sec.titulo}</span>}
            {sec.tipo === 'texto' && <span>Comparecencia (inicio)</span>}
            {sec.tipo === 'bloque' && <span>{NOMBRE_BLOQUE[sec.bloque] || sec.bloque}</span>}
          </ItemNav>
        ))}
        <button style={s.navAgregar} onClick={agregarClausula}><Plus size={13} /> Agregar cláusula</button>

        <div style={s.navTitulo}>Fragmentos</div>
        {Object.entries(contenido.fragmentos || {}).map(([id, f]) => (
          <ItemNav
            key={id}
            activo={esSel('fragmento', id)}
            onClick={() => setSel({ tipo: 'fragmento', id })}
            icono={Puzzle}
            insignia={f.condicion ? <GitBranch size={12} color="#b06000" /> : null}
          >
            {f.nombre}
          </ItemNav>
        ))}
        <button style={s.navAgregar} onClick={agregarFragmento}><Plus size={13} /> Agregar fragmento</button>

        <div style={s.navTitulo}>Formatos de persona</div>
        {Object.entries(contenido.formatosPersona || {}).map(([id, f]) => (
          <ItemNav key={id} activo={esSel('formato', id)} onClick={() => setSel({ tipo: 'formato', id })} icono={Users}>
            {f.nombre}
          </ItemNav>
        ))}
      </nav>

      {/* ── Panel de edición ── */}
      <div style={s.panel}>
        {sel.tipo === 'general' && (
          <div style={s.card}>
            <h3 style={s.h3}>General</h3>
            <Campo label="Título del documento">
              <input value={contenido.titulo || ''} onChange={(e) => actualizar((c) => { c.titulo = e.target.value; })} style={s.input} />
            </Campo>
            <div style={s.subTitulo}>Rol bajo cada firma</div>
            <div style={s.grid3}>
              {[['propietarios', 'Propietarios'], ['arrendatarios', 'Arrendatarios'], ['fiadores', 'Fiadores']].map(([k, label]) => (
                <Campo key={k} label={label}>
                  <input value={contenido.firmas?.[k] || ''} onChange={(e) => actualizar((c) => { c.firmas = { ...(c.firmas || {}), [k]: e.target.value }; })} style={s.input} />
                </Campo>
              ))}
            </div>
            <Ayuda />
          </div>
        )}

        {seccion && seccion.tipo === 'bloque' && (
          <div style={s.card}>
            <h3 style={s.h3}><Lock size={16} /> {NOMBRE_BLOQUE[seccion.bloque]}</h3>
            <p style={s.texto}>
              Este bloque se arma automáticamente con los nombres de las partes.
              {seccion.bloque === 'portada' ? ' El título se cambia en General.' : ' Los roles bajo cada firma se cambian en General.'}
            </p>
          </div>
        )}

        {seccion && seccion.tipo !== 'bloque' && (
          <div style={s.card}>
            <div style={s.cabecera}>
              <h3 style={s.h3}>
                {seccion.tipo === 'clausula' ? `${ordinal(numeros[seccion.id])}:` : 'Comparecencia'}
              </h3>
              <div style={s.acciones}>
                <BotonAccion titulo="Subir" onClick={() => moverSeccion(seccion.id, -1)}><ArrowUp size={15} /></BotonAccion>
                <BotonAccion titulo="Bajar" onClick={() => moverSeccion(seccion.id, 1)}><ArrowDown size={15} /></BotonAccion>
                {seccion.tipo === 'clausula' && (
                  confirmarBorrar === seccion.id ? (
                    <span style={s.confirmar}>
                      ¿Eliminar cláusula?
                      <button style={s.btnPeligro} onClick={() => borrarSeccion(seccion.id)}>Sí, eliminar</button>
                      <button style={s.btnSec} onClick={() => setConfirmarBorrar(null)}>No</button>
                    </span>
                  ) : (
                    <BotonAccion titulo="Eliminar cláusula" onClick={() => setConfirmarBorrar(seccion.id)} peligro><Trash2 size={15} /></BotonAccion>
                  )
                )}
              </div>
            </div>

            {seccion.tipo === 'clausula' && (
              <div style={s.grid2}>
                <Campo label="Título de la cláusula">
                  <input
                    value={seccion.titulo || ''}
                    onChange={(e) => actualizar((c) => { c.secciones.find((x) => x.id === seccion.id).titulo = e.target.value.toUpperCase(); })}
                    style={s.input}
                  />
                </Campo>
                <Campo label="¿Cuándo se incluye la cláusula?">
                  <SelectCondicion
                    value={seccion.condicion}
                    onChange={(v) => actualizar((c) => { c.secciones.find((x) => x.id === seccion.id).condicion = v; })}
                  />
                </Campo>
              </div>
            )}

            <EditorTexto
              key={seccion.id}
              doc={seccion.cuerpo}
              modo="bloque"
              alcance="general"
              contenido={contenido}
              onChange={(json) => actualizar((c) => { c.secciones.find((x) => x.id === seccion.id).cuerpo = json; })}
            />
          </div>
        )}

        {fragmento && (
          <div style={s.card}>
            <div style={s.cabecera}>
              <h3 style={s.h3}><Puzzle size={16} /> Fragmento</h3>
              {confirmarBorrar === sel.id ? (
                <span style={s.confirmar}>
                  ¿Eliminar fragmento?
                  <button style={s.btnPeligro} onClick={() => borrarFragmento(sel.id)}>Sí, eliminar</button>
                  <button style={s.btnSec} onClick={() => setConfirmarBorrar(null)}>No</button>
                </span>
              ) : (
                usosDeFragmento(contenido, sel.id) > 0
                  ? <span style={s.nota}>En uso en {usosDeFragmento(contenido, sel.id)} lugar(es): quítalo del texto para poder eliminarlo.</span>
                  : <BotonAccion titulo="Eliminar fragmento" onClick={() => setConfirmarBorrar(sel.id)} peligro><Trash2 size={15} /></BotonAccion>
              )}
            </div>
            <p style={s.texto}>
              Un fragmento es un trozo de texto que se inserta dentro de un párrafo (con el botón &quot;Fragmento&quot;) y aparece solo si se cumple su condición.
              Ojo con los espacios y la puntuación al inicio y al final.
            </p>
            <div style={s.grid2}>
              <Campo label="Nombre">
                <input
                  value={fragmento.nombre}
                  onChange={(e) => actualizar((c) => { c.fragmentos[sel.id].nombre = e.target.value; })}
                  style={s.input}
                />
              </Campo>
              <Campo label="¿Cuándo aparece?">
                <SelectCondicion
                  value={fragmento.condicion}
                  onChange={(v) => actualizar((c) => { c.fragmentos[sel.id].condicion = v; })}
                />
              </Campo>
            </div>
            <EditorTexto
              key={`frag-${sel.id}`}
              doc={fragmento.cuerpo}
              modo="linea"
              alcance="general"
              permitirFragmentos={false}
              contenido={contenido}
              onChange={(json) => actualizar((c) => { c.fragmentos[sel.id].cuerpo = json; })}
            />
          </div>
        )}

        {formato && (
          <div style={s.card}>
            <h3 style={s.h3}><Users size={16} /> {formato.nombre}</h3>
            <p style={s.texto}>
              Cómo se redacta cada persona cuando aparece en una lista. Si hay varias, se repite este texto para cada una,
              unidas por el separador.
            </p>
            <Campo label="Separador entre personas (incluye espacios)">
              <input
                value={formato.separador ?? ''}
                onChange={(e) => actualizar((c) => { c.formatosPersona[sel.id].separador = e.target.value; })}
                style={{ ...s.input, maxWidth: 160, fontFamily: 'monospace' }}
              />
            </Campo>
            <div style={{ height: 12 }} />
            <EditorTexto
              key={`fmt-${sel.id}`}
              doc={formato.cuerpo}
              modo="linea"
              alcance="persona"
              contenido={contenido}
              onChange={(json) => actualizar((c) => { c.formatosPersona[sel.id].cuerpo = json; })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Ayuda() {
  return (
    <div style={s.ayuda}>
      <div style={s.subTitulo}>Cómo funciona</div>
      <ul style={s.ul}>
        <li><span style={s.chipDemo('#e8f0fe', '#1a56c4')}>Dato</span> Valor del contrato (nombre, monto, fecha). Se puede mover o borrar, no editar.</li>
        <li><span style={s.chipDemo('#f3e8fd', '#7627bb')}>don / doña</span> Concordancia: la palabra cambia sola según género y número. Selecciónala para editar sus formas.</li>
        <li><span style={s.chipDemo('#e6f4ea', '#137333')}>⧉ Fragmento</span> Texto que aparece solo si se cumple una condición (por ejemplo, si hay fiador).</li>
        <li><span style={s.chipDemo('#fef7e0', '#a05a00')}>≡ Lista</span> Todas las personas de un grupo, redactadas según su formato.</li>
        <li>Párrafos con borde amarillo: se incluyen solo si se cumple la condición indicada.</li>
        <li>La numeración de cláusulas (PRIMERO, SEGUNDO…) se calcula sola.</li>
        <li>Para ver el resultado con distintos datos, usa la vista <b>Probar</b> con &quot;borrador sin guardar&quot;.</li>
      </ul>
    </div>
  );
}

function SelectCondicion({ value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={s.input}>
      <option value="">Siempre</option>
      {Object.entries(CONDICIONES).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
    </select>
  );
}

function ItemNav({ children, activo, onClick, icono: Icono, atenuado, insignia }) {
  return (
    <button onClick={onClick} style={{ ...s.navItem, ...(activo ? s.navItemActivo : {}), ...(atenuado ? { color: '#80868b' } : {}) }}>
      <Icono size={13} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={s.navTexto}>{children}</span>
      {insignia}
    </button>
  );
}

function BotonAccion({ children, onClick, titulo, peligro }) {
  return (
    <button onClick={onClick} title={titulo} style={{ ...s.btnAccion, ...(peligro ? { color: '#c5221f' } : {}) }}>
      {children}
    </button>
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
  layout: { flex: 1, display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' },
  nav: { width: 270, flexShrink: 0, overflowY: 'auto', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 1 },
  navTitulo: { fontSize: 10, fontWeight: 700, color: '#80868b', textTransform: 'uppercase', letterSpacing: 0.6, padding: '12px 8px 4px' },
  navItem: { display: 'flex', alignItems: 'flex-start', gap: 7, width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 12, color: '#3c4043', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.35 },
  navItemActivo: { background: '#e8f0fe', color: '#1a56c4' },
  navTexto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  ord: { fontSize: 10, letterSpacing: 0.3 },
  navAgregar: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', margin: '2px 0', border: '1px dashed #c6dafc', background: 'transparent', borderRadius: 6, fontSize: 12, color: '#1a73e8', cursor: 'pointer', fontFamily: 'inherit' },
  panel: { flex: 1, overflowY: 'auto', minWidth: 0 },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  cabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  h3: { margin: 0, fontSize: 16, fontWeight: 700, color: '#202124', display: 'flex', alignItems: 'center', gap: 8 },
  acciones: { display: 'flex', alignItems: 'center', gap: 4 },
  btnAccion: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid #dadce0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#3c4043' },
  confirmar: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#c5221f', fontWeight: 600 },
  btnPeligro: { padding: '5px 10px', background: '#c5221f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { padding: '5px 10px', background: '#fff', color: '#3c4043', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  grid2: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 },
  label: { fontSize: 11, fontWeight: 600, color: '#5f6368' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #dadce0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  subTitulo: { fontSize: 12, fontWeight: 700, color: '#3c4043', marginTop: 4 },
  texto: { fontSize: 13, color: '#5f6368', lineHeight: 1.5, margin: 0 },
  nota: { fontSize: 12, color: '#80868b' },
  ayuda: { marginTop: 8, padding: 14, background: '#f8f9fa', borderRadius: 8 },
  ul: { margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: '#3c4043', lineHeight: 1.9 },
  chipDemo: (bg, color) => ({ display: 'inline-block', padding: '0 6px', borderRadius: 10, fontSize: 12, background: bg, color, marginRight: 4 }),
};
