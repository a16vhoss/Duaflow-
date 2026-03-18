'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  enviada: boolean;
  container_id: string | null;
  created_at: string;
}

const NOTIF_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }
> = {
  aprobacion: {
    icon: <CheckCircle className="h-5 w-5" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  rechazo: {
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  correccion: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
  },
  corte_info: {
    icon: <Info className="h-5 w-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
};

const DEFAULT_CONFIG = {
  icon: <Bell className="h-5 w-5" />,
  color: 'text-slate-400',
  bgColor: 'bg-slate-500/10',
  borderColor: 'border-slate-500/20',
};

export default function NotificacionesPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel('broker-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;

    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .eq('enviada', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }

  async function markAsRead(notifId: string) {
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notifId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, leida: true } : n))
    );
  }

  async function markAllAsRead() {
    if (!user) return;
    setMarkingAll(true);

    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('user_id', user.id)
      .eq('leida', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
    setMarkingAll(false);
  }

  function handleNotifClick(notif: Notification) {
    if (!notif.leida) markAsRead(notif.id);
    if (notif.container_id) {
      router.push(`/contenedores/${notif.container_id}`);
    }
  }

  const unreadCount = notifications.filter((n) => !n.leida).length;

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">Notificaciones</h1>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="text-cyan-400 hover:text-cyan-300 text-xs"
          >
            {markingAll ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <CheckCheck className="h-3 w-3 mr-1" />
            )}
            Marcar todas como leidas
          </Button>
        )}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Bell className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const config = NOTIF_CONFIG[notif.tipo] || DEFAULT_CONFIG;
            return (
              <Card
                key={notif.id}
                className={`border cursor-pointer transition-colors ${
                  notif.leida
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : `bg-slate-800 ${config.borderColor}`
                }`}
                onClick={() => handleNotifClick(notif)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div
                      className={`flex-shrink-0 p-2 rounded-lg ${config.bgColor} ${config.color}`}
                    >
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm font-medium ${
                            notif.leida ? 'text-slate-400' : 'text-white'
                          }`}
                        >
                          {notif.titulo}
                        </p>
                        {!notif.leida && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          notif.leida ? 'text-slate-500' : 'text-slate-300'
                        }`}
                      >
                        {notif.mensaje}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2">
                        {format(
                          new Date(notif.created_at),
                          "dd MMM yyyy, HH:mm",
                          { locale: es }
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
