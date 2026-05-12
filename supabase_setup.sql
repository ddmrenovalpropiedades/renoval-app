-- ============================================================
-- RENOVAL APP — Setup inicial de base de datos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Tabla de usuarios de la app (se puebla automáticamente al primer login)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
  blocked BOOLEAN DEFAULT FALSE,
  last_sign_in TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar los 4 usuarios iniciales con sus roles
INSERT INTO app_users (email, full_name, role) VALUES
  ('ddm@renovalpropiedades.com',      'DD',     'owner'),
  ('fdm@renovalpropiedades.com',      'FD',     'owner'),
  ('edith@renovalpropiedades.com',    'EA',     'collaborator'),
  ('fernanda@renovalpropiedades.com', 'FG',     'collaborator')
ON CONFLICT (email) DO NOTHING;

-- RLS: solo owners pueden ver y modificar todos los usuarios
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON app_users FOR SELECT
  USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Owners pueden ver todos los usuarios"
  ON app_users FOR SELECT
  USING (
    (auth.jwt() ->> 'email') IN (
      'ddm@renovalpropiedades.com',
      'fdm@renovalpropiedades.com'
    )
  );

CREATE POLICY "Owners pueden modificar usuarios"
  ON app_users FOR UPDATE
  USING (
    (auth.jwt() ->> 'email') IN (
      'ddm@renovalpropiedades.com',
      'fdm@renovalpropiedades.com'
    )
  );

CREATE POLICY "Owners pueden eliminar usuarios"
  ON app_users FOR DELETE
  USING (
    (auth.jwt() ->> 'email') IN (
      'ddm@renovalpropiedades.com',
      'fdm@renovalpropiedades.com'
    )
  );

-- Función para actualizar last_sign_in automáticamente
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_users (email, full_name, avatar_url, last_sign_in)
  VALUES (
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    last_sign_in = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta en cada login
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_login();
