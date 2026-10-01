// ════════════════════════════════════════════════════════════════
// Vista previa del documento — se dibuja desde los mismos bloques que el Word
// Los datos faltantes se destacan en amarillo.
// ════════════════════════════════════════════════════════════════

const PT = 4 / 3; // 1 pt = 1.333 px

function Segmentos({ segs }) {
  return segs.map((s, i) => (
    <span
      key={i}
      style={{
        fontWeight: s.b ? 700 : 400,
        background: s.falta ? '#fff3cd' : 'transparent',
        whiteSpace: s.t.includes('\n') ? 'pre-wrap' : 'normal',
      }}
    >
      {s.t}
    </span>
  ));
}

function Bloque({ bl }) {
  switch (bl.tipo) {
    case 'linea':
      return <div style={{ height: 14 * PT }} />;
    case 'titulo_doc':
      return <p style={{ ...st.base, ...st.centro, fontWeight: 700, fontSize: 12 * PT }}>{bl.texto}</p>;
    case 'centrado':
      return <p style={{ ...st.base, ...st.centro }}><Segmentos segs={bl.segs} /></p>;
    case 'titulo_clausula':
      return <p style={{ ...st.base, ...st.just, fontWeight: 700, marginTop: 12 * PT, marginBottom: 6 * PT }}>{bl.texto}</p>;
    case 'parrafo':
    default:
      return <p style={{ ...st.base, ...st.just, marginBottom: 6 * PT }}><Segmentos segs={bl.segs || []} /></p>;
  }
}

export default function VistaPrevia({ bloques }) {
  return (
    <div style={st.hoja}>
      {bloques.map((bl, i) => <Bloque key={i} bl={bl} />)}
    </div>
  );
}

const st = {
  hoja: {
    background: '#fff',
    width: '100%',
    maxWidth: 794,
    margin: '0 auto',
    padding: '56px 56px 40px',
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15)',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#000',
  },
  base: { fontSize: 11 * PT, lineHeight: `${14 * PT}px`, margin: 0 },
  centro: { textAlign: 'center' },
  just: { textAlign: 'justify' },
};
