import React, { useState, useMemo } from 'react';
import { LOGO_BASE64 } from '../logoBase64';
import { Plus, Trash2, Download, Eye, ChevronLeft } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Header } from 'docx';
import { saveAs } from 'file-saver';

// ── Chile regions & comunas ───────────────────────────────────
const REGIONES_COMUNAS = {
  'Región de Arica y Parinacota': ['Arica','Camarones','Putre','General Lagos'],
  'Región de Tarapacá': ['Iquique','Alto Hospicio','Pozo Almonte','Camiña','Colchane','Huara','Pica'],
  'Región de Antofagasta': ['Antofagasta','Mejillones','Sierra Gorda','Taltal','Calama','Ollagüe','San Pedro de Atacama','Tocopilla','María Elena'],
  'Región de Atacama': ['Copiapó','Caldera','Tierra Amarilla','Chañaral','Diego de Almagro','Vallenar','Alto del Carmen','Freirina','Huasco'],
  'Región de Coquimbo': ['La Serena','Coquimbo','Andacollo','La Higuera','Paiguano','Vicuña','Illapel','Canela','Los Vilos','Salamanca','Ovalle','Combarbalá','Monte Patria','Punitaqui','Río Hurtado'],
  'Región de Valparaíso': ['Valparaíso','Casablanca','Concón','Juan Fernández','Puchuncaví','Quintero','Viña del Mar','Isla de Pascua','Los Andes','Calle Larga','Rinconada','San Esteban','La Ligua','Cabildo','Papudo','Petorca','Zapallar','Quillota','Calera','Hijuelas','La Cruz','Nogales','San Antonio','Algarrobo','Cartagena','El Quisco','El Tabo','Santo Domingo','San Felipe','Catemu','Llaillay','Panquehue','Putaendo','Santa María','Quilpué','Limache','Olmué','Villa Alemana'],
  'Región Metropolitana': ['Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Santiago','Vitacura','Puente Alto','Pirque','San José de Maipo','Colina','Lampa','Tiltil','San Bernardo','Buin','Calera de Tango','Paine','Melipilla','Alhué','Curacaví','María Pinto','San Pedro','Talagante','El Monte','Isla de Maipo','Padre Hurtado','Peñaflor'],
  'Región del Libertador Gral. Bernardo O\'Higgins': ['Rancagua','Codegua','Coinco','Coltauco','Doñihue','Graneros','Las Cabras','Machalí','Malloa','Mostazal','Olivar','Peumo','Pichidegua','Quinta de Tilcoco','Rengo','Requínoa','San Vicente','Pichilemu','La Estrella','Litueche','Marchihue','Navidad','Paredones','San Fernando','Chépica','Chimbarongo','Lolol','Nancagua','Palmilla','Peralillo','Placilla','Pumanque','Santa Cruz'],
  'Región del Maule': ['Talca','Constitución','Curepto','Empedrado','Maule','Pelarco','Pencahue','Río Claro','San Clemente','San Rafael','Cauquenes','Chanco','Pelluhue','Curicó','Hualañé','Licantén','Molina','Rauco','Romeral','Sagrada Familia','Teno','Vichuquén','Linares','Colbún','Longaví','Parral','Retiro','San Javier','Villa Alegre','Yerbas Buenas'],
  'Región de Ñuble': ['Chillán','Bulnes','Chillán Viejo','El Carmen','Pemuco','Pinto','Quillón','San Ignacio','Yungay','Coihueco','Ñiquén','San Carlos','San Fabián','San Nicolás'],
  'Región del Biobío': ['Concepción','Coronel','Chiguayante','Florida','Hualqui','Lota','Penco','San Pedro de la Paz','Santa Juana','Talcahuano','Tomé','Hualpén','Lebu','Arauco','Cañete','Contulmo','Curanilahue','Los Álamos','Tirúa','Los Ángeles','Antuco','Cabrero','Laja','Mulchén','Nacimiento','Negrete','Quilaco','Quilleco','San Rosendo','Santa Bárbara','Tucapel','Yumbel','Alto Biobío'],
  'Región de La Araucanía': ['Temuco','Carahue','Cunco','Curarrehue','Freire','Galvarino','Gorbea','Lautaro','Loncoche','Melipeuco','Nueva Imperial','Padre Las Casas','Perquenco','Pitrufquén','Pucón','Saavedra','Teodoro Schmidt','Toltén','Vilcún','Villarrica','Cholchol','Angol','Collipulli','Curacautín','Ercilla','Lonquimay','Los Sauces','Lumaco','Purén','Renaico','Traiguén','Victoria'],
  'Región de Los Ríos': ['Valdivia','Corral','Futrono','La Unión','Lago Ranco','Lanco','Los Lagos','Máfil','Mariquina','Paillaco','Panguipulli','Río Bueno'],
  'Región de Los Lagos': ['Puerto Montt','Calbuco','Cochamó','Fresia','Frutillar','Los Muermos','Llanquihue','Maullín','Puerto Varas','Castro','Ancud','Chonchi','Curaco de Vélez','Dalcahue','Puqueldón','Queilén','Quellón','Quemchi','Quinchao','Osorno','Puerto Octay','Purranque','Puyehue','Río Negro','San Juan de la Costa','San Pablo','Chaitén','Futaleufú','Hualaihué','Palena'],
  'Región de Aysén': ['Coyhaique','Lago Verde','Aysén','Cisnes','Guaitecas','Cochrane','O\'Higgins','Tortel','Chile Chico','Río Ibáñez'],
  'Región de Magallanes': ['Punta Arenas','Laguna Blanca','Río Verde','San Gregorio','Cabo de Hornos','Antártica','Porvenir','Primavera','Timaukel','Natales','Torres del Paine'],
};

const REGIONES = Object.keys(REGIONES_COMUNAS);

// ── RUT formatter ─────────────────────────────────────────────
const formatRut = (raw) => {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
};

