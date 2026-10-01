// ════════════════════════════════════════════════════════════════
// Catálogo de variables, condiciones y concordancias (contrato de arriendo)
//
// - VARIABLES: datos que cambian en cada contrato. En el editor aparecen
//   como chips bloqueados; el texto alrededor es libre.
// - VARIABLES_PERSONA: se usan dentro de los "formatos de persona"
//   (cómo se redacta cada propietario / arrendatario / fiador).
// - REFERENCIAS: a quién se refiere una concordancia (género / número).
// - CONDICIONES: cuándo se incluye una sección, párrafo o fragmento.
// ════════════════════════════════════════════════════════════════
import { PH, formatFecha, sumarMesesISO, formatMonto, buildDomicilio } from './formato';

// Segmentos de texto: { t: texto, b: negrita, falta: dato faltante }
const r = (t) => ({ t, b: false });
const b = (t) => ({ t, b: true });
const falta = (bold) => ({ t: PH, b: bold, falta: true });

// ── Contexto: todos los valores derivados se calculan una sola vez ──
export function construirContexto(data = {}) {
  const propietarios = data.propietarios || [];
  const arrendatarios = data.arrendatarios || [];
  const fiadores = data.fiadores || [];
  const propiedad = data.propiedad || {};
  const moneda = propiedad.monedaArriendo === 'UF' ? 'UF' : 'CLP';
  return {
    propietarios,
    arrendatarios,
    fiadores,
    propiedad,
    moneda,
    inicio: formatFecha(propiedad.fechaInicio),
    fin: formatFecha(sumarMesesISO(propiedad.fechaInicio, 12)),
    renta: formatMonto(propiedad.arriendo, moneda),
    garantia: formatMonto(propiedad.garantia || propiedad.arriendo, moneda),
    promo: formatMonto(propiedad.promo, moneda),
    tieneExtras: !!(propiedad.bodega || propiedad.estacionamiento),
  };
}

// ── Descripción del inmueble (cláusula PRIMERO) ─────────────────
// Lógica gramatical compleja → se genera en código, aparece como un chip.
function descripcionInmueble(ctx) {
  const p = ctx.propiedad;
  const tipo = p.tipoProp || 'departamento';
  const esCasa = tipo === 'casa';
  const articulo = tipo === 'departamento' ? 'del ' : 'de la ';
  const calle = p.calle ? b(p.calle) : falta(true);
  const segs = [];

  if (!p.numeroProp && !ctx.tieneExtras) {
    segs.push(r('del inmueble ubicado en '), calle);
  } else if (p.numeroProp && !ctx.tieneExtras) {
    segs.push(r(articulo), b(tipo), r(' '), b(p.numeroProp), r(`, ubicad${esCasa ? 'a' : 'o'} en `), calle);
  } else {
    segs.push(r(articulo), b(tipo));
    if (p.numeroProp) segs.push(r(' '), b(p.numeroProp));
    if (p.bodega) segs.push(r(', bodega '), b(p.bodega));
    if (p.estacionamiento) segs.push(r(', estacionamiento '), b(p.estacionamiento));
    segs.push(r(', todos ubicados en '), calle);
  }
  return segs;
}

// ── Variables generales ─────────────────────────────────────────
// valor(ctx) → string | null (null = dato faltante) | array de segmentos
export const VARIABLES = {
  fecha_dia:     { grupo: 'Fechas', label: 'Día de inicio',  ejemplo: '01',      valor: (c) => c.inicio?.dia },
  fecha_mes:     { grupo: 'Fechas', label: 'Mes de inicio',  ejemplo: 'Junio',   valor: (c) => c.inicio?.mes },
  fecha_anio:    { grupo: 'Fechas', label: 'Año de inicio',  ejemplo: '2026',    valor: (c) => c.inicio?.anio },
  fin_dia:       { grupo: 'Fechas', label: 'Día de término (12 meses)', ejemplo: '01',    valor: (c) => c.fin?.dia },
  fin_mes:       { grupo: 'Fechas', label: 'Mes de término (12 meses)', ejemplo: 'Junio', valor: (c) => c.fin?.mes },
  fin_anio:      { grupo: 'Fechas', label: 'Año de término (12 meses)', ejemplo: '2027',  valor: (c) => c.fin?.anio },

  renta_numero:      { grupo: 'Montos', label: 'Renta (número)',      ejemplo: '$450.000',  valor: (c) => c.renta?.numero },
  renta_palabras:    { grupo: 'Montos', label: 'Renta (palabras)',    ejemplo: 'cuatrocientos cincuenta mil pesos', valor: (c) => c.renta?.palabras },
  garantia_numero:   { grupo: 'Montos', label: 'Garantía (número)',   ejemplo: '$450.000',  valor: (c) => c.garantia?.numero },
  garantia_palabras: { grupo: 'Montos', label: 'Garantía (palabras)', ejemplo: 'cuatrocientos cincuenta mil pesos', valor: (c) => c.garantia?.palabras },
  promo_numero:      { grupo: 'Montos', label: 'Renta promocional (número)',   ejemplo: '$350.000', valor: (c) => c.promo?.numero },
  promo_palabras:    { grupo: 'Montos', label: 'Renta promocional (palabras)', ejemplo: 'trescientos cincuenta mil pesos', valor: (c) => c.promo?.palabras },
  meses_promo:       { grupo: 'Montos', label: 'Meses de promoción',  ejemplo: 'enero y febrero de 2026', valor: (c) => c.propiedad.mesesPromo || null },
  periodo_reajuste:  { grupo: 'Montos', label: 'Periodicidad reajuste (seis/doce)', ejemplo: 'seis',
    valor: (c) => (c.propiedad.reajuste === 'IPC (cada 12 meses)' ? 'doce' : 'seis') },

  descripcion_inmueble: { grupo: 'Inmueble', label: 'Descripción del inmueble (automática)', ejemplo: 'del departamento 502, ubicado en Av. Providencia 1234', valor: descripcionInmueble },
  calle_prop:   { grupo: 'Inmueble', label: 'Dirección', ejemplo: 'Av. Providencia 1234', valor: (c) => c.propiedad.calle || null },
  comuna_prop:  { grupo: 'Inmueble', label: 'Comuna',    ejemplo: 'Providencia',          valor: (c) => c.propiedad.comunaProp || null },
  region_prop:  { grupo: 'Inmueble', label: 'Región',    ejemplo: 'Región Metropolitana', valor: (c) => c.propiedad.regionProp || null },
};

