// ════════════════════════════════════════════════════════════════
// Editor de texto de plantilla (TipTap) con barra de herramientas
//
// props:
//   doc        JSON TipTap inicial (el componente se remonta con key al cambiar de sección)
//   onChange   (json) => void
//   modo       'bloque' (varios párrafos, con condición/ítem) | 'linea' (un párrafo)
//   alcance    'general' (variables del contrato) | 'persona' (variables de la persona)
//   contenido  plantilla completa (nombres de fragmentos y formatos de persona)
//   permitirFragmentos  bool
// ════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Bold, Undo2, Redo2, Braces, Languages, Puzzle, Users, ChevronDown } from 'lucide-react';
import { extensionesPlantilla, CSS_EDITOR, formasUnicas } from './extensiones';
import { VARIABLES, VARIABLES_PERSONA, CONDICIONES, REFERENCIAS } from './variables';

const REFS_GENERAL = ['propietarios', 'arrendatarios', 'fiadores', 'inmueble'];
const REFS_PERSONA = ['persona'];

export default function EditorTexto({
  doc, onChange, modo = 'bloque', alcance = 'general', contenido, permitirFragmentos = true,
}) {
  const onChangeRef = useRef(onChange);
  const contenidoRef = useRef(contenido);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { contenidoRef.current = contenido; }, [contenido]);

  const extensiones = useMemo(
    () => extensionesPlantilla({ modo, contexto: () => contenidoRef.current || {} }),
    [modo],
  );

  const editor = useEditor({
    extensions: extensiones,
    content: doc,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: ed }) => onChangeRef.current(ed.getJSON()),
  });

  const [menu, setMenu] = useState(null); // 'dato' | 'frag' | 'lista' | 'conc'
  const [formConc, setFormConc] = useState(null);

  if (!editor) return null;

  const insertar = (nodo) => {
    editor.chain().focus().insertContent(nodo).run();
    setMenu(null);
  };

  // ── Concordancia: abrir formulario (nuevo o editar el chip seleccionado) ──
  const sel = editor.state.selection;
  const chipSel = sel.node && ['variable', 'concordancia', 'fragmento', 'lista'].includes(sel.node.type.name) ? sel.node : null;

  const abrirConcordanciaNueva = () => {
    const texto = editor.state.doc.textBetween(sel.from, sel.to, ' ').trim();
    const refs = alcance === 'persona' ? REFS_PERSONA : REFS_GENERAL;
    setFormConc({ editando: false, ref: refs[0], sm: texto, sf: texto, pm: texto, pf: texto });
    setMenu('conc');
  };

  const abrirConcordanciaEdicion = () => {
    setFormConc({ editando: true, ...chipSel.attrs });
    setMenu('conc');
  };

  const aplicarConcordancia = () => {
    const { editando, ...attrs } = formConc;
    if (editando) editor.chain().focus().updateAttributes('concordancia', attrs).run();
    else editor.chain().focus().insertContent({ type: 'concordancia', attrs }).run();
    setMenu(null);
    setFormConc(null);
  };

  // ── Atributos del párrafo actual ──
  const attrsParrafo = editor.getAttributes('paragraph');
  const setAttrParrafo = (k, v) => editor.chain().focus().updateAttributes('paragraph', { [k]: v }).run();

  const variables = alcance === 'persona' ? VARIABLES_PERSONA : VARIABLES;
  const grupos = {};
  Object.entries(variables).forEach(([id, v]) => {
    const g = v.grupo || 'Persona';
    (grupos[g] = grupos[g] || []).push([id, v]);
  });

  const fragmentos = Object.entries(contenido?.fragmentos || {});
  const formatos = Object.entries(contenido?.formatosPersona || {});
  const refsDisponibles = alcance === 'persona' ? REFS_PERSONA : REFS_GENERAL;

  return (
    <div style={s.wrap}>
      <style>{CSS_EDITOR}</style>

      {/* ── Barra de herramientas ── */}
      <div style={s.toolbar}>
        <BotonIcono activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} titulo="Negrita (Ctrl+B)">
          <Bold size={15} />
        </BotonIcono>
        <BotonIcono onClick={() => editor.chain().focus().undo().run()} titulo="Deshacer (Ctrl+Z)" deshabilitado={!editor.can().undo()}>
          <Undo2 size={15} />
        </BotonIcono>
        <BotonIcono onClick={() => editor.chain().focus().redo().run()} titulo="Rehacer (Ctrl+Y)" deshabilitado={!editor.can().redo()}>
          <Redo2 size={15} />
        </BotonIcono>
        <div style={s.sep} />

        <Menu abierto={menu === 'dato'} onToggle={() => setMenu(menu === 'dato' ? null : 'dato')} etiqueta="Dato" icono={Braces} color="#1a56c4" onCerrar={() => setMenu(null)}>
          {Object.entries(grupos).map(([g, items]) => (
            <div key={g}>
              <div style={s.menuGrupo}>{g}</div>
              {items.map(([id, v]) => (
                <button key={id} style={s.menuItem} onMouseDown={(e) => { e.preventDefault(); insertar({ type: 'variable', attrs: { id } }); }}>
                  <span>{v.label}</span>
                  <span style={s.menuEjemplo}>{v.ejemplo}</span>
                </button>
              ))}
            </div>
          ))}
        </Menu>

        <button style={{ ...s.btnMenu, color: '#7627bb' }} onMouseDown={(e) => { e.preventDefault(); abrirConcordanciaNueva(); }} title="Palabra que cambia según género o número (selecciona la palabra antes)">
          <Languages size={14} /> Concordancia
        </button>

        {alcance === 'general' && permitirFragmentos && (
          <Menu abierto={menu === 'frag'} onToggle={() => setMenu(menu === 'frag' ? null : 'frag')} etiqueta="Fragmento" icono={Puzzle} color="#137333" onCerrar={() => setMenu(null)}>
            {fragmentos.length === 0 && <div style={s.menuVacio}>No hay fragmentos</div>}
            {fragmentos.map(([id, f]) => (
              <button key={id} style={s.menuItem} onMouseDown={(e) => { e.preventDefault(); insertar({ type: 'fragmento', attrs: { id } }); }}>
                <span>{f.nombre}</span>
                <span style={s.menuEjemplo}>{CONDICIONES[f.condicion]?.label || 'Siempre'}</span>
              </button>
            ))}
          </Menu>
        )}

        {alcance === 'general' && (
          <Menu abierto={menu === 'lista'} onToggle={() => setMenu(menu === 'lista' ? null : 'lista')} etiqueta="Lista de personas" icono={Users} color="#a05a00" onCerrar={() => setMenu(null)}>
            {formatos.map(([id, f]) => (
              <button key={id} style={s.menuItem} onMouseDown={(e) => { e.preventDefault(); insertar({ type: 'lista', attrs: { formato: id } }); }}>
                <span>{f.nombre}</span>
              </button>
            ))}
          </Menu>
        )}

        {modo === 'bloque' && (
          <>
            <div style={s.sep} />
            <label style={s.ctrlLabel}>Párrafo:</label>
            <select
              value={attrsParrafo.condicion || ''}
              onChange={(e) => setAttrParrafo('condicion', e.target.value || null)}
              style={s.ctrlSelect}
              title="Cuándo se incluye el párrafo donde está el cursor"
            >
              <option value="">Siempre</option>
              {Object.entries(CONDICIONES).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
            </select>
            <label style={s.ctrlCheck} title="Numera el párrafo como 1-, 2-, … dentro de la cláusula">
              <input type="checkbox" checked={!!attrsParrafo.item} onChange={(e) => setAttrParrafo('item', e.target.checked)} />
              Ítem numerado
            </label>
          </>
        )}
      </div>

      {/* ── Formulario de concordancia ── */}
      {menu === 'conc' && formConc && (
        <div style={s.panelConc}>
          <div style={s.panelTitulo}>{formConc.editando ? 'Editar concordancia' : 'Nueva concordancia'}</div>
          <div style={s.concGrid}>
            <label style={s.concLabel}>Se refiere a</label>
            <select value={formConc.ref} onChange={(e) => setFormConc({ ...formConc, ref: e.target.value })} style={s.ctrlSelect}>
              {refsDisponibles.map((r) => <option key={r} value={r}>{REFERENCIAS[r].label}</option>)}
            </select>
            {[
              ['sm', 'Uno, hombre'],
              ['sf', 'Una, mujer'],
              ['pm', 'Varios (al menos un hombre)'],
              ['pf', 'Varias (todas mujeres)'],
            ].map(([k, label]) => (
              <CampoForma key={k} label={label} value={formConc[k] ?? ''} onChange={(v) => setFormConc({ ...formConc, [k]: v })} />
            ))}
          </div>
          <div style={s.panelAcciones}>
            <button style={s.btnSec} onClick={() => { setMenu(null); setFormConc(null); }}>Cancelar</button>
            <button style={s.btnPri} onClick={aplicarConcordancia}>{formConc.editando ? 'Actualizar' : 'Insertar'}</button>
          </div>
        </div>
      )}

      {/* ── Info del chip seleccionado ── */}
      {chipSel && menu !== 'conc' && (
        <div style={s.chipInfo}>
          <InfoChip nodo={chipSel} contenido={contenido} />
          {chipSel.type.name === 'concordancia' && (
            <button style={s.btnLink} onClick={abrirConcordanciaEdicion}>Editar formas</button>
          )}
          <button style={{ ...s.btnLink, color: '#c5221f' }} onClick={() => editor.chain().focus().deleteSelection().run()}>Quitar</button>
        </div>
      )}

      <div className={`plt-editor ${modo}`} style={s.area}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function InfoChip({ nodo, contenido }) {
  const a = nodo.attrs;
  switch (nodo.type.name) {
    case 'variable': {
      const v = VARIABLES[a.id] || VARIABLES_PERSONA[a.id];
      return <span><b>Dato:</b> {v?.label || a.id} {v?.ejemplo && <span style={s.menuEjemplo}>— ej.: {v.ejemplo}</span>}</span>;
    }
    case 'concordancia':
      return <span><b>Concordancia</b> ({REFERENCIAS[a.ref]?.label || a.ref}): {formasUnicas(a).join(' / ')}</span>;
    case 'fragmento': {
      const f = contenido?.fragmentos?.[a.id];
      return <span><b>Fragmento:</b> {f?.nombre || a.id} — {CONDICIONES[f?.condicion]?.label || 'Siempre'}. Se edita en la sección Fragmentos.</span>;
    }
    case 'lista':
      return <span><b>Lista de personas:</b> {contenido?.formatosPersona?.[a.formato]?.nombre || a.formato}. Se edita en Formatos de persona.</span>;
    default:
      return null;
  }
}

function CampoForma({ label, value, onChange }) {
  return (
    <>
      <label style={s.concLabel}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={s.concInput} />
    </>
  );
}

function BotonIcono({ children, onClick, titulo, activo, deshabilitado }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); if (!deshabilitado) onClick(); }}
      title={titulo}
      style={{ ...s.btnIcono, ...(activo ? s.btnIconoActivo : {}), ...(deshabilitado ? { opacity: 0.35, cursor: 'default' } : {}) }}
    >
      {children}
    </button>
  );
}