// ── Helpers ───────────────────────────────────────────────────
const MESES_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const gender = (genero) => {
  const m = genero === 'M';
  return {
    don: m ? 'don' : 'doña',
    domiciliado: m ? 'domiciliado' : 'domiciliada',
    chileno: m ? 'chileno' : 'chilena',
  };
};

const formatFecha = (dateStr) => {
  if (!dateStr) return { dia: 'XX', mes: 'XXXXXXXX', año: '2026' };
  const [y, m, d] = dateStr.split('-');
  return { dia: d, mes: MESES_CAP[parseInt(m)-1], año: y };
};

const addMonths = (dateStr, months) => {
  if (!dateStr) return 'XX de XXXXXXXX del año 20XX';
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  const f = formatFecha(d.toISOString().split('T')[0]);
  return `${f.dia} de ${f.mes} del año ${f.año}`;
};

const numToWords = (n) => {
  const ones = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
  const tens = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const hundreds = ['','cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  if (!n || isNaN(n)) return 'XXXXXXXXXX';
  const num = parseInt(n);
  if (num >= 1000000) { const m=Math.floor(num/1000000),r=num%1000000; return (m===1?'un millón':`${numToWords(m)} millones`)+(r>0?` ${numToWords(r)}`:''); }
  if (num >= 1000) { const m=Math.floor(num/1000),r=num%1000; return (m===1?'mil':`${numToWords(m)} mil`)+(r>0?` ${numToWords(r)}`:''); }
  if (num >= 100) { const h=Math.floor(num/100),r=num%100; return hundreds[h]+(r>0?` ${numToWords(r)}`:''); }
  if (num >= 20) return tens[Math.floor(num/10)]+(num%10>0?` y ${ones[num%10]}`:'');
  return ones[num]||'';
};

const formatMoney = (val) => {
  if (!val) return { num: 'XXXXXXXXXX', words: 'XXXXXXXXXX' };
  const n = parseInt(String(val).replace(/[^0-9]/g,''));
  return { num: `$${n.toLocaleString('es-CL')}`, words: numToWords(n) };
};

const buildDomicilio = (p) => {
  const parts = [];
  if (p.calle) parts.push(p.calle);
  if (p.comuna) parts.push(`comuna de ${p.comuna}`);
  if (p.region) parts.push(p.region);
  return parts.join(', ') || 'XXXXXXXXXX';
};

// ── Empty person templates ─────────────────────────────────────
const emptyProp = () => ({ nombre:'', rut:'', calle:'', region:'Región Metropolitana', comuna:'', genero:'M', nacionalidad:'chilena' });
const emptyArr  = () => ({ nombre:'', rut:'', calle:'', region:'Región Metropolitana', comuna:'', telefono:'', email:'', genero:'M', nacionalidad:'chilena' });

// ── Input components ───────────────────────────────────────────
const Field = ({ label, children, required, span2 }) => (
  <div style={{ ...fs.field, ...(span2 ? { gridColumn: 'span 2' } : {}) }}>
    <label style={fs.label}>{label}{required && <span style={{ color:'#ea4335' }}> *</span>}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder='', type='text' }) => (
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} style={fs.input} />
);

const Sel = ({ value, onChange, options }) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={fs.select}>
    {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
  </select>
);

// RUT input with auto-format
const RutInput = ({ value, onChange }) => {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9kK.\\-]/g,'');
    const clean = raw.replace(/[^0-9kK]/g,'').toUpperCase();
    onChange(formatRut(clean));
  };
  return <input value={value} onChange={handleChange} placeholder="12.345.678-9" style={fs.input} maxLength={12} />;
};

// Phone input with +569 prefix
const PhoneInput = ({ value, onChange }) => {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g,'').slice(0,8);
    onChange(digits);
  };
  const display = value ? value.replace(/(\d{4})(\d{1,4})/,'$1 $2') : '';
  return (
    <div style={{ display:'flex', alignItems:'center', border:'1px solid #dadce0', borderRadius:7, overflow:'hidden' }}>
      <span style={{ background:'#f8f9fa', padding:'8px 10px', fontSize:13, color:'#5f6368', borderRight:'1px solid #dadce0', whiteSpace:'nowrap' }}>+569</span>
      <input value={display} onChange={handleChange} placeholder="XXXX XXXX" maxLength={9}
        style={{ border:'none', outline:'none', padding:'8px 10px', fontSize:13, fontFamily:'inherit', flex:1 }} />
    </div>
  );
};

