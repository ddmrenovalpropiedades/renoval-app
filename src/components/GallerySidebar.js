import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { X, Upload, ChevronLeft, ChevronRight, ImageIcon, Trash2 } from 'lucide-react';

const MAX_SETS = 10;

export default function GallerySidebar({ onClose, userEmail, unlockedSinceOpen = 0 }) {
  const [sets, setSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(() => localStorage.getItem('galleryActiveSet') || null);
  const [progress, setProgress] = useState({});
  const [images, setImages] = useState([]);
  const [mainIdx, setMainIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showNewSet, setShowNewSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const [deletingSet, setDeletingSet] = useState(false);

  const setsRef = useRef(sets);
  const progressRef = useRef(progress);
  useEffect(() => { setsRef.current = sets; }, [sets]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const fetchSets = useCallback(async () => {
    const { data } = await supabase.from('gallery_sets').select('*').order('created_at', { ascending: true });
    setSets(data || []);
    return data || [];
  }, []);

  const fetchProgress = useCallback(async () => {
    const { data } = await supabase.from('gallery_progress').select('*');
    const map = {};
    (data || []).forEach(p => { map[p.set_id] = p.unlocked_count; });
    setProgress(map);
    return map;
  }, []);

  const buildImageUrls = useCallback((setId, setsArr, progressMap) => {
    if (!setId) return [];
    const set = setsArr.find(s => s.id === setId);
    if (!set || !set.total_images) return [];
    const unlocked = progressMap[setId] || 1;
    const urls = [];
    for (let i = 1; i <= Math.min(unlocked, set.total_images); i++) {
      const { data } = supabase.storage.from('gallery').getPublicUrl(`${setId}/${i}.jpg`);
      urls.push(data.publicUrl);
    }
    return urls;
  }, []);

  useEffect(() => {
    const init = async () => {
      const setsData = await fetchSets();
      const progressData = await fetchProgress();
      const stored = localStorage.getItem('galleryActiveSet');
      if (stored) {
        const urls = buildImageUrls(stored, setsData, progressData);
        setImages(urls);
        // Mostrar la última imagen desbloqueada al abrir
        setMainIdx(urls.length > 0 ? urls.length - 1 : 0);
        setImageLoadErrors({});
      }
    };
    init();
  }, [fetchSets, fetchProgress, buildImageUrls]);

  // Cuando se desbloquea una imagen, mostrarla automáticamente
  useEffect(() => {
    if (unlockedSinceOpen > 0) {
      fetchProgress().then(progressData => {
        if (activeSetId) {
          const urls = buildImageUrls(activeSetId, setsRef.current, progressData);
          setImages(urls);
          // Ir a la recién desbloqueada (última)
          setMainIdx(urls.length > 0 ? urls.length - 1 : 0);
          setImageLoadErrors({});
        }
      });
    }
  }, [unlockedSinceOpen, fetchProgress, activeSetId, buildImageUrls]);

  useEffect(() => {
    if (!activeSetId) { setImages([]); return; }
    const urls = buildImageUrls(activeSetId, setsRef.current, progressRef.current);
    setImages(urls);
    setMainIdx(urls.length > 0 ? urls.length - 1 : 0);
    setImageLoadErrors({});
  }, [activeSetId, buildImageUrls]);

  const handleSetChange = (id) => {
    if (!id) return;
    setActiveSetId(id);
    localStorage.setItem('galleryActiveSet', id);
    setImageLoadErrors({});
    const urls = buildImageUrls(id, setsRef.current, progressRef.current);
    setImages(urls);
    setMainIdx(urls.length > 0 ? urls.length - 1 : 0);
  };

  const handleDeleteSet = async () => {
    if (!activeSetId) return;
    const setName = sets.find(s => s.id === activeSetId)?.name || 'este set';
    if (!window.confirm(`¿Eliminar "${setName}" y todas sus imágenes? Esta acción no se puede deshacer.`)) return;
    setDeletingSet(true);
    try {
      // Listar y eliminar archivos del bucket
      const { data: fileList } = await supabase.storage.from('gallery').list(activeSetId);
      if (fileList && fileList.length > 0) {
        const paths = fileList.map(f => `${activeSetId}/${f.name}`);
        await supabase.storage.from('gallery').remove(paths);
      }
      // Eliminar registros de DB
      await supabase.from('gallery_progress').delete().eq('set_id', activeSetId);
      await supabase.from('gallery_sets').delete().eq('id', activeSetId);
      // Limpiar estado
      localStorage.removeItem('galleryActiveSet');
      setActiveSetId(null);
      setImages([]);
      setMainIdx(0);
      await fetchSets();
      await fetchProgress();
    } catch (e) {
      alert('Error al eliminar el set: ' + e.message);
    }
    setDeletingSet(false);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (sets.length >= MAX_SETS && !activeSetId) { alert('Máximo de sets alcanzado (10)'); return; }

    const jpgFiles = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));
    if (!jpgFiles.length) { alert('Solo se aceptan archivos JPG'); return; }

    jpgFiles.sort((a, b) => {
      const na = parseInt(a.name.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.name.replace(/\D/g, '')) || 0;
      return na - nb;
    });

    setUploading(true);
    // Si showNewSet está activo, siempre crear un set nuevo (ignorar activeSetId)
    let setId = showNewSet ? null : activeSetId;

    if (!setId) {
      const name = newSetName.trim() || `Set ${sets.length + 1}`;
      const { data, error } = await supabase.from('gallery_sets')
        .insert({ name, total_images: jpgFiles.length }).select().single();
      if (error || !data) { alert('Error creando set: ' + (error?.message || 'desconocido')); setUploading(false); return; }
      setId = data.id;
      await supabase.from('gallery_progress').insert({ set_id: setId, unlocked_count: 1 });
    }

    for (let i = 0; i < jpgFiles.length; i++) {
      setUploadProgress(`Subiendo ${i + 1} de ${jpgFiles.length}...`);
      const { error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(`${setId}/${i + 1}.jpg`, jpgFiles[i], { upsert: true });
      if (uploadError) console.error(`Error subiendo imagen ${i + 1}:`, uploadError.message);
    }

    await supabase.from('gallery_sets').update({ total_images: jpgFiles.length }).eq('id', setId);

    const freshSets = await fetchSets();
    const freshProgress = await fetchProgress();

    setActiveSetId(setId);
    localStorage.setItem('galleryActiveSet', setId);

    const urls = buildImageUrls(setId, freshSets, freshProgress);
    setImages(urls);
    setMainIdx(0);
    setImageLoadErrors({});
    setShowNewSet(false);
    setNewSetName('');
    setUploading(false);
    setUploadProgress('');
    e.target.value = '';
  };

  const activeSet = sets.find(s => s.id === activeSetId);
  const unlocked = activeSetId ? (progress[activeSetId] || 1) : 0;
  const total = activeSet?.total_images || 0;

  return (
    <div style={styles.sidebar}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Galería</span>
        <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
      </div>

      {/* Set selector + botón eliminar */}
      <div style={styles.setRow}>
        <select value={activeSetId || ''} onChange={e => handleSetChange(e.target.value)} style={styles.setSelect}>
          <option value="">— Seleccionar set —</option>
          {sets.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({progress[s.id] || 1}/{s.total_images})</option>
          ))}
        </select>
        {activeSetId && (
          <button onClick={handleDeleteSet} disabled={deletingSet} style={styles.deleteSetBtn} title="Eliminar set">
            <Trash2 size={14} />
          </button>
        )}
        {sets.length < MAX_SETS && (
          <button onClick={() => setShowNewSet(!showNewSet)} style={styles.addSetBtn} title="Nuevo set">+</button>
        )}
      </div>

      {/* New set form */}
      {showNewSet && (
        <div style={styles.newSetForm}>
          <input value={newSetName} onChange={e => setNewSetName(e.target.value)}
            placeholder="Nombre del set" style={styles.newSetInput} />
          <label style={styles.uploadBtn}>
            <Upload size={13} style={{ marginRight: 4 }} />
            {uploading ? uploadProgress : 'Cargar imágenes'}
            <input type="file" accept=".jpg,.jpeg" multiple style={{ display: 'none' }}
              onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {/* Reemplazar imágenes del set activo */}
      {activeSetId && !showNewSet && (
        <label style={{ ...styles.uploadBtn, marginBottom: 8 }}>
          <Upload size={13} style={{ marginRight: 4 }} />
          {uploading ? uploadProgress : 'Reemplazar imágenes del set'}
          <input type="file" accept=".jpg,.jpeg" multiple style={{ display: 'none' }}
            onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {/* Progress bar */}
      {activeSetId && total > 0 && (
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${(unlocked / total) * 100}%` }} />
          <span style={styles.progressText}>{unlocked} / {total} imágenes desbloqueadas</span>
        </div>
      )}

      {/* Imagen principal */}
      {images.length > 0 ? (
        <div style={styles.mainImageWrapper}>
          {imageLoadErrors[mainIdx] ? (
            <div style={styles.imgError}>
              <ImageIcon size={32} color="#dadce0" />
              <p style={{ color: '#9aa0a6', fontSize: 12, margin: '6px 0 0', textAlign: 'center' }}>
                No se pudo cargar la imagen
              </p>
            </div>
          ) : (
            <img
              key={images[mainIdx]}
              src={images[mainIdx]}
              alt={`${mainIdx + 1}`}
              style={styles.mainImage}
              onError={() => setImageLoadErrors(prev => ({ ...prev, [mainIdx]: true }))}
            />
          )}
          {images.length > 1 && (
            <div style={styles.mainNav}>
              <button onClick={() => setMainIdx(i => Math.max(0, i - 1))} style={styles.navBtn} disabled={mainIdx === 0}>
                <ChevronLeft size={18} />
              </button>
              <span style={styles.mainCounter}>{mainIdx + 1} / {images.length}</span>
              <button onClick={() => setMainIdx(i => Math.min(images.length - 1, i + 1))} style={styles.navBtn} disabled={mainIdx === images.length - 1}>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <ImageIcon size={40} color="#dadce0" />
          <p style={{ color: '#9aa0a6', fontSize: 13, margin: '8px 0 0', textAlign: 'center' }}>
            {activeSetId ? (uploading ? uploadProgress : 'No hay imágenes disponibles') : 'Selecciona un set para ver imágenes'}
          </p>
        </div>
      )}

      {/* Miniaturas — solo las desbloqueadas */}
      {images.length > 0 && (
        <div style={styles.thumbGrid}>
          {images.map((url, i) => (
            imageLoadErrors[i] ? (
              <div key={i} style={{ ...styles.thumbLocked, cursor: 'pointer', background: '#f8d7da' }}
                onClick={() => setMainIdx(i)} title="Error al cargar">⚠️</div>
            ) : (
              <img
                key={i}
                src={url}
                alt={`${i + 1}`}
                onClick={() => setMainIdx(i)}
                style={{ ...styles.thumb, ...(i === mainIdx ? styles.thumbActive : {}) }}
                onError={() => setImageLoadErrors(prev => ({ ...prev, [i]: true }))}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

export async function unlockNextGalleryImage(setId) {
  if (!setId) return;
  const { data: prog } = await supabase.from('gallery_progress').select('*').eq('set_id', setId).maybeSingle();
  const { data: set } = await supabase.from('gallery_sets').select('total_images').eq('id', setId).maybeSingle();
  if (!prog || !set) return;
  if (prog.unlocked_count >= set.total_images) return;
  await supabase.from('gallery_progress').update({ unlocked_count: prog.unlocked_count + 1 }).eq('set_id', setId);
}

const styles = {
  sidebar: { width: 320, background: '#fff', borderLeft: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#202124' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: '#5f6368' },
  setRow: { display: 'flex', gap: 6, padding: '12px 14px 0', flexShrink: 0 },
  setSelect: { flex: 1, border: '1px solid #dadce0', borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  addSetBtn: { width: 32, height: 32, borderRadius: 7, border: '1px solid #1a73e8', background: '#e8f0fe', color: '#1a73e8', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  deleteSetBtn: { width: 32, height: 32, borderRadius: 7, border: '1px solid #fce8e6', background: '#fce8e6', color: '#c5221f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  newSetForm: { padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 },
  newSetInput: { border: '1px solid #dadce0', borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' },
  uploadBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, margin: '0 14px' },
  progressBar: { position: 'relative', height: 20, background: '#f1f3f4', margin: '10px 14px 0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 },
  progressFill: { position: 'absolute', left: 0, top: 0, height: '100%', background: '#1a73e8', borderRadius: 10, transition: 'width 0.4s' },
  progressText: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', zIndex: 1 },
  mainImageWrapper: { padding: '10px 14px 0', flexShrink: 0 },
  mainImage: { width: '100%', borderRadius: 8, display: 'block', maxHeight: 400, objectFit: 'contain', background: '#f8f9fa' },
  imgError: { width: '100%', height: 200, borderRadius: 8, background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  mainNav: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 6 },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: '#5f6368' },
  mainCounter: { fontSize: 12, color: '#5f6368' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  thumbGrid: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 14px 20px', },
  thumb: { width: 60, height: 80, objectFit: 'cover', borderRadius: 5, cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.15s' },
  thumbActive: { border: '2px solid #1a73e8' },
  thumbLocked: { width: 60, height: 80, background: '#f1f3f4', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#bdbdbd' },
};
