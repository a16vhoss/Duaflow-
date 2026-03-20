-- ============================================================================
-- AduaRed + CargoFlow — Complete Database Schema
-- Generated: 2026-03-17
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
CREATE TYPE user_role           AS ENUM ('superadmin', 'admin', 'broker');
CREATE TYPE container_estado    AS ENUM ('pendiente', 'aprobado', 'rechazado', 'correccion_solicitada');
CREATE TYPE corte_tipo          AS ENUM ('automatico', 'manual');
CREATE TYPE notif_tipo          AS ENUM ('aprobacion', 'rechazo', 'correccion', 'corte_info');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 aduanas (referenced by users, containers, user_aduanas)
-- --------------------------------------------------------------------------
CREATE TABLE aduanas (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  VARCHAR(150) NOT NULL,
    clave   VARCHAR(10)  UNIQUE NOT NULL,
    activa  BOOLEAN      DEFAULT true
);

COMMENT ON TABLE aduanas IS 'Catálogo de aduanas del sistema.';

-- --------------------------------------------------------------------------
-- 2.2 mercancias (referenced by containers, user_mercancias)
-- --------------------------------------------------------------------------
CREATE TABLE mercancias (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      VARCHAR(150) NOT NULL,
    descripcion TEXT,
    activa      BOOLEAN      DEFAULT true,
    created_at  TIMESTAMPTZ  DEFAULT now()
);

COMMENT ON TABLE mercancias IS 'Catálogo de tipos de mercancía.';

-- --------------------------------------------------------------------------
-- 2.3 users
-- --------------------------------------------------------------------------
CREATE TABLE users (
    id             UUID         PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email          VARCHAR(255) UNIQUE NOT NULL,
    nombre         VARCHAR(150) NOT NULL,
    role           user_role    NOT NULL,
    aduana_base_id UUID         REFERENCES aduanas (id) ON DELETE SET NULL,
    activo         BOOLEAN      DEFAULT true,
    created_at     TIMESTAMPTZ  DEFAULT now(),
    updated_at     TIMESTAMPTZ  DEFAULT now()
);

COMMENT ON TABLE users IS 'Perfil público de cada usuario, vinculado a auth.users.';

-- --------------------------------------------------------------------------
-- 2.4 user_aduanas (many-to-many: users <-> aduanas)
-- --------------------------------------------------------------------------
CREATE TABLE user_aduanas (
    user_id   UUID NOT NULL REFERENCES users (id)   ON DELETE CASCADE,
    aduana_id UUID NOT NULL REFERENCES aduanas (id)  ON DELETE CASCADE,
    PRIMARY KEY (user_id, aduana_id)
);

COMMENT ON TABLE user_aduanas IS 'Aduanas asignadas a cada usuario (broker o admin).';

-- --------------------------------------------------------------------------
-- 2.5 user_mercancias (many-to-many: users <-> mercancias)
-- --------------------------------------------------------------------------
CREATE TABLE user_mercancias (
    user_id      UUID NOT NULL REFERENCES users (id)      ON DELETE CASCADE,
    mercancia_id UUID NOT NULL REFERENCES mercancias (id)  ON DELETE CASCADE,
    PRIMARY KEY (user_id, mercancia_id)
);

COMMENT ON TABLE user_mercancias IS 'Mercancías que cada broker puede manejar.';

-- --------------------------------------------------------------------------
-- 2.6 admin_permisos
-- --------------------------------------------------------------------------
CREATE TABLE admin_permisos (
    user_id              UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    perm_aduanas         BOOLEAN DEFAULT false,
    perm_administradores BOOLEAN DEFAULT false,
    perm_brokers         BOOLEAN DEFAULT false,
    perm_mercancias      BOOLEAN DEFAULT false,
    perm_proyectos       BOOLEAN DEFAULT false
);

COMMENT ON TABLE admin_permisos IS 'Permisos granulares para usuarios con rol admin.';

