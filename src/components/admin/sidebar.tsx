'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useCountdown } from '@/hooks/use-countdown';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  MapPin,
  Package,
  Scissors,
  ShieldCheck,
  BarChart3,
  User,
  LogOut,
  Clock,
  Timer,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: null },
  { href: '/proyectos', label: 'Proyectos (Revisión)', icon: FolderOpen, perm: 'perm_proyectos' },
  { href: '/brokers', label: 'Alta de Nuevos Brokers', icon: Users, perm: 'perm_brokers' },
  { href: '/cortes', label: 'Gestionar Cortes', icon: Scissors, perm: 'perm_aduanas' },
  { href: '/aduanas', label: 'Configurar Aduanas', icon: MapPin, perm: 'perm_aduanas' },
  { href: '/mercancias', label: 'Catálogo de Mercancías', icon: Package, perm: 'perm_mercancias' },
  { href: '/administradores', label: 'Administradores', icon: ShieldCheck, perm: 'perm_administradores' },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, perm: null },
  { href: '/perfil', label: 'Mi Perfil', icon: User, perm: null },
];

function ServerTime() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-MX', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return <span>{time}</span>;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { timeLeft } = useCountdown();

  const isSuperadmin = user?.role === 'superadmin';
  const permisos = user?.admin_permisos;

  function canAccess(perm: string | null): boolean {
    if (!perm) return true;
    if (isSuperadmin) return true;
    if (!permisos) return false;
    return (permisos as unknown as Record<string, boolean>)[perm] ?? false;
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">AR</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">Control AduaRed</h1>
            <p className="text-[10px] text-slate-500 leading-tight">Gestión Centralizada y Análisis de Operaciones</p>
          </div>
        </Link>
        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <ServerTime />
          </div>
          <div className="flex items-center gap-1 text-rose-500">
            <Timer className="h-3 w-3" />
            <span className="font-mono">{timeLeft}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          if (!canAccess(item.perm)) return null;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-rose-50 text-rose-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon className={cn('h-4 w-4', isActive ? 'text-rose-500' : 'text-slate-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.nombre}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
