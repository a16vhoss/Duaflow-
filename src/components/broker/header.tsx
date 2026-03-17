'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useCountdown } from '@/hooks/use-countdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Plus, User, LogOut, Clock, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

export function BrokerHeader() {
  const { user } = useUser();
  const { timeLeft } = useCountdown();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setServerTime(new Date().toLocaleTimeString('es-MX', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('enviada', true)
      .eq('leida', false)
      .then(({ count }) => setUnreadCount(count || 0));

    // Realtime subscription for notifications
    const channel = supabase
      .channel('broker-notifs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id=eq.${user.id}`,
        },
        () => setUnreadCount((prev) => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CF</span>
          </div>
          <span className="text-white font-semibold hidden sm:block">
            Portal CargoFlow
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          <span>{serverTime}</span>
          <span className="mx-1 text-slate-600">|</span>
          <Timer className="h-3 w-3 text-cyan-400" />
          <span className="text-cyan-400 font-mono">{timeLeft}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/registrar">
            <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Registrar</span>
            </Button>
          </Link>

          <Link href="/notificaciones" className="relative">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 text-slate-300 hover:text-white hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <User className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <div className="px-3 py-2 text-sm text-slate-400 border-b border-slate-700">
                {user?.nombre}
              </div>
              <DropdownMenuItem
                onClick={() => router.push('/perfil')}
                className="text-slate-200 focus:bg-slate-700"
              >
                <User className="h-4 w-4 mr-2" />
                Mi Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400 focus:bg-slate-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