// ── Variables de persona (solo dentro de formatos de persona) ───
export const VARIABLES_PERSONA = {
  p_nombre:       { label: 'Nombre',       ejemplo: 'CARLOS MUÑOZ REYES', valor: (p) => p.nombre || null },
  p_rut:          { label: 'RUT',          ejemplo: '12.345.678-9',       valor: (p) => p.rut || null },
  p_nacionalidad: { label: 'Nacionalidad', ejemplo: 'chilena',            valor: (p) => p.nacionalidad || 'chilena' },
  p_domicilio:    { label: 'Domicilio',    ejemplo: 'Calle Moneda 890, comuna de Santiago, Región Metropolitana', valor: (p) => buildDomicilio(p) },
  p_telefono:     { label: 'Teléfono (8 dígitos)', ejemplo: '98765432',  valor: (p) => p.telefono || 'XXXXXXXX' },
  p_email:        { label: 'Email',        ejemplo: 'correo@ejemplo.com', valor: (p) => p.email || null },
};

// ── Concordancia gramatical ─────────────────────────────────────
// Cada referencia indica si el sujeto es plural y/o femenino.
// Grupo femenino solo si TODOS sus integrantes son mujeres.
const grupo = (lista) => ({
  plural: lista.length > 1,
  femenino: lista.length > 0 && lista.every((p) => p.genero === 'F'),
});

export const REFERENCIAS = {
  propietarios:  { label: 'Propietarios',  resolver: (c) => grupo(c.propietarios) },
  arrendatarios: { label: 'Arrendatarios', resolver: (c) => grupo(c.arrendatarios) },
  fiadores:      { label: 'Fiadores',      resolver: (c) => grupo(c.fiadores) },
  inmueble:      { label: 'Inmueble (plural si incluye bodega o estacionamiento)', resolver: (c) => ({ plural: c.tieneExtras, femenino: false }) },
  persona:       { label: 'La persona (dentro de un formato de persona)', resolver: (c, persona) => ({ plural: false, femenino: persona?.genero === 'F' }) },
};

// attrs de un nodo concordancia: { ref, sm, sf, pm, pf }
export function resolverConcordancia(attrs, ctx, persona) {
  const ref = REFERENCIAS[attrs.ref];
  const { plural, femenino } = ref ? ref.resolver(ctx, persona) : { plural: false, femenino: false };
  if (plural) return femenino ? attrs.pf : attrs.pm;
  return femenino ? attrs.sf : attrs.sm;
}

// ── Grupos de personas (para listas y firmas) ───────────────────
export const GRUPOS_PERSONA = {
  propietarios:  { label: 'Propietarios',  lista: (c) => c.propietarios },
  arrendatarios: { label: 'Arrendatarios', lista: (c) => c.arrendatarios },
  fiadores:      { label: 'Fiadores',      lista: (c) => c.fiadores },
};

// ── Condiciones de inclusión ────────────────────────────────────
export const CONDICIONES = {
  con_fiador:   { label: 'Solo si hay fiador',          test: (c) => c.fiadores.length > 0 },
  sin_fiador:   { label: 'Solo si NO hay fiador',       test: (c) => c.fiadores.length === 0 },
  moneda_clp:   { label: 'Solo si la renta es en pesos', test: (c) => c.moneda === 'CLP' },
  moneda_uf:    { label: 'Solo si la renta es en UF',   test: (c) => c.moneda === 'UF' },
  amoblado:     { label: 'Solo si es amoblado',         test: (c) => !!c.propiedad.amoblado },
  sin_muebles:  { label: 'Solo si es sin muebles',      test: (c) => !c.propiedad.amoblado },
  con_promo:    { label: 'Solo si hay renta promocional', test: (c) => !!(c.propiedad.promo && c.propiedad.mesesPromo) },
  con_extras:   { label: 'Solo si incluye bodega o estacionamiento', test: (c) => c.tieneExtras },
};

export function cumpleCondicion(id, ctx) {
  if (!id) return true;
  const cond = CONDICIONES[id];
  return cond ? cond.test(ctx) : true;
}
