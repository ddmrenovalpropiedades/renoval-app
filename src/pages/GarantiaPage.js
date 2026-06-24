import { useState } from 'react';
import PropertyAutocomplete from '../components/pizarra/PropertyAutocomplete';
import { Plus, Trash2, Download, ChevronLeft, Eye } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         AlignmentType, ImageRun, Header, BorderStyle, WidthType, ShadingType,
         VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { LOGO_BASE64 } from '../logoBase64';

// ── Helpers ───────────────────────────────────────────────────
const MESES_CAP = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const formatMiles = (val) => {
  const clean = String(val).replace(/[^0-9]/g, '');
  if (!clean) return '';
  return '$' + parseInt(clean).toLocaleString('es-CL');
};

const parseMiles = (val) => String(val).replace(/[^0-9]/g, '');

const formatFechaLarga = (d) => {
  if (!d) return 'XX de XXXXXXXX de 20XX';
  const [y, m, dd] = d.split('-');
  return `${parseInt(dd)} de ${MESES_CAP[parseInt(m) - 1]} de ${y}`;
};


const todayISO = () => new Date().toISOString().split('T')[0];

// ── Default items ─────────────────────────────────────────────
const DEFAULT_DESCUENTOS = [
  { id: 'd1', tipo: 'descuento', label: 'Cuenta de luz',        monto: '', detalle: '' },
  { id: 'd2', tipo: 'descuento', label: 'Cuenta de agua',       monto: '', detalle: '' },
  { id: 'd3', tipo: 'descuento', label: 'Cuenta de gas',        monto: '', detalle: '' },
  { id: 'd4', tipo: 'descuento', label: 'Gastos comunes',       monto: '', detalle: '' },
  { id: 'd5', tipo: 'descuento', label: 'Trabajos de habilitación de propiedad', monto: '', detalle: '' },
  { id: 'd6', tipo: 'descuento', label: 'Aseo',                 monto: '', detalle: '' },
];