// Comuna combobox with filter
const ComunaInput = ({ region, value, onChange }) => {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const comunas = REGIONES_COMUNAS[region] || [];
  const filtered = comunas.filter(c => c.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ position:'relative' }}>
      <input value={open ? filter : value} 
        onChange={e=>{ setFilter(e.target.value); setOpen(true); }}
        onFocus={()=>{ setFilter(''); setOpen(true); }}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        placeholder="Seleccionar comuna..." style={fs.input} />
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #dadce0', borderRadius:7, zIndex:100, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
          {filtered.map(c=>(
            <div key={c} onMouseDown={()=>{ onChange(c); setFilter(''); setOpen(false); }}
              style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid #f1f3f4' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Person card ────────────────────────────────────────────────
function PersonCard({ title, person, onChange, onRemove, canRemove, type='full' }) {
  const set = (k,v) => onChange({ ...person, [k]:v });

  return (
    <div style={fs.personCard}>
      <div style={fs.personHeader}>
        <span style={fs.personTitle}>{title}</span>
        {canRemove && <button onClick={onRemove} style={fs.removeBtn}><Trash2 size={13}/></button>}
      </div>
      <div style={fs.personGrid}>
        <Field label="Nombre completo" required>
          <input value={person.nombre} onChange={e=>set('nombre', e.target.value.toUpperCase())}
            placeholder="NOMBRE COMPLETO" style={fs.input} />
        </Field>
        <Field label="RUT" required>
          <RutInput value={person.rut} onChange={v=>set('rut',v)} />
        </Field>
        <Field label="Género">
          <Sel value={person.genero} onChange={v=>set('genero',v)} options={[['M','Hombre'],['F','Mujer']]} />
        </Field>
        <Field label="Nacionalidad">
          <Input value={person.nacionalidad} onChange={v=>set('nacionalidad',v)} placeholder="chilena" />
        </Field>
        <Field label="Calle y número" required span2>
          <Input value={person.calle} onChange={v=>set('calle',v)} placeholder="Av. Ejemplo 123, departamento 45" />
        </Field>
        <Field label="Región" required>
          <Sel value={person.region} onChange={v=>{ set('region',v); set('comuna',''); }}
            options={REGIONES.map(r=>[r,r])} />
        </Field>
        <Field label="Comuna" required>
          <ComunaInput region={person.region} value={person.comuna} onChange={v=>set('comuna',v)} />
        </Field>
        {type==='full' && <>
          <Field label="Teléfono (8 dígitos)">
            <PhoneInput value={person.telefono} onChange={v=>set('telefono',v)} />
          </Field>
          <Field label="Email">
            <Input value={person.email} onChange={v=>set('email',v)} placeholder="correo@ejemplo.com" />
          </Field>
        </>}
      </div>
    </div>
  );
}

// ── Build contract document ───────────────────────────────────
function buildContractDoc(data) {
  const { propietarios, arrendatarios, fiadores, propiedad } = data;
  const fecha = formatFecha(propiedad.fechaInicio);
  const fechaFin = addMonths(propiedad.fechaInicio, 12);
  const renta = formatMoney(propiedad.arriendo);
  const garantia = formatMoney(propiedad.garantia || propiedad.arriendo);
  const hasFiador = fiadores.length > 0;
  const esCasa = propiedad.tipoProp === 'casa';

  const bold = (text) => new TextRun({ text, bold:true });
  const run  = (text) => new TextRun({ text });
  const br   = () => new Paragraph({ children:[new TextRun('')], spacing:{after:120} });

  const centered = (children, extra={}) => new Paragraph({ alignment:AlignmentType.CENTER, children, spacing:{after:120}, ...extra });
  const justified = (children, extra={}) => new Paragraph({ alignment:AlignmentType.JUSTIFIED, children, spacing:{after:160}, ...extra });
  const clausulaTitle = (text) => new Paragraph({
    alignment:AlignmentType.JUSTIFIED,
    children:[new TextRun({ text, bold:true })],
    spacing:{after:120, before:240}
  });

  // Intro runs
  const introRuns = [run(`En Santiago de Chile, `), bold(fecha.dia), run(` de `), bold(fecha.mes), run(` del año `), bold(fecha.año), run(`, entre `)];

  propietarios.forEach((p,i) => {
    const g = gender(p.genero);
    if (i>0) introRuns.push(run('; '));
    introRuns.push(run(`${g.don} `));
    introRuns.push(bold(p.nombre));
    introRuns.push(run(`, de nacionalidad ${p.nacionalidad||'chilena'}, cédula de identidad N°${p.rut||'XXXXXXXXXX'}, ${g.domiciliado} en ${buildDomicilio(p)}`));
  });
  introRuns.push(run(`, en adelante también denominad${propietarios.length>1?'os':'a como la parte '}`));
  introRuns.push(bold(propietarios.length>1 ? '"Arrendadores"' : '"Arrendadora"'));
  introRuns.push(run(`, por una parte y `));

  arrendatarios.forEach((a,i) => {
    const g = gender(a.genero);
    if (i>0) introRuns.push(run('; '));
    introRuns.push(run(`${g.don} `));
    introRuns.push(bold(a.nombre));
    introRuns.push(run(`, de nacionalidad ${a.nacionalidad||'chilena'}, cédula de identidad N°${a.rut||'XXXXXXXXXX'}, número telefónico: +569${a.telefono||'XXXXXXXX'}; correo electrónico: ${a.email||'XXXXXXXXXX'}, ${g.domiciliado} en ${buildDomicilio(a)}`));
  });
  introRuns.push(run(`; en adelante también denominad${arrendatarios.length>1?'os':'a'} como la parte `));
  introRuns.push(bold('"Arrendataria"'));

  if (hasFiador) {
    introRuns.push(run(', y '));
    fiadores.forEach((f,i) => {
      const g = gender(f.genero);
      if (i>0) introRuns.push(run('; '));
      introRuns.push(run(`${g.don} `));
      introRuns.push(bold(f.nombre));
      introRuns.push(run(`, de nacionalidad ${f.nacionalidad||'chilena'}, cédula de identidad N°${f.rut||'XXXXXXXXXX'}, número telefónico: +569${f.telefono||'XXXXXXXX'}, correo electrónico: ${f.email||'XXXXXXXXXX'}, ${g.domiciliado} en ${buildDomicilio(f)}, en su calidad de `));
      introRuns.push(bold('Fiador y Codeudor Solidario'));
    });
  }
  introRuns.push(run(`; todos ellos mayores de edad, quienes debidamente facultados acuerdan celebrar el presente Contrato de Arrendamiento, en adelante también denominado "Contrato", que consta de las cláusulas que a continuación se detallan:`));

  const promoText = propiedad.promo && propiedad.mesesPromo
    ? ` No obstante lo anterior, durante los meses de ${propiedad.mesesPromo}, la renta será de ${formatMoney(propiedad.promo).num} (${formatMoney(propiedad.promo).words}) mensuales.`
    : '';

  let inmuebleDesc = esCasa ? 'casa' : 'departamento';
  let extras = [];
  if (propiedad.bodega) extras.push(`bodega ${propiedad.bodega}`);
  if (propiedad.estacionamiento) extras.push(`estacionamiento ${propiedad.estacionamiento}`);
  const inmuebleStr = [inmuebleDesc, ...extras].join(', ') + `, todos ubicados en ${propiedad.direccion||'XXXXX'}, comuna de ${propiedad.comunaProp||'Santiago'}, Región Metropolitana`;

  const amobladoText = propiedad.amoblado
    ? `Las partes dejan constancia que el inmueble se arrienda amoblado, con los muebles y enseres que se identifican en inventario que debidamente suscrito por los contratantes, se entiende formar parte de este contrato para todos los efectos a que haya lugar.`
    : `Las partes dejan constancia que el inmueble se arrienda sin muebles, salvo aquellos que se entienden formar parte del mismo, los cuales se identifican en inventario que debidamente suscrito por los contratantes, se entiende formar parte de este contrato para todos los efectos a que haya lugar.`;

  const reajusteTexts = {
    'IPC': 'El reajuste se realizará cada seis meses una vez comenzado el contrato de arrendamiento según las variaciones del Índice de Precios al Consumidor (IPC), considerándose para el cálculo el último valor publicado del IPC previo a la aplicación del reajuste.',
    'UF': 'El reajuste se realizará cada seis meses una vez comenzado el contrato de arrendamiento según las variaciones de la Unidad de Fomento (UF), considerándose para el cálculo el valor de la UF vigente al momento de aplicar el reajuste.',
    'Sin reajuste': 'La renta de arrendamiento no estará sujeta a reajuste durante la vigencia del presente contrato.',
  };

  // Title block: CONTRATO DE ARRENDAMIENTO, then blank line, then names
  const titleParas = [
    centered([bold('CONTRATO DE ARRENDAMIENTO')], { spacing:{ after:0 } }),
    br(),
    ...propietarios.map(p => centered([bold(p.nombre||'PROPIETARIO')], { spacing:{after:0} })),
    centered([bold('A')], { spacing:{after:0} }),
    ...arrendatarios.map(a => centered([bold(a.nombre||'ARRENDATARIO')], { spacing:{after:0} })),
    ...fiadores.map(f => centered([bold(f.nombre||'FIADOR')], { spacing:{after:0} })),
    br(),
  ];

  const clausulas = [
    justified(introRuns),
    br(),
    clausulaTitle('PRIMERO: DE LA PROPIEDAD'),
    justified([run(`La parte Arrendadora, declara ser dueña del ${inmuebleStr}, en adelante todos denominados como "el Inmueble".`)]),
    clausulaTitle('SEGUNDO: DEL ARRENDAMIENTO'),
    justified([run(`Por el presente instrumento, la parte Arrendadora da en arrendamiento a la parte Arrendataria, el Inmueble singularizado en la cláusula primera precedente, para ser destinado a habitación y residencia de éste.`)]),
    justified([run(amobladoText)]),
    clausulaTitle('TERCERO: DEL PLAZO'),
    justified([run(`El presente contrato comenzará a regir el día `), bold(fecha.dia), run(` del mes de `), bold(fecha.mes), run(` del año `), bold(fecha.año), run(` y tendrá vigencia de un año, esto es, hasta el día ${fechaFin}. Vencido dicho plazo el contrato se renovará tácita, automática y sucesivamente por períodos iguales de (6) meses cada uno, a menos que alguna de las partes diere aviso a la otra de su voluntad de ponerle término, lo que deberá hacer por escrito, con a lo menos 60 días de anticipación al vencimiento del período inicial o de una cualquiera de sus prórrogas, aviso que deberá hacerse por medio de correo electrónico a la dirección fdm@renovalpropiedades.com.`)]),
    clausulaTitle('CUARTO: DE LA RENTA'),
    justified([run(`La renta de arrendamiento será la suma de `), bold(`${renta.num} (${renta.words}) mensuales`), run(`, que la parte arrendataria pagará mediante transferencia electrónica a la cuenta corriente número 27624332 del Banco Santander a nombre de Renoval Gestión Inmobiliaria Limitada; Rut: 78.299.346-1; mail: fdm@renovalpropiedades.com los primeros cinco días de cada mes. La renta de arrendamiento de ${fecha.mes} de ${fecha.año} corresponderá al `), bold('proporcional de los días de ocupación del mes'), run('.'), run(promoText)]),
    clausulaTitle('QUINTO: DEL PAGO'),
    justified([run(`El simple retardo en el pago de toda o parte de la renta mensual de arrendamiento, constituirá en mora la parte Arrendataria, quedando este obligado a pagar a título de multa, la cantidad de 0.5 Unidades de Fomento por cada día de atraso, en su equivalente en pesos al día de pago, conjuntamente con la renta adeudada. Además, en el evento de mora indicado, y si fuere del caso, serán de cargo de la parte Arrendataria todos los costos que la cobranza de la renta pudiere acarrear a la parte Arrendadora.`)]),
    justified([run(`La parte Arrendataria autoriza a la parte Arrendadora para que, en caso de el retardo, mora o incumplimiento de cualquiera de las obligaciones contraídas en el presente contrato, los datos personales y demás derivados del presente contrato, puedan ser ingresados, procesados, tratados y comunicados al registro o banco BOLETIN ELECTRONICO DICOM (Sistema de Morosidades y Protestos).`)]),
    justified([run(`Adicionalmente, el solo retraso en el pago de la renta de arrendamiento y/o servicios, dará derecho a la parte Arrendadora para poner término anticipado al arrendamiento en la forma establecida por la ley.`)]),
    clausulaTitle('SEXTO: DE LA MANTENCIÓN DEL INMUEBLE A CARGO DEL ARRENDATARIO'),
    justified([run(`La parte Arrendataria se obliga a conservar y a mantener en perfecto estado el funcionamiento y conservación del inmueble arrendado, sus artefactos, instalaciones, elementos y otros bienes incluidos en él, efectuando oportunamente y a su exclusivo cargo, las reparaciones y gastos de conservación y mantenimiento que correspondan, y sin derecho a reembolso. Entre ellas se incluye la mantención anual de calefont, caldera y aire acondicionado, en caso de contar con estos equipos la propiedad.`)]),
    justified([run(`La parte Arrendataria estará obligada a pagar con toda puntualidad y a quién corresponda, los consumos de Gastos Comunes, incluidos seguros y fondo de reserva, Energía Eléctrica, Gas, Agua Potable; Teléfono, Internet, TV Cable y demás consumos. Deberá acreditar el pago de los servicios al propietario o quién lo represente al momento de pagar la renta de arrendamiento o cuando le fuere requerido. El atraso de un mes en cualquiera de los pagos indicados, dará derecho al arrendador para suspender los servicios respectivos.`)]),
    justified([run(`Será de cargo de la parte Arrendadora, el pago de las contribuciones e impuestos territoriales y los gastos comunes de carácter extraordinarios.`)]),
    clausulaTitle('SÉPTIMO: DE LA MANTENCIÓN DEL INMUEBLE A CARGO DEL ARRENDADOR'),
    justified([run(`La parte Arrendadora entregará la propiedad con sus sistemas de gas, electricidad, agua y calefacción, como así también, todos los artefactos, como enchufes, llaves, puertas, lámparas funcionando en perfectas condiciones. Además, la propiedad se entrega recién pintada.`)]),
    justified([run(`Una vez entregada la propiedad la parte Arrendadora no tendrá la obligación de efectuar mejoras en la propiedad arrendada, salvo aquellas de envergadura mayor y cuyo origen sean: temblores, inundaciones e incendios ajenos a la responsabilidad de la parte Arrendataria, fallas estructurales de la construcción. En estos casos la parte Arrendataria notificará a la parte Arrendadora, y si este no procediera a iniciar las reparaciones pertinentes dentro de los cinco (5) días hábiles siguientes, la parte Arrendataria podrá hacerlas directamente y descontar su costo de la renta de arrendamiento, previa aprobación por parte de la Arrendadora del presupuesto respectivo.`)]),
    justified([run(`La parte Arrendadora no responderá de manera alguna por los robos, hurtos, u otros delitos contra la propiedad, ni por los daños o perjuicios producidos por actos maliciosos, incendios, inundaciones, filtraciones, explosiones, roturas de cañerías, efectos de humedad o calor, o cualquier otro de análoga naturaleza que puedan afectar al Arrendatario o a sus bienes.`)]),
    clausulaTitle('OCTAVO: DE LA GARANTÍA'),
    justified([run(`A fin de garantizar la conservación del Inmueble, su restitución en el mismo estado en que se recibe, la conservación de las especies y artefactos, el pago de los perjuicios y deterioros que se causen en el Inmueble, sus servicios e instalaciones en general, y para responder igualmente del fiel cumplimiento de las estipulaciones de este contrato, la parte Arrendataria, entrega en este acto al Arrendador, la suma `), bold(`equivalente a ${garantia.num} (${garantia.words})`), run(`, a título de garantía, que éste se obliga a devolver al término del presente contrato, dentro de los 60 (sesenta) días siguientes a la restitución de la propiedad arrendada, quedando desde luego autorizado para descontar de la cantidad mencionada, el valor efectivo de los deterioros y perjuicios de cargo de la parte Arrendataria, que se hayan ocasionados, como así mismo el valor de cuentas pendientes de Energía Eléctrica, Gas, Agua Potable, TV Cable, Teléfono, Internet, Gastos Comunes y demás consumos. La parte Arrendataria no podrá en ningún caso o circunstancia imputar la Garantía al pago de rentas insolutas, ni al arriendo del último mes que permanezca en la propiedad.`)]),
    justified([run(`Si la citada garantía no alcanza a cubrir los gastos, perjuicios y deterioros mencionados, y que son de cargo de la Arrendataria, éste se obliga a pagarlos a la parte Arrendadora, dentro de los 10 días siguientes a la fecha en que éste le requiera por escrito el pago correspondiente. La parte arrendadora no devolverá la garantía en caso de incumplimiento de la cláusula tercera del presente contrato.`)]),
    clausulaTitle('NOVENO: DE LAS PROHIBICIONES AL ARRENDATARIO'),
    justified([run(`Queda prohibido a la parte Arrendataria: perforar paredes, hacer variaciones al inmueble; ceder en arriendo o subarrendar la propiedad sin autorización previa escrita de la parte Arrendadora; darle un uso distinto a la propiedad que el indicado en la cláusula segunda del presente contrato; causar molestias a los vecinos; realizar convenios de pago para el pago cuentas de servicio y/o de gasto común sin la autorización expresa del propietario o de la corredora Renoval Propiedades.`)]),
    justified([run(`La parte Arrendataria no tendrá obligación de hacer mejoras en el inmueble y las que efectuase, sólo podrán ejecutarse, previo consentimiento por escrito de la parte Arrendadora, quedando a beneficio de la propiedad, sin que la parte Arrendadora deba pagar suma alguna por ellas, cualquiera sea el carácter, naturaleza o monto de la misma.`)]),
    justified([run(`La parte Arrendataria no podrá introducir materiales explosivos, ni materiales inflamables, drogas no permitidas, hacer variaciones en la propiedad o causar molestias a los vecinos.`)]),
    clausulaTitle('DÉCIMO: DE LA RESTITUCIÓN DEL INMUEBLE'),
    justified([run(`Producido el término de este contrato, por cualquier causa, la parte Arrendataria deberá restituir de inmediato la propiedad a la parte Arrendadora o a quién lo represente, mediante la devolución total del inmueble, la entrega de las llaves y de los recibos que acrediten el pago de los servicios de Gastos Comunes, Energía Eléctrica, Gas, Agua Potable, Teléfono, Internet, TV Cable y demás consumos, hasta el último día de ocupación de la propiedad.`)]),
    justified([run(`Si la parte Arrendataria de hecho no restituye el Inmueble en la forma prevista anteriormente, por cada día en que de hecho esté incumpliendo con ello o siga ocupando el inmueble arrendado, pagará a título de pena y uso indebido, la suma diaria de una Unidad de Fomento, que se devengará hasta el día en que haga entrega oficial y fehaciente del inmueble arrendado, y sin perjuicio del pago del canon de arriendo correspondiente.`)]),
    clausulaTitle('DÉCIMO PRIMERO: VISITAS AL INMUEBLE'),
    justified([run(`Se deja establecido que, en caso de término del contrato, la parte Arrendataria queda obligado a permitir que la parte Arrendadora o quién lo represente junto a terceros interesados en el arriendo de la propiedad lo puedan visitar a lo menos tres (3) veces a la semana, durante dos (2) horas cada día, en horario a definir de común acuerdo entre las partes, durante los últimos sesenta (60) días de duración del contrato.`)]),
    justified([run(`De igual manera, la parte Arrendataria se obliga a dar facilidades necesarias para que la parte arrendadora, o quien lo represente, pueda visitar el inmueble cuando este lo desee en horario a definir de común acuerdo.`)]),
    clausulaTitle('DÉCIMO SEGUNDO: DE LA LINEA TELEFÓNICA Y OTROS SERVICIOS'),
    justified([run(`La propiedad se arrienda sin teléfono, sin Internet y sin TV Cable, quedando desde ya la parte arrendataria autorizada para contratar la línea telefónica y los otros servicios de su conveniencia, siendo de su cargo y total responsabilidad.`)]),
    clausulaTitle('DÉCIMO TERCERO: DEL DOMICILIO'),
    justified([run(`Para todos los efectos legales que deriven del presente contrato, las partes fijan su domicilio en la ciudad de Santiago y se someten a la Jurisdicción de sus Tribunales.`)]),
    clausulaTitle('DÉCIMO CUARTO: ACCIONES JUDICIALES'),
    justified([run(`En la eventualidad que La parte Arrendataria, no hiciere el pago correspondiente a un mes de la renta de arrendamiento; dará derecho a la parte Arrendadora a iniciar de inmediato las acciones judiciales tendientes a pedir la restitución del inmueble, rentas impagas, consumos, deterioros del inmueble, y los gastos que se ocasionen con motivo del juicio. (Judiciales y honorarios de abogados).`)]),
    clausulaTitle('DÉCIMO QUINTO: VARIOS'),
    justified([bold('A). - REAJUSTABILIDAD: '), run(reajusteTexts[propiedad.reajuste]||reajusteTexts['IPC'])]),
    justified([bold('B). - REUNIONES COMUNIDAD: '), run('Será obligación de la parte arrendataria participar en las juntas de residentes y co-propietarios, para evitar el cobro de multas por no asistencia, en caso contrario serán de cargo de la parte arrendataria.')]),
  ];

  if (hasFiador) {
    clausulas.push(clausulaTitle('DÉCIMO SEXTO: FIADOR Y CODEUDOR SOLIDARIO'));
    fiadores.forEach(f => {
      const g = gender(f.genero);
      clausulas.push(justified([
        run(`Presente en este acto ${g.don} `), bold(f.nombre),
        run(`, ya individualizado en el presente contrato, se constituye en fiador y codeudor solidario de todas y cada una de las obligaciones contraídas por la parte Arrendataria en virtud del presente contrato y hasta su total extinción, y declara que renuncia, en consecuencia, a los beneficios de excusión y de división que le pudieren corresponder de acuerdo a la Ley, aceptando desde luego y sin previa notificación, las modificaciones que las partes puedan introducirle, sea en cuanto al monto de la renta, plazo u otras estipulaciones.`)
      ]));
    });
  }

  // Signatures
  clausulas.push(br(), br());
  const sigLine = '---------------------------------------------------';
  propietarios.forEach(p => {
    clausulas.push(justified([run(`${sigLine}                    `), bold(p.nombre.toUpperCase())]));
    clausulas.push(justified([bold('ARRENDADOR')]));
    clausulas.push(br());
  });
  arrendatarios.forEach(a => {
    clausulas.push(justified([run(`${sigLine}                    `), bold(a.nombre.toUpperCase())]));
    clausulas.push(justified([bold('ARRENDATARIO')]));
    clausulas.push(br());
  });
  fiadores.forEach(f => {
    clausulas.push(justified([run(`${sigLine}                    `), bold(f.nombre.toUpperCase())]));
    clausulas.push(justified([bold('FIADOR Y CODEUDOR SOLIDARIO')]));
    clausulas.push(br());
  });

  // Logo as ImageRun for header
  const logoBuffer = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
  const logoHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 200, height: 60 },
            type: 'jpg',
          }),
        ],
        spacing: { after: 120 },
      }),
    ],
  });

  return new Document({
    styles: { default: { document: { run: { font:'Arial', size:22 } } } },
    sections: [{
      properties: {
        page: { size:{ width:11906, height:16838 }, margin:{ top:1417, right:1134, bottom:1134, left:1134 } },
        titlePage: true,
      },
      headers: {
        first: logoHeader,
        default: new Header({ children: [new Paragraph('')] }),
      },
      children: [...titleParas, ...clausulas]
    }]
  });
}

