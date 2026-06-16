import React, { useState } from 'react';

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

export default function CalculadoraPage() {
  const [arriendoInput, setArriendoInput] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState('');
  const [garantiaOpc, setGarantiaOpc] = useState('');
  const [garantiaOtro, setGarantiaOtroInput] = useState('');
  const [garantiaOtroVal, setGarantiaOtroVal] = useState('');
  const [comisionOpc, setComisionOpc] = useState('');
  const [comisionOtro, setComisionOtroInput] = useState('');
  const [comisionOtroVal, setComisionOtroVal] = useState('');
  const [contratoInput, setContratoInput] = useState('17.000');
  const [contratoVal, setContratoVal] = useState(17000);

  const arriendoNum = arriendoInput ? parseFloat(arriendoInput.replace(/\./g, '')) : '';

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

  const handleArriendoFocus = () => {
    setArriendoInput(arriendoInput.replace(/\./g, ''));
  };

  const handleArriendoBlur = () => {
    const n = parseFloat(arriendoInput.replace(/\./g, ''));
    if (!isNaN(n)) setArriendoInput(Math.round(n).toLocaleString('es-CL'));
  };

  const handleContratoFocus = () => {
    setContratoInput(String(contratoVal));
  };

  const handleContratoBlur = () => {
    const n = parseFloat(contratoInput.replace(/\./g, ''));
    if (!isNaN(n)) {
      setContratoVal(n);
      setContratoInput(Math.round(n).toLocaleString('es-CL'));
    } else {
      setContratoInput('17.000');
      setContratoVal(17000);
    }
  };

  const handleGarantiaOtroFocus = () => {
    setGarantiaOtroInput(String(garantiaOtroVal || ''));
  };

  const handleGarantiaOtroBlur = () => {
    const n = parseFloat(garantiaOtro.replace(/\./g, ''));
    if (!isNaN(n)) {
      setGarantiaOtroVal(n);
      setGarantiaOtroInput(Math.round(n).toLocaleString('es-CL'));
    }
  };

  const handleComisionOtroFocus = () => {
    setComisionOtroInput(String(comisionOtroVal || ''));
  };

  const handleComisionOtroBlur = () => {
    const n = parseFloat(comisionOtro.replace(/\./g, ''));
    if (!isNaN(n)) {
      setComisionOtroVal(n);
      setComisionOtroInput(Math.round(n).toLocaleString('es-CL'));
    }
  };

  const s = styles;

  const ResultRow = ({ label, value, highlight }) => (
    <div style={{ ...s.resultRow, ...(highlight ? s.resultRowHighlight : {}) }}>
      <span style={highlight ? s.resultLabelHL : s.resultLabel}>{label}</span>
      <span style={highlight ? s.resultValueHL : s.resultValue}>
        {value !== '' && value !== null && value !== undefined
          ? '$' + formatCLP(value)
          : <span style={s.empty}>—</span>}
      </span>
    </div>
  );

  return (
    <div style={s.page}>
      <h1 style={s.title}>Calculadora de arriendo</h1>

      <div style={s.layout}>
        {/* INPUTS */}
        <div style={s.card}>
          <p style={s.cardTitle}>Datos de entrada</p>

          <div style={s.field}>
            <label style={s.label}>Arriendo</label>
            <div style={s.inputWrap}>
              <span style={s.prefix}>$</span>
              <input
                style={s.input}
                type="text"
                inputMode="numeric"
                value={arriendoInput}
                onChange={e => setArriendoInput(e.target.value.replace(/[^0-9]/g, ''))}
                onFocus={handleArriendoFocus}
                onBlur={handleArriendoBlur}
                placeholder="0"
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Fecha de llegada</label>
            <input
              style={{ ...s.input, paddingLeft: 12, border: '1px solid #dadce0', borderRadius: 8 }}
              type="date"
              value={fechaLlegada}
              onChange={e => setFechaLlegada(e.target.value)}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Garantía</label>
            <select
              style={s.select}
              value={garantiaOpc}
              onChange={e => {
                setGarantiaOpc(e.target.value);
                setGarantiaOtroInput('');
                setGarantiaOtroVal('');
              }}
            >
              <option value="">Seleccionar...</option>
              <option value="un_mes">Un mes</option>
              <option value="mes_medio">Mes y medio</option>
              <option value="dos_meses">2 meses</option>
              <option value="otro">Otro</option>
            </select>
            {garantiaOpc === 'otro' && (
              <div style={{ ...s.inputWrap, marginTop: 8 }}>
                <span style={s.prefix}>$</span>
                <input
                  style={s.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="Monto manual"
                  value={garantiaOtro}
                  onChange={e => setGarantiaOtroInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={handleGarantiaOtroFocus}
                  onBlur={handleGarantiaOtroBlur}
                />
              </div>
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Comisión corretaje</label>
            <select
              style={s.select}
              value={comisionOpc}
              onChange={e => {
                setComisionOpc(e.target.value);
                setComisionOtroInput('');
                setComisionOtroVal('');
              }}
            >
              <option value="">Seleccionar...</option>
              <option value="mitad">Mitad de arriendo</option>
              <option value="otro">Otro</option>
            </select>
            {comisionOpc === 'otro' && (
              <div style={{ ...s.inputWrap, marginTop: 8 }}>
                <span style={s.prefix}>$</span>
                <input
                  style={s.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="Monto manual"
                  value={comisionOtro}
                  onChange={e => setComisionOtroInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={handleComisionOtroFocus}
                  onBlur={handleComisionOtroBlur}
                />
              </div>
            )}
          </div>
        </div>

        {/* RESULTADOS */}
        <div style={s.card}>
          <p style={s.cardTitle}>Resumen</p>

          <ResultRow label="Arriendo proporcional" value={proporcional} />
          {fechaLlegada && totalDias && diaLlegada && (
            <div style={s.resultSubtext}>
              {totalDias - diaLlegada + 1} días de {totalDias} del mes
            </div>
          )}

          <div style={s.resultRow}>
            <span style={s.resultLabel}>Contrato digital</span>
            <div style={s.inlineEdit}>
              <span style={s.prefix2}>$</span>
              <input
                style={s.inlineInput}
                type="text"
                inputMode="numeric"
                value={contratoInput}
                onChange={e => setContratoInput(e.target.value.replace(/[^0-9]/g, ''))}
                onFocus={handleContratoFocus}
                onBlur={handleContratoBlur}
              />
            </div>
          </div>

          <ResultRow label="Garantía" value={garantia} />
          <ResultRow label="Comisión corretaje + IVA" value={comision} />

          <div style={s.divider} />
          <ResultRow label="Total" value={total} highlight />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '32px',
    maxWidth: 860,
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#202124',
    marginBottom: 28,
    marginTop: 0,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    alignItems: 'start',
  },
  card: {
    background: '#fff',
    border: '1px solid #e8eaed',
    borderRadius: 12,
    padding: '20px 24px',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#5f6368',
    margin: '0 0 20px 0',
  },
  field: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#3c4043',
    marginBottom: 6,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #dadce0',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
  },
  prefix: {
    padding: '0 10px',
    fontSize: 13,
    color: '#5f6368',
    background: '#f8f9fa',
    borderRight: '1px solid #dadce0',
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 13,
    padding: '9px 12px',
    color: '#202124',
    background: 'transparent',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'right',
  },
  select: {
    width: '100%',
    border: '1px solid #dadce0',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: '#202124',
    background: '#fff',
    outline: 'none',
    cursor: 'pointer',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f1f3f4',
  },
  resultRowHighlight: {
    background: '#1B5E20',
    borderRadius: 8,
    padding: '12px 14px',
    marginTop: 4,
    border: 'none',
  },
  resultLabel: {
    fontSize: 13,
    color: '#3c4043',
    fontWeight: 500,
  },
  resultLabelHL: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 700,
  },
  resultValue: {
    fontSize: 13,
    color: '#202124',
    fontWeight: 600,
    textAlign: 'right',
  },
  resultValueHL: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 700,
    textAlign: 'right',
  },
  resultSubtext: {
    fontSize: 11,
    color: '#5f6368',
    marginTop: -6,
    marginBottom: 4,
    paddingLeft: 2,
  },
  empty: {
    color: '#bdc1c6',
    fontWeight: 400,
  },
  divider: {
    borderTop: '1px solid #e8eaed',
    margin: '12px 0 4px',
  },
  inlineEdit: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #dadce0',
    borderRadius: 6,
    overflow: 'hidden',
    background: '#fff',
  },
  prefix2: {
    padding: '0 6px',
    fontSize: 12,
    color: '#5f6368',
    background: '#f8f9fa',
    borderRight: '1px solid #dadce0',
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
  },
  inlineInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    padding: '5px 8px',
    color: '#202124',
    background: 'transparent',
    width: 90,
    textAlign: 'right',
    fontWeight: 600,
  },
};