// ── Input components ──────────────────────────────────────────
const Field = ({ label, children, span2 }) => (
  <div style={{ ...(span2 ? { gridColumn: 'span 2' } : {}), display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={fs.label}>{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder = '', type = 'text' }) => (
  <input value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder} type={type} style={fs.input} />
);

function MoneyInput({ value, onChange, placeholder = '0' }) {
  return (
    <input
      value={value ? formatMiles(value) : ''}
      onChange={e => onChange(parseMiles(e.target.value))}
      placeholder={`$${placeholder}`}
      style={fs.input}
    />
  );
}

// ── Item row ──────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...item, [k]: v });
  const isAbono = item.tipo === 'abono';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr 1fr auto',
      gap: 8, alignItems: 'start',
      padding: '10px 12px', background: isAbono ? '#f0fff4' : '#fff8f8',
      border: `1px solid ${isAbono ? '#c6efce' : '#fcd5d5'}`,
      borderRadius: 8, marginBottom: 6,
    }}>
      {/* Tipo badge */}
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 2 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
          background: isAbono ? '#c6efce' : '#fcd5d5',
          color: isAbono ? '#1e6f3e' : '#c0392b',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {isAbono ? '＋ Abono' : '－ Descuento'}
        </span>
      </div>
      {/* Descripción */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          value={item.label}
          onChange={e => set('label', e.target.value)}
          placeholder="Descripción del ítem"
          style={{ ...fs.input, fontSize: 13 }}
        />
        <input
          value={item.detalle}
          onChange={e => set('detalle', e.target.value)}
          placeholder="Detalle adicional (opcional)"
          style={{ ...fs.input, fontSize: 12, color: '#5f6368', background: '#fafafa' }}
        />
      </div>
      {/* Monto */}
      <MoneyInput value={item.monto} onChange={v => set('monto', v)} />
      {/* Remove */}
      <button onClick={onRemove} style={fs.removeBtn} title="Eliminar ítem">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Build Word document ───────────────────────────────────────
function buildGarantiaDoc({ datos, items, fecha }) {
  const bold = (t) => new TextRun({ text: t, bold: true, font: 'Arial', size: 22 });
  const run = (t) => new TextRun({ text: t, font: 'Arial', size: 22 });
  const br = () => new Paragraph({ children: [run('')], spacing: { after: 0, line: 280, lineRule: 'exact' } });
  const justified = (children, extra = {}) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED, children,
    spacing: { after: 120, line: 280, lineRule: 'exact' }, ...extra,
  });
  const centered = (children, extra = {}) => new Paragraph({
    alignment: AlignmentType.CENTER, children,
    spacing: { after: 0, line: 280, lineRule: 'exact' }, ...extra,
  });

  const abonos = items.filter(i => i.tipo === 'abono' && i.monto);
  const descuentos = items.filter(i => i.tipo === 'descuento' && i.monto);
  const totalAbonos = abonos.reduce((s, i) => s + parseInt(i.monto || 0), 0);
  const totalDescuentos = descuentos.reduce((s, i) => s + parseInt(i.monto || 0), 0);
  const garantiaN = parseInt(parseMiles(datos.garantia) || 0);
  const saldo = garantiaN + totalAbonos - totalDescuentos;

  // Table borders
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  const cell = (children, opts = {}) => new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children,
      spacing: { after: 0, line: 240, lineRule: 'exact' },
    })],
  });

  const headerCell = (text, width) => cell(
    [new TextRun({ text, bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })],
    { width, shading: '1A73E8', align: AlignmentType.CENTER }
  );
  const labelCell = (text, width) => cell(
    [new TextRun({ text, font: 'Arial', size: 20 })],
    { width, shading: 'F8F9FA' }
  );
  const amountCell = (n, color = '202124') => cell(
    [new TextRun({ text: formatMilesNum(n), bold: true, font: 'Arial', size: 20, color })],
    { width: 2200, align: AlignmentType.RIGHT }
  );
  const detailCell = (text) => cell(
    [new TextRun({ text: text || '', font: 'Arial', size: 18, color: '777777', italics: !!text })],
    { width: 2200 }
  );

  const formatMilesNum = (n) => {
    if (!n && n !== 0) return '';
    const abs = Math.abs(n);
    const formatted = '$' + abs.toLocaleString('es-CL');
    return n < 0 ? `(${formatted})` : formatted;
  };

  // Table rows
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Concepto', 4606),
        headerCell('Detalle', 2200),
        headerCell('Monto', 2200),
      ],
    }),
    // Garantía
    new TableRow({
      children: [
        labelCell('Garantía recibida', 4606),
        cell([run('')], { width: 2200 }),
        amountCell(garantiaN, '1e6f3e'),
      ],
    }),
    // Abonos
    ...abonos.map(i => new TableRow({
      children: [
        labelCell(`  + ${i.label}`, 4606),
        detailCell(i.detalle),
        amountCell(parseInt(i.monto), '1e6f3e'),
      ],
    })),
    // Descuentos
    ...descuentos.map(i => new TableRow({
      children: [
        labelCell(`  − ${i.label}`, 4606),
        detailCell(i.detalle),
        amountCell(-parseInt(i.monto), 'c0392b'),
      ],
    })),
    // Total
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: '1A73E8' }, bottom: border, left: noBorder, right: noBorder },
          shading: { fill: 'E8F0FE', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'SALDO A DEVOLVER AL ARRENDATARIO', bold: true, font: 'Arial', size: 22 })],
            spacing: { after: 0 },
          })],
        }),
        new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: '1A73E8' }, bottom: border, left: noBorder, right: noBorder },
          shading: { fill: 'E8F0FE', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: formatMilesNum(saldo),
              bold: true, font: 'Arial', size: 22,
              color: saldo >= 0 ? '1e6f3e' : 'c0392b',
            })],
            spacing: { after: 0 },
          })],
        }),
      ],
    }),
  ];

  const table = new Table({
    width: { size: 9006, type: WidthType.DXA },
    columnWidths: [4606, 2200, 2200],
    rows: tableRows,
  });

  // Logo header
  const logoBuffer = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
  const logoHeader = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logoBuffer, transformation: { width: 200, height: 60 }, type: 'jpg' })],
      spacing: { after: 120 },
    })],
  });

  const children = [
    br(), br(),
    centered([new TextRun({ text: 'LIQUIDACIÓN DE GARANTÍA DE ARRENDAMIENTO', bold: true, font: 'Arial', size: 24 })]),
    br(),
    centered([new TextRun({ text: `Fecha: ${formatFechaLarga(fecha)}`, font: 'Arial', size: 22, italics: true })]),
    br(), br(),
    justified([run('Estimado/a '), bold(datos.arrendatario || 'ARRENDATARIO'), run(':')]),
    br(),
    justified([
      run('Por medio del presente documento, Renoval Gestión Inmobiliaria Limitada, en representación de la parte Arrendadora, procede a realizar la liquidación de la garantía de arrendamiento correspondiente al inmueble ubicado en '),
      bold(datos.direccion || 'DIRECCIÓN DEL INMUEBLE'),
      run(', de conformidad con lo estipulado en el contrato de arrendamiento suscrito entre las partes.'),
    ]),
    br(),
    justified([run('El detalle de la liquidación es el siguiente:')]),
    br(),
    table,
    br(),
    ...(saldo >= 0
      ? [justified([
          run('En consecuencia, la suma de '),
          bold(formatMilesNum(saldo)),
          run(` será transferida a la cuenta bancaria indicada por el arrendatario dentro de los 60 días siguientes a la restitución del inmueble, de acuerdo a lo establecido en la cláusula octava del contrato de arrendamiento.`),
        ])]
      : [justified([
          run('Dado que los descuentos aplicados exceden el monto de la garantía, se solicita a '),
          bold(datos.arrendatario || 'ARRENDATARIO'),
          run(` que proceda a transferir la suma de `),
          bold(formatMilesNum(Math.abs(saldo))),
          run(` a la cuenta corriente N° 27624332 del Banco Santander, a nombre de Renoval Gestión Inmobiliaria Limitada, RUT: 78.299.346-1, dentro de los 10 días siguientes a la recepción de esta liquidación.`),
        ])]
    ),
    br(),
    justified([run('Ante cualquier consulta o discrepancia respecto de la presente liquidación, las partes se comprometen a resolverla de buena fe dentro de los 10 días siguientes a su recepción.')]),
    br(), br(),
    justified([run(`Santiago, ${formatFechaLarga(fecha)}.`)]),
    br(), br(), br(), br(), br(),
    centered([run('_________________________________________________')]),
    centered([bold('RENOVAL GESTIÓN INMOBILIARIA LIMITADA')]),
    centered([run('En representación de la parte Arrendadora')]),
    br(), br(), br(), br(), br(),
    centered([run('_________________________________________________')]),
    centered([bold(datos.arrendatario?.toUpperCase() || 'NOMBRE ARRENDATARIO')]),
    centered([run('Parte Arrendataria')]),
  ];

  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1417, right: 1134, bottom: 1134, left: 1134 },
        },
        titlePage: true,
      },
      headers: {
        first: logoHeader,
        default: new Header({ children: [new Paragraph('')] }),
      },
      children,
    }],
  });
}

