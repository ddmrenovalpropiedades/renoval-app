// api/backup-to-drive.js
// Genera respaldos Excel de todos los módulos y los sube a Google Drive
// Estructura: Mi Unidad > RENOVAL PROPIEDADES > APP > RESPALDO > {año} > {mes} > {fecha}

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const USER_INITIALS = {
  'ddm@renovalpropiedades.com':      'DD',
  'fdm@renovalpropiedades.com':      'FD',
  'edith@renovalpropiedades.com':    'EA',
  'fernanda@renovalpropiedades.com': 'FG',
};

// ── Google Drive helpers ──────────────────────────────────────────────────────

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener access token de Google: ' + JSON.stringify(data));
  return data.access_token;
}

// Busca una carpeta por nombre dentro de un parent; la crea si no existe
async function findOrCreateFolder(token, name, parentId) {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  // Crear carpeta
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error(`No se pudo crear carpeta "${name}": ` + JSON.stringify(created));
  return created.id;
}

// Sube un buffer Excel a Drive
async function uploadExcel(token, filename, buffer, parentId) {
  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const boundary = 'renoval_boundary_' + Date.now();
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    buffer,
    `\r\n--${boundary}--`,
  ];

  // Construir body multipart manualmente
  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
    new Uint8Array(buffer),
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) { combined.set(p, offset); offset += p.length; }

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(combined.length),
      },
      body: combined,
    }
  );
  const result = await res.json();
  return result;
}

// ── Generadores de Excel por módulo ──────────────────────────────────────────