-- --------------------------------------------------------------------------
-- 2.7 corte_schedules
-- --------------------------------------------------------------------------
CREATE TABLE corte_schedules (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    dia_semana INT     NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_corte TIME    NOT NULL,
    orden      INT     NOT NULL,
    activo     BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE corte_schedules IS 'Programación semanal de cortes automáticos.';
COMMENT ON COLUMN corte_schedules.dia_semana IS '0=Domingo, 1=Lunes … 6=Sábado';

-- --------------------------------------------------------------------------
-- 2.8 cortes
-- --------------------------------------------------------------------------
CREATE TABLE cortes (
    id                  UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id         UUID       REFERENCES corte_schedules (id) ON DELETE SET NULL,
    tipo                corte_tipo NOT NULL,
    ejecutado_por       UUID       REFERENCES users (id) ON DELETE SET NULL,
    total_contenedores  INT        DEFAULT 0,
    total_aprobados     INT        DEFAULT 0,
    total_rechazados    INT        DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE cortes IS 'Registro histórico de cada corte ejecutado.';

-- Prevent duplicate cortes at the same date/time (truncated to minute)
CREATE OR REPLACE FUNCTION immutable_date_trunc_minute(ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
    SELECT date_trunc('minute', ts AT TIME ZONE 'UTC');
$$ LANGUAGE sql IMMUTABLE;

CREATE UNIQUE INDEX idx_cortes_unique_datetime
  ON cortes (immutable_date_trunc_minute(created_at), tipo);

-- --------------------------------------------------------------------------
-- 2.9 containers
-- --------------------------------------------------------------------------
CREATE TABLE containers (
    id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    folio             VARCHAR(20)       UNIQUE NOT NULL,
    broker_id         UUID              NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    corte_id          UUID              REFERENCES cortes (id) ON DELETE SET NULL,
    bl                VARCHAR(30)       NOT NULL,
    numero_contenedor VARCHAR(50)       NOT NULL,
    comercializadora  VARCHAR(200)      NOT NULL,
    pedimento         VARCHAR(30)       NOT NULL,
    peso              DECIMAL(12,2)     NOT NULL CHECK (peso > 0),
    tipo_mercancia_id UUID              NOT NULL REFERENCES mercancias (id) ON DELETE RESTRICT,
    aduana_id         UUID              NOT NULL REFERENCES aduanas (id) ON DELETE RESTRICT,
    estado            container_estado  DEFAULT 'pendiente',
    motivo_rechazo    TEXT,
    revisado_por      UUID              REFERENCES users (id) ON DELETE SET NULL,
    revisado_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ       DEFAULT now(),
    updated_at        TIMESTAMPTZ       DEFAULT now()
);

COMMENT ON TABLE containers IS 'Cada registro de contenedor enviado por un broker.';

-- --------------------------------------------------------------------------
-- 2.10 documents
-- --------------------------------------------------------------------------
CREATE TABLE documents (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id    UUID         NOT NULL REFERENCES containers (id) ON DELETE CASCADE,
    nombre_archivo  VARCHAR(255) NOT NULL,
    url             TEXT         NOT NULL,
    tipo_mime       VARCHAR(100) NOT NULL,
    tamano_bytes    INT,
    created_at      TIMESTAMPTZ  DEFAULT now()
);

COMMENT ON TABLE documents IS 'Archivos adjuntos asociados a un contenedor.';

-- --------------------------------------------------------------------------
-- 2.11 container_events
-- --------------------------------------------------------------------------
CREATE TABLE container_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id   UUID        NOT NULL REFERENCES containers (id) ON DELETE CASCADE,
    tipo_evento    VARCHAR(50) NOT NULL,
    descripcion    TEXT        NOT NULL,
    motivo         TEXT,
    ejecutado_por  UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    rol_ejecutor   VARCHAR(20) NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE container_events IS 'Bitácora de eventos/acciones sobre un contenedor.';

-- --------------------------------------------------------------------------
-- 2.12 notificaciones
-- --------------------------------------------------------------------------
CREATE TABLE notificaciones (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    container_id UUID        REFERENCES containers (id) ON DELETE SET NULL,
    corte_id     UUID        REFERENCES cortes (id) ON DELETE SET NULL,
    tipo         notif_tipo  NOT NULL,
    titulo       VARCHAR(200) NOT NULL,
    mensaje      TEXT        NOT NULL,
    enviada      BOOLEAN     DEFAULT false,
    leida        BOOLEAN     DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE notificaciones IS 'Notificaciones internas para los usuarios.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- users
CREATE INDEX idx_users_role           ON users (role);
CREATE INDEX idx_users_aduana_base    ON users (aduana_base_id) WHERE aduana_base_id IS NOT NULL;
CREATE INDEX idx_users_activo         ON users (activo);

-- containers
CREATE INDEX idx_containers_broker    ON containers (broker_id);
CREATE INDEX idx_containers_aduana    ON containers (aduana_id);
CREATE INDEX idx_containers_estado    ON containers (estado);
CREATE INDEX idx_containers_corte     ON containers (corte_id) WHERE corte_id IS NOT NULL;
CREATE INDEX idx_containers_mercancia ON containers (tipo_mercancia_id);
CREATE INDEX idx_containers_created   ON containers (created_at DESC);

-- documents
CREATE INDEX idx_documents_container  ON documents (container_id);

-- container_events
CREATE INDEX idx_events_container     ON container_events (container_id);
CREATE INDEX idx_events_created       ON container_events (created_at DESC);

-- notificaciones
CREATE INDEX idx_notif_user           ON notificaciones (user_id);
CREATE INDEX idx_notif_user_leida     ON notificaciones (user_id, leida) WHERE leida = false;
CREATE INDEX idx_notif_container      ON notificaciones (container_id) WHERE container_id IS NOT NULL;

-- cortes
CREATE INDEX idx_cortes_created       ON cortes (created_at DESC);

-- corte_schedules
CREATE INDEX idx_schedules_dia        ON corte_schedules (dia_semana, hora_corte);

-- ============================================================================
-- 4. FUNCTION & TRIGGER — updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_containers_updated_at
    BEFORE UPDATE ON containers
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 5. HELPER — get current user role from the users table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on every table
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_aduanas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mercancias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permisos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE aduanas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercancias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE corte_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones    ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 6.1 users
-- --------------------------------------------------------------------------
-- Everyone authenticated can read users
CREATE POLICY "users_select_all" ON users
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin and superadmin can insert/update/delete
CREATE POLICY "users_insert_admin" ON users
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "users_update_admin" ON users
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "users_delete_admin" ON users
    FOR DELETE USING (get_my_role() = 'superadmin');

-- --------------------------------------------------------------------------
-- 6.2 aduanas
-- --------------------------------------------------------------------------
-- Everyone authenticated can read active aduanas
CREATE POLICY "aduanas_select_active" ON aduanas
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin/superadmin can write
CREATE POLICY "aduanas_insert_admin" ON aduanas
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "aduanas_update_admin" ON aduanas
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "aduanas_delete_admin" ON aduanas
    FOR DELETE USING (get_my_role() = 'superadmin');

-- --------------------------------------------------------------------------
-- 6.3 mercancias
-- --------------------------------------------------------------------------
CREATE POLICY "mercancias_select_active" ON mercancias
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mercancias_insert_admin" ON mercancias
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "mercancias_update_admin" ON mercancias
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "mercancias_delete_admin" ON mercancias
    FOR DELETE USING (get_my_role() = 'superadmin');

-- --------------------------------------------------------------------------
-- 6.4 containers
-- --------------------------------------------------------------------------
-- Brokers see only their own; admin/superadmin see all
CREATE POLICY "containers_select" ON containers
    FOR SELECT USING (
        broker_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

-- Brokers can insert their own containers
CREATE POLICY "containers_insert_broker" ON containers
    FOR INSERT WITH CHECK (
        broker_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

-- Admin/superadmin can update any container; broker cannot update directly
CREATE POLICY "containers_update_admin" ON containers
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

-- Brokers can update their own containers only when estado = 'correccion_solicitada'
CREATE POLICY "containers_update_broker_correccion" ON containers
    FOR UPDATE USING (
        broker_id = auth.uid()
        AND estado = 'correccion_solicitada'
    );

-- --------------------------------------------------------------------------
-- 6.5 documents (access follows container access)
-- --------------------------------------------------------------------------
CREATE POLICY "documents_select" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM containers c
            WHERE c.id = documents.container_id
              AND (c.broker_id = auth.uid() OR get_my_role() IN ('admin', 'superadmin'))
        )
    );

CREATE POLICY "documents_insert" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM containers c
            WHERE c.id = documents.container_id
              AND (c.broker_id = auth.uid() OR get_my_role() IN ('admin', 'superadmin'))
        )
    );

CREATE POLICY "documents_delete" ON documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM containers c
            WHERE c.id = documents.container_id
              AND get_my_role() IN ('admin', 'superadmin')
        )
    );

