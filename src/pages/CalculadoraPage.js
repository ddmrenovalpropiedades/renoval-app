import React, { useState, useEffect } from 'react';

const fmt = (val) =>
  val === '' || isNaN(val)
    ? ''
    : '$' + Math.round(val).toLocaleString('es-CL');

export default function CalculadoraPage() {
  // Tabla 1
  const [arriendo, setArriendo] = useState('');
  const [diaLlegada, setDiaLlegada] = useState('');
  const [diasMes, setDiasMes] = useState('');

  // Tabla 2
  const [contratoDigital, setContratoDigital] = useState(17000);
  const [garantia, setGarantia] = useState('');
  const [comisionOverride, setComisionOverride] = useState(null);

  const arriendoNum = arriendo !== '' ? parseFloat(arriendo) : '';
  const diaLlegadaNum = diaLlegada !== '' ? parseFloat(diaLlegada) : '';
  const diasMesNum = diasMes !== '' ? parseFloat(diasMes) : '';

  const proporcional =
    arriendoNum !== '' && diaLlegadaNum !== '' && diasMesNum !== '' && diasMesNum > 0
      ? ((diasMesNum - diaLlegadaNum + 1) / diasMesNum) * arriendoNum
      : '';

  const comisionDefault =
    arriendoNum !== '' ? (arriendoNum / 2) * 1.19 : '';

  const comisionFinal =
    comisionOverride !== null ? comisionOverride : comisionDefault;

  const garantiaNum = garantia !== '' ? parseFloat(garantia) : '';

  const total =
    proporcional !== '' &&
    contratoDigital !== '' &&
    garantiaNum !== '' &&
    comisionFinal !== ''
      ? proporcional + contratoDigital + garantiaNum + comisionFinal
      : '';

  // Reset override de comisión si cambia arriendo
  useEffect(() => {
    setComisionOverride(null);
  }, [arriendo]);

  const handleDiaChange = (setter, val) => {
    if (val === '') { setter(''); return; }
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1 && n <= 31) setter(String(n));
  };

  const handleComisionChange = (val) => {
    if (val === '') { setComisionOverride(null); return; }
    const n = parseFloat(val);
    if (!isNaN(n)) setComisionOverride(n);
  };

  const s = styles;

  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Calculadora de Arriendo</h1>

      {/* ── TABLA 1 ── */}
      <p style={s.sectionLabel}>PROPORCIONAL DÍAS DE OCUPACIÓN</p>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.tdLabel}>Arriendo</td>
            <td style={s.tdInput}>
              <input
                style={s.input}
                type="number"
                min="0"
                value={arriendo}
                onChange={e => setArriendo(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
          <tr>
            <td style={s.tdLabel}>Día Llegada</td>
            <td style={s.tdInput}>
              <input
                style={s.input}
                type="number"
                min="1"
                max="31"
                value={diaLlegada}
                onChange={e => handleDiaChange(setDiaLlegada, e.target.value)}
                placeholder="1"
              />
            </td>
          </tr>
          <tr style={{ borderBottom: 'none' }}>
            <td style={{ ...s.tdLabel, borderBottom: 'none' }}>Días del mes</td>
            <td style={{ ...s.tdInput, borderBottom: 'none' }}>
              <input
                style={s.input}
                type="number"
                min="1"
                max="31"
                value={diasMes}
                onChange={e => handleDiaChange(setDiasMes, e.target.value)}
                placeholder="31"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...s.table, marginTop: 8, border: '1px solid #c8a800' }}>
        <tbody>
          <tr>
            <td style={s.tdYellowLabel}>PROPORCIONAL</td>
            <td style={s.tdYellowValue}>{proporcional !== '' ? fmt(proporcional) : '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* ── TABLA 2 ── */}
      <p style={{ ...s.sectionLabel, marginTop: 32 }}>MONTO TOTAL</p>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.tdLabel}>Proporcional</td>
            <td style={{ ...s.tdInput, textAlign: 'right', paddingRight: 12, color: '#444' }}>
              {proporcional !== '' ? fmt(proporcional) : '—'}
            </td>
          </tr>
          <tr>
            <td style={s.tdLabel}>Contrato Digital</td>
            <td style={s.tdInput}>
              <input
                style={s.input}
                type="number"
                min="0"
                value={contratoDigital}
                onChange={e => setContratoDigital(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="17000"
              />
            </td>
          </tr>
          <tr>
            <td style={s.tdLabel}>Garantía</td>
            <td style={s.tdInput}>
              <input
                style={s.input}
                type="number"
                min="0"
                value={garantia}
                onChange={e => setGarantia(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
          <tr>
            <td style={{ ...s.tdLabel, borderBottom: 'none' }}>Comisión Corretaje + IVA</td>
            <td style={{ ...s.tdInput, borderBottom: 'none' }}>
              <input
                style={s.input}
                type="number"
                min="0"
                value={
                  comisionOverride !== null
                    ? comisionOverride
                    : comisionDefault !== ''
                    ? Math.round(comisionDefault)
                    : ''
                }
                onChange={e => handleComisionChange(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...s.table, marginTop: 8, border: '1px solid #1B5E20' }}>
        <tbody>
          <tr>
            <td style={s.tdGreenLabel}>TOTAL</td>
            <td style={s.tdGreenValue}>{total !== '' ? fmt(total) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  page: {
    padding: '32px',
    maxWidth: 560,
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#202124',
    marginBottom: 28,
    marginTop: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#5f6368',
    marginBottom: 8,
    marginTop: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #d0d0d0',
  },
  tdLabel: {
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: '#333',
    borderBottom: '1px solid #e0e0e0',
    borderRight: '1px solid #e0e0e0',
    width: '58%',
  },
  tdInput: {
    padding: '2px 6px',
    fontSize: 13,
    borderBottom: '1px solid #e0e0e0',
    width: '42%',
  },
  input: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    background: 'transparent',
    textAlign: 'right',
    padding: '6px',
    color: '#1a1a1a',
    boxSizing: 'border-box',
  },
  tdYellowLabel: {
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 700,
    color: '#1a1a1a',
    backgroundColor: '#FFE500',
    borderRight: '1px solid #c8a800',
    width: '58%',
  },
  tdYellowValue: {
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 700,
    color: '#1a1a1a',
    backgroundColor: '#FFE500',
    textAlign: 'right',
  },
  tdGreenLabel: {
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    backgroundColor: '#1B5E20',
    borderRight: '1px solid #1B5E20',
    width: '58%',
  },
  tdGreenValue: {
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    backgroundColor: '#1B5E20',
    textAlign: 'right',
  },
};