// ── Preview component ─────────────────────────────────────────
function PreviewPage({ datos, items, fecha, onBack }) {
  const [generating, setGenerating] = useState(false);

  const abonos = items.filter(i => i.tipo === 'abono' && i.monto);
  const descuentos = items.filter(i => i.tipo === 'descuento' && i.monto);
  const totalAbonos = abonos.reduce((s, i) => s + parseInt(i.monto || 0), 0);
  const totalDescuentos = descuentos.reduce((s, i) => s + parseInt(i.monto || 0), 0);
  const garantiaN = parseInt(parseMiles(datos.garantia) || 0);
  const saldo = garantiaN + totalAbonos - totalDescuentos;

  const formatN = (n) => {
    const abs = Math.abs(n);
    const f = '$' + abs.toLocaleString('es-CL');
    return n < 0 ? `(${f})` : f;
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const doc = buildGarantiaDoc({ datos, items, fecha });
      const blob = await Packer.toBlob(doc);
      const nombre = datos.arrendatario?.split(' ')[0] || 'Arrendatario';
      saveAs(blob, `Liquidacion_Garantia_${nombre}.docx`);
    } catch (e) { alert('Error: ' + e.message); }
    setGenerating(false);
  };

  const RowItem = ({ label, detalle, monto, tipo }) => (
    <tr>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#202124', borderBottom: '1px solid #f1f3f4' }}>
        {tipo === 'abono' ? '＋' : '－'} {label}
        {detalle && <div style={{ fontSize: 11, color: '#777', marginTop: 2, fontStyle: 'italic' }}>{detalle}</div>}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: tipo === 'abono' ? '#1e6f3e' : '#c0392b', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #f1f3f4' }}>
        {tipo === 'descuento' ? `(${formatMiles(monto)})` : formatMiles(monto)}
      </td>
    </tr>
  );

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <button onClick={onBack} style={fs.backBtn}><ChevronLeft size={16} style={{ marginRight: 4 }} />Volver</button>
        <button onClick={handleDownload} disabled={generating} style={fs.downloadBtn}>
          <Download size={15} style={{ marginRight: 5 }} />
          {generating ? 'Generando...' : 'Descargar Word (.docx)'}
        </button>
      </div>

      <div style={fs.previewDoc}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>LIQUIDACIÓN DE GARANTÍA DE ARRENDAMIENTO</h2>
          <p style={{ fontSize: 12, color: '#5f6368', margin: 0, fontStyle: 'italic' }}>Fecha: {formatFechaLarga(fecha)}</p>
        </div>

        <p style={{ fontSize: 12, textAlign: 'justify', lineHeight: 1.7, marginBottom: 12 }}>
          Estimado/a <strong>{datos.arrendatario || 'ARRENDATARIO'}</strong>:
        </p>
        <p style={{ fontSize: 12, textAlign: 'justify', lineHeight: 1.7, marginBottom: 20 }}>
          A continuación se presenta la liquidación de garantía correspondiente al inmueble ubicado en <strong>{datos.direccion || 'DIRECCIÓN'}</strong>.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#1a73e8' }}>
              <th style={{ padding: '10px 12px', fontSize: 12, color: '#fff', textAlign: 'left', fontWeight: 700 }}>Concepto</th>
              <th style={{ padding: '10px 12px', fontSize: 12, color: '#fff', textAlign: 'right', fontWeight: 700 }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8f9fa' }}>
              <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e8eaed' }}>Garantía recibida</td>
              <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#1e6f3e', textAlign: 'right', borderBottom: '1px solid #e8eaed' }}>{formatMiles(datos.garantia)}</td>
            </tr>
            {abonos.map(i => <RowItem key={i.id} {...i} tipo="abono" />)}
            {descuentos.map(i => <RowItem key={i.id} {...i} tipo="descuento" />)}
            <tr style={{ background: '#e8f0fe' }}>
              <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, borderTop: '2px solid #1a73e8' }}>SALDO A DEVOLVER</td>
              <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, textAlign: 'right', borderTop: '2px solid #1a73e8', color: saldo >= 0 ? '#1e6f3e' : '#c0392b' }}>
                {saldo < 0 ? `(${formatMiles(String(Math.abs(saldo)))})` : formatMiles(String(saldo))}
              </td>
            </tr>
          </tbody>
        </table>

        {saldo >= 0
          ? <p style={{ fontSize: 12, textAlign: 'justify', lineHeight: 1.7, color: '#202124' }}>
              La suma de <strong>{formatN(saldo)}</strong> será transferida dentro de los 60 días siguientes a la restitución del inmueble.
            </p>
          : <p style={{ fontSize: 12, textAlign: 'justify', lineHeight: 1.7, color: '#c0392b' }}>
              Los descuentos exceden el monto de garantía. Se solicita transferir <strong>{formatN(Math.abs(saldo))}</strong> dentro de 10 días.
            </p>
        }

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 48 }}>
          {['RENOVAL G.I. LTDA.\nArrendadora', `${datos.arrendatario?.toUpperCase() || 'ARRENDATARIO'}\nParte Arrendataria`].map((sig, i) => (
            <div key={i} style={{ textAlign: 'center', width: 220 }}>
              <div style={{ borderBottom: '1px solid #202124', marginBottom: 8, height: 40 }} />
              {sig.split('\n').map((l, j) => <div key={j} style={{ fontSize: 11, fontWeight: j === 0 ? 700 : 400, color: j === 0 ? '#202124' : '#5f6368' }}>{l}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function GarantiaPage() {
  const [datos, setDatos] = useState({
    arrendatario: '',
    direccion: '',
    garantia: '',
  });
  const [items, setItems] = useState(DEFAULT_DESCUENTOS.map(d => ({ ...d })));
  const [fecha, setFecha] = useState(todayISO());
  const [showPreview, setShowPreview] = useState(false);

  const setD = (k, v) => setDatos(p => ({ ...p, [k]: v }));

  const updateItem = (id, val) => setItems(prev => prev.map(i => i.id === id ? val : i));
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const addItem = (tipo) => {
    const id = 'i' + Date.now();
    setItems(prev => [...prev, { id, tipo, label: '', monto: '', detalle: '' }]);
  };

  const garantiaN = parseInt(parseMiles(datos.garantia) || 0);
  const totalAbonos = items.filter(i => i.tipo === 'abono' && i.monto).reduce((s, i) => s + parseInt(i.monto), 0);
  const totalDescuentos = items.filter(i => i.tipo === 'descuento' && i.monto).reduce((s, i) => s + parseInt(i.monto), 0);
  const saldo = garantiaN + totalAbonos - totalDescuentos;

  if (showPreview) return <PreviewPage datos={datos} items={items} fecha={fecha} onBack={() => setShowPreview(false)} />;

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <div>
          <h1 style={fs.title}>Liquidación de Garantía</h1>
          <p style={fs.subtitle}>Genera el documento de devolución de garantía al arrendatario</p>
        </div>
        <button onClick={() => setShowPreview(true)} style={fs.previewBtn}>
          <Eye size={15} style={{ marginRight: 5 }} />
          Vista previa y descarga
        </button>
      </div>

      <div style={fs.body}>
        {/* Datos generales */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Datos generales</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            <Field label="Nombre del arrendatario">
              <input value={datos.arrendatario} onChange={e => setD('arrendatario', e.target.value.toUpperCase())}
                placeholder="NOMBRE COMPLETO" style={fs.input} />
            </Field>
            <Field label="Fecha del documento">
              <Input value={fecha} onChange={setFecha} type="date" />
            </Field>
            <Field label="Dirección" span2>
              <PropertyAutocomplete
                value={datos.direccion}
                onChange={v => setD('direccion', v)}
                placeholder="Av. Ejemplo 123, Departamento 45, Las Condes"
                inputStyle={{ padding: '8px 10px', fontSize: 13, borderRadius: 7, height: 'auto' }}
              />
            </Field>
            <Field label="Monto de garantía recibida">
              <MoneyInput value={datos.garantia} onChange={v => setD('garantia', v)} />
            </Field>
          </div>
        </div>

        {/* Ítems */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Abonos y descuentos</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => addItem('abono')} style={{ ...fs.addBtn, background: '#e6f4ea', color: '#1e6f3e' }}>
                <Plus size={13} style={{ marginRight: 4 }} />Agregar abono
              </button>
              <button onClick={() => addItem('descuento')} style={{ ...fs.addBtn, background: '#fde8e8', color: '#c0392b' }}>
                <Plus size={13} style={{ marginRight: 4 }} />Agregar descuento
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr auto', gap: 8, padding: '0 12px 6px', marginBottom: 4 }}>
            <span style={fs.colHeader}>Tipo</span>
            <span style={fs.colHeader}>Descripción / Detalle</span>
            <span style={fs.colHeader}>Monto</span>
            <span />
          </div>

          {items.map(item => (
            <ItemRow key={item.id} item={item}
              onChange={val => updateItem(item.id, val)}
              onRemove={() => removeItem(item.id)} />
          ))}

          {items.length === 0 && (
            <p style={{ color: '#9aa0a6', fontSize: 13, padding: '6px 0' }}>No hay ítems — agrega abonos o descuentos arriba</p>
          )}
        </div>

        {/* Resumen */}
        <div style={{ ...fs.section, background: '#e8f0fe', border: '1px solid #c5d9f8' }}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Resumen</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Garantía', value: formatMiles(datos.garantia) || '$0', color: '#1a73e8' },
              { label: 'Total abonos', value: formatMiles(String(totalAbonos)) || '$0', color: '#1e6f3e' },
              { label: 'Total descuentos', value: formatMiles(String(totalDescuentos)) || '$0', color: '#c0392b' },
              { label: 'Saldo a devolver', value: (saldo < 0 ? `(${formatMiles(String(Math.abs(saldo)))})` : formatMiles(String(saldo))) || '$0', color: saldo < 0 ? '#c0392b' : '#1e6f3e' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#5f6368', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const fs = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  previewBtn: { display: 'flex', alignItems: 'center', padding: '9px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  downloadBtn: { display: 'flex', alignItems: 'center', padding: '9px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  backBtn: { display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#fff', color: '#5f6368', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  body: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
  section: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 20, flexShrink: 0 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#202124' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#ea4335', display: 'flex', alignItems: 'center', marginTop: 2 },
  label: { fontSize: 11, fontWeight: 600, color: '#5f6368' },
  colHeader: { fontSize: 11, fontWeight: 600, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { border: '1px solid #dadce0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  previewDoc: { flex: 1, overflow: 'auto', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '40px 48px', maxWidth: 860, margin: '0 auto', width: '100%', lineHeight: 1.8 },
};
