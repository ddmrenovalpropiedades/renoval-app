// ════════════════════════════════════════════════════════════════
// Motor de render: plantilla + datos → bloques (representación única)
// La vista previa (React) y el Word (.docx) se construyen desde estos
// mismos bloques, así que siempre coinciden.
//
// Bloque: { tipo, segs?, texto? }
//   tipo: 'linea' | 'titulo_doc' | 'centrado' | 'titulo_clausula' | 'parrafo'
// Segmento: { t, b, falta? }
// ════════════════════════════════════════════════════════════════
import { PH } from './formato';
import {
  construirContexto, VARIABLES, VARIABLES_PERSONA, GRUPOS_PERSONA,
  resolverConcordancia, cumpleCondicion,
} from './variables';

// ── Ordinales de cláusulas ──────────────────────────────────────
const ORD_UNIDAD = ['', 'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO'];
const ORD_DECENA = ['', 'DÉCIMO', 'VIGÉSIMO', 'TRIGÉSIMO', 'CUADRAGÉSIMO'];

export function ordinal(n) {
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 0) return ORD_UNIDAD[u];
  return ORD_DECENA[d] + (u ? ` ${ORD_UNIDAD[u]}` : '');
}

// ── Helpers de segmentos ────────────────────────────────────────
const tieneNegrita = (nodo) => (nodo.marks || []).some((m) => m.type === 'bold');

function aSegmentos(valor, negrita) {
  if (valor === null || valor === undefined || valor === '') {
    return [{ t: PH, b: negrita, falta: true }];
  }
  if (Array.isArray(valor)) {
    return valor.map((s) => ({ ...s, b: negrita || s.b }));
  }
  return [{ t: String(valor), b: negrita }];
}

// Une segmentos contiguos con el mismo formato
function compactar(segs) {
  const out = [];
  segs.forEach((s) => {
    if (!s.t) return;
    const ult = out[out.length - 1];
    if (ult && ult.b === s.b && !!ult.falta === !!s.falta) ult.t += s.t;
    else out.push({ ...s });
  });
  return out;
}

// ── Render de contenido inline ──────────────────────────────────
// env: { ctx, contenido, persona, profundidad }
function renderInline(nodos, env) {
  const segs = [];
  (nodos || []).forEach((nodo) => {
    const negrita = tieneNegrita(nodo);

    switch (nodo.type) {
      case 'text':
        segs.push({ t: nodo.text, b: negrita });
        break;

      case 'hardBreak':
        segs.push({ t: '\n', b: negrita });
        break;

      case 'variable': {
        const id = nodo.attrs?.id;
        if (VARIABLES_PERSONA[id]) {
          const valor = env.persona ? VARIABLES_PERSONA[id].valor(env.persona) : null;
          segs.push(...aSegmentos(valor, negrita));
        } else if (VARIABLES[id]) {
          segs.push(...aSegmentos(VARIABLES[id].valor(env.ctx), negrita));
        } else {
          segs.push({ t: `{{${id}}}`, b: negrita, falta: true });
        }
        break;
      }

      case 'concordancia':
        segs.push({ t: resolverConcordancia(nodo.attrs || {}, env.ctx, env.persona) || '', b: negrita });
        break;

      case 'lista': {
        const formato = env.contenido.formatosPersona?.[nodo.attrs?.formato];
        const grupo = formato && GRUPOS_PERSONA[formato.grupo];
        if (!formato || !grupo || env.profundidad > 3) break;
        const personas = grupo.lista(env.ctx);
        personas.forEach((persona, i) => {
          if (i > 0) segs.push({ t: formato.separador ?? ' ', b: negrita });
          const interior = renderInline(formato.cuerpo?.content?.[0]?.content, {
            ...env, persona, profundidad: env.profundidad + 1,
          });
          segs.push(...interior.map((s) => ({ ...s, b: negrita || s.b })));
        });
        break;
      }

      case 'fragmento': {
        const frag = env.contenido.fragmentos?.[nodo.attrs?.id];
        if (!frag || env.profundidad > 3 || !cumpleCondicion(frag.condicion, env.ctx)) break;
        const interior = renderInline(frag.cuerpo?.content?.[0]?.content, {
          ...env, profundidad: env.profundidad + 1,
        });
        segs.push(...interior.map((s) => ({ ...s, b: negrita || s.b })));
        break;
      }

      default:
        break;
    }
  });
  return segs;
}

