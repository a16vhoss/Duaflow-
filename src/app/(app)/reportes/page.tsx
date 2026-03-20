'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  FolderOpen,
  Download,
  FileText,
  Calendar,
  Loader2,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Aduana } from '@/types/database';

type Periodo = 'mes' | 'trimestre' | 'anio';

const PIE_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function ReportesPage() {
  const supabase = createClient();
  const { loading: userLoading } = useUser();

  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [aduanaFilter, setAduanaFilter] = useState<string>('all');
  const [aduanas, setAduanas] = useState<Aduana[]>([]);

  // KPIs
  const [totalOps, setTotalOps] = useState(0);
  const [totalAprobados, setTotalAprobados] = useState(0);
  const [totalRechazados, setTotalRechazados] = useState(0);
  const [totalPendientes, setTotalPendientes] = useState(0);

  // Charts
  const [activityByDay, setActivityByDay] = useState<{ day: string; count: number }[]>([]);
  const [byBroker, setByBroker] = useState<{ name: string; count: number }[]>([]);
  const [byMercancia, setByMercancia] = useState<{ name: string; value: number }[]>([]);
  const [byWeek, setByWeek] = useState<{ week: string; aprobados: number; rechazados: number; pendientes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadAduanas() {
      const { data } = await supabase.from('aduanas').select('*').eq('activa', true).order('nombre');
      setAduanas(data || []);
    }
    loadAduanas();
  }, []);

  useEffect(() => {
    async function loadReportData() {
      setLoading(true);
      const now = new Date();
      let from: Date;
      let to: Date;

      switch (periodo) {
        case 'mes':
          from = startOfMonth(now);
          to = endOfMonth(now);
          break;
        case 'trimestre':
          from = startOfMonth(subMonths(now, 2));
          to = endOfMonth(now);
          break;
        case 'anio':
          from = startOfYear(now);
          to = endOfYear(now);
          break;
      }

      let query = supabase
        .from('containers')
        .select('id, estado, created_at, broker_id, tipo_mercancia_id, aduana_id, broker:users!broker_id(nombre), mercancia:mercancias!tipo_mercancia_id(nombre)');

      query = query.gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
      if (aduanaFilter !== 'all') query = query.eq('aduana_id', aduanaFilter);

      const { data: containers } = await query;

      if (!containers) {
        setLoading(false);
        return;
      }

      // KPIs
      setTotalOps(containers.length);
      setTotalAprobados(containers.filter((c) => c.estado === 'aprobado').length);
      setTotalRechazados(containers.filter((c) => c.estado === 'rechazado').length);
      setTotalPendientes(containers.filter((c) => c.estado === 'pendiente').length);

      // Activity by day
      const days = eachDayOfInterval({ start: from, end: to });
      const dayMap: Record<string, number> = {};
      days.forEach((d) => (dayMap[format(d, 'yyyy-MM-dd')] = 0));
      containers.forEach((c) => {
        const key = format(new Date(c.created_at), 'yyyy-MM-dd');
        if (dayMap[key] !== undefined) dayMap[key]++;
      });
      setActivityByDay(
        Object.entries(dayMap).map(([day, count]) => ({
          day: format(new Date(day), 'dd MMM', { locale: es }),
          count,
        }))
      );

      // By broker
      const brokerMap: Record<string, number> = {};
      containers.forEach((c) => {
        const name = (c.broker as unknown as { nombre: string })?.nombre || 'Desconocido';
        brokerMap[name] = (brokerMap[name] || 0) + 1;
      });
      setByBroker(
        Object.entries(brokerMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );

      // By mercancia (pie)
      const mercMap: Record<string, number> = {};
      containers.forEach((c) => {
        const name = (c.mercancia as unknown as { nombre: string })?.nombre || 'Sin tipo';
        mercMap[name] = (mercMap[name] || 0) + 1;
      });
      setByMercancia(Object.entries(mercMap).map(([name, value]) => ({ name, value })));

      // By week (line chart)
      const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
      const weekData = weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekContainers = containers.filter((c) => {
          const d = new Date(c.created_at);
          return d >= weekStart && d <= weekEnd;
        });
        return {
          week: format(weekStart, 'dd MMM', { locale: es }),
          aprobados: weekContainers.filter((c) => c.estado === 'aprobado').length,
          rechazados: weekContainers.filter((c) => c.estado === 'rechazado').length,
          pendientes: weekContainers.filter((c) => c.estado === 'pendiente').length,
        };
      });
      setByWeek(weekData);

      setLoading(false);
    }
    loadReportData();
  }, [periodo, aduanaFilter]);

  function exportCSV() {
    // Build a simple CSV from the activity data
    const headers = 'Dia,Operaciones\n';
    const rows = activityByDay.map((d) => `${d.day},${d.count}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-actividad-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    if (!reportRef.current) return;
    setGeneratingPDF(true);
    try {
      // Dynamic import of html2pdf.js to keep bundle size small
      const html2pdf = (await import('html2pdf.js')).default;
      const element = reportRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `reporte-${periodo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setGeneratingPDF(false);
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
          <p className="text-slate-500 text-sm mt-1">Analisis y metricas de operaciones.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportPDF} disabled={generatingPDF}>
            {generatingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            {generatingPDF ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Periodo</label>
              <div className="flex gap-1">
                {([['mes', 'Este Mes'], ['trimestre', 'Trimestre'], ['anio', 'Este Ano']] as [Periodo, string][]).map(
                  ([key, label]) => (
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
                  )
                )}
              </div>
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-slate-500 mb-1">Aduana</label>
              <Select value={aduanaFilter} onValueChange={(val) => setAduanaFilter(val || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas">
                    {(value: string | null) => {
                      if (!value || value === 'all') return 'Todas las aduanas';
                      const aduana = aduanas.find((a) => a.id === value);
                      return aduana ? `${aduana.nombre} (${aduana.clave})` : 'Todas las aduanas';
                    }}
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
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Operaciones</p>
                <p className="text-2xl font-bold text-slate-900">{totalOps}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Aprobados</p>
                <p className="text-2xl font-bold text-green-600">{totalAprobados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Rechazados</p>
                <p className="text-2xl font-bold text-red-600">{totalRechazados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
        </div>
      ) : (
        <>
          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity by day */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Actividad por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activityByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#f43f5e" radius={[3, 3, 0, 0]} name="Operaciones" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By broker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Proyectos por Broker</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byBroker} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Proyectos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Merchandise pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Mercancias por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={byMercancia}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine
                    >
                      {byMercancia.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By week line */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Proyectos por Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={byWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="aprobados" stroke="#10b981" strokeWidth={2} name="Aprobados" />
                    <Line type="monotone" dataKey="rechazados" stroke="#ef4444" strokeWidth={2} name="Rechazados" />
                    <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" strokeWidth={2} name="Pendientes" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
