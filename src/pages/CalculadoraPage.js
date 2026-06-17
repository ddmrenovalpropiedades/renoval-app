import React, { useState, useRef } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatCLP = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return '';
  return Math.round(val).toLocaleString('es-CL');
};

const diasEnMes = (fecha) => {
  if (!fecha) return null;
  const [y, m] = fecha.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const diaDelMes = (fecha) => {
  if (!fecha) return null;
  return parseInt(fecha.split('-')[2], 10);
};

// Formatea mientras escribe: agrega separador de miles al raw numérico
const fmtLive = (raw) => {
  if (!raw) return '';
  const n = parseInt(raw.replace(/\./g, ''), 10);
  return isNaN(n) ? raw : n.toLocaleString('es-CL');
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── MoneyInput: separador de miles mientras se escribe ────────────────────────
function MoneyInput({ value, onChange, onBlur, onFocus, placeholder = '0', style = {} }) {
  return (
    <input
      style={style}
      type="text"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw ? fmtLive(raw) : '');
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

// ── Renderiza una línea de texto con *bold* y §amarillo§ ─────────────────────
function RichLine({ text }) {
  const parts = text.split(/(\*[^*]+\*|§[^§]+§)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        if (part.startsWith('§') && part.endsWith('§')) {
          return (
            <strong key={i} style={{ background: '#FFF9C4', padding: '0 3px', borderRadius: 3 }}>
              {part.slice(1, -1)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Modal de comunicado ──────────────────────────────────────────────────────
function MensajeModal({ onClose, datos }) {
  const {
    arriendoInput, fechaLlegada, garantiaOpc,
    comisionOpc, proporcional, garantia, comision,
    contratoInput, total,
  } = datos;

  const [nombre, setNombre] = useState('');
  const [formalidad, setFormalidad] = useState('informal');
  const [reajuste, setReajuste] = useState('');
  const [reajusteOtro, setReajusteOtro] = useState('');
  const [tienePromocion, setTienePromocion] = useState('no');
  const [promoValorRaw, setPromoValorRaw] = useState('');
  const [promoValorNum, setPromoValorNum] = useState('');
  const [promoMeses, setPromoMeses] = useState([]);
  const [generado, setGenerado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const richRef = useRef(null);

  const toggleMes = (m) => setPromoMeses(prev =>
    prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const garantiaLabel = {
    un_mes: 'Un mes', mes_medio: 'Mes y medio',
    dos_meses: '2 meses', otro: 'Otro',
  }[garantiaOpc] || '';

  // Comisión: si fue "otro" en el input, aparece como XXXXX amarillo
  const comisionEsOtro = comisionOpc === 'otro';

  const fechaFormateada = fechaLlegada
    ? new Date(fechaLlegada + 'T12:00:00').toLocaleDateString('es-CL')
    : '';

  // reajuste: si es "otro" y no hay texto → XXXXX (amarillo)
  const reajusteEsOtro = reajuste === 'otro';
  const reajusteTexto = reajusteEsOtro ? (reajusteOtro || null) : reajuste;

  const promoTexto = tienePromocion === 'si' && promoValorNum
    ? `$${formatCLP(promoValorNum)}${promoMeses.length > 0 ? ', ' + promoMeses.join(', ') : ''}`
    : '';

  // b() → bold con asteriscos; y() → amarillo con §
  const generarTexto = () => {
    const b = (t) => `*${t}*`;
    const y = (t) => `§${t}§`;
    const est = formalidad === 'formal' ? 'está' : 'estás';
    const comisionPart = comisionEsOtro
      ? `$${formatCLP(comision)}, ${y('XXXXX')}`
      : `$${formatCLP(comision)}, ${b('mitad de arriendo')}`;
    const reajustePart = reajusteEsOtro
      ? (reajusteTexto ? b(reajusteTexto) : y('XXXXX'))
      : b(reajusteTexto);

    let txt = `Hola ${nombre},\n\n`;
    txt += `Como ${est}? Despues de realizar la revision de antecedentes hay aprobacion para que arrienden la propiedad.\n\n`;
    txt += `Tal y como fue conversado, el detalle del monto total a cancelar se calcula sumando los siguientes montos:\n\n`;
    txt += `${b('MONTO TOTAL')}\n\n`;
    txt += `-${garantiaLabel} de garantia: ${b('$' + formatCLP(garantia))}\n`;
    txt += `-Comision de corretaje + IVA: ${comisionPart}\n`;
    txt += `-Arriendo proporcional del mes, cuyo calculo dependera de la fecha de llegada a la propiedad (definida en principio para el ${fechaFormateada}, monto de ${b('$' + formatCLP(proporcional))})\n`;
    txt += `-Contrato digital notariado ${b('$' + contratoInput)}\n\n`;
    txt += `Considerando estos valores preliminares, el monto total seria de ${b('$' + formatCLP(total))}.\n\n`;
    txt += `${b('FORMA DE PAGO')}\n\n`;
    txt += `Para que ustedes se queden de manera efectiva con el arriendo, se debe pagar primero la reserva, cuyo monto equivale a un mes de arriendo, en este caso, de ${b('$' + arriendoInput)}. Este monto es un adelanto del monto total, no un monto adicional a pagarse. El saldo restante del monto total se debe transferir el dia de la entrega de la propiedad, previo a la entrega de llaves.\n\n`;
    txt += `La cuenta a la que se debe transferir la reserva y el saldo del monto total el dia de la entrega es:\n\n`;
    txt += `Cuenta corriente Banco Santander\nN 975947211\nRenoval Gestion Inmobiliaria\nRut 77.023.552-9\nfdm@renovalpropiedades.com\n\n`;
    txt += `En caso de que, posterior al pago de la reserva, se desista del arriendo de la propiedad y cualquiera sea el motivo, se descontara de la devolucion de la misma un monto equivalente al arriendo proporcional de los dias en que se dejo de publicar y mostrar la propiedad (dia en que se pago la reserva y se dio de baja la publicidad). El monto minimo a descontar, no obstante lo anterior, es de la mitad del valor de la reserva.\n\n`;
    txt += `${b('CONDICIONES DEL ARRIENDO')}\n\n`;
    txt += `Canon de arriendo: ${b('$' + arriendoInput)}\n`;
    txt += `Reajuste: ${reajustePart}\n`;
    if (tienePromocion === 'si' && promoTexto) txt += `Promocion: ${b(promoTexto)}\n`;
    txt += `\nSe adjunta borrador de contrato, para hacer una revision preliminar de las clausulas principales del mismo (este no es el contrato definitivo).\n\n`;
    txt += `En caso de arrendar la propiedad, es responsabilidad del arrendatario coordinar la mudanza y solicitar el reglamento de copropiedad a la administracion del edificio.\n\n`;
    txt += `Saludos cordiales`;
    return txt;
  };

  const textoGenerado = generado ? generarTexto() : '';

  // Copia el HTML del div renderizado como texto plano con bold preservado
  const handleCopiar = () => {
    // Texto para portapapeles: reemplaza *x* → x y §x§ → x (sin formato, texto limpio)
    // Para WhatsApp: *bold* ya funciona. §amarillo§ lo dejamos como el texto puro.
    const textoClipboard = textoGenerado
      .replace(/§([^§]+)§/g, '$1'); // quita marcas de amarillo, deja el texto
    navigator.clipboard.writeText(textoClipboard).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const handlePromoValorBlur = () => {
    const n = parseFloat(promoValorRaw.replace(/\./g, ''));
    if (!isNaN(n)) {
      setPromoValorNum(n);
      setPromoValorRaw('$' + Math.round(n).toLocaleString('es-CL'));
    }
  };

  const s = ms;
  const canGen = nombre && reajuste && !(reajuste === 'otro' && !reajusteOtro);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Generar comunicado</span>
          <button onClick={onClose} style={s.closeBtn}>X</button>
        </div>

        <div style={s.modalBody}>
          {!generado ? (
            <>
              <div style={s.field}>
                <label style={s.label}>Nombre del destinatario</label>
                <input style={s.input} type="text" value={nombre}
                  onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan" />
              </div>

              <div style={s.field}>
                <label style={s.label}>Formalidad del mensaje</label>
                <div style={s.radioGroup}>
                  {['formal','informal'].map(op => (
                    <label key={op} style={s.radioLabel}>
                      <input type="radio" value={op} checked={formalidad === op}
                        onChange={() => setFormalidad(op)} />
                      {op === 'formal' ? 'Formal (esta / usted)' : 'Informal (estas / tu)'}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Reajuste</label>
                <select style={s.select} value={reajuste} onChange={e => setReajuste(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="anual por IPC">Anual por IPC</option>
                  <option value="semestral por IPC">Semestral por IPC</option>
                  <option value="Sin reajuste">Sin reajuste</option>
                  <option value="otro">Otro</option>
                </select>
                {reajuste === 'otro' && (
                  <input
                    style={{ ...s.input, marginTop: 8, background: '#FFF9C4', border: '1px solid #F9A825' }}
                    type="text"
                    value={reajusteOtro}
                    onChange={e => setReajusteOtro(e.target.value)}
                    placeholder="Especificar reajuste..."
                  />
                )}
              </div>

              <div style={s.field}>
                <label style={s.label}>Promocion</label>
                <div style={s.radioGroup}>
                  {['no','si'].map(op => (
                    <label key={op} style={s.radioLabel}>
                      <input type="radio" value={op} checked={tienePromocion === op}
                        onChange={() => setTienePromocion(op)} />
                      {op === 'si' ? 'Si' : 'No'}
                    </label>
                  ))}
                </div>
                {tienePromocion === 'si' && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...s.label, marginBottom: 4 }}>Valor de la promocion</label>
                    <div style={s.inputWrap}>
                      <span style={s.prefix}>$</span>
                      <MoneyInput
                        style={s.inputInner}
                        value={promoValorRaw}
                        onChange={v => setPromoValorRaw(v)}
                        onFocus={() => setPromoValorRaw(String(promoValorNum || ''))}
                        onBlur={handlePromoValorBlur}
                        placeholder="0"
                      />
                    </div>
                    <label style={{ ...s.label, marginTop: 10, marginBottom: 6 }}>Meses de la promocion</label>
                    <div style={s.mesesGrid}>
                      {MESES.map(m => (
                        <button key={m} onClick={() => toggleMes(m)}
                          style={{ ...s.mesBtn, ...(promoMeses.includes(m) ? s.mesBtnActive : {}) }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setGenerado(true)} disabled={!canGen}
                style={{ ...s.genBtn, ...(!canGen ? s.genBtnDisabled : {}) }}>
                Generar texto
              </button>
            </>
          ) : (
            <>
              <div style={s.textArea} ref={richRef}>
                {textoGenerado.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: '1px 0', fontSize: 13, lineHeight: 1.75,
                    fontFamily: 'inherit', minHeight: line === '' ? 8 : 'auto' }}>
                    {line === '' ? '\u00A0' : <RichLine text={line} />}
                  </p>
                ))}
              </div>
              <div style={s.bottomRow}>
                <button onClick={() => setGenerado(false)} style={s.backBtn}>Volver</button>
                <button onClick={handleCopiar} style={s.copyBtn}>
                  {copiado ? 'Copiado!' : 'Copiar texto'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CalculadoraPage() {
  const dateRef = useRef(null);

  const [arriendoRaw, setArriendoRaw] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState('');
  const [garantiaOpc, setGarantiaOpc] = useState('');
  const [garantiaOtroRaw, setGarantiaOtroRaw] = useState('');
  const [garantiaOtroVal, setGarantiaOtroVal] = useState('');
  const [comisionOpc, setComisionOpc] = useState('');
  const [comisionOtroRaw, setComisionOtroRaw] = useState('');
  const [comisionOtroVal, setComisionOtroVal] = useState('');
  const [contratoRaw, setContratoRaw] = useState('17.000');
  const [contratoVal, setContratoVal] = useState(17000);
  const [showModal, setShowModal] = useState(false);

  const arriendoNum = arriendoRaw ? parseFloat(arriendoRaw.replace(/\./g, '')) : '';
  const totalDias = diasEnMes(fechaLlegada);
  const diaLlegada = diaDelMes(fechaLlegada);

  const proporcional =
    arriendoNum !== '' && totalDias && diaLlegada
      ? ((totalDias - diaLlegada + 1) / totalDias) * arriendoNum
      : '';

  let garantia = '';
  if (garantiaOpc === 'un_mes' && arriendoNum !== '') garantia = arriendoNum;
  else if (garantiaOpc === 'mes_medio' && arriendoNum !== '') garantia = arriendoNum * 1.5;
  else if (garantiaOpc === 'dos_meses' && arriendoNum !== '') garantia = arriendoNum * 2;
  else if (garantiaOpc === 'otro') garantia = garantiaOtroVal;

  let comision = '';
  if (comisionOpc === 'mitad' && arriendoNum !== '') comision = (arriendoNum / 2) * 1.19;
  else if (comisionOpc === 'otro') comision = comisionOtroVal;

  const total =
    proporcional !== '' && contratoVal !== '' && garantia !== '' && comision !== ''
      ? proporcional + contratoVal + Number(garantia) + Number(comision)
      : '';

  const blurToFormatted = (raw, setter) => {
    const n = parseFloat(raw.replace(/\./g, ''));
    if (!isNaN(n)) setter('$' + Math.round(n).toLocaleString('es-CL'));
    else setter('');
  };

  const focusToRaw = (raw, setter) => {
    const clean = raw.replace(/[$,.]/g, '').replace(/[^0-9]/g, '');
    setter(clean);
  };

  const fechaFormateada = fechaLlegada
    ? new Date(fechaLlegada + 'T12:00:00').toLocaleDateString('es-CL')
    : '';

  const s = styles;

  const ResultRow = ({ label, value, highlight }) => (
    <div style={{ ...s.resultRow, ...(highlight ? s.resultRowHighlight : {}) }}>
      <span style={highlight ? s.resultLabelHL : s.resultLabel}>{label}</span>
      <span style={highlight ? s.resultValueHL : s.resultValue}>
        {value !== '' && value !== null && value !== undefined
          ? '$' + formatCLP(value)
          : <span style={s.empty}>-</span>}
      </span>
    </div>
  );

  const canGenerate = arriendoRaw && fechaLlegada && garantiaOpc && comisionOpc && total !== '';

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Calculadora de arriendo</h1>
        <button onClick={() => setShowModal(true)} disabled={!canGenerate}
          style={{ ...s.msgBtn, ...(!canGenerate ? s.msgBtnDisabled : {}) }}>
          Generar comunicado
        </button>
      </div>

      <div style={s.layout}>
        {/* ── INPUTS ── */}
        <div style={s.card}>
          <p style={s.cardTitle}>Datos de entrada</p>

          <div style={s.field}>
            <label style={s.label}>Arriendo</label>
            <div style={s.inputWrap}>
              <span style={s.prefix}>$</span>
              <MoneyInput
                style={s.input}
                value={arriendoRaw}
                onChange={v => setArriendoRaw(v)}
                onFocus={() => focusToRaw(arriendoRaw, setArriendoRaw)}
                onBlur={() => blurToFormatted(arriendoRaw, setArriendoRaw)}
                placeholder="0"
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Fecha de llegada</label>
            <div style={s.inputWrap} onClick={() => dateRef.current && dateRef.current.showPicker()}>
              <span style={s.prefix}>📅</span>
              <div style={{ flex: 1, padding: '9px 12px', fontSize: 13, color: fechaLlegada ? '#202124' : '#aaa', cursor: 'pointer', position: 'relative' }}>
                {fechaLlegada ? fechaFormateada : 'dd/mm/aaaa'}
                <input
                  ref={dateRef}
                  type="date"
                  value={fechaLlegada}
                  onChange={e => setFechaLlegada(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Garantia</label>
            <select style={s.select} value={garantiaOpc}
              onChange={e => { setGarantiaOpc(e.target.value); setGarantiaOtroRaw(''); setGarantiaOtroVal(''); }}>
              <option value="">Seleccionar...</option>
              <option value="un_mes">Un mes</option>
              <option value="mes_medio">Mes y medio</option>
              <option value="dos_meses">2 meses</option>
              <option value="otro">Otro</option>
            </select>
            {garantiaOpc === 'otro' && (
              <div style={{ ...s.inputWrap, marginTop: 8 }}>
                <span style={s.prefix}>$</span>
                <MoneyInput
                  style={s.input}
                  value={garantiaOtroRaw}
                  onChange={v => setGarantiaOtroRaw(v)}
                  onFocus={() => focusToRaw(garantiaOtroRaw, setGarantiaOtroRaw)}
                  onBlur={() => {
                    const n = parseFloat(garantiaOtroRaw.replace(/\./g, ''));
                    if (!isNaN(n)) { setGarantiaOtroVal(n); setGarantiaOtroRaw('$' + Math.round(n).toLocaleString('es-CL')); }
                  }}
                  placeholder="Monto manual"
                />
              </div>
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Comision corretaje</label>
            <select style={s.select} value={comisionOpc}
              onChange={e => { setComisionOpc(e.target.value); setComisionOtroRaw(''); setComisionOtroVal(''); }}>
              <option value="">Seleccionar...</option>
              <option value="mitad">Mitad de arriendo</option>
              <option value="otro">Otro</option>
            </select>
            {comisionOpc === 'otro' && (
              <div style={{ ...s.inputWrap, marginTop: 8 }}>
                <span style={s.prefix}>$</span>
                <MoneyInput
                  style={s.input}
                  value={comisionOtroRaw}
                  onChange={v => setComisionOtroRaw(v)}
                  onFocus={() => focusToRaw(comisionOtroRaw, setComisionOtroRaw)}
                  onBlur={() => {
                    const n = parseFloat(comisionOtroRaw.replace(/\./g, ''));
                    if (!isNaN(n)) { setComisionOtroVal(n); setComisionOtroRaw('$' + Math.round(n).toLocaleString('es-CL')); }
                  }}
                  placeholder="Monto manual"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── RESUMEN ── */}
        <div style={s.card}>
          <p style={s.cardTitle}>Resumen</p>

          <ResultRow label="Arriendo proporcional" value={proporcional} />
          {fechaLlegada && totalDias && diaLlegada && (
            <div style={s.resultSubtext}>
              {totalDias - diaLlegada + 1} dias de {totalDias} del mes
            </div>
          )}

          <div style={s.resultRow}>
            <span style={s.resultLabel}>Contrato digital</span>
            <div style={s.inlineEdit}>
              <span style={s.prefix2}>$</span>
              <MoneyInput
                style={s.inlineInput}
                value={contratoRaw}
                onChange={v => setContratoRaw(v)}
                onFocus={() => focusToRaw(contratoRaw, setContratoRaw)}
                onBlur={() => {
                  const n = parseFloat(contratoRaw.replace(/\./g, ''));
                  if (!isNaN(n)) { setContratoVal(n); setContratoRaw('$' + Math.round(n).toLocaleString('es-CL')); }
                  else { setContratoRaw('$17.000'); setContratoVal(17000); }
                }}
              />
            </div>
          </div>

          <ResultRow label="Garantia" value={garantia} />
          <ResultRow label="Comision corretaje + IVA" value={comision} />

          <div style={s.divider} />
          <ResultRow label="Total" value={total} highlight />
        </div>
      </div>

      {showModal && (
        <MensajeModal
          onClose={() => setShowModal(false)}
          datos={{
            arriendoInput: arriendoRaw.replace('$',''),
            fechaLlegada, garantiaOpc,
            comisionOpc, proporcional, garantia, comision,
            contratoInput: contratoRaw.replace('$',''),
            total,
          }}
        />
      )}
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  page: { padding: '32px', maxWidth: 860, fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: '#202124', margin: 0 },
  msgBtn: { padding: '9px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  msgBtnDisabled: { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '20px 24px' },
  cardTitle: { fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#5f6368', margin: '0 0 20px 0' },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4043', marginBottom: 6 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1px solid #dadce0', borderRadius: 8, overflow: 'hidden', background: '#fff', cursor: 'pointer' },
  prefix: { padding: '0 10px', fontSize: 13, color: '#5f6368', background: '#f8f9fa', borderRight: '1px solid #dadce0', alignSelf: 'stretch', display: 'flex', alignItems: 'center' },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '9px 12px', color: '#202124', background: 'transparent', width: '100%', boxSizing: 'border-box', textAlign: 'right' },
  select: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#202124', background: '#fff', outline: 'none', cursor: 'pointer' },
  resultRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f3f4' },
  resultRowHighlight: { background: '#1B5E20', borderRadius: 8, padding: '12px 14px', marginTop: 4, border: 'none' },
  resultLabel: { fontSize: 13, color: '#3c4043', fontWeight: 500 },
  resultLabelHL: { fontSize: 14, color: '#fff', fontWeight: 700 },
  resultValue: { fontSize: 13, color: '#202124', fontWeight: 600, textAlign: 'right' },
  resultValueHL: { fontSize: 14, color: '#fff', fontWeight: 700, textAlign: 'right' },
  resultSubtext: { fontSize: 11, color: '#5f6368', marginTop: -6, marginBottom: 4, paddingLeft: 2 },
  empty: { color: '#bdc1c6', fontWeight: 400 },
  divider: { borderTop: '1px solid #e8eaed', margin: '12px 0 4px' },
  inlineEdit: { display: 'flex', alignItems: 'center', border: '1px solid #dadce0', borderRadius: 6, overflow: 'hidden', background: '#fff' },
  prefix2: { padding: '0 6px', fontSize: 12, color: '#5f6368', background: '#f8f9fa', borderRight: '1px solid #dadce0', alignSelf: 'stretch', display: 'flex', alignItems: 'center' },
  inlineInput: { border: 'none', outline: 'none', fontSize: 13, padding: '5px 8px', color: '#202124', background: 'transparent', width: 90, textAlign: 'right', fontWeight: 600 },
};

const ms = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#fff', borderRadius: 16, width: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', fontFamily: "'Google Sans', 'Segoe UI', sans-serif", overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#202124' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5f6368', padding: '4px 8px', borderRadius: 6 },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4043', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  select: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#202124', background: '#fff', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  radioGroup: { display: 'flex', gap: 20 },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3c4043', cursor: 'pointer' },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1px solid #dadce0', borderRadius: 8, overflow: 'hidden', background: '#fff' },
  prefix: { padding: '0 10px', fontSize: 13, color: '#5f6368', background: '#f8f9fa', borderRight: '1px solid #dadce0', alignSelf: 'stretch', display: 'flex', alignItems: 'center' },
  inputInner: { flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '9px 12px', color: '#202124', background: 'transparent', textAlign: 'right', fontFamily: 'inherit' },
  mesesGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  mesBtn: { padding: '4px 10px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  mesBtnActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 600 },
  genBtn: { width: '100%', padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  genBtnDisabled: { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' },
  textArea: { background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 10, padding: '16px', marginBottom: 16, maxHeight: 420, overflowY: 'auto' },
  bottomRow: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  backBtn: { padding: '9px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
  copyBtn: { padding: '9px 20px', background: '#1B5E20', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
