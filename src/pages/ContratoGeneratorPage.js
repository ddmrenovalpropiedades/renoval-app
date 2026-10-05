import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Download, ChevronLeft, AlertTriangle } from 'lucide-react';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';
import { renderPlantilla, contarFaltantes } from '../lib/plantillas/render';
import { docxABlob } from '../lib/plantillas/docx';
import { PLANTILLA_ARRIENDO_BASE, SLUG_ARRIENDO } from '../lib/plantillas/plantillaBase';
import VistaPrevia from '../lib/plantillas/VistaPrevia';

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

// ── Helpers ───────────────────────────────────────────────────
const formatRut = (raw) => {
  const clean = raw.replace(/[^0-9kK]/g,'').toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0,-1), dv = clean.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + '-' + dv;
};

const formatMiles = (val) => {
  const clean = String(val).replace(/[^0-9]/g,'');
  if (!clean) return '';
  return '$' + parseInt(clean).toLocaleString('es-CL');
};

const parseMiles = (val) => String(val).replace(/[^0-9]/g,'');

// ── Empty templates ───────────────────────────────────────────
const emptyProp  = () => ({ nombre:'', rut:'', calle:'', region:'Región Metropolitana', comuna:'', genero:'M', nacionalidad:'chilena' });
const emptyArr   = (defaultCalle='', defaultRegion='Región Metropolitana', defaultComuna='') =>
  ({ nombre:'', rut:'', calle:defaultCalle, region:defaultRegion, comuna:defaultComuna, telefono:'', email:'', genero:'M', nacionalidad:'chilena' });

// ── Money input ───────────────────────────────────────────────
function MoneyInput({ value, onChange, placeholder='0' }) {
  const handleChange = (e) => {
    const raw = parseMiles(e.target.value);
    onChange(raw);
  };
  const display = value ? formatMiles(value) : '';
  return (
    <input value={display} onChange={handleChange} placeholder={`$${placeholder}`}
      style={fs.input} />
  );
}

