// ════════════════════════════════════════════════════════════════
// Bloques renderizados → documento Word (.docx)
// Mismo formato que el generador actual: Arial 11, A4, logo en portada.
// ════════════════════════════════════════════════════════════════
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Header } from 'docx';
import { LOGO_BASE64 } from '../../logoBase64';

const FUENTE = 'Arial';
const TAM = 22; // medio-puntos → 11 pt
const INTERLINEADO = { line: 280, lineRule: 'exact' };

const run = (s) => new TextRun({ text: s.t, ...(s.b ? { bold: true } : {}), font: FUENTE, size: TAM });

function parrafoDesdeBloque(bl) {
  switch (bl.tipo) {
    case 'linea':
      return new Paragraph({ children: [new TextRun({ text: '', font: FUENTE, size: TAM })], spacing: { after: 0, ...INTERLINEADO } });

    case 'titulo_doc':
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: bl.texto, bold: true, font: FUENTE, size: 24 })],
        spacing: { after: 0, ...INTERLINEADO },
      });

    case 'centrado':
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: bl.segs.map(run),
        spacing: { after: 0, ...INTERLINEADO },
      });

    case 'titulo_clausula':
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: bl.texto, bold: true, font: FUENTE, size: TAM })],
        spacing: { after: 120, before: 240, ...INTERLINEADO },
      });

    case 'parrafo':
    default:
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: (bl.segs || []).map(run),
        spacing: { after: 120, ...INTERLINEADO },
      });
  }
}

export function construirDocx(bloques) {
  const logo = Uint8Array.from(atob(LOGO_BASE64), (c) => c.charCodeAt(0));
  const headerLogo = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logo, transformation: { width: 200, height: 60 }, type: 'jpg' })],
      spacing: { after: 120 },
    })],
  });

  return new Document({
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1134, bottom: 1134, left: 1134 } },
        titlePage: true,
      },
      headers: {
        first: headerLogo,
        default: new Header({ children: [new Paragraph('')] }),
      },
      children: bloques.map(parrafoDesdeBloque),
    }],
  });
}

export async function docxABlob(bloques) {
  return Packer.toBlob(construirDocx(bloques));
}
