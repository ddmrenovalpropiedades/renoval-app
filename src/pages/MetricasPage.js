// src/pages/MetricasPage.js
//
// Métricas del módulo de Mensajería. Ahora que toda consulta se deriva al WhatsApp
// personal del ejecutivo (ver api/whatsapp.js → notificarEjecutivo), ya no hay
// visibilidad de los mensajes que el ejecutivo intercambia con el interesado. La
// única señal medible es el link corto que se le envía en la notificación
// (tabla wa_links): cuándo se creó (se generó y envió el resumen) y, si lo abrió,
// cuándo (wa_links.clicked_at). Con eso se arma:
//   - Leads atendidos hoy      → wa_links con clicked_at dentro de hoy
//   - Pendientes por atender   → wa_links sin clicked_at (backlog completo)
//   - Tiempo de respuesta      → promedio de (clicked_at - created_at) por ejecutivo,
//                                dentro del período elegido, de más rápido a más lento
//
// "Consultas por fuentes" (donut por origen del lead) queda en standby: no hay hoy
// una fuente registrada por conversación, así que no se implementa en esta versión.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const PERIODOS = [
  { id: 'hoy', label: 'Hoy',               dias: 1  },
  { id: '7d',  label: 'Últimos 7 días',    dias: 7  },
  { id: '30d', label: 'Últimos 30 días',   dias: 30 },
  { id: '90d', label: 'Últimos 90 días',   dias: 90 },
];

const PERIODO_DEFAULT = '7d';