// ── Preview page ──────────────────────────────────────────────
function PreviewPage({ data, onBack }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const doc = buildContractDoc(data);
      const blob = await Packer.toBlob(doc);
      const name = `Contrato_${data.arrendatarios[0]?.nombre?.split(' ')[0]||'Arriendo'}.docx`;
      saveAs(blob, name);
    } catch(e) { alert('Error: '+e.message); }
    setGenerating(false);
  };

  const { propietarios, arrendatarios, fiadores, propiedad } = data;
  const fecha = formatFecha(propiedad.fechaInicio);
  const renta = formatMoney(propiedad.arriendo);
  const hasFiador = fiadores.length > 0;

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <button onClick={onBack} style={fs.backBtn}><ChevronLeft size={16} style={{marginRight:4}}/>Volver al formulario</button>
        <button onClick={handleDownload} disabled={generating} style={fs.downloadBtn}>
          <Download size={15} style={{marginRight:5}}/>
          {generating?'Generando...':'Descargar Word (.docx)'}
        </button>
      </div>
      <div style={fs.previewDoc}>
        <div style={{ textAlign:'center', marginBottom:24, lineHeight:2 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>CONTRATO DE ARRENDAMIENTO</div>
          <br/>
          {propietarios.map(p=><div key={p.nombre} style={{fontWeight:700}}>{p.nombre}</div>)}
          <div style={{fontWeight:700}}>A</div>
          {arrendatarios.map(a=><div key={a.nombre} style={{fontWeight:700}}>{a.nombre}</div>)}
          {fiadores.map(f=><div key={f.nombre} style={{fontWeight:700}}>{f.nombre}</div>)}
        </div>
        <p style={fs.previewP}>
          En Santiago de Chile, <strong>{fecha.dia} de {fecha.mes} del año {fecha.año}</strong>, entre{' '}
          {propietarios.map((p,i)=><span key={i}>{i>0?' y ':''}{gender(p.genero).don} <strong>{p.nombre}</strong>, de nacionalidad {p.nacionalidad}, cédula de identidad N°{p.rut}, {gender(p.genero).domiciliado} en {buildDomicilio(p)}</span>)},
          en adelante la parte <strong>{propietarios.length>1?'"Arrendadores"':'"Arrendadora"'}</strong>, por una parte y{' '}
          {arrendatarios.map((a,i)=><span key={i}>{i>0?' y ':''}{gender(a.genero).don} <strong>{a.nombre}</strong>, de nacionalidad {a.nacionalidad}, cédula de identidad N°{a.rut}, número telefónico: +569{a.telefono}, correo electrónico: {a.email}, {gender(a.genero).domiciliado} en {buildDomicilio(a)}</span>)};
          en adelante la parte <strong>"Arrendataria"</strong>
          {hasFiador && <>, y {fiadores.map((f,i)=><span key={i}>{i>0?' y ':''}{gender(f.genero).don} <strong>{f.nombre}</strong>, en su calidad de <strong>Fiador y Codeudor Solidario</strong></span>)}</>}.
        </p>
        {[
          ['PRIMERO: DE LA PROPIEDAD', `La parte Arrendadora declara ser dueña del ${propiedad.tipoProp==='casa'?'casa':'departamento'}${propiedad.bodega?`, bodega ${propiedad.bodega}`:''}${propiedad.estacionamiento?`, estacionamiento ${propiedad.estacionamiento}`:''}, ubicado en ${propiedad.direccion}, ${propiedad.comunaProp}, Región Metropolitana.`],
          ['TERCERO: DEL PLAZO', `Inicio: ${fecha.dia} de ${fecha.mes} del año ${fecha.año}. Vigencia: 1 año. Renovación automática por períodos de 6 meses.`],
          ['CUARTO: DE LA RENTA', 'Renta mensual: ' + renta.num + ' (' + renta.words + ').' + (propiedad.promo ? ' Valor promocional: ' + formatMoney(propiedad.promo).num + ' durante ' + propiedad.mesesPromo + '.' : '')],
          ['DÉCIMO QUINTO A: REAJUSTABILIDAD', propiedad.reajuste],
          ...(hasFiador ? [['DÉCIMO SEXTO: FIADOR', fiadores.map(f=>f.nombre).join(', ')]] : [])
        ].filter(Boolean).map(([title, text])=>(
          <div key={title} style={{marginBottom:14}}>
            <div style={{fontWeight:700, marginBottom:4}}>{title}</div>
            <p style={fs.previewP}>{text}</p>
          </div>
        ))}
        <p style={{color:'#9aa0a6',fontSize:12,textAlign:'center',marginTop:24}}>Vista previa resumida — el documento descargado contiene el contrato completo</p>
      </div>
    </div>
  );
}