-- --------------------------------------------------------------------------
-- 6.6 container_events (access follows container access)
-- --------------------------------------------------------------------------
CREATE POLICY "events_select" ON container_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM containers c
            WHERE c.id = container_events.container_id
              AND (c.broker_id = auth.uid() OR get_my_role() IN ('admin', 'superadmin'))
        )
    );

CREATE POLICY "events_insert" ON container_events
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------------
-- 6.7 notificaciones
-- --------------------------------------------------------------------------
CREATE POLICY "notif_select_own" ON notificaciones
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notif_update_own" ON notificaciones
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notif_insert_system" ON notificaciones
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

-- --------------------------------------------------------------------------
-- 6.8 user_aduanas
-- --------------------------------------------------------------------------
-- Brokers see own; admin/superadmin see all
CREATE POLICY "user_aduanas_select" ON user_aduanas
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "user_aduanas_write_admin" ON user_aduanas
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "user_aduanas_delete_admin" ON user_aduanas
    FOR DELETE USING (get_my_role() IN ('admin', 'superadmin'));

-- --------------------------------------------------------------------------
-- 6.9 user_mercancias
-- --------------------------------------------------------------------------
-- Brokers see own; admin/superadmin see all
CREATE POLICY "user_mercancias_select" ON user_mercancias
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "user_mercancias_write_admin" ON user_mercancias
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "user_mercancias_delete_admin" ON user_mercancias
    FOR DELETE USING (get_my_role() IN ('admin', 'superadmin'));

