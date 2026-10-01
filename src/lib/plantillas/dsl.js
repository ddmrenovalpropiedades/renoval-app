// ════════════════════════════════════════════════════════════════
// Notación compacta → documento TipTap (JSON)
//
//   **texto**            negrita (puede envolver variables)
//   {{variable}}         variable general o de persona
//   {{lista:formato}}    lista de personas usando un formato de persona
//   {{frag:id}}          fragmento condicional
//   {{g:ref|masc|fem}}   concordancia de género
//   {{n:ref|sing|plur}}  concordancia de número
//   {{c:ref|sm|sf|pm|pf}} concordancia completa
//
// Se usa para escribir la plantilla base y sirve de base para importar.
// ════════════════════════════════════════════════════════════════

const TOKEN = /(\*\*|\{\{[^}]+\}\})/g;

function nodoDesdeToken(cuerpo) {
  const [tipo, resto] = cuerpo.includes(':') ? cuerpo.split(/:(.*)/s) : [null, cuerpo];

  if (tipo === 'lista') return { type: 'lista', attrs: { formato: resto.trim() } };
  if (tipo === 'frag') return { type: 'fragmento', attrs: { id: resto.trim() } };

  if (tipo === 'g' || tipo === 'n' || tipo === 'c') {
    const [ref, ...formas] = resto.split('|');
    let attrs;
    if (tipo === 'g') attrs = { sm: formas[0], sf: formas[1], pm: formas[0], pf: formas[1] };
    else if (tipo === 'n') attrs = { sm: formas[0], sf: formas[0], pm: formas[1], pf: formas[1] };
    else attrs = { sm: formas[0], sf: formas[1], pm: formas[2], pf: formas[3] };
    return { type: 'concordancia', attrs: { ref: ref.trim(), ...attrs } };
  }

  return { type: 'variable', attrs: { id: cuerpo.trim() } };
}

// Una línea de notación → array de nodos inline TipTap
export function inline(texto) {
  const nodos = [];
  let negrita = false;
  texto.split(TOKEN).forEach((parte) => {
    if (!parte) return;
    if (parte === '**') {
      negrita = !negrita;
      return;
    }
    const marks = negrita ? [{ type: 'bold' }] : undefined;
    const nodo = parte.startsWith('{{')
      ? nodoDesdeToken(parte.slice(2, -2))
      : { type: 'text', text: parte };
    if (marks) nodo.marks = marks;
    nodos.push(nodo);
  });
  return nodos;
}

// p('texto', { condicion, item }) → nodo párrafo
export function p(texto, attrs = {}) {
  return {
    type: 'paragraph',
    attrs: { condicion: attrs.condicion || null, item: !!attrs.item },
    content: inline(texto),
  };
}

// doc(p(...), p(...)) → documento TipTap
export function doc(...parrafos) {
  return { type: 'doc', content: parrafos };
}

// Atajo para cuerpos de una sola línea (fragmentos, formatos de persona)
export function docInline(texto) {
  return doc(p(texto));
}