// ── Main form page ─────────────────────────────────────────────
export default function ContratosPage() {
  const [propietarios, setPropietarios] = useState([emptyProp()]);
  const [arrendatarios, setArrendatarios] = useState([emptyArr()]);
  const [fiadores, setFiadores] = useState([]);
  const [propiedad, setPropiedad] = useState({
    direccion:'', comunaProp:'Santiago', bodega:'', estacionamiento:'',
    arriendo:'', garantia:'', promo:'', mesesPromo:'',
    fechaInicio:'', reajuste:'IPC', tipoProp:'departamento', amoblado:false,
  });
  const [showPreview, setShowPreview] = useState(false);

  const setProp = (k,v) => setPropiedad(p=>({...p,[k]:v}));
  const updateP = (list,setList,i,val) => { const n=[...list]; n[i]=val; setList(n); };
  const removeP = (list,setList,i) => setList(list.filter((_,j)=>j!==i));

  const contractData = useMemo(()=>({ propietarios, arrendatarios, fiadores, propiedad }),[propietarios,arrendatarios,fiadores,propiedad]);

  if (showPreview) return <PreviewPage data={contractData} onBack={()=>setShowPreview(false)} />;

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <div>
          <h1 style={fs.title}>Generador de Contratos</h1>
          <p style={fs.subtitle}>Completa los datos para generar el contrato de arriendo</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowPreview(true)} style={fs.previewBtn}>
            <Eye size={15} style={{marginRight:5}}/>Vista previa
          </button>
        </div>
      </div>

      <div style={fs.body}>
        {/* Propietarios */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Propietario(s)</span>
            <button onClick={()=>setPropietarios([...propietarios,emptyProp()])} style={fs.addBtn}><Plus size={13} style={{marginRight:4}}/>Agregar</button>
          </div>
          {propietarios.map((p,i)=>(
            <PersonCard key={i} title={`Propietario${propietarios.length>1?' '+(i+1):''}`}
              person={p} type="prop"
              onChange={v=>updateP(propietarios,setPropietarios,i,v)}
              onRemove={()=>removeP(propietarios,setPropietarios,i)}
              canRemove={propietarios.length>1} />
          ))}
        </div>

        {/* Arrendatarios */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Arrendatario(s)</span>
            <button onClick={()=>setArrendatarios([...arrendatarios,emptyArr()])} style={fs.addBtn}><Plus size={13} style={{marginRight:4}}/>Agregar</button>
          </div>
          {arrendatarios.map((a,i)=>(
            <PersonCard key={i} title={`Arrendatario${arrendatarios.length>1?' '+(i+1):''}`}
              person={a} type="full"
              onChange={v=>updateP(arrendatarios,setArrendatarios,i,v)}
              onRemove={()=>removeP(arrendatarios,setArrendatarios,i)}
              canRemove={arrendatarios.length>1} />
          ))}
        </div>

        {/* Fiadores */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Fiador(es) y Codeudor(es) Solidario(s)</span>
            <button onClick={()=>setFiadores([...fiadores,emptyArr()])} style={fs.addBtn}><Plus size={13} style={{marginRight:4}}/>Agregar</button>
          </div>
          {fiadores.length===0 && <p style={{color:'#9aa0a6',fontSize:13,padding:'6px 0'}}>Sin fiador — la cláusula décimo sexta no se incluirá</p>}
          {fiadores.map((f,i)=>(
            <PersonCard key={i} title={`Fiador${fiadores.length>1?' '+(i+1):''}`}
              person={f} type="full"
              onChange={v=>updateP(fiadores,setFiadores,i,v)}
              onRemove={()=>removeP(fiadores,setFiadores,i)}
              canRemove={true} />
          ))}
        </div>

        {/* Propiedad */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Datos de la Propiedad</span></div>
          <div style={fs.propGrid}>
            <Field label="Dirección (calle y número)" required span2>
              <Input value={propiedad.direccion} onChange={v=>setProp('direccion',v)} placeholder="Av. Ejemplo 123" />
            </Field>
            <Field label="Comuna de la propiedad" required>
              <ComunaInput region="Región Metropolitana" value={propiedad.comunaProp} onChange={v=>setProp('comunaProp',v)} />
            </Field>
            <Field label="Tipo de propiedad">
              <Sel value={propiedad.tipoProp} onChange={v=>setProp('tipoProp',v)} options={[['departamento','Departamento'],['casa','Casa']]} />
            </Field>
            <Field label="¿Amoblado?">
              <Sel value={propiedad.amoblado?'si':'no'} onChange={v=>setProp('amoblado',v==='si')} options={[['no','Sin muebles'],['si','Amoblado']]} />
            </Field>
            <Field label="N° Bodega (opcional)">
              <Input value={propiedad.bodega} onChange={v=>setProp('bodega',v)} placeholder="B-12" />
            </Field>
            <Field label="N° Estacionamiento (opcional)">
              <Input value={propiedad.estacionamiento} onChange={v=>setProp('estacionamiento',v)} placeholder="E-5" />
            </Field>
          </div>
        </div>

        {/* Condiciones */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Condiciones del Contrato</span></div>
          <div style={fs.propGrid}>
            <Field label="Fecha de inicio" required>
              <Input value={propiedad.fechaInicio} onChange={v=>setProp('fechaInicio',v)} type="date" />
            </Field>
            <Field label="Reajuste">
              <Sel value={propiedad.reajuste} onChange={v=>setProp('reajuste',v)}
                options={[['IPC','IPC (cada 6 meses)'],['UF','UF (cada 6 meses)'],['Sin reajuste','Sin reajuste']]} />
            </Field>
            <Field label="Monto arriendo ($)" required>
              <Input value={propiedad.arriendo} onChange={v=>setProp('arriendo',v)} placeholder="450000" />
            </Field>
            <Field label="Monto garantía ($)">
              <Input value={propiedad.garantia} onChange={v=>setProp('garantia',v)} placeholder="Vacío = igual al arriendo" />
            </Field>
            <Field label="Monto promocional ($, opcional)">
              <Input value={propiedad.promo} onChange={v=>setProp('promo',v)} placeholder="350000" />
            </Field>
            {propiedad.promo && (
              <Field label="Meses de promoción">
                <Input value={propiedad.mesesPromo} onChange={v=>setProp('mesesPromo',v)} placeholder="enero y febrero de 2026" />
              </Field>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const fs = {
  container: { height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Google Sans','Segoe UI',sans-serif" },
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexShrink:0 },
  title: { fontSize:24, fontWeight:700, color:'#202124', margin:'0 0 4px' },
  subtitle: { fontSize:14, color:'#5f6368', margin:0 },
  previewBtn: { display:'flex', alignItems:'center', padding:'9px 14px', background:'#fff', color:'#1a73e8', border:'1px solid #1a73e8', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  downloadBtn: { display:'flex', alignItems:'center', padding:'9px 14px', background:'#1a73e8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  backBtn: { display:'flex', alignItems:'center', padding:'8px 14px', background:'#fff', color:'#5f6368', border:'1px solid #dadce0', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  body: { flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:16 },
  section: { background:'#fff', border:'1px solid #e8eaed', borderRadius:12, padding:20, flexShrink:0 },
  sectionHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  sectionTitle: { fontSize:14, fontWeight:700, color:'#202124' },
  addBtn: { display:'flex', alignItems:'center', padding:'5px 10px', background:'#e8f0fe', color:'#1a73e8', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  personCard: { border:'1px solid #e8eaed', borderRadius:10, padding:14, marginBottom:10, background:'#fafafa' },
  personHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  personTitle: { fontSize:12, fontWeight:700, color:'#5f6368', textTransform:'uppercase', letterSpacing:0.5 },
  removeBtn: { background:'none', border:'none', cursor:'pointer', padding:4, color:'#ea4335', display:'flex' },
  personGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' },
  propGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' },
  field: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:11, fontWeight:600, color:'#5f6368' },
  input: { border:'1px solid #dadce0', borderRadius:7, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' },
  select: { border:'1px solid #dadce0', borderRadius:7, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fff', appearance:'none', WebkitAppearance:'none' },
  previewDoc: { flex:1, overflow:'auto', background:'#fff', border:'1px solid #e8eaed', borderRadius:12, padding:'40px 48px', maxWidth:800, margin:'0 auto', width:'100%', lineHeight:1.8 },
  previewP: { textAlign:'justify', lineHeight:1.8, marginBottom:12, fontSize:13 },
};
