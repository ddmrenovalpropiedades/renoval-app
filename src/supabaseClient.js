import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://yyxsurlhzvazwgmerglc.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_m6ZuIMeuDyRfK5NpSYJFrA_dx7fKd64';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Roles por email
export const OWNER_EMAILS = [
  'ddm@renovalpropiedades.com',
  'fdm@renovalpropiedades.com',
];

export const USER_INITIALS = {
  'ddm@renovalpropiedades.com': 'DD',
  'fdm@renovalpropiedades.com': 'FD',
  'edith@renovalpropiedades.com': 'EA',
  'fernanda@renovalpropiedades.com': 'FG',
};

export const getUserRole = (email) => {
  return OWNER_EMAILS.includes(email) ? 'owner' : 'collaborator';
};

export const getUserInitials = (email) => {
  return USER_INITIALS[email] || email?.split('@')[0]?.toUpperCase()?.slice(0, 2);
};
