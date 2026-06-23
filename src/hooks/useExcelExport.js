// src/hooks/useExcelExport.js
// Hook reutilizable para exportar datos a Excel con SheetJS (ya instalado en el proyecto)
import { useCallback } from 'react';
import * as XLSX from 'xlsx';

export function useExcelExport() {
  const exportToExcel = useCallback((data, columns, filename) => {
    // data: array de objetos
    // columns: array de { key, label } — define orden y nombres de columnas
    // filename: nombre del archivo sin extensión

    const rows = data.map(row =>
      Object.fromEntries(columns.map(c => [c.label, row[c.key] ?? '']))
    );

    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.label) });

    // Ancho automático por columna
    const colWidths = columns.map(c => ({
      wch: Math.max(c.label.length, ...rows.map(r => String(r[c.label] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${filename}_${fecha}.xlsx`);
  }, []);

  return { exportToExcel };
}
