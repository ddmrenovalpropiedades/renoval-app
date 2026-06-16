import React, { useState, useEffect } from 'react';

const fmt = (val) =>
  val === '' || isNaN(val)
    ? ''
    : '$' + Math.round(val).toLocaleString('es-CL');

const parseNum = (str) => {
  const clean = str.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? '' : n;
};

export default function CalculadoraPage() {
  // Tabla 1
  const [arriendo, setArriendo] = useState('');
  const [diaLlegada, setDiaLlegada] = useState('');
  const [diasMes, setDiasMes] = useState('');

  // Tabla 2 — editables con override
  const [contratoDigital, setContratoDigital] = useState(17000);
  const [garantia, setGarantia] = useState('');
  const [comisionOverride, setComisionOverride] = useState(null); // null = usar default

  const [contratoInput, setContratoInput] = useState('17.000');
  const [comisionInput, setComisionInput] = useState('');

  // Cálculos
  const arriendoNum = parseNum(String(arriendo));
  const diaLlegadaNum = parseNum(String(diaLlegada));
  const diasMesNum = parseNum(String(diasMes));

  const proporcional =
    arriendoNum !== '' && diaLlegadaNum !== '' && diasMesNum !== '' && diasMesNum > 0
      ? ((diasMesNum - diaLlegadaNum + 1) / diasMesNum) * arriendoNum
      : '';

  const comisionDefault =
    arriendoNum !== '' ? (arriendoNum / 2) * 1.19 : '';

  const comisionFinal =
    comisionOverride !== null ? comisionOverride : comisionDefault;

  const garantiaNum = parseNum(String(garantia));

  const total =
    proporcional !== '' &&
    contratoDigital !== '' &&
    garantiaNum !== '' &&
    comisionFinal !== ''
      ? proporcional + contratoDigital + garantiaNum + comisionFinal
      : '';

  // Sincronizar input de comisión cuando cambia arriendo (si no hay override)
  useEffect(() => {
    if (comisionOverride === null && comisionDefault !== '') {
      setComisionInput(Math.round(comisionDefault).toLocaleString('es-CL'));
    }
  }, [comisionDefault, comisionOverride]);

  const handleDiasChange = (setter, val) => {
    const n = parseInt(val);
    if (val === '' || (n >= 1 && n <= 31)) setter(val);
  };

  const handleComisionChange = (val) => {
    setComisionInput(val);
    const n = parseNum(val);
    if (n !== '') setComisionOverride(n);
    else setComisionOverride(null);
  };

  const handleContratoChange = (val) => {
    setContratoInput(val);
    const n = parseNum(val);
    if (n !== '') setContratoDigital(n);
  };

  const styles = {
    page: {
      padding: '32px',
      maxWidth: '560px',
      fontFamily: 'Inter, sans-serif',
      color: '#1a1a1a',
    },
    title: {
      fontSize: '20px',
      fontWeight: '700',
      marginBottom: '28px',
      color: '#111',
      letterSpacing: '-0.3px',
    },
    sectionTitle: {
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      color: '#555',
      marginBottom: '10px',
      marginTop: '28px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      border: '1px solid #d0d0d0',
      marginBottom: '8px',
    },
    tdLabel: {
      padding: '9px 12px',
      fontSize: '13px',
      borderBottom: '1px solid #e0e0e0',
      borderRight: '1px solid #e0e0e0',
      width: '55%',
      color: '#333',
      fontWeight: '500',
    },
    tdValue: {
      padding: '4px 8px',
      fontSize: '13px',
      borderBottom: '1px solid #e0e0e0',
      width: '45%',
    },
    tdLabelYellow: {
      padding: '9px 12px',
      fontSize: '13px',
      borderRight: '1px solid #b8a800',
      width: '55%',
      fontWeight: '700',
      backgroundColor: '#FFE500',
      color: '#1a1a1a',
    },
    tdValueYellow: {
      padding: '9px 12px',
      fontSize: '13px',
      fontWeight: '700',
      backgroundColor: '#FFE500',
      color: '#1a1a1a',
      textAlign: 'right',
    },
    tdLabelTotal: {
      padding: '10px 12px',
      fontSize: '14px',
      borderRight: '1px solid #1a3a1a',
      width: '55%',
      fontWeight: '800',
      backgroundColor: '#1B5E20',
      color: '#fff',
    },
    tdValueTotal: {
      padding: '10px 12px',
      fontSize: '14px',
      fontWeight: '800',
      backgroundColor: '#1B5E20',
      color: '#fff',
      textAlign: 'right',
    },
    input: {
      width: '100%',
      border: 'none',
      outline: 'none',
      fontSize: '13px',
      background: 'transparent',
      textAlign: 'right',
      padding: '4px',
      color: '#1a1a1a',
      boxSizing: 'border-box',
    },
    readonlyValue: {
      padding: '4px 12px',
      fontSize: '13px',
      textAlign: 'right',
      color: '#444',
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.title}>Calculadora de Arriendo</div>

      {/* TABLA 1 */}
      <div style={styles.sectionTitle}>Proporcional días de ocupación</div>
      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={styles.tdLabel}>Arriendo</td>
            <td style={styles.tdValue}>
              <input
                style={styles.input}
                type="number"
                min="0"
                value={arriendo}
                onChange={(e) => setArriendo(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
          <tr>
            <td style={styles.tdLabel}>Día Llegada</td>
            <td style={styles.tdValue}>
              <input
                style={styles.input}
                type="number"
                min="1"
                max="31"
                value={diaLlegada}
                onChange={(e) => handleDiasChange(setDiaLlegada, e.target.value)}
                placeholder="1"
              />
            </td>
          </tr>
          <tr>
            <td style={{ ...styles.tdLabel, borderBottom: 'none' }}>Días del mes</td>
            <td style={{ ...styles.tdValue, borderBottom: 'none' }}>
              <input
                style={styles.input}
                type="number"
                min="1"
                max="31"
                value={diasMes}
                onChange={(e) => handleDiasChange(setDiasMes, e.target.value)}
                placeholder="31"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <table style={{ ...styles.table, border: '1px solid #b8a800' }}>
        <tbody>
          <tr>
            <td style={styles.tdLabelYellow}>Proporcional</td>
            <td style={styles.tdValueYellow}>
              {proporcional !== '' ? fmt(proporcional) : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* TABLA 2 */}
      <div style={styles.sectionTitle}>Monto total</div>
      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={styles.tdLabel}>Proporcional</td>
            <td style={styles.tdValue}>
              <div style={styles.readonlyValue}>
                {proporcional !== '' ? fmt(proporcional) : '—'}
              </div>
            </td>
          </tr>
          <tr>
            <td style={styles.tdLabel}>Contrato Digital</td>
            <td style={styles.tdValue}>
              <input
                style={styles.input}
                type="number"
                value={contratoDigital}
                onChange={(e) => handleContratoChange(e.target.value)}
                placeholder="17000"
              />
            </td>
          </tr>
          <tr>
            <td style={styles.tdLabel}>Garantía</td>
            <td style={styles.tdValue}>
              <input
                style={styles.input}
                type="number"
                min="0"
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
          <tr>
            <td style={{ ...styles.tdLabel, borderBottom: 'none' }}>
              Comisión Corretaje + IVA
            </td>
            <td style={{ ...styles.tdValue, borderBottom: 'none' }}>
              <input
                style={styles.input}
                type="number"
                value={comisionOverride !== null ? comisionOverride : (comisionDefault !== '' ? Math.round(comisionDefault) : '')}
                onChange={(e) => handleComisionChange(e.target.value)}
                placeholder="0"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <table style={{ ...styles.table, border: '1px solid #1B5E20' }}>
        <tbody>
          <tr>
            <td style={styles.tdLabelTotal}>Total</td>
            <td style={styles.tdValueTotal}>
              {total !== '' ? fmt(total) : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