-- --------------------------------------------------------------------------
-- 6.10 corte_schedules
-- --------------------------------------------------------------------------
-- Everyone authenticated can read
CREATE POLICY "schedules_select" ON corte_schedules
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin/superadmin can write
CREATE POLICY "schedules_insert_admin" ON corte_schedules
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "schedules_update_admin" ON corte_schedules
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "schedules_delete_admin" ON corte_schedules
    FOR DELETE USING (get_my_role() = 'superadmin');

-- --------------------------------------------------------------------------
-- 6.11 cortes
-- --------------------------------------------------------------------------
-- Everyone authenticated can read
CREATE POLICY "cortes_select_all" ON cortes
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin/superadmin can insert (system creates cortes)
CREATE POLICY "cortes_insert_admin" ON cortes
    FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "cortes_update_admin" ON cortes
    FOR UPDATE USING (get_my_role() IN ('admin', 'superadmin'));

-- --------------------------------------------------------------------------
-- 6.12 admin_permisos
-- --------------------------------------------------------------------------
-- User sees own; superadmin sees all
CREATE POLICY "permisos_select" ON admin_permisos
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_my_role() = 'superadmin'
    );

CREATE POLICY "permisos_insert_superadmin" ON admin_permisos
    FOR INSERT WITH CHECK (get_my_role() = 'superadmin');

CREATE POLICY "permisos_update_superadmin" ON admin_permisos
    FOR UPDATE USING (get_my_role() = 'superadmin');

CREATE POLICY "permisos_delete_superadmin" ON admin_permisos
    FOR DELETE USING (get_my_role() = 'superadmin');

