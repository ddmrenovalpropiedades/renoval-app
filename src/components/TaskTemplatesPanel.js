import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Plus, Trash2, Save } from 'lucide-react';

const TRIGGER_LABELS = {
  pizarra_nueva_propiedad: 'Nueva propiedad en Pizarra',
  pizarra_arrendada: 'Propiedad arrendada en Pizarra',
  pagos_90_dias: 'Pago cumple 90 días',
};

const CONDITION_LABELS = {
  nuevo: 'Solo si TIPO = Nuevo',
  renovacion: 'Solo si TIPO = Renovación/Vacío',
  renovacion_dev_gar: 'Tarea programada Dev Gar (Renovación/Vacío)',
  null: 'Siempre',
};

const ROLE_LABELS = {
  e1: 'E1 (DD/FD)',
  e2: 'E2 (EA/FG)',
  dd: 'DD',
  fd: 'FD',
};

export default function TaskTemplatesPanel({ onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .order('trigger', { ascending: true })
      .order('position', { ascending: true });
    setTemplates(data || []);
    setLoading(false);
  };

  const handleSave = async (tpl) => {
    setSaving(tpl.id);
    await supabase.from('task_templates').update({
      task_title: tpl.task_title,
      subtasks: tpl.subtasks,
      active: tpl.active,
    }).eq('id', tpl.id);
    setSaving(null);
    setSaved(tpl.id);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleSubtaskChange = (tplId, idx, val) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== tplId) return t;
      const subs = [...(t.subtasks || [])];
      subs[idx] = val;
      return { ...t, subtasks: subs };
    }));
  };

  const handleAddSubtask = (tplId) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== tplId) return t;
      return { ...t, subtasks: [...(t.subtasks || []), ''] };
    }));
  };

  const handleDeleteSubtask = (tplId, idx) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== tplId) return t;
      const subs = [...(t.subtasks || [])];
      subs.splice(idx, 1);
      return { ...t, subtasks: subs };
    }));
  };

  const handleToggleActive = (tplId) => {
    setTemplates(prev => prev.map(t =>
      t.id === tplId ? { ...t, active: !t.active } : t
    ));
  };

  const handleTitleChange = (tplId, val) => {
    setTemplates(prev => prev.map(t =>
      t.id === tplId ? { ...t, task_title: val } : t
    ));
  };

  // Agrupar por trigger
  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.trigger]) acc[t.trigger] = [];
    acc[t.trigger].push(t);
    return acc;
  }, {});

  const s = styles;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.headerTitle}>Configuración de tareas automáticas</span>
          <button onClick={onClose} style={s.closeBtn}><X size={18} color="#5f6368" /></button>
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={s.loading}>Cargando...</div>
          ) : (
            Object.entries(grouped).map(([trigger, tpls]) => (
              <div key={trigger} style={s.group}>
                <div style={s.groupTitle}>{TRIGGER_LABELS[trigger] || trigger}</div>
                {tpls.map(tpl => (
                  <div key={tpl.id} style={{ ...s.card, opacity: tpl.active ? 1 : 0.5 }}>
                    <div style={s.cardHeader}>
                      <div style={s.cardMeta}>
                        <span style={s.roleBadge}>{ROLE_LABELS[tpl.assignee_role] || tpl.assignee_role}</span>
                        {tpl.condition && (
                          <span style={s.condBadge}>{CONDITION_LABELS[tpl.condition] || tpl.condition}</span>
                        )}
                      </div>
                      <div style={s.cardActions}>
                        <label style={s.toggleLabel}>
                          <input
                            type="checkbox"
                            checked={tpl.active}
                            onChange={() => handleToggleActive(tpl.id)}
                            style={{ marginRight: 4 }}
                          />
                          Activo
                        </label>
                        <button
                          onClick={() => handleSave(tpl)}
                          style={{ ...s.saveBtn, ...(saved === tpl.id ? s.saveBtnDone : {}) }}
                          disabled={saving === tpl.id}
                        >
                          {saving === tpl.id ? '...' : saved === tpl.id ? '✓ Guardado' : <><Save size={12} style={{ marginRight: 4 }} />Guardar</>}
                        </button>
                      </div>
                    </div>

                    <div style={s.field}>
                      <label style={s.fieldLabel}>Título de tarea</label>
                      <input
                        style={s.input}
                        value={tpl.task_title}
                        onChange={e => handleTitleChange(tpl.id, e.target.value)}
                      />
                      <div style={s.hint}>Usa {'{{propiedad}}'} para insertar el nombre de la propiedad</div>
                    </div>

                    {tpl.condition !== 'renovacion_dev_gar' && (
                      <div style={s.field}>
                        <label style={s.fieldLabel}>Subtareas</label>
                        {(tpl.subtasks || []).map((sub, idx) => (
                          <div key={idx} style={s.subtaskRow}>
                            <input
                              style={s.subtaskInput}
                              value={sub}
                              onChange={e => handleSubtaskChange(tpl.id, idx, e.target.value)}
                              placeholder={`Subtarea ${idx + 1}`}
                            />
                            <button
                              onClick={() => handleDeleteSubtask(tpl.id, idx)}
                              style={s.deleteSubBtn}
                              title="Eliminar subtarea"
                            >
                              <Trash2 size={13} color="#ea4335" />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => handleAddSubtask(tpl.id)} style={s.addSubBtn}>
                          <Plus size={13} style={{ marginRight: 4 }} />Agregar subtarea
                        </button>
                      </div>
                    )}

                    {tpl.condition === 'renovacion_dev_gar' && (
                      <div style={s.hint}>
                        Esta tarea se programa automáticamente para 52 días después de la fecha de entrega (1 mes + 3 semanas). Al completarse, marca DEV GAR como Listo en Propiedades Arrendadas.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 2000 },
  panel: { background: '#fff', width: 540, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', fontFamily: "'Google Sans','Segoe UI',sans-serif", overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: '#202124' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6' },
  group: { marginBottom: 28 },
  groupTitle: { fontSize: 11, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #e8eaed' },
  card: { background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 10, padding: '14px 16px', marginBottom: 12, transition: 'opacity 0.2s' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardMeta: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  roleBadge: { fontSize: 11, fontWeight: 700, background: '#e8f0fe', color: '#1a73e8', borderRadius: 20, padding: '2px 10px' },
  condBadge: { fontSize: 11, fontWeight: 600, background: '#fff3e0', color: '#f57c00', borderRadius: 20, padding: '2px 10px' },
  cardActions: { display: 'flex', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 12, color: '#5f6368', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', padding: '5px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtnDone: { background: '#34a853' },
  field: { marginBottom: 12 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#5f6368', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' },
  hint: { fontSize: 11, color: '#9aa0a6', marginTop: 4 },
  subtaskRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  subtaskInput: { flex: 1, border: '1px solid #dadce0', borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  deleteSubBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 },
  addSubBtn: { display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'none', border: '1px dashed #dadce0', borderRadius: 6, fontSize: 12, color: '#5f6368', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
};
