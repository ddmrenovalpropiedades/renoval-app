// ════════════════════════════════════════════════════════════════
// Datos de prueba (inventados) para probar plantillas sin el formulario
// Mismos nombres que la "Prueba rápida" del generador actual.
// ════════════════════════════════════════════════════════════════

const NOMBRES_M = ['CARLOS ANDRÉS MUÑOZ REYES', 'PEDRO IGNACIO SOTO CAMPOS', 'DIEGO ALEJANDRO VARGAS LUNA', 'JORGE ANTONIO HERRERA PINTO', 'MARCELO FRANCISCO CASTRO DÍAZ'];
const NOMBRES_F = ['MARÍA ELENA TORRES SILVA', 'ANA PAULA FUENTES MORA', 'CAROLINA BEATRIZ LAGOS ROJAS', 'VALENTINA ANDREA PÉREZ VEGA', 'SOFÍA CONSTANZA ARAYA NAVARRO'];
const RUTS_M = ['12.345.678-9', '15.234.567-K', '18.901.234-5', '11.222.333-4', '16.789.012-3'];
const RUTS_F = ['13.456.789-0', '14.567.890-1', '17.890.123-6', '10.123.456-7', '19.012.345-8'];
const TELEFONOS = ['98765432', '87654321', '91234567', '96543210', '92345678'];
const EMAILS_M = ['cmunoz@gmail.com', 'psoto@hotmail.com', 'dvargas@gmail.com', 'jherrera@yahoo.com', 'mcastro@gmail.com'];
const EMAILS_F = ['mtorres@gmail.com', 'afuentes@hotmail.com', 'clagos@gmail.com', 'vperez@yahoo.com', 'saraya@gmail.com'];
const CALLES_PERSONA = ["Av. Bernardo O'Higgins 1100", 'Calle Moneda 890', 'Av. Irarrázaval 2345', 'Calle Portugal 456', 'Av. Italia 789'];
const COMUNAS = ['Santiago', 'Providencia', 'Las Condes', 'Ñuñoa', 'La Florida'];

// i: posición correlativa dentro de su género (evita repetir personas)
function persona(genero, i5) {
  const m = genero === 'M';
  const i = i5 % 5;
  return {
    nombre: (m ? NOMBRES_M : NOMBRES_F)[i],
    rut: (m ? RUTS_M : RUTS_F)[i],
    genero,
    nacionalidad: 'chilena',
    calle: CALLES_PERSONA[i],
    region: 'Región Metropolitana',
    comuna: COMUNAS[i],
    telefono: TELEFONOS[i],
    email: (m ? EMAILS_M : EMAILS_F)[i],
  };
}

export const CONFIG_PRUEBA_INICIAL = {
  gProp: ['M'],
  gArr: ['F'],
  gFia: [],
  tipoProp: 'departamento',
  numeroProp: '502',
  bodega: false,
  estacionamiento: false,
  amoblado: false,
  monedaArriendo: 'CLP',
  arriendo: '450000',
  promo: false,
  reajuste: 'IPC (cada 6 meses)',
  fechaInicio: '2026-06-01',
};

export function datosDesdeConfig(cfg) {
  const contador = { M: 0, F: 0 };
  const crear = (g) => {
    const p = persona(g, contador[g]);
    contador[g] += 1;
    return p;
  };
  return {
    propietarios: cfg.gProp.map(crear),
    arrendatarios: cfg.gArr.map(crear),
    fiadores: cfg.gFia.map(crear),
    propiedad: {
      calle: 'Av. Providencia 1234',
      tipoProp: cfg.tipoProp,
      numeroProp: cfg.numeroProp,
      regionProp: 'Región Metropolitana',
      comunaProp: 'Providencia',
      bodega: cfg.bodega ? 'B-23' : '',
      estacionamiento: cfg.estacionamiento ? 'E-14' : '',
      amoblado: cfg.amoblado,
      monedaArriendo: cfg.monedaArriendo,
      arriendo: cfg.arriendo,
      garantia: '',
      promo: cfg.promo ? (cfg.monedaArriendo === 'UF' ? '22' : '350000') : '',
      mesesPromo: cfg.promo ? 'enero y febrero de 2027' : '',
      fechaInicio: cfg.fechaInicio,
      reajuste: cfg.reajuste,
    },
  };
}
