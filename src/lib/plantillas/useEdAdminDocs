// ¿El usuario actual puede editar plantillas? (fuente de verdad: tabla doc_admins)
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function useEsAdminDocs() {
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    let activo = true;
    supabase.rpc('doc_es_admin').then(({ data, error }) => {
      if (activo) setEsAdmin(!error && data === true);
    });
    return () => { activo = false; };
  }, []);

  return esAdmin;
}
