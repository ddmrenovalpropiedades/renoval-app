import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { X, FileText, Trash2, Paperclip, Image as ImageIcon, Download } from 'lucide-react';

const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };
const BUCKET = 'ficha-adjuntos';
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'application/pdf'];
const ACCEPTED_EXT = /\.(jpe?g|pdf)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const genId = () => (
  typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

// Descarga forzada vía blob — un <a download> normal no funciona confiable
// para URLs de otro origen (como las de Supabase Storage), el navegador
// tiende a solo abrirlas en vez de descargarlas.
async function forceDownload(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error('Error al descargar, se abre en pestaña nueva:', e);
    window.open(url, '_blank');
  }
}

// ── Envoltorio de celda ─────────────────────────────────────────
// Envuelve el contenido de una celda de "propiedad". Si `propiedad` viene
// resuelta (existe en Cartera), muestra un ícono de documento en la esquina
// inferior derecha, visible SOLO al pasar el mouse por la celda — nunca
// interfiere con el click normal de la celda (edición inline, etc.) porque
// usa stopPropagation.
export function FichaCellWrap({ children, propiedad, onOpenFicha, style }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ position: 'relative', width: '100%', ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {propiedad && (
        <button
          onClick={e => { e.stopPropagation(); onOpenFicha(propiedad); }}
          title="Ver Ficha de la propiedad"
          style={{ position: 'absolute', bottom: -6, right: -4, background: '#fff', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', color: '#5f6368', borderRadius: 4, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
          <FileText size={11} />
        </button>
      )}
    </div>
  );
}

// ── Barra lateral: Ficha de la propiedad ─────────────────────────
// Dos bloques independientes, ambos compartidos entre usuarios y
// actualizados en tiempo real: bitácora de comentarios (3/4 del alto) y
// archivos adjuntos (1/4 del alto).
export default function FichaSidebar({ propiedad, onClose }) {
  const { profile } = useAuth();

  // Bitácora de comentarios
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [newText, setNewText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState(null);

  // Archivos adjuntos
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoadingEntries(true);
    setLoadingFiles(true);
    const [{ data: entriesData }, { data: filesData }] = await Promise.all([
      supabase.from('property_bitacora').select('*').eq('propiedad', propiedad).order('created_at', { ascending: false }),
      supabase.from('property_files').select('*').eq('propiedad', propiedad).order('created_at', { ascending: false }),
    ]);
    setEntries(entriesData || []);
    setFiles(filesData || []);
    setLoadingEntries(false);
    setLoadingFiles(false);
  }, [propiedad]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filtramos en el cliente en vez de usar un filtro de Postgrest
  // (`propiedad=eq.${propiedad}`) porque el nombre de la propiedad puede
  // traer comas (la dirección completa de Cartera), y esas comas rompen la
  // sintaxis de filtro de Postgrest.
  useEffect(() => {
    const channel = supabase
      .channel('property_ficha_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_bitacora' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.propiedad !== propiedad) return;
        if (payload.eventType === 'INSERT') {
          setEntries(prev => prev.some(e => e.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_files' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.propiedad !== propiedad) return;
        if (payload.eventType === 'INSERT') {
          setFiles(prev => prev.some(f => f.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setFiles(prev => prev.filter(f => f.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [propiedad]);

  // ── Comentarios ──
  const handleAddComment = async () => {
    const texto = newText.trim();
    if (!texto) return;
    setSendingComment(true);
    try {
      const payload = { propiedad, texto, autor_email: profile?.email || null, autor_iniciales: profile?.iniciales || null };
      const { data, error } = await supabase.from('property_bitacora').insert(payload).select().single();
      if (error) throw error;
      if (data) {
        setEntries(prev => prev.some(e => e.id === data.id) ? prev : [data, ...prev]);
        setNewText('');
      }
    } catch (e) {
      console.error('Error guardando comentario:', e);
      alert('No se pudo guardar el comentario: ' + e.message);
    }
    setSendingComment(false);
  };

  const handleDeleteEntry = async (id) => {
    await supabase.from('property_bitacora').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setConfirmDeleteEntryId(null);
  };

  const handleDownloadLog = () => {
    const chronological = [...entries].reverse();
    const lines = chronological.map(e =>
      `[${formatFechaHora(e.created_at)}]${e.autor_iniciales ? ' ' + e.autor_iniciales : ''}\n${e.texto || ''}`
    );
    const text = `Bitácora — ${propiedad}\n${'='.repeat(40)}\n\n` +
      (lines.length ? lines.join('\n\n') : '(Sin entradas)');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_${propiedad.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ── Archivos ──
  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validType = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name);
    if (!validType) { alert('Solo se permiten archivos JPG o PDF.'); return; }
    if (file.size > MAX_FILE_SIZE) { alert('El archivo no puede superar los 10 MB.'); return; }
    setUploadingFile(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const path = `${genId()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const payload = {
        propiedad,
        archivo_url: urlData.publicUrl,
        archivo_path: path,
        archivo_nombre: file.name,
        archivo_tipo: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        archivo_size: file.size,
        autor_email: profile?.email || null,
        autor_iniciales: profile?.iniciales || null,
      };
      const { data, error } = await supabase.from('property_files').insert(payload).select().single();
      if (error) throw error;
      if (data) setFiles(prev => prev.some(f => f.id === data.id) ? prev : [data, ...prev]);
    } catch (e) {
      console.error('Error subiendo archivo:', e);
      alert('No se pudo subir el archivo: ' + e.message);
    }
    setUploadingFile(false);
  };

  const handleDeleteFile = async (id) => {
    const file = files.find(f => f.id === id);
    await supabase.from('property_files').delete().eq('id', id);
    if (file?.archivo_path) supabase.storage.from(BUCKET).remove([file.archivo_path]).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== id));
    setConfirmDeleteFileId(null);
  };

  const sectionLabelStyle = { fontSize: 11, fontWeight: 700, color: '#9aa0a6', letterSpacing: 0.5 };
  const smallBtnStyle = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #dadce0', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5f6368', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 380, maxWidth: '90vw', background: '#fff', boxShadow: '-6px 0 24px rgba(0,0,0,0.18)', zIndex: 2500, display: 'flex', flexDirection: 'column', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px', borderBottom: '1px solid #e8eaed', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa0a6', letterSpacing: 0.5, marginBottom: 2 }}>FICHA</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#202124' }}>{propiedad}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368' }}><X size={18} /></button>
      </div>

      {/* Cuerpo: bitácora (3/4) + archivos (1/4) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── BITÁCORA DE COMENTARIOS (3/4) ── */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: '1px solid #e8eaed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 8px', flexShrink: 0 }}>
            <span style={sectionLabelStyle}>BITÁCORA</span>
            <button onClick={handleDownloadLog} title="Descargar bitácora completa (.txt)" style={smallBtnStyle}>
              <Download size={12} /> Descargar
            </button>
          </div>

          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Agregar entrada a la bitácora..."
              style={{ width: '100%', minHeight: 60, border: '1px solid #dadce0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={handleAddComment} disabled={sendingComment || !newText.trim()}
                style={{ padding: '6px 14px', background: newText.trim() ? '#1a73e8' : '#e8eaed', color: newText.trim() ? '#fff' : '#9aa0a6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: newText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {sendingComment ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingEntries ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 16 }}>Cargando...</div>
            ) : entries.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 16, fontStyle: 'italic' }}>Sin entradas en la bitácora todavía.</div>
            ) : entries.map(entry => (
              <div key={entry.id} style={{ background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {entry.autor_iniciales && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: ENCARGADO_COLORS[entry.autor_iniciales] || '#5f6368', background: (ENCARGADO_COLORS[entry.autor_iniciales] || '#9aa0a6') + '22', border: `1px solid ${(ENCARGADO_COLORS[entry.autor_iniciales] || '#9aa0a6')}44`, borderRadius: 20, padding: '1px 7px' }}>
                        {entry.autor_iniciales}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#9aa0a6' }}>{formatFechaHora(entry.created_at)}</span>
                  </div>
                  {confirmDeleteEntryId === entry.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDeleteEntry(entry.id)} style={{ background: '#fce8e6', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 5px', color: '#ea4335', display: 'flex' }} title="Confirmar eliminar"><Trash2 size={11} /></button>
                      <button onClick={() => setConfirmDeleteEntryId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', color: '#5f6368', display: 'flex' }} title="Cancelar"><X size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteEntryId(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', color: '#9aa0a6', display: 'flex' }} title="Eliminar"><Trash2 size={11} /></button>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#3c4043', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.texto}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ARCHIVOS ADJUNTOS (1/4) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
            <span style={sectionLabelStyle}>ARCHIVOS</span>
            <button onClick={handleFileButtonClick} disabled={uploadingFile} title="Subir JPG o PDF" style={smallBtnStyle}>
              <Paperclip size={12} /> {uploadingFile ? 'Subiendo...' : 'Subir'}
            </button>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,application/pdf,image/jpeg" style={{ display: 'none' }} onChange={handleFileInputChange} />
          </div>

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loadingFiles ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 10 }}>Cargando...</div>
            ) : files.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 10, fontStyle: 'italic' }}>Sin archivos cargados.</div>
            ) : files.map(file => (
              <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: '7px 9px' }}>
                {file.archivo_tipo?.startsWith('image') ? <ImageIcon size={15} color="#5f6368" style={{ flexShrink: 0 }} /> : <FileText size={15} color="#5f6368" style={{ flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.archivo_nombre}>{file.archivo_nombre}</div>
                  <div style={{ fontSize: 10, color: '#9aa0a6' }}>{formatFileSize(file.archivo_size)}{file.autor_iniciales ? ` · ${file.autor_iniciales}` : ''}</div>
                </div>
                <button onClick={() => forceDownload(file.archivo_url, file.archivo_nombre)} title="Descargar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#1a73e8', display: 'flex', flexShrink: 0 }}><Download size={13} /></button>
                {confirmDeleteFileId === file.id ? (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => handleDeleteFile(file.id)} style={{ background: '#fce8e6', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '4px 5px', color: '#ea4335', display: 'flex' }} title="Confirmar eliminar"><Trash2 size={12} /></button>
                    <button onClick={() => setConfirmDeleteFileId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', color: '#5f6368', display: 'flex' }} title="Cancelar"><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteFileId(file.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9aa0a6', display: 'flex', flexShrink: 0 }}><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