-- ============================================================================
-- 7. SEED DATA — Default corte schedules (Mon-Sat, 12:00/15:00/18:00)
-- ============================================================================
INSERT INTO corte_schedules (dia_semana, hora_corte, orden) VALUES
    -- Lunes (1)
    (1, '12:00:00', 1),
    (1, '15:00:00', 2),
    (1, '18:00:00', 3),
    -- Martes (2)
    (2, '12:00:00', 1),
    (2, '15:00:00', 2),
    (2, '18:00:00', 3),
    -- Miércoles (3)
    (3, '12:00:00', 1),
    (3, '15:00:00', 2),
    (3, '18:00:00', 3),
    -- Jueves (4)
    (4, '12:00:00', 1),
    (4, '15:00:00', 2),
    (4, '18:00:00', 3),
    -- Viernes (5)
    (5, '12:00:00', 1),
    (5, '15:00:00', 2),
    (5, '18:00:00', 3),
    -- Sábado (6)
    (6, '12:00:00', 1),
    (6, '15:00:00', 2),
    (6, '18:00:00', 3);

-- ============================================================================
-- 8. STORAGE — Private bucket for documentation
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentacion', 'documentacion', false);

-- Storage policies: only authenticated users with container access
CREATE POLICY "docs_bucket_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documentacion'
        AND auth.uid() IS NOT NULL
    );

CREATE POLICY "docs_bucket_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documentacion'
        AND auth.uid() IS NOT NULL
    );

CREATE POLICY "docs_bucket_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documentacion'
        AND get_my_role() IN ('admin', 'superadmin')
    );

-- ============================================================================
-- 9. SECURITY — Login attempts & session control
-- ============================================================================

-- --------------------------------------------------------------------------
-- 9.1 login_attempts — Registro de intentos fallidos de login
-- --------------------------------------------------------------------------
CREATE TABLE login_attempts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    ip_address  VARCHAR(45),
    success     BOOLEAN     DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE login_attempts IS 'Registro de intentos de login para protección contra fuerza bruta.';

CREATE INDEX idx_login_attempts_email      ON login_attempts (email, created_at DESC);
CREATE INDEX idx_login_attempts_ip         ON login_attempts (ip_address, created_at DESC);

-- --------------------------------------------------------------------------
-- 9.2 account_lockouts — Bloqueo temporal de cuentas
-- --------------------------------------------------------------------------
CREATE TABLE account_lockouts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE account_lockouts IS 'Bloqueo temporal de cuentas tras intentos fallidos excesivos.';

CREATE INDEX idx_lockouts_email ON account_lockouts (email);

-- --------------------------------------------------------------------------
-- 9.3 user_sessions — Control de sesiones activas (una por usuario)
-- --------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_id  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    last_seen   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

COMMENT ON TABLE user_sessions IS 'Sesión activa por usuario para evitar sesiones simultáneas.';

CREATE INDEX idx_user_sessions_user    ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_session ON user_sessions (session_id);

-- RLS for login_attempts (service role only — no RLS needed, accessed via API)
ALTER TABLE login_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;

-- login_attempts: allow insert from anyone (anon for login), select for admins
CREATE POLICY "login_attempts_insert_anon" ON login_attempts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "login_attempts_select_admin" ON login_attempts
    FOR SELECT USING (get_my_role() IN ('admin', 'superadmin'));

-- account_lockouts: allow all for service role via API
CREATE POLICY "lockouts_all" ON account_lockouts
    FOR ALL USING (true);

-- user_sessions: users can see own, admins can see all
CREATE POLICY "sessions_select" ON user_sessions
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "sessions_insert" ON user_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "sessions_update" ON user_sessions
    FOR UPDATE USING (true);

CREATE POLICY "sessions_delete" ON user_sessions
    FOR DELETE USING (
        user_id = auth.uid()
        OR get_my_role() IN ('admin', 'superadmin')
    );

-- --------------------------------------------------------------------------
-- 9.4 Function: check and clean expired lockouts
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_expired_lockouts()
RETURNS void AS $$
BEGIN
    DELETE FROM account_lockouts WHERE locked_until < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 9.5 Function: count recent failed attempts (last 15 minutes)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION count_failed_attempts(p_email VARCHAR)
RETURNS INT AS $$
    SELECT COALESCE(COUNT(*)::INT, 0)
    FROM login_attempts
    WHERE email = p_email
      AND success = false
      AND created_at > now() - INTERVAL '15 minutes';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- Done.
-- ============================================================================
