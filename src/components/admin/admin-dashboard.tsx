'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FolderOpen,
  Users,
  AlertCircle,
  Plus,
  FileText,
  Scissors,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  format,
  eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Aduana, User as DbUser } from '@/types/database';

type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado';

function getDateRange(periodo: Periodo, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (periodo) {
    case 'hoy':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'semana':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'mes':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'trimestre':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'anio':
      return { from: startOfYear(now), to: endOfYear(now) };
    case 'personalizado':
      return { from: customStart || subDays(now, 30), to: customEnd || now };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Filters skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-md" />
                ))}
              </div>
            </div>
            <div className="w-48">
              <Skeleton className="h-3 w-12 mb-2" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="w-48">
              <Skeleton className="h-3 w-12 mb-2" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div>
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-9 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-[300px] pt-8">
            {[40, 65, 45, 80, 55, 70, 50, 60, 75, 45, 85, 55].map((h, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [aduanaFilter, setAduanaFilter] = useState<string>('all');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [aduanas, setAduanas] = useState<Aduana[]>([]);
  const [brokers, setBrokers] = useState<DbUser[]>([]);

  const [totalOps, setTotalOps] = useState(0);
  const [brokersActivos, setBrokersActivos] = useState(0);
  const [pendientesRevision, setPendientesRevision] = useState(0);
  const [chartData, setChartData] = useState<{ day: string; count: number }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  // Load dropdowns
  useEffect(() => {
    async function loadFilters() {
      const [aduanasRes, brokersRes] = await Promise.all([
        supabase.from('aduanas').select('*').eq('activa', true).order('nombre'),
        supabase.from('users').select('*').eq('role', 'broker').eq('activo', true).order('nombre'),
      ]);
      if (aduanasRes.data) setAduanas(aduanasRes.data);
      if (brokersRes.data) setBrokers(brokersRes.data);
    }
    loadFilters();
  }, []);

  // Load KPIs and chart
  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setChartReady(false);
      const range = getDateRange(
        periodo,
        customStart ? new Date(customStart) : undefined,
        customEnd ? new Date(customEnd) : undefined
      );

      let query = supabase
        .from('containers')
        .select('id, created_at, estado, broker_id, aduana_id');

      query = query.gte('created_at', range.from.toISOString()).lte('created_at', range.to.toISOString());

      if (aduanaFilter !== 'all') query = query.eq('aduana_id', aduanaFilter);
      if (brokerFilter !== 'all') query = query.eq('broker_id', brokerFilter);

      const { data: containers } = await query;

      if (containers) {
        setTotalOps(containers.length);
        const uniqueBrokers = new Set(containers.map((c) => c.broker_id));
        setBrokersActivos(uniqueBrokers.size);
        setPendientesRevision(containers.filter((c) => c.estado === 'pendiente').length);

        // Chart: count by day
        const days = eachDayOfInterval({ start: range.from, end: range.to });
        const countMap: Record<string, number> = {};
        days.forEach((d) => {
          countMap[format(d, 'yyyy-MM-dd')] = 0;
        });
        containers.forEach((c) => {
          const key = format(new Date(c.created_at), 'yyyy-MM-dd');
          if (countMap[key] !== undefined) countMap[key]++;
        });
        const chart = Object.entries(countMap).map(([day, count]) => ({
          day: format(new Date(day), 'dd MMM', { locale: es }),
          count,
        }));
        setChartData(chart);
      }
      setLoadingData(false);
      requestAnimationFrame(() => setChartReady(true));
    }
    loadData();
  }, [periodo, aduanaFilter, brokerFilter, customStart, customEnd]);

  // Build lookup maps for Select labels (Hallazgo 1.1.2)
  const aduanaLabels: Record<string, string> = { all: 'Todas las aduanas' };
  aduanas.forEach((a) => { aduanaLabels[a.id] = `${a.nombre} (${a.clave})`; });

  const brokerLabels: Record<string, string> = { all: 'Todos los brokers' };
  brokers.forEach((b) => { brokerLabels[b.id] = b.nombre; });

  if (userLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Bienvenido, {user?.nombre}. Resumen de operaciones.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Periodo</label>
              <div className="flex gap-1">
                {([
                  ['hoy', 'Hoy'],
                  ['semana', 'Esta Semana'],
                  ['mes', 'Este Mes'],
                  ['trimestre', 'Este Trimestre'],
                  ['anio', 'Este Ano'],
                  ['personalizado', 'Personalizado'],
                ] as [Periodo, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={periodo === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriodo(key)}
                    className={
                      periodo === key
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'text-slate-600'
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {periodo === 'personalizado' && (
              <div className="flex gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="w-48">
              <label className="block text-xs font-medium text-slate-500 mb-1">Aduana</label>
              <Select value={aduanaFilter} onValueChange={(val) => setAduanaFilter(val || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las aduanas">
                    {(value: string | null) => aduanaLabels[value || 'all'] || 'Todas las aduanas'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las aduanas</SelectItem>
                  {aduanas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre} ({a.clave})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-medium text-slate-500 mb-1">Broker</label>
              <Select value={brokerFilter} onValueChange={(val) => setBrokerFilter(val || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los brokers">
                    {(value: string | null) => brokerLabels[value || 'all'] || 'Todos los brokers'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los brokers</SelectItem>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingData ? (
          [1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div>
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card
              className="cursor-pointer transition-shadow hover:shadow-lg hover:border-rose-200"
              onClick={() => router.push('/proyectos')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Operaciones</p>
                    <p className="text-3xl font-bold text-slate-900">{totalOps}</p>
                  </div>
                </div>
                <p className="text-xs text-rose-400 mt-2 text-right">Ver detalle &rarr;</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-lg hover:border-blue-200"
              onClick={() => router.push('/brokers')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Brokers Activos</p>
                    <p className="text-3xl font-bold text-slate-900">{brokersActivos}</p>
                  </div>
                </div>
                <p className="text-xs text-blue-400 mt-2 text-right">Ver detalle &rarr;</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-lg hover:border-yellow-200"
              onClick={() => router.push('/proyectos?estado=pendiente')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pendientes de Revision</p>
                    <p className="text-3xl font-bold text-slate-900">{pendientesRevision}</p>
                  </div>
                </div>
                <p className="text-xs text-yellow-500 mt-2 text-right">Ver detalle &rarr;</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <TrendingUp className="h-5 w-5 text-rose-500" />
            Actividad por dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex items-end gap-2 h-[300px] pt-8">
              {[40, 65, 45, 80, 55, 70, 50, 60, 75, 45, 85, 55].map((h, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          ) : chartData.length > 0 && chartReady ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Operaciones" isAnimationActive={true} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Sin datos para el periodo seleccionado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900">Acciones rapidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/proyectos">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:border-rose-300 hover:bg-rose-50">
                <FileText className="h-5 w-5 text-rose-500" />
                <span className="text-sm text-slate-700">Revisar Proyectos</span>
              </Button>
            </Link>
            <Link href="/brokers">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:border-rose-300 hover:bg-rose-50">
                <Plus className="h-5 w-5 text-rose-500" />
                <span className="text-sm text-slate-700">Nuevo Broker</span>
              </Button>
            </Link>
            <Link href="/cortes">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:border-rose-300 hover:bg-rose-50">
                <Scissors className="h-5 w-5 text-rose-500" />
                <span className="text-sm text-slate-700">Gestionar Cortes</span>
              </Button>
            </Link>
            <Link href="/reportes">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:border-rose-300 hover:bg-rose-50">
                <CalendarDays className="h-5 w-5 text-rose-500" />
                <span className="text-sm text-slate-700">Ver Reportes</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
