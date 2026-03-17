// ============================================
// Enums
// ============================================
export type UserRole = 'superadmin' | 'admin' | 'broker';
export type ContainerEstado = 'pendiente' | 'aprobado' | 'rechazado' | 'correccion_solicitada';
export type CorteTipo = 'automatico' | 'manual';
export type NotifTipo = 'aprobacion' | 'rechazo' | 'correccion' | 'corte_info';
export type EventoTipo = 'CREATED' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED' | 'CORRECTION_SUBMITTED';

// ============================================
// Tables
// ============================================
export interface User {
  id: string;
  email: string;
  nombre: string;
  role: UserRole;
  aduana_base_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAduana {
  user_id: string;
  aduana_id: string;
}

export interface UserMercancia {
  user_id: string;
  mercancia_id: string;
}

export interface AdminPermisos {
  user_id: string;
  perm_aduanas: boolean;
  perm_administradores: boolean;
  perm_brokers: boolean;
  perm_mercancias: boolean;
  perm_proyectos: boolean;
}

export interface Aduana {
  id: string;
  nombre: string;
  clave: string;
  activa: boolean;
}

export interface Mercancia {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
}

export interface CorteSchedule {
  id: string;
  dia_semana: number; // 0=Dom...6=Sáb
  hora_corte: string; // TIME
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface Corte {
  id: string;
  schedule_id: string | null;
  tipo: CorteTipo;
  ejecutado_por: string | null;
  total_contenedores: number;
  total_aprobados: number;
  total_rechazados: number;
  created_at: string;
}

export interface Container {
  id: string;
  folio: string;
  broker_id: string;
  corte_id: string | null;
  bl: string;
  numero_contenedor: string;
  comercializadora: string;
  pedimento: string;
  peso: number;
  tipo_mercancia_id: string;
  aduana_id: string;
  estado: ContainerEstado;
  motivo_rechazo: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  container_id: string;
  nombre_archivo: string;
  url: string;
  tipo_mime: string;
  tamano_bytes: number | null;
  created_at: string;
}

export interface ContainerEvent {
  id: string;
  container_id: string;
  tipo_evento: EventoTipo;
  descripcion: string;
  motivo: string | null;
  ejecutado_por: string;
  rol_ejecutor: string;
  created_at: string;
}

export interface Notificacion {
  id: string;
  user_id: string;
  container_id: string | null;
  corte_id: string | null;
  tipo: NotifTipo;
  titulo: string;
  mensaje: string;
  enviada: boolean;
  leida: boolean;
  created_at: string;
}

// ============================================
// Extended types (with joins)
// ============================================
export interface ContainerWithRelations extends Container {
  broker?: User;
  aduana?: Aduana;
  mercancia?: Mercancia;
  documents?: Document[];
  events?: ContainerEvent[];
}

export interface UserWithPermisos extends User {
  admin_permisos?: AdminPermisos;
  aduanas?: Aduana[];
  mercancias?: Mercancia[];
}