function makeWorkbook(sheets) {
  // sheets: [{ name, rows, columns }]
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = sheet.rows.map(row =>
      Object.fromEntries(sheet.columns.map(c => [c.label, row[c.key] ?? '']))
    );
    const ws = XLSX.utils.json_to_sheet(data, { header: sheet.columns.map(c => c.label) });
    ws['!cols'] = sheet.columns.map(c => ({
      wch: Math.max(c.label.length, ...data.map(r => String(r[c.label] ?? '').length)) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function fetchAll(table, query = null) {
  let all = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select('*');
    if (query) q = query(q);
    const { data } = await q.range(from, from + 999);
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function generatePizarra() {
  const rows = await fetchAll('pizarra', q => q.order('position', { ascending: true }));
  return makeWorkbook([{ name: 'Pizarra', rows, columns: [
    { key: 'propiedad',    label: 'Propiedad' },
    { key: 'precio',       label: 'Precio' },
    { key: 'promo',        label: 'Promo' },
    { key: 'status',       label: 'Publicación' },
    { key: 'e1',           label: 'E1' },
    { key: 'e2',           label: 'E2' },
    { key: 'db',           label: 'D/B' },
    { key: 'eb',           label: 'E/B' },
    { key: 'comuna',       label: 'Comuna' },
    { key: 'fecha_salida', label: 'Fecha Salida' },
    { key: 'aviso',        label: 'Aviso' },
    { key: 'respaldo',     label: 'Respaldo' },
    { key: 'tipo',         label: 'Tipo' },
    { key: 'admin',        label: 'Admin' },
  ]}]);
}

async function generateArrendadas() {
  const rows = await fetchAll('arrendadas', q => q.order('mes', { ascending: false }).order('position', { ascending: true }));
  return makeWorkbook([{ name: 'Arrendadas', rows, columns: [
    { key: 'mes',         label: 'Mes' },
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
  ]}]);
}

async function generateCartera() {
  const rows = await fetchAll('properties', q => q.order('propiedad', { ascending: true }));
  return makeWorkbook([{ name: 'Cartera', rows, columns: [
    { key: 'propiedad',   label: 'Propiedad' },
    { key: 'propietario', label: 'Propietario' },
    { key: 'e1',          label: 'E1' },
    { key: 'e2',          label: 'E2' },
  ]}]);
}

async function generateAtributos() {
  const rows = await fetchAll('property_attributes', q => q.order('propiedad', { ascending: true }));
  const toBool = v => v === true ? 'Sí' : v === false ? 'No' : '';
  const mapped = rows.map(a => ({
    ...a,
    tiene_agua: toBool(a.tiene_agua),
    tiene_luz:  toBool(a.tiene_luz),
    tiene_gas:  toBool(a.tiene_gas),
    tiene_gc:   toBool(a.tiene_gc),
  }));
  return makeWorkbook([{ name: 'Atributos', rows: mapped, columns: [
    { key: 'propiedad',    label: 'Propiedad' },
    { key: 'tiene_agua',   label: 'Agua' },
    { key: 'tiene_luz',    label: 'Luz' },
    { key: 'tiene_gas',    label: 'Gas' },
    { key: 'tiene_gc',     label: 'GC' },
    { key: 'umbral1_agua', label: 'U1 Agua' },
    { key: 'umbral2_agua', label: 'U2 Agua' },
    { key: 'umbral1_luz',  label: 'U1 Luz' },
    { key: 'umbral2_luz',  label: 'U2 Luz' },
    { key: 'umbral1_gas',  label: 'U1 Gas' },
    { key: 'umbral2_gas',  label: 'U2 Gas' },
    { key: 'gc_promedio',  label: 'GC Promedio' },
  ]}]);
}

async function generateTareas() {
  const tareas = await fetchAll('tasks', q =>
    q.eq('completed', false).order('owner_email').order('category').order('position', { ascending: true })
  );
  const titleById = {};
  tareas.forEach(t => { titleById[t.id] = t.title; });

  const byEmail = {};
  tareas.forEach(t => {
    const email = t.owner_email || t.assigned_to || '';
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(t);
  });

  const columns = [
    { key: 'category',        label: 'Lista' },
    { key: 'title',           label: 'Tarea' },
    { key: 'parent_title',    label: 'Tarea padre' },
    { key: 'next_occurrence', label: 'Fecha vencimiento' },
    { key: 'notes',           label: 'Notas' },
  ];

  const sheets = Object.entries(byEmail).map(([email, tasks]) => ({
    name: USER_INITIALS[email] || email.split('@')[0],
    rows: tasks.map(t => ({ ...t, parent_title: t.parent_id ? (titleById[t.parent_id] || '') : '' })),
    columns,
  }));

  if (sheets.length === 0) sheets.push({ name: 'Sin datos', rows: [], columns });
  return makeWorkbook(sheets);
}

async function generateSaldos() {
  const rows = await fetchAll('saldos', q => q.order('propiedad', { ascending: true }));
  const filtered = rows.filter(r => r.last_cuentas_ac || r.last_cuentas_an || r.last_arriendos);
  return makeWorkbook([{ name: 'Saldos', rows: filtered, columns: [
    { key: 'propiedad',      label: 'Propiedad' },
    { key: 'propietario',    label: 'Propietario' },
    { key: 'e1',             label: 'E1' },
    { key: 'e2',             label: 'E2' },
    { key: 'agua_ac',        label: 'Agua Ac' },
    { key: 'agua_an',        label: 'Agua An' },
    { key: 'luz_ac',         label: 'Luz Ac' },
    { key: 'luz_an',         label: 'Luz An' },
    { key: 'gas_ac',         label: 'Gas Ac' },
    { key: 'gas_an',         label: 'Gas An' },
    { key: 'gc_ac',          label: 'GC Ac' },
    { key: 'gc_an',          label: 'GC An' },
    { key: 'deuda_arriendo', label: 'Deuda Arriendo' },
  ]}]);
}

async function generatePagos() {
  const rows = await fetchAll('pagos', q => q.order('position', { ascending: true }));
  return makeWorkbook([{ name: 'Pagos', rows, columns: [
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
  ]}]);
}

async function generateConsultasGC() {
  const mesActual = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  })();

  const [cfg, logs] = await Promise.all([
    fetchAll('gc_consultas_config', q => q.order('propiedad')),
    fetchAll('gc_consultas_log'),
  ]);

  // Pestaña config actual
  const logMap = {};
  logs.forEach(l => {
    if (!logMap[l.propiedad]) logMap[l.propiedad] = {};
    logMap[l.propiedad][l.mes] = l;
  });

  const configRows = cfg.map(r => {
    const logRow = logMap[r.propiedad]?.[mesActual] || {};
    return {
      propiedad:  r.propiedad,
      cartera:    r.cartera || '',
      mail_admin: r.mail_admin || '',
      status:     logRow.status || '',
      gc_valor:   logRow.gc_valor || '',
      enviado_at: logRow.enviado_at || '',
      respondido_at: logRow.respondido_at || '',
    };
  });

  // Pestaña historial (todos los logs)
  const historialRows = logs.sort((a, b) => (b.mes > a.mes ? 1 : -1));

  return makeWorkbook([
    { name: 'Consultas GC', rows: configRows, columns: [
      { key: 'propiedad',     label: 'Propiedad' },
      { key: 'cartera',       label: 'Cartera' },
      { key: 'mail_admin',    label: 'Correo Admin' },
      { key: 'status',        label: 'Estado' },
      { key: 'gc_valor',      label: 'Valor GC' },
      { key: 'enviado_at',    label: 'Enviado' },
      { key: 'respondido_at', label: 'Respondido' },
    ]},
    { name: 'Reportabilidad', rows: historialRows, columns: [
      { key: 'propiedad',     label: 'Propiedad' },
      { key: 'mes',           label: 'Mes' },
      { key: 'status',        label: 'Estado' },
      { key: 'gc_valor',      label: 'Valor GC' },
      { key: 'enviado_at',    label: 'Enviado' },
      { key: 'respondido_at', label: 'Respondido' },
    ]},
  ]);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Acepta tanto GET (desde cron) como POST (llamada manual con CRON_SECRET)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const año = String(now.getFullYear());
    const mes = MESES_ES[now.getMonth()];
    const fecha = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;

    console.log(`Iniciando respaldo: ${fecha}`);

    // 1. Obtener access token de Google Drive
    const token = await getAccessToken();

    // 2. Navegar / crear estructura de carpetas
    // Buscar "RENOVAL PROPIEDADES" sin restricción de parent (más robusto)
    const rootSearch = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='RENOVAL PROPIEDADES' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    console.log('Búsqueda carpeta raíz:', JSON.stringify(rootSearch));

    if (!rootSearch.files?.length) throw new Error('No se encontró la carpeta "RENOVAL PROPIEDADES" en Mi Unidad');
    const renovalId = rootSearch.files[0].id;

    const appId      = await findOrCreateFolder(token, 'APP',      renovalId);
    const respaldoId = await findOrCreateFolder(token, 'RESPALDO', appId);
    const añoId      = await findOrCreateFolder(token, año,        respaldoId);
    const mesId      = await findOrCreateFolder(token, mes,        añoId);
    const fechaId    = await findOrCreateFolder(token, fecha,      mesId);

    console.log(`Carpeta destino creada: RESPALDO/${año}/${mes}/${fecha}`);

    // 3. Generar y subir cada archivo
    const archivos = [
      { nombre: `Pizarra_${fecha}.xlsx`,         gen: generatePizarra },
      { nombre: `Arrendadas_${fecha}.xlsx`,       gen: generateArrendadas },
      { nombre: `Cartera_${fecha}.xlsx`,          gen: generateCartera },
      { nombre: `Atributos_${fecha}.xlsx`,        gen: generateAtributos },
      { nombre: `Tareas_${fecha}.xlsx`,           gen: generateTareas },
      { nombre: `Saldos_${fecha}.xlsx`,           gen: generateSaldos },
      { nombre: `Pagos_${fecha}.xlsx`,            gen: generatePagos },
      { nombre: `ConsultasGC_${fecha}.xlsx`,      gen: generateConsultasGC },
    ];

    const resultados = [];
    for (const archivo of archivos) {
      try {
        console.log(`Generando ${archivo.nombre}...`);
        const buffer = await archivo.gen();
        const result = await uploadExcel(token, archivo.nombre, buffer, fechaId);
        resultados.push({ archivo: archivo.nombre, ok: true, id: result.id });
        console.log(`✓ ${archivo.nombre} subido (${result.id})`);
      } catch (e) {
        console.error(`✗ Error en ${archivo.nombre}:`, e.message);
        resultados.push({ archivo: archivo.nombre, ok: false, error: e.message });
      }
    }

    const exitosos = resultados.filter(r => r.ok).length;
    console.log(`Respaldo completado: ${exitosos}/${archivos.length} archivos`);

    return res.status(200).json({
      ok: true,
      fecha,
      carpeta: `RESPALDO/${año}/${mes}/${fecha}`,
      resultados,
    });

  } catch (e) {
    console.error('Error en backup-to-drive:', e);
    return res.status(500).json({ error: e.message });
  }
}
