import { createClient } from '@/lib/supabase/client';
import type { Notificacion } from '@/types/database';

const supabase = createClient();

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('user_id', userId)
    .eq('enviada', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Notificacion[];
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enviada', true)
    .eq('leida', false);

  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notifId: string) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', notifId);

  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('user_id', userId)
    .eq('leida', false);

  if (error) throw error;
}