function Menu({ abierto, onToggle, onCerrar, etiqueta, icono: Icono, color, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <button style={{ ...s.btnMenu, color }} onMouseDown={(e) => { e.preventDefault(); onToggle(); }}>
        <Icono size={14} /> {etiqueta} <ChevronDown size={12} />
      </button>
      {abierto && (
        <>
          <div style={s.overlay} onMouseDown={onCerrar} />
          <div style={s.menuPanel}>{children}</div>
        </>
      )}
    </div>
  );
}

const s = {
  wrap: { border: '1px solid #dadce0', borderRadius: 10, background: '#fff', display: 'flex', flexDirection: 'column' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '6px 8px', borderBottom: '1px solid #e8eaed', background: '#f8f9fa', borderRadius: '10px 10px 0 0' },
  sep: { width: 1, height: 20, background: '#dadce0', margin: '0 4px' },
  btnIcono: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: '#3c4043' },
  btnIconoActivo: { background: '#e8f0fe', color: '#1a73e8' },
  btnMenu: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, zIndex: 40 },
  menuPanel: { position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4, background: '#fff', border: '1px solid #dadce0', borderRadius: 8, boxShadow: '0 4px 16px rgba(60,64,67,0.2)', minWidth: 280, maxHeight: 360, overflowY: 'auto', padding: 4 },
  menuGrupo: { fontSize: 10, fontWeight: 700, color: '#80868b', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 8px 4px' },
  menuItem: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 13, color: '#202124', cursor: 'pointer', fontFamily: 'inherit' },
  menuEjemplo: { fontSize: 11, color: '#80868b' },
  menuVacio: { padding: 8, fontSize: 12, color: '#80868b' },
  ctrlLabel: { fontSize: 12, color: '#5f6368', marginLeft: 2 },
  ctrlSelect: { border: '1px solid #dadce0', borderRadius: 6, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit', background: '#fff', maxWidth: 220 },
  ctrlCheck: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#3c4043', cursor: 'pointer', marginLeft: 6 },
  panelConc: { margin: 8, padding: 12, border: '1px solid #e3ccf8', background: '#faf5ff', borderRadius: 8 },
  panelTitulo: { fontSize: 13, fontWeight: 700, color: '#7627bb', marginBottom: 8 },
  concGrid: { display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: '6px 10px', alignItems: 'center' },
  concLabel: { fontSize: 12, color: '#5f6368' },
  concInput: { border: '1px solid #dadce0', borderRadius: 6, padding: '5px 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 0 },
  panelAcciones: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  btnPri: { padding: '6px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { padding: '6px 12px', background: '#fff', color: '#3c4043', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  chipInfo: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '6px 10px', fontSize: 12, color: '#3c4043', background: '#f1f3f4', borderBottom: '1px solid #e8eaed' },
  btnLink: { border: 'none', background: 'none', color: '#1a73e8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  area: { padding: '12px 14px' },
};
