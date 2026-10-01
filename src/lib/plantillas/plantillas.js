// ════════════════════════════════════════════════════════════════
// Extensiones TipTap del editor de plantillas
//
// - Párrafo con atributos: condicion (cuándo se incluye) e item (1-, 2-…)
// - Chips bloqueados (átomos): variable, concordancia, fragmento, lista.
//   Se pueden mover, borrar o poner en negrita, pero no editar por dentro.
// El JSON resultante es exactamente el que consume render.js.
// ════════════════════════════════════════════════════════════════
import { Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { VARIABLES, VARIABLES_PERSONA, CONDICIONES, REFERENCIAS } from './variables';

// ── Documento: 'bloque' = varios párrafos; 'linea' = un solo párrafo ──
const crearDocumento = (modo) => Node.create({
  name: 'doc',
  topNode: true,
  content: modo === 'linea' ? 'paragraph' : 'paragraph+',
});

// ── Párrafo con condición e ítem numerado ───────────────────────
const Parrafo = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  priority: 1000,

  addAttributes() {
    return {
      condicion: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-condicion') || null,
        renderHTML: (a) => (a.condicion
          ? { 'data-condicion': a.condicion, 'data-condicion-label': CONDICIONES[a.condicion]?.label || a.condicion }
          : {}),
      },
      item: {
        default: false,
        parseHTML: (el) => el.hasAttribute('data-item'),
        renderHTML: (a) => (a.item ? { 'data-item': '' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0];
  },
});

// ── Fábrica de chips ────────────────────────────────────────────
// attrs: lista de nombres de atributo → se guardan como data-<nombre>
function crearChip({ nombre, clase, attrs, etiqueta }) {
  return Node.create({
    name: nombre,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
      return { contexto: () => ({}) };
    },

    addAttributes() {
      const out = {};
      attrs.forEach((a) => {
        out[a] = {
          default: null,
          parseHTML: (el) => el.getAttribute(`data-${a}`),
          renderHTML: (v) => (v[a] !== null && v[a] !== undefined ? { [`data-${a}`]: v[a] } : {}),
        };
      });
      return out;
    },

    parseHTML() {
      return [{ tag: `span[data-chip="${nombre}"]` }];
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        mergeAttributes({ 'data-chip': nombre, class: `chip ${clase}`, contenteditable: 'false' }, HTMLAttributes),
        etiqueta(node.attrs, this.options.contexto()),
      ];
    },

    renderText({ node }) {
      return `[${etiqueta(node.attrs, this.options.contexto())}]`;
    },
  });
}

export const formasUnicas = (a) => [...new Set([a.sm, a.sf, a.pm, a.pf].filter((x) => x !== null && x !== undefined))];

const Variable = crearChip({
  nombre: 'variable',
  clase: 'chip-var',
  attrs: ['id'],
  etiqueta: (a) => VARIABLES[a.id]?.label || VARIABLES_PERSONA[a.id]?.label || `¿${a.id}?`,
});

const Concordancia = crearChip({
  nombre: 'concordancia',
  clase: 'chip-conc',
  attrs: ['ref', 'sm', 'sf', 'pm', 'pf'],
  etiqueta: (a) => formasUnicas(a).join(' / ') || '(vacío)',
});

const Fragmento = crearChip({
  nombre: 'fragmento',
  clase: 'chip-frag',
  attrs: ['id'],
  etiqueta: (a, ctx) => `⧉ ${ctx.fragmentos?.[a.id]?.nombre || a.id}`,
});

const Lista = crearChip({
  nombre: 'lista',
  clase: 'chip-lista',
  attrs: ['formato'],
  etiqueta: (a, ctx) => `≡ ${ctx.formatosPersona?.[a.formato]?.nombre || a.formato}`,
});

// ── Conjunto de extensiones para un editor ──────────────────────
// contexto(): devuelve { fragmentos, formatosPersona } para las etiquetas
export function extensionesPlantilla({ modo = 'bloque', contexto = () => ({}) } = {}) {
  return [
    StarterKit.configure({
      document: false,
      paragraph: false,
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      italic: false,
      strike: false,
      underline: false,
      link: false,
      hardBreak: false,
      trailingNode: false,
    }),
    crearDocumento(modo),
    Parrafo,
    Variable.configure({ contexto }),
    Concordancia.configure({ contexto }),
    Fragmento.configure({ contexto }),
    Lista.configure({ contexto }),
  ];
}

export { REFERENCIAS, CONDICIONES };

// ── Estilos del contenido del editor (se inyectan con <style>) ──
export const CSS_EDITOR = `
.plt-editor .ProseMirror { outline: none; min-height: 120px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #202124; counter-reset: item; }
.plt-editor.linea .ProseMirror { min-height: 0; }
.plt-editor .ProseMirror p { margin: 0 0 10px; text-align: justify; padding: 2px 6px; border-left: 3px solid transparent; border-radius: 3px; }
.plt-editor .ProseMirror p:last-child { margin-bottom: 0; }
.plt-editor .ProseMirror p[data-condicion] { border-left-color: #f9ab00; background: #fffbeb; }
.plt-editor .ProseMirror p[data-condicion]::before { content: attr(data-condicion-label); display: block; font-size: 10px; font-weight: 700; color: #b06000; text-transform: uppercase; letter-spacing: .4px; font-family: 'Google Sans','Segoe UI',sans-serif; margin-bottom: 2px; }
.plt-editor .ProseMirror p[data-item] { counter-increment: item; position: relative; padding-right: 64px; }
.plt-editor .ProseMirror p[data-item]::after { content: "ÍTEM " counter(item) "-"; position: absolute; right: 6px; top: 2px; font-size: 10px; font-weight: 700; color: #1a73e8; background: #e8f0fe; padding: 0 5px; border-radius: 4px; font-family: 'Google Sans','Segoe UI',sans-serif; }
.plt-editor .chip { display: inline-block; padding: 0 6px; margin: 0 1px; border-radius: 10px; font-size: 12px; line-height: 18px; font-family: 'Google Sans','Segoe UI',sans-serif; cursor: grab; user-select: none; white-space: nowrap; vertical-align: baseline; }
.plt-editor strong .chip { font-weight: 700; }
.plt-editor .chip-var { background: #e8f0fe; color: #1a56c4; border: 1px solid #c6dafc; }
.plt-editor .chip-conc { background: #f3e8fd; color: #7627bb; border: 1px solid #e3ccf8; }
.plt-editor .chip-frag { background: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
.plt-editor .chip-lista { background: #fef7e0; color: #a05a00; border: 1px solid #fde49b; }
.plt-editor .ProseMirror-selectednode.chip { outline: 2px solid #1a73e8; outline-offset: 1px; }
`;