function formatMmSs(totalSegundos) {
  const s   = Math.max(0, Math.round(totalSegundos));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${String(min).padStart(2, '0')}m ${String(seg).padStart(2, '0')}s`;
}

function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const containerStyle = { padding: 24, maxWidth: 1000, margin: '0 auto' };
const headerRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 };
const titleStyle     = { fontSize: 20, fontWeight: 600, margin: 0 };
const selectStyle    = { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#1c1f24', color: '#e4e6eb', fontSize: 14 };
const tilesRowStyle  = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 };
const tileStyle      = { background: '#1c1f24', border: '1px solid #2a2e35', borderRadius: 12, padding: '18px 20px' };
const tileLabelStyle = { fontSize: 13, color: '#9aa0a6', marginBottom: 8 };
const tileValueStyle = { fontSize: 32, fontWeight: 700, color: '#e4e6eb', lineHeight: 1 };
const sectionTitle   = { fontSize: 15, fontWeight: 600, margin: '0 0 12px 0', color: '#e4e6eb' };
const listCardStyle  = { background: '#1c1f24', border: '1px solid #2a2e35', borderRadius: 12, overflow: 'hidden' };
const rowStyle        = (isLast) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid #2a2e35' });
const rowNameStyle    = { fontSize: 14, color: '#e4e6eb' };
const rowSubStyle     = { fontSize: 12, color: '#9aa0a6', marginTop: 2 };
const rowTimeStyle    = { fontSize: 15, fontWeight: 600, color: '#e4e6eb', fontVariantNumeric: 'tabular-nums' };
const emptyStyle      = { padding: '24px 20px', color: '#9aa0a6', fontSize: 14, textAlign: 'center' };
const errorStyle      = { padding: '14px 16px', background: '#3a1f22', border: '1px solid #5a2a2f', borderRadius: 8, color: '#f2b8bd', fontSize: 14, marginBottom: 16 };

export default function MetricasPage() {
  const [periodo, setPeriodo]                 = useState(PERIODO_DEFAULT);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [leadsAtendidosHoy, setLeadsAtendidosHoy] = useState(0);
  const [pendientes, setPendientes]           = useState(0);
  const [ranking, setRanking]                 = useState([]);

  const cargarMetricas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configPeriodo = PERIODOS.find(p => p.id === periodo) || PERIODOS[1];
      const desde = new Date();
      desde.setDate(desde.getDate() - configPeriodo.dias);

      const hoyInicio = inicioDeHoy();

      const [{ count: atendidosHoy, error: errAtendidos }, { count: pendientesCount, error: errPendientes }, { data: filas, error: errFilas }] = await Promise.all([
        supabase.from('wa_links').select('id', { count: 'exact', head: true }).gte('clicked_at', hoyInicio.toISOString()),
        supabase.from('wa_links').select('id', { count: 'exact', head: true }).is('clicked_at', null),
        supabase.from('wa_links').select('agent_id, created_at, clicked_at').not('clicked_at', 'is', null).gte('created_at', desde.toISOString()),
      ]);

      if (errAtendidos)  throw errAtendidos;
      if (errPendientes) throw errPendientes;
      if (errFilas)      throw errFilas;

      // Promedio de tiempo de respuesta por ejecutivo dentro del período
      const acumulado = {};
      (filas || []).forEach(f => {
        if (!f.agent_id || !f.clicked_at) return;
        const segundos = (new Date(f.clicked_at).getTime() - new Date(f.created_at).getTime()) / 1000;
        if (segundos < 0) return; // dato inconsistente, se ignora
        if (!acumulado[f.agent_id]) acumulado[f.agent_id] = { total: 0, n: 0 };
        acumulado[f.agent_id].total += segundos;
        acumulado[f.agent_id].n     += 1;
      });

      const agentIds = Object.keys(acumulado);
      let nombresPorId = {};
      if (agentIds.length > 0) {
        const { data: usuarios, error: errUsuarios } = await supabase
          .from('app_users')
          .select('id, full_name')
          .in('id', agentIds);
        if (errUsuarios) throw errUsuarios;
        (usuarios || []).forEach(u => { nombresPorId[u.id] = u.full_name; });
      }

      const rankingCalculado = agentIds
        .map(id => ({
          agentId:           id,
          nombre:            nombresPorId[id] || 'Sin nombre',
          promedioSegundos:  acumulado[id].total / acumulado[id].n,
          cantidadAtendidos: acumulado[id].n,
        }))
        .sort((a, b) => a.promedioSegundos - b.promedioSegundos);

      setLeadsAtendidosHoy(atendidosHoy || 0);
      setPendientes(pendientesCount || 0);
      setRanking(rankingCalculado);
    } catch (err) {
      console.error('Error cargando métricas:', err.message);
      setError('No se pudieron cargar las métricas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { cargarMetricas(); }, [cargarMetricas]);

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <h2 style={titleStyle}>Métricas</h2>
        <select style={selectStyle} value={periodo} onChange={e => setPeriodo(e.target.value)}>
          {PERIODOS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={tilesRowStyle}>
        <div style={tileStyle}>
          <div style={tileLabelStyle}>Leads atendidos (hoy)</div>
          <div style={tileValueStyle}>{loading ? '—' : leadsAtendidosHoy}</div>
        </div>
        <div style={tileStyle}>
          <div style={tileLabelStyle}>Pendientes por atender</div>
          <div style={tileValueStyle}>{loading ? '—' : pendientes}</div>
        </div>
      </div>

      <h3 style={sectionTitle}>Tiempo promedio de respuesta por ejecutivo</h3>
      <div style={listCardStyle}>
        {loading ? (
          <div style={emptyStyle}>Cargando…</div>
        ) : ranking.length === 0 ? (
          <div style={emptyStyle}>Sin datos de respuesta en este período.</div>
        ) : (
          ranking.map((r, idx) => (
            <div key={r.agentId} style={rowStyle(idx === ranking.length - 1)}>
              <div>
                <div style={rowNameStyle}>{r.nombre}</div>
                <div style={rowSubStyle}>{r.cantidadAtendidos} lead{r.cantidadAtendidos === 1 ? '' : 's'} atendido{r.cantidadAtendidos === 1 ? '' : 's'}</div>
              </div>
              <div style={rowTimeStyle}>{formatMmSs(r.promedioSegundos)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
