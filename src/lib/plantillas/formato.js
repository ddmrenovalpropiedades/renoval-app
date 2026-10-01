// ════════════════════════════════════════════════════════════════
// Helpers de formato para documentos (fechas, montos, números en letras)
// ════════════════════════════════════════════════════════════════

export const PH = 'XXXXXXXXXX';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// 'aaaa-mm-dd' → { dia, mes, anio } | null
export function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return { dia: d, mes: MESES[parseInt(m, 10) - 1], anio: y };
}

export function sumarMesesISO(iso, n) {
  if (!iso) return null;
  const dt = new Date(`${iso}T12:00:00`);
  dt.setMonth(dt.getMonth() + n);
  return dt.toISOString().split('T')[0];
}

export const separarMiles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ── Números en letras (español, con apócope y femenino) ─────────
const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorCien(n, fem, apocope) {
  let s;
  if (n < 30) {
    s = UNIDADES[n];
  } else {
    const d = Math.floor(n / 10);
    const u = n % 10;
    s = DECENAS[d] + (u ? ` y ${UNIDADES[u]}` : '');
  }
  if (s.endsWith('uno')) {
    if (fem) s = `${s.slice(0, -1)}a`;
    else if (apocope) s = s === 'veintiuno' ? 'veintiún' : s.slice(0, -1);
  }
  return s;
}

function menorMil(n, fem, apocope) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = c ? CENTENAS[c] : '';
  if (fem && c > 1) s = s.replace(/os$/, 'as');
  if (r) s += (s ? ' ' : '') + menorCien(r, fem, apocope);
  return s;
}

// apocope=true → "un", "veintiún", "treinta y un" (cuando sigue un sustantivo)
export function numeroALetras(num, { femenino = false, apocope = true } = {}) {
  const n = Math.floor(Number(num));
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : `${menorMil(millones, false, true)} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${menorMil(miles, femenino, true)} mil`);
  if (resto) partes.push(menorMil(resto, femenino, apocope));
  return partes.join(' ');
}

// ── Montos ──────────────────────────────────────────────────────
// valor: string tal como viene del formulario ('450000' en CLP, '25.5' en UF)
// → { numero, palabras } | null
export function formatMonto(valor, moneda) {
  if (valor === null || valor === undefined || valor === '') return null;

  if (moneda === 'UF') {
    const [ent, dec] = String(valor).replace(',', '.').split('.');
    const entero = parseInt(ent, 10);
    if (Number.isNaN(entero)) return null;
    const decimales = (dec || '').replace(/[^0-9]/g, '');
    const numero = `${separarMiles(entero)}${decimales ? `,${decimales}` : ''} UF`;
    let palabras = numeroALetras(entero, { femenino: true });
    if (decimales) {
      const ceros = decimales.match(/^0*/)[0].length;
      const resto = decimales.slice(ceros);
      const pal = [...Array(ceros).fill('cero')];
      if (resto) pal.push(numeroALetras(parseInt(resto, 10), { apocope: false }));
      palabras += ` coma ${pal.join(' ')}`;
    }
    const singular = entero === 1 && !decimales;
    palabras += singular ? ' Unidad de Fomento' : ' Unidades de Fomento';
    return { numero, palabras };
  }

  const n = parseInt(String(valor).replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  const de = n > 0 && n % 1e6 === 0 ? ' de' : '';
  return { numero: `$${separarMiles(n)}`, palabras: `${numeroALetras(n)}${de} pesos` };
}

export function buildDomicilio(p) {
  const parts = [];
  if (p.calle) parts.push(p.calle);
  if (p.comuna) parts.push(`comuna de ${p.comuna}`);
  if (p.region) parts.push(p.region);
  return parts.join(', ') || PH;
}
