-- ============================================================
-- MÓDULO DE TAREAS — Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla principal de tareas
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,           -- dueño de la tarea
  category TEXT NOT NULL CHECK (category IN ('Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo')),
  title TEXT NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0,          -- orden dentro de la categoría
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- para subtareas
  -- Solicitudes
  assigned_to TEXT,                    -- email del destinatario (solo Solicitudes)
  -- Recurrencia
  recurrence TEXT CHECK (recurrence IN ('none','daily','weekly','monthly','yearly','custom')),
  recurrence_config JSONB,             -- config detallada (ej. días de la semana)
  next_occurrence DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(owner_email);
CREATE INDEX IF NOT EXISTS tasks_category_idx ON tasks(category);
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON tasks(assigned_to);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve sus propias tareas + las que le asignaron en Equipo
CREATE POLICY "Ver propias tareas"
  ON tasks FOR SELECT
  USING (
    owner_email = auth.jwt() ->> 'email'
    OR assigned_to = auth.jwt() ->> 'email'
  );

CREATE POLICY "Crear propias tareas"
  ON tasks FOR INSERT
  WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Editar propias tareas"
  ON tasks FOR UPDATE
  USING (
    owner_email = auth.jwt() ->> 'email'
    OR assigned_to = auth.jwt() ->> 'email'
  );

CREATE POLICY "Eliminar propias tareas"
  ON tasks FOR DELETE
  USING (owner_email = auth.jwt() ->> 'email');

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabla de historial de tareas completadas
CREATE TABLE IF NOT EXISTS tasks_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  assigned_to TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver propio historial"
  ON tasks_history FOR SELECT
  USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Insertar en historial"
  ON tasks_history FOR INSERT
  WITH CHECK (owner_email = auth.jwt() ->> 'email');