// ── Párrafos de una sección (con condición y numeración de ítems) ──
function renderCuerpo(cuerpo, env) {
  const bloques = [];
  let item = 0;
  (cuerpo?.content || []).forEach((par) => {
    if (par.type !== 'paragraph') return;
    if (!cumpleCondicion(par.attrs?.condicion, env.ctx)) return;
    let segs = renderInline(par.content, env);
    if (par.attrs?.item) {
      item += 1;
      segs = [{ t: `${item}- `, b: true }, ...segs];
    }
    if (!segs.length) return;
    bloques.push({ tipo: 'parrafo', segs: compactar(segs) });
  });
  return bloques;
}

// ── Bloques generados por código ────────────────────────────────
const linea = () => ({ tipo: 'linea' });
const centrado = (t) => ({ tipo: 'centrado', segs: [{ t, b: true }] });

function bloquePortada(contenido, ctx) {
  const nombres = (lista, defecto) => lista.map((p) => centrado(p.nombre || defecto));
  return [
    linea(), linea(),
    { tipo: 'titulo_doc', texto: contenido.titulo || '' },
    linea(), linea(),
    ...nombres(ctx.propietarios, 'PROPIETARIO'),
    centrado('A'),
    ...nombres(ctx.arrendatarios, 'ARRENDATARIO'),
    ...nombres(ctx.fiadores, 'FIADOR'),
    linea(),
  ];
}

function bloqueFirmas(contenido, ctx) {
  const roles = contenido.firmas || {};
  const firma = (nombre, rol) => [
    linea(), linea(), linea(), linea(),
    { tipo: 'centrado', segs: [{ t: '_________________________________________________', b: false }] },
    centrado(nombre.toUpperCase()),
    centrado(rol || ''),
    linea(), linea(),
  ];
  return [
    linea(), linea(), linea(), linea(), linea(),
    ...ctx.propietarios.flatMap((p) => firma(p.nombre || 'PROPIETARIO', roles.propietarios)),
    ...ctx.arrendatarios.flatMap((a) => firma(a.nombre || 'ARRENDATARIO', roles.arrendatarios)),
    ...ctx.fiadores.flatMap((f) => firma(f.nombre || 'FIADOR', roles.fiadores)),
  ];
}

const BLOQUES = { portada: bloquePortada, firmas: bloqueFirmas };

// ── Punto de entrada ────────────────────────────────────────────
export function renderPlantilla(contenido, data) {
  const ctx = construirContexto(data);
  const env = { ctx, contenido, persona: null, profundidad: 0 };
  const bloques = [];
  let numClausula = 0;

  (contenido.secciones || []).forEach((sec) => {
    if (!cumpleCondicion(sec.condicion, ctx)) return;

    if (sec.tipo === 'bloque') {
      const fn = BLOQUES[sec.bloque];
      if (fn) bloques.push(...fn(contenido, ctx));
      return;
    }

    if (sec.tipo === 'clausula') {
      numClausula += 1;
      bloques.push({ tipo: 'titulo_clausula', texto: `${ordinal(numClausula)}: ${sec.titulo || ''}` });
    }

    bloques.push(...renderCuerpo(sec.cuerpo, env));
    if (sec.lineaDespues) bloques.push(linea());
  });

  return bloques;
}

// Cantidad de datos faltantes (para advertir antes de descargar)
export function contarFaltantes(bloques) {
  return bloques.reduce((n, bl) => n + (bl.segs || []).filter((s) => s.falta).length, 0);
}