// ── Input components ───────────────────────────────────────────
const Field = ({ label, children, required, span2 }) => (
  <div style={{ ...fs.field, ...(span2?{gridColumn:'span 2'}:{}) }}>
    <label style={fs.label}>{label}{required&&<span style={{color:'#ea4335'}}> *</span>}</label>
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
const RutInput = ({ value, onChange }) => (
  <input value={value}
    onChange={e=>onChange(formatRut(e.target.value))}
    placeholder="12.345.678-9" style={fs.input} maxLength={12} />
);
const PhoneInput = ({ value, onChange }) => {
  const digits = parseMiles(value).slice(0,8);
  const display = digits ? digits.replace(/(\d{4})(\d{1,4})/,'$1 $2') : '';
  return (
    <div style={{display:'flex',alignItems:'center',border:'1px solid #dadce0',borderRadius:7,overflow:'hidden'}}>
      <span style={{background:'#f8f9fa',padding:'8px 10px',fontSize:13,color:'#5f6368',borderRight:'1px solid #dadce0',whiteSpace:'nowrap'}}>+569</span>
      <input value={display} onChange={e=>onChange(parseMiles(e.target.value).slice(0,8))}
        placeholder="XXXX XXXX" maxLength={9}
        style={{border:'none',outline:'none',padding:'8px 10px',fontSize:13,fontFamily:'inherit',flex:1}} />
    </div>
  );
};

function ComunaInput({ region, value, onChange }) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const comunas = REGIONES_COMUNAS[region]||[];
  const filtered = comunas.filter(c=>c.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div style={{position:'relative'}}>
      <input value={open?filter:value}
        onChange={e=>{setFilter(e.target.value);setOpen(true);}}
        onFocus={()=>{setFilter('');setOpen(true);}}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        placeholder="Seleccionar comuna..." style={fs.input} />
      {open && filtered.length>0 && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #dadce0',borderRadius:7,zIndex:100,maxHeight:200,overflowY:'auto',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
          {filtered.map(c=>(
            <div key={c} onMouseDown={()=>{onChange(c);setFilter('');setOpen(false);}}
              style={{padding:'8px 12px',fontSize:13,cursor:'pointer',borderBottom:'1px solid #f1f3f4'}}
              onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ title, person, onChange, onRemove, canRemove, type='full' }) {
  const set=(k,v)=>onChange({...person,[k]:v});
  return (
    <div style={fs.personCard}>
      <div style={fs.personHeader}>
        <span style={fs.personTitle}>{title}</span>
        {canRemove&&<button onClick={onRemove} style={fs.removeBtn}><Trash2 size={13}/></button>}
      </div>
      <div style={fs.personGrid}>
        <Field label="Nombre completo" required>
          <input value={person.nombre} onChange={e=>set('nombre',e.target.value.toUpperCase())}
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
          <Input value={person.calle} onChange={v=>set('calle',v)} placeholder="Av. Ejemplo 123, Departamento 45" />
        </Field>
        <Field label="Región" required>
          <Sel value={person.region} onChange={v=>{set('region',v);set('comuna','');}}
            options={REGIONES.map(r=>[r,r])} />
        </Field>
        <Field label="Comuna" required>
          <ComunaInput region={person.region} value={person.comuna} onChange={v=>set('comuna',v)} />
        </Field>
        {type==='full'&&<>
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


// ── Plantilla vigente ─────────────────────────────────────────
// El texto del contrato sale de la plantilla editable (Documentos → editor de
// plantilla). Si todavía no hay versiones guardadas en Supabase, se usa la
// plantilla base del sistema, que reproduce el texto histórico.
function usePlantillaVigente() {
  const [plantilla, setPlantilla] = useState({ cargando: true, id: null, version: null, contenido: PLANTILLA_ARRIENDO_BASE, error: '' });

  useEffect(() => {
    let activo = true;
    supabase
      .from('doc_plantillas')
      .select('id, version, contenido')
      .eq('slug', SLUG_ARRIENDO)
      .order('version', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!activo) return;
        const fila = data && data[0];
        setPlantilla({
          cargando: false,
          id: fila?.id || null,
          version: fila?.version || null,
          contenido: fila?.contenido || PLANTILLA_ARRIENDO_BASE,
          error: error ? 'No se pudo cargar la plantilla vigente; se usa la plantilla base.' : '',
        });
      });
    return () => { activo = false; };
  }, []);

  return plantilla;
}

const tituloContrato = (data) => {
  const p = data.propiedad || {};
  const direccion = [p.calle, p.numeroProp].filter(Boolean).join(' ');
  return `Contrato — ${direccion || 'sin dirección'}`;
};

// ── Preview page ──────────────────────────────────────────────
function PreviewPage({ data, onBack, registrar = true }) {
  const [generating, setGenerating] = useState(false);
  const plantilla = usePlantillaVigente();
  const { arrendatarios } = data;

  const bloques = useMemo(
    () => renderPlantilla(plantilla.contenido, data),
    [plantilla.contenido, data],
  );
  const faltantes = contarFaltantes(bloques);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const blob = await docxABlob(bloques);
      saveAs(blob, `Contrato_${arrendatarios[0]?.nombre?.split(' ')[0] || 'Arriendo'}.docx`);
      // Registro del documento emitido (versión exacta + datos). No bloquea la descarga.
      if (registrar && plantilla.id) {
        supabase.from('doc_generados').insert({
          plantilla_id: plantilla.id,
          tipo: 'contrato_arriendo',
          titulo: tituloContrato(data),
          datos: data,
        }).then(({ error }) => { if (error) console.error('No se pudo registrar el contrato generado:', error.message); });
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setGenerating(false);
  };

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <button onClick={onBack} style={fs.backBtn}><ChevronLeft size={16} style={{marginRight:4}}/>Volver al formulario</button>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#80868b' }}>
            {plantilla.cargando ? 'Cargando plantilla…' : plantilla.version ? `Plantilla v${plantilla.version}` : 'Plantilla base'}
          </span>
          <button onClick={handleDownload} disabled={generating || plantilla.cargando} style={{ ...fs.downloadBtn, opacity: generating || plantilla.cargando ? 0.6 : 1 }}>
            <Download size={15} style={{marginRight:5}}/>
            {generating?'Generando...':'Descargar Word (.docx)'}
          </button>
        </div>
      </div>
      {(faltantes > 0 || plantilla.error) && (
        <div style={fs.aviso}>
          <AlertTriangle size={15} style={{ flexShrink:0 }} />
          <span>
            {faltantes > 0 && `Faltan ${faltantes} dato${faltantes > 1 ? 's' : ''} (marcados en amarillo). `}
            {plantilla.error}
          </span>
        </div>
      )}
      <div style={fs.previewWrap}>
        <VistaPrevia bloques={bloques} />
      </div>
    </div>
  );
}


// ── Test data generator ────────────────────────────────────────
const NAMES_M = ['CARLOS ANDRÉS MUÑOZ REYES','PEDRO IGNACIO SOTO CAMPOS','DIEGO ALEJANDRO VARGAS LUNA','JORGE ANTONIO HERRERA PINTO','MARCELO FRANCISCO CASTRO DÍAZ'];
const NAMES_F = ['MARÍA ELENA TORRES SILVA','ANA PAULA FUENTES MORA','CAROLINA BEATRIZ LAGOS ROJAS','VALENTINA ANDREA PÉREZ VEGA','SOFÍA CONSTANZA ARAYA NAVARRO'];
const RUTS_M = ['12.345.678-9','15.234.567-K','18.901.234-5','11.222.333-4','16.789.012-3'];
const RUTS_F = ['13.456.789-0','14.567.890-1','17.890.123-6','10.123.456-7','19.012.345-8'];
const TELEFONOS = ['98765432','87654321','91234567','96543210','92345678'];
const EMAILS_M = ['cmuñoz@gmail.com','psoto@hotmail.com','dvargas@gmail.com','jherrera@yahoo.com','mcastro@gmail.com'];
const EMAILS_F = ['mtorres@gmail.com','afuentes@hotmail.com','clagos@gmail.com','vperez@yahoo.com','saraya@gmail.com'];
const CALLES_PROP = [
  'Av. Providencia 1234, Departamento 501',
  'Calle Las Condes 567, Casa 12',
  'Av. Ñuñoa 890, Departamento 302',
  'Calle Macul 234, Departamento 104',
  'Av. San Miguel 789, Departamento 805',
];
const CALLES_PERSONA = [
  "Av. Bernardo O'Higgins 1100",
  'Calle Moneda 890',
  'Av. Irarrázaval 2345',
  'Calle Portugal 456',
  'Av. Italia 789',
];

const pickRandom = (arr, i) => arr[i % arr.length];

function generatePerson(genero, index, type) {
  const isMale = genero === 'M';
  const names = isMale ? NAMES_M : NAMES_F;
  const ruts = isMale ? RUTS_M : RUTS_F;
  const emails = isMale ? EMAILS_M : EMAILS_F;
  const i = (index + type.length) % 5;
  return {
    nombre: pickRandom(names, i),
    rut: pickRandom(ruts, i),
    genero,
    nacionalidad: 'chilena',
    calle: pickRandom(CALLES_PERSONA, i + type.length),
    region: 'Región Metropolitana',
    comuna: ['Santiago','Providencia','Las Condes','Ñuñoa','La Florida'][i],
    telefono: TELEFONOS[i],
    email: emails[i],
  };
}

function TestContratosPage({ onBack }) {
  const [config, setConfig] = useState({
    nProp: 1, gProp: ['M'],
    nArr: 1, gArr: ['M'],
    nFia: 0, gFia: [],
    tipoProp: 'departamento',
    numeroProp: '502',
    bodega: false,
    estacionamiento: false,
    amoblado: false,
    monedaArriendo: 'CLP',
    tienePromo: false,
    generado: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [contractData, setContractData] = useState(null);

  const setC = (k, v) => setConfig(p => ({ ...p, [k]: v }));

  const updateCount = (field, gField, n) => {
    const prev = config[gField];
    const newG = Array.from({ length: n }, (_, i) => prev[i] || 'M');
    setC(field, n);
    setC(gField, newG);
  };

  const GenderRow = ({ list, onChange }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      {list.map((g, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#5f6368' }}>#{i+1}:</span>
          <select value={g} onChange={e => { const n=[...list]; n[i]=e.target.value; onChange(n); }}
            style={{ ...fs.select, padding: '4px 8px', fontSize: 12 }}>
            <option value="M">Hombre</option>
            <option value="F">Mujer</option>
          </select>
        </div>
      ))}
    </div>
  );

  const handleGenerate = () => {
    const propietarios = config.gProp.map((g, i) => generatePerson(g, i, 'prop'));
    const arrendatarios = config.gArr.map((g, i) => generatePerson(g, i, 'arr'));
    const fiadores = config.gFia.map((g, i) => generatePerson(g, i, 'fia'));

    const data = {
      propietarios,
      arrendatarios,
      fiadores,
      propiedad: {
        calle: pickRandom(CALLES_PROP, config.nProp + config.nArr),
        tipoProp: config.tipoProp,
        numeroProp: config.tipoProp === 'departamento' ? config.numeroProp : config.numeroProp,
        regionProp: 'Región Metropolitana',
        comunaProp: 'Providencia',
        bodega: config.bodega ? 'B-23' : '',
        estacionamiento: config.estacionamiento ? 'E-14' : '',
        amoblado: config.amoblado,
        monedaArriendo: config.monedaArriendo,
        arriendo: config.monedaArriendo === 'UF' ? '28' : '450000',
        garantia: '',
        promo: config.tienePromo ? (config.monedaArriendo === 'UF' ? '22' : '350000') : '',
        mesesPromo: config.tienePromo ? 'enero y febrero de 2026' : '',
        fechaInicio: '2026-06-01',
        reajuste: 'IPC (cada 6 meses)',
      },
    };
    setContractData(data);
    setShowPreview(true);
  };

  if (showPreview && contractData) {
    return <PreviewPage data={contractData} onBack={() => setShowPreview(false)} registrar={false} />;
  }

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <div>
          <h1 style={{ ...fs.title, color: '#f57c00' }}>🧪 Generador de Contratos de Prueba</h1>
          <p style={fs.subtitle}>Solo visible para administradores — los datos son inventados</p>
        </div>
        <button onClick={onBack} style={fs.backBtn}><ChevronLeft size={16} style={{marginRight:4}}/>Volver</button>
      </div>

      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:16 }}>
        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Firmantes</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            {[
              { label:'Propietarios', countKey:'nProp', gKey:'gProp' },
              { label:'Arrendatarios', countKey:'nArr', gKey:'gArr' },
              { label:'Fiadores', countKey:'nFia', gKey:'gFia' },
            ].map(({ label, countKey, gKey }) => (
              <div key={countKey}>
                <label style={fs.label}>{label}</label>
                <select value={config[countKey]} onChange={e => updateCount(countKey, gKey, parseInt(e.target.value))}
                  style={{ ...fs.select, marginTop:4 }}>
                  {[0,1,2,3].map(n => (countKey === 'nProp' || countKey === 'nArr') && n === 0 ? null :
                    <option key={n} value={n}>{n}</option>
                  )}
                </select>
                {config[countKey] > 0 && (
                  <GenderRow list={config[gKey]} onChange={v => setC(gKey, v)} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Propiedad</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div>
              <label style={fs.label}>Tipo</label>
              <select value={config.tipoProp} onChange={e => setC('tipoProp', e.target.value)} style={{ ...fs.select, marginTop:4 }}>
                <option value="departamento">Departamento</option>
                <option value="casa">Casa</option>
              </select>
            </div>
            <div>
              <label style={fs.label}>Número</label>
              <input value={config.numeroProp} onChange={e => setC('numeroProp', e.target.value)}
                style={{ ...fs.input, marginTop:4 }} placeholder="502" />
            </div>
            <div>
              <label style={fs.label}>Moneda arriendo</label>
              <select value={config.monedaArriendo} onChange={e => setC('monedaArriendo', e.target.value)} style={{ ...fs.select, marginTop:4 }}>
                <option value="CLP">Pesos ($)</option>
                <option value="UF">UF</option>
              </select>
            </div>
            {[
              { key:'bodega', label:'¿Bodega?' },
              { key:'estacionamiento', label:'¿Estacionamiento?' },
              { key:'amoblado', label:'¿Amoblado?' },
              { key:'tienePromo', label:'¿Valor promocional?' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={fs.label}>{label}</label>
                <select value={config[key] ? 'si' : 'no'} onChange={e => setC(key, e.target.value === 'si')}
                  style={{ ...fs.select, marginTop:4 }}>
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleGenerate}
          style={{ padding:'12px 24px', background:'#f57c00', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', alignSelf:'flex-start' }}>
          🧪 Generar contrato de prueba
        </button>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────
export default function ContratoGeneratorPage() {
  const { profile } = useAuth();
  const isOwner = profile?.isOwner;
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'test'
  const [propiedad, setPropiedad] = useState({
    calle:'', tipoProp:'departamento', numeroProp:'', regionProp:'Región Metropolitana', comunaProp:'',
    bodega:'', estacionamiento:'', amoblado:false,
    monedaArriendo:'CLP', arriendo:'', garantia:'', promo:'', mesesPromo:'',
    fechaInicio:'', reajuste:'IPC (cada 6 meses)',
  });
  const [propietarios, setPropietarios] = useState([emptyProp()]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [fiadores, setFiadores] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const setProp = (k,v) => setPropiedad(p=>({...p,[k]:v}));
  const updateP = (list,setList,i,val) => { const n=[...list]; n[i]=val; setList(n); };
  const removeP = (list,setList,i) => setList(list.filter((_,j)=>j!==i));

  const defaultArrCalle = useMemo(() => {
    const parts=[];
    if(propiedad.calle) parts.push(propiedad.calle);
    return parts.join(', ');
  }, [propiedad.calle]);

  const addArrendatario = () => setArrendatarios(prev => [...prev, emptyArr(defaultArrCalle, propiedad.regionProp, propiedad.comunaProp)]);

  const contractData = useMemo(()=>({ propietarios, arrendatarios, fiadores, propiedad }), [propietarios,arrendatarios,fiadores,propiedad]);

  if (showPreview) return <PreviewPage data={contractData} onBack={()=>setShowPreview(false)} />;

  if (activeTab === 'test') return <TestContratosPage onBack={() => setActiveTab('form')} />;

  return (
    <div style={fs.container}>
      <div style={fs.header}>
        <div>
          <h1 style={fs.title}>Generador de Contratos</h1>
          <p style={fs.subtitle}>Completa los datos para generar el contrato de arriendo</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isOwner && (
            <button onClick={()=>setActiveTab('test')} style={{ ...fs.backBtn, color:'#f57c00', borderColor:'#f57c00' }}
              title="Generador de prueba (solo administradores)">
              🧪 Prueba rápida
            </button>
          )}
          <button onClick={()=>setShowPreview(true)} style={fs.previewBtn}>Vista previa y descarga</button>
        </div>
      </div>

      <div style={fs.body}>
        {/* 1. Propiedad — FIRST */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}><span style={fs.sectionTitle}>Datos de la Propiedad</span></div>
          <div style={fs.propGrid}>
            <Field label="Calle y número" required span2>
              <Input value={propiedad.calle} onChange={v=>setProp('calle',v)} placeholder="Av. Ejemplo 123" />
            </Field>
            <Field label="Tipo de propiedad" required>
              <Sel value={propiedad.tipoProp} onChange={v=>setProp('tipoProp',v)}
                options={[['departamento','Departamento'],['casa','Casa']]} />
            </Field>
            <Field label="Número de departamento/casa">
              <Input value={propiedad.numeroProp} onChange={v=>setProp('numeroProp',v)} placeholder="45, 3B, etc." />
            </Field>
            <Field label="Región" required>
              <Sel value={propiedad.regionProp} onChange={v=>{setProp('regionProp',v);setProp('comunaProp','');}}
                options={REGIONES.map(r=>[r,r])} />
            </Field>
            <Field label="Comuna" required>
              <ComunaInput region={propiedad.regionProp} value={propiedad.comunaProp} onChange={v=>setProp('comunaProp',v)} />
            </Field>
            <Field label="N° Bodega (opcional)">
              <Input value={propiedad.bodega} onChange={v=>setProp('bodega',v)} placeholder="B-12" />
            </Field>
            <Field label="N° Estacionamiento (opcional)">
              <Input value={propiedad.estacionamiento} onChange={v=>setProp('estacionamiento',v)} placeholder="E-5" />
            </Field>
            <Field label="¿Amoblado?">
              <Sel value={propiedad.amoblado?'si':'no'} onChange={v=>setProp('amoblado',v==='si')}
                options={[['no','Sin muebles'],['si','Amoblado']]} />
            </Field>
            <Field label="Fecha de inicio" required>
              <Input value={propiedad.fechaInicio} onChange={v=>setProp('fechaInicio',v)} type="date" />
            </Field>
            <Field label="Moneda del arriendo" required>
              <Sel value={propiedad.monedaArriendo} onChange={v=>setProp('monedaArriendo',v)}
                options={[['CLP','Pesos ($)'],['UF','UF']]} />
            </Field>
            <Field label={propiedad.monedaArriendo==='UF'?'Monto arriendo (UF)':'Monto arriendo ($)'} required>
              {propiedad.monedaArriendo==='UF'
                ? <Input value={propiedad.arriendo} onChange={v=>setProp('arriendo',v.replace(/[^0-9.]/g,''))} placeholder="Ej: 25.5" />
                : <MoneyInput value={propiedad.arriendo} onChange={v=>setProp('arriendo',v)} />}
            </Field>
            {propiedad.monedaArriendo==='CLP' && (
              <Field label="Reajuste">
                <Sel value={propiedad.reajuste} onChange={v=>setProp('reajuste',v)}
                  options={[['IPC (cada 6 meses)','IPC (cada 6 meses)'],['IPC (cada 12 meses)','IPC (cada 12 meses)']]} />
              </Field>
            )}
            <Field label={propiedad.monedaArriendo==='UF'?'Garantía (UF, vacío = 1 arriendo)':'Garantía ($, vacío = 1 arriendo)'}>
              {propiedad.monedaArriendo==='UF'
                ? <Input value={propiedad.garantia} onChange={v=>setProp('garantia',v.replace(/[^0-9.]/g,''))} placeholder="Vacío = igual al arriendo" />
                : <MoneyInput value={propiedad.garantia} onChange={v=>setProp('garantia',v)} placeholder="Vacío = igual al arriendo" />}
            </Field>
            <Field label={propiedad.monedaArriendo==='UF'?'Promoción (UF, opcional)':'Promoción ($, opcional)'}>
              {propiedad.monedaArriendo==='UF'
                ? <Input value={propiedad.promo} onChange={v=>setProp('promo',v.replace(/[^0-9.]/g,''))} placeholder="Ej: 20" />
                : <MoneyInput value={propiedad.promo} onChange={v=>setProp('promo',v)} />}
            </Field>
            {propiedad.promo && (
              <Field label="Meses de promoción">
                <Input value={propiedad.mesesPromo} onChange={v=>setProp('mesesPromo',v)} placeholder="enero y febrero de 2026" />
              </Field>
            )}
          </div>
        </div>

        {/* 2. Propietarios */}
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

        {/* 3. Arrendatarios */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Arrendatario(s)</span>
            <button onClick={addArrendatario} style={fs.addBtn}><Plus size={13} style={{marginRight:4}}/>Agregar</button>
          </div>
          {arrendatarios.length===0&&<p style={{color:'#9aa0a6',fontSize:13,padding:'6px 0'}}>Agrega al menos un arrendatario</p>}
          {arrendatarios.map((a,i)=>(
            <PersonCard key={i} title={`Arrendatario${arrendatarios.length>1?' '+(i+1):''}`}
              person={a} type="full"
              onChange={v=>updateP(arrendatarios,setArrendatarios,i,v)}
              onRemove={()=>removeP(arrendatarios,setArrendatarios,i)}
              canRemove={arrendatarios.length>1} />
          ))}
        </div>

        {/* 4. Fiadores */}
        <div style={fs.section}>
          <div style={fs.sectionHeader}>
            <span style={fs.sectionTitle}>Fiador(es) y Codeudor(es) Solidario(s)</span>
            <button onClick={()=>setFiadores([...fiadores,emptyArr()])} style={fs.addBtn}><Plus size={13} style={{marginRight:4}}/>Agregar</button>
          </div>
          {fiadores.length===0&&<p style={{color:'#9aa0a6',fontSize:13,padding:'6px 0'}}>Sin fiador — la cláusula décimo sexta no se incluirá</p>}
          {fiadores.map((f,i)=>(
            <PersonCard key={i} title={`Fiador${fiadores.length>1?' '+(i+1):''}`}
              person={f} type="full"
              onChange={v=>updateP(fiadores,setFiadores,i,v)}
              onRemove={()=>removeP(fiadores,setFiadores,i)}
              canRemove={true} />
          ))}
        </div>
      </div>
    </div>
  );
}

const fs = {
  container:{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Google Sans','Segoe UI',sans-serif" },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexShrink:0 },
  title:{ fontSize:24, fontWeight:700, color:'#202124', margin:'0 0 4px' },
  subtitle:{ fontSize:14, color:'#5f6368', margin:0 },
  previewBtn:{ padding:'9px 14px', background:'#1a73e8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  downloadBtn:{ display:'flex', alignItems:'center', padding:'9px 14px', background:'#1a73e8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  backBtn:{ display:'flex', alignItems:'center', padding:'8px 14px', background:'#fff', color:'#5f6368', border:'1px solid #dadce0', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  body:{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:16 },
  section:{ background:'#fff', border:'1px solid #e8eaed', borderRadius:12, padding:20, flexShrink:0 },
  sectionHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  sectionTitle:{ fontSize:14, fontWeight:700, color:'#202124' },
  addBtn:{ display:'flex', alignItems:'center', padding:'5px 10px', background:'#e8f0fe', color:'#1a73e8', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  personCard:{ border:'1px solid #e8eaed', borderRadius:10, padding:14, marginBottom:10, background:'#fafafa' },
  personHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  personTitle:{ fontSize:12, fontWeight:700, color:'#5f6368', textTransform:'uppercase', letterSpacing:0.5 },
  removeBtn:{ background:'none', border:'none', cursor:'pointer', padding:4, color:'#ea4335', display:'flex' },
  personGrid:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' },
  propGrid:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' },
  field:{ display:'flex', flexDirection:'column', gap:4 },
  label:{ fontSize:11, fontWeight:600, color:'#5f6368' },
  input:{ border:'1px solid #dadce0', borderRadius:7, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' },
  select:{ border:'1px solid #dadce0', borderRadius:7, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fff' },
  aviso:{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'#fef7e0', color:'#a05a00', borderRadius:8, fontSize:13, marginBottom:12, flexShrink:0 },
  previewWrap:{ flex:1, overflowY:'auto', background:'#f1f3f4', borderRadius:12, padding:24 },
  previewDoc:{ flex:1, overflow:'auto', background:'#fff', border:'1px solid #e8eaed', borderRadius:12, padding:'40px 48px', maxWidth:860, margin:'0 auto', width:'100%', lineHeight:1.8 },
};
