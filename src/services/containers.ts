import { createClient } from '@/lib/supabase/client';
import type { Container, ContainerWithRelations, ContainerEstado } from '@/types/database';

const supabase = createClient();

export async function getContainers(filters?: {
  broker_id?: string;
  aduana_id?: string;
  estado?: ContainerEstado;
  corte_id?: string;
  search?: string;
}) {
  let query = supabase
    .from('containers')
    .select(`
      *,
      broker:users!broker_id(id, nombre, email),
      aduana:aduanas!aduana_id(id, nombre, clave),
      mercancia:mercancias!tipo_mercancia_id(id, nombre)
    `)
    .order('created_at', { ascending: false });

  if (filters?.broker_id) query = query.eq('broker_id', filters.broker_id);
  if (filters?.aduana_id) query = query.eq('aduana_id', filters.aduana_id);
  if (filters?.estado) query = query.eq('estado', filters.estado);
  if (filters?.corte_id) query = query.eq('corte_id', filters.corte_id);
  if (filters?.search) {
    query = query.or(`bl.ilike.%${filters.search}%,numero_contenedor.ilike.%${filters.search}%,folio.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ContainerWithRelations[];
}

export async function getContainerById(id: string) {
  const { data, error } = await supabase
    .from('containers')
    .select(`
      *,
      broker:users!broker_id(id, nombre, email),
      aduana:aduanas!aduana_id(id, nombre, clave),
      mercancia:mercancias!tipo_mercancia_id(id, nombre),
      documents(*),
      events:container_events(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ContainerWithRelations;
}

export async function createContainer(data: {
  bl: string;
  numero_contenedor: string;
  comercializadora: string;
  pedimento: string;
  peso: number;
  tipo_mercancia_id: string;
  aduana_id: string;
  broker_id: string;
}) {
  // Generate folio: YYYY + sequential
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('containers')
    .select('*', { count: 'exact', head: true });

  const folio = `${year}${String((count || 0) + 1).padStart(6, '0')}`;

  const { data: container, error } = await supabase
    .from('containers')
    .insert({ ...data, folio, estado: 'pendiente' })
    .select()
    .single();

  if (error) throw error;

  // Create CREATED event
  await supabase.from('container_events').insert({
    container_id: container.id,
    tipo_evento: 'CREATED',
    descripcion: `Contenedor registrado con Folio ${folio}`,
    ejecutado_por: data.broker_id,
    rol_ejecutor: 'BROKER',
  });

  return container as Container;
}

export async function updateContainerStatus(
  containerId: string,
  estado: ContainerEstado,
  adminId: string,
  adminNombre: string,
  motivo?: string
) {
  const updateData: Record<string, unknown> = {
    estado,
    revisado_por: adminId,
    revisado_at: new Date().toISOString(),
  };
  if (motivo) updateData.motivo_rechazo = motivo;

  const { error } = await supabase
    .from('containers')
    .update(updateData)
    .eq('id', containerId);

  if (error) throw error;

  // Create event
  const eventMap: Record<string, string> = {
    aprobado: 'APPROVED',
    rechazado: 'REJECTED',
    correccion_solicitada: 'CORRECTION_REQUESTED',
  };

  const descriptions: Record<string, string> = {
    aprobado: `Estado actualizado a APPROVED — Por: ${adminNombre} (ADMIN)`,
    rechazado: `Estado actualizado a REJECTED. Motivo: ${motivo} — Por: ${adminNombre} (ADMIN)`,
    correccion_solicitada: `Corrección solicitada. Motivo: ${motivo} — Por: ${adminNombre} (ADMIN)`,
  };

  await supabase.from('container_events').insert({
    container_id: containerId,
    tipo_evento: eventMap[estado],
    descripcion: descriptions[estado],
    motivo: motivo || null,
    ejecutado_por: adminId,
    rol_ejecutor: 'ADMIN',
  });
}

export async function submitCorrection(containerId: string, brokerId: string, brokerNombre: string) {
  const { error } = await supabase
    .from('containers')
    .update({ estado: 'pendiente' })
    .eq('id', containerId);

  if (error) throw error;

  await supabase.from('container_events').insert({
    container_id: containerId,
    tipo_evento: 'CORRECTION_SUBMITTED',
    descripcion: `Documentos actualizados — Por: ${brokerNombre} (BROKER)`,
    ejecutado_por: brokerId,
    rol_ejecutor: 'BROKER',
  });
}
