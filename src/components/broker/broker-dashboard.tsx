'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { useCountdown } from '@/hooks/use-countdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Clock,
  XCircle,
  AlertTriangle,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardStats {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

interface ContainerRow {
  id: string;
  folio: string;
  numero_contenedor: string;
  bl: string;
  status: string;
  created_at: string;
  comercializadora: string;
}

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  aprobado: 'bg-green-500/20 text-green-400 border-green-500/30',
  rechazado: 'bg-red-500/20 text-red-400 border-red-500/30',
  correccion_solicitada: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  correccion_solicitada: 'Corrección',
};

const CHART_COLORS = ['#EAB308', '#22C55E', '#EF4444'];

export default function BrokerDashboard() {
  const { user, loading: userLoading } = useUser();
  const { timeLeft } = useCountdown();
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
  });
  const [recentContainers, setRecentContainers] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setServerTime(new Date().toLocaleTimeString('es-MX', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function fetchDashboard() {
      // Fetch all containers for this broker
      const { data: containers } = await supabase
        .from('contenedores')
        .select('id, folio, numero_contenedor, bl, status, created_at, comercializadora')
        .eq('broker_id', user!.id)
        .order('created_at', { ascending: false });

      if (containers) {
        const total = containers.length;
        const pendientes = containers.filter((c) => c.status === 'pendiente').length;
        const aprobados = containers.filter((c) => c.status === 'aprobado').length;
        const rechazados = containers.filter((c) => c.status === 'rechazado').length;

        setStats({ total, pendientes, aprobados, rechazados });
        setRecentContainers(containers.slice(0, 10));
      }

      setLoading(false);
    }

    fetchDashboard();

    // Realtime subscription
    const channel = supabase
      .channel('broker-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contenedores',
          filter: `broker_id=eq.${user.id}`,
        },
        () => fetchDashboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const donutData = [
    { name: 'Pendientes', value: stats.pendientes },
    { name: 'Aprobados', value: stats.aprobados },
    { name: 'Rechazados', value: stats.rechazados },
  ];

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Bienvenido, {user?.nombre}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{serverTime}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-cyan-400">
            <Timer className="h-3 w-3" />
            <span className="font-mono font-semibold">{timeLeft}</span>
            <span className="text-slate-500 text-[10px]">próx. corte</span>
          </div>
        </div>
      </div>

      {/* Donut Chart */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Resumen de Operaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-6">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-slate-300">Pendientes: {stats.pendientes}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-300">Aprobados: {stats.aprobados}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-slate-300">Rechazados: {stats.rechazados}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Package className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Operaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pendientes}</p>
                <p className="text-xs text-slate-400">Pendientes Autorización</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.rechazados}</p>
                <p className="text-xs text-slate-400">Rechazados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Containers Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-300">
              Últimos Contenedores
            </CardTitle>
            <Link
              href="/contenedores"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">Folio</TableHead>
                  <TableHead className="text-slate-400 text-xs">Contenedor</TableHead>
                  <TableHead className="text-slate-400 text-xs hidden sm:table-cell">
                    BL
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentContainers.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No hay contenedores registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  recentContainers.map((container) => (
                    <TableRow
                      key={container.id}
                      className="border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                      onClick={() =>
                        (window.location.href = `/contenedores/${container.id}`)
                      }
                    >
                      <TableCell className="text-cyan-400 text-xs font-mono">
                        {container.folio}
                      </TableCell>
                      <TableCell className="text-slate-200 text-xs">
                        {container.numero_contenedor}
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs hidden sm:table-cell">
                        {container.bl}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[container.status] || ''}`}
                        >
                          {STATUS_LABELS[container.status] || container.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
