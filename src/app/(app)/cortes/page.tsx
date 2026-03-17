'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Scissors,
  Play,
  Plus,
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CorteSchedule, Corte } from '@/types/database';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export default function CortesPage() {
  const supabase = createClient();
  const { user } = useUser();

  const [schedules, setSchedules] = useState<CorteSchedule[]>([]);
  const [recentCortes, setRecentCortes] = useState<Corte[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingCorte, setExecutingCorte] = useState(false);

  // Add schedule form
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDia, setNewDia] = useState(1);
  const [newHora, setNewHora] = useState('08:00');
  const [addingSched, setAddingSched] = useState(false);

  // Confirm manual corte
  const [showManualDialog, setShowManualDialog] = useState(false);

  async function loadData() {
    setLoading(true);
    const [schedRes, cortesRes] = await Promise.all([
      supabase.from('corte_schedules').select('*').order('dia_semana').order('hora_corte'),
      supabase.from('cortes').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setSchedules(schedRes.data || []);
    setRecentCortes(cortesRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleManualCorte() {
    if (!user) return;
    setExecutingCorte(true);

    // Count containers by status in pendiente state
    const { data: pendientes } = await supabase
      .from('containers')
      .select('id, estado')
      .eq('estado', 'pendiente');

    const { data: aprobados } = await supabase
      .from('containers')
      .select('id')
      .eq('estado', 'aprobado')
      .is('corte_id', null);

    const { data: rechazados } = await supabase
      .from('containers')
      .select('id')
      .eq('estado', 'rechazado')
      .is('corte_id', null);

    const totalContenedores = (pendientes?.length || 0) + (aprobados?.length || 0) + (rechazados?.length || 0);

    // Create the corte
    const { data: corte } = await supabase
      .from('cortes')
      .insert({
        tipo: 'manual',
        ejecutado_por: user.id,
        total_contenedores: totalContenedores,
        total_aprobados: aprobados?.length || 0,
        total_rechazados: rechazados?.length || 0,
      })
      .select()
      .single();

    if (corte) {
      // Associate unassigned containers
      const allIds = [
        ...(aprobados?.map((c) => c.id) || []),
        ...(rechazados?.map((c) => c.id) || []),
      ];
      if (allIds.length > 0) {
        await supabase
          .from('containers')
          .update({ corte_id: corte.id })
          .in('id', allIds);
      }
    }

    setShowManualDialog(false);
    setExecutingCorte(false);
    loadData();
  }

  async function addSchedule() {
    setAddingSched(true);
    const maxOrden = schedules
      .filter((s) => s.dia_semana === newDia)
      .reduce((max, s) => Math.max(max, s.orden), 0);

    await supabase.from('corte_schedules').insert({
      dia_semana: newDia,
      hora_corte: newHora,
      orden: maxOrden + 1,
      activo: true,
    });

    setAddingSched(false);
    setShowAddDialog(false);
    loadData();
  }

  async function toggleSchedule(sched: CorteSchedule) {
    await supabase
      .from('corte_schedules')
      .update({ activo: !sched.activo })
      .eq('id', sched.id);
    loadData();
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Eliminar este horario de corte?')) return;
    await supabase.from('corte_schedules').delete().eq('id', id);
    loadData();
  }

  // Group schedules by day
  const schedulesByDay = DIAS_SEMANA.map((nombre, idx) => ({
    dia: idx,
    nombre,
    items: schedules.filter((s) => s.dia_semana === idx),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cortes</h1>
          <p className="text-slate-500 text-sm mt-1">Ejecuta cortes manuales y configura el calendario semanal.</p>
        </div>
      </div>

      {/* Manual execution */}
      <Card className="border-rose-200 bg-rose-50/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center">
              <Scissors className="h-7 w-7 text-rose-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Ejecucion Manual de Corte</h2>
              <p className="text-sm text-slate-500">
                Ejecuta un corte inmediatamente. Se procesaran todos los contenedores aprobados y rechazados sin corte asignado.
              </p>
            </div>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white px-6" onClick={() => setShowManualDialog(true)}>
              <Play className="h-4 w-4 mr-2" />
              Ejecutar Corte Ahora
            </Button>
            <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Ejecucion de Corte</DialogTitle>
                  <DialogDescription>
                    Se creara un nuevo corte manual. Los contenedores aprobados y rechazados pendientes de corte seran asignados.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-yellow-700">Esta accion no se puede deshacer.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleManualCorte}
                    disabled={executingCorte}
                    className="bg-rose-500 hover:bg-rose-600 text-white"
                  >
                    {executingCorte ? 'Ejecutando...' : 'Confirmar Corte'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Weekly schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Calendar className="h-5 w-5 text-rose-500" />
                Calendario Semanal de Cortes
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Horario
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Nuevo Horario de Corte</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Dia de la semana</Label>
                      <select
                        value={newDia}
                        onChange={(e) => setNewDia(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1"
                      >
                        {DIAS_SEMANA.map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={newHora}
                        onChange={(e) => setNewHora(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
                    <Button
                      onClick={addSchedule}
                      disabled={addingSched}
                      className="bg-rose-500 hover:bg-rose-600 text-white"
                    >
                      {addingSched ? 'Agregando...' : 'Agregar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {schedulesByDay.map(({ dia, nombre, items }) => (
                  <div key={dia} className="flex gap-4">
                    <div className="w-28 flex-shrink-0 pt-2">
                      <p className="text-sm font-semibold text-slate-700">{nombre}</p>
                    </div>
                    <div className="flex-1 flex flex-wrap gap-2 min-h-[2.5rem] items-center">
                      {items.length === 0 ? (
                        <span className="text-xs text-slate-300 italic">Sin cortes programados</span>
                      ) : (
                        items.map((s) => (
                          <div
                            key={s.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                              s.activo
                                ? 'bg-white border-rose-200 text-slate-700'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-mono">{s.hora_corte.substring(0, 5)}</span>
                            <button
                              onClick={() => toggleSchedule(s)}
                              className={`ml-1 ${s.activo ? 'text-green-500' : 'text-slate-300'} hover:opacity-70`}
                            >
                              {s.activo ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => deleteSchedule(s.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent cortes sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-slate-900">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCortes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Sin cortes recientes.</p>
              ) : (
                <div className="space-y-3">
                  {recentCortes.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={
                            c.tipo === 'manual'
                              ? 'bg-rose-50 text-rose-600 border-rose-200 text-xs'
                              : 'bg-blue-50 text-blue-600 border-blue-200 text-xs'
                          }
                        >
                          {c.tipo === 'manual' ? 'Manual' : 'Auto'}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {format(new Date(c.created_at), 'dd/MM HH:mm', { locale: es })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p>Total: {c.total_contenedores}</p>
                        <p className="text-green-600">Aprobados: {c.total_aprobados}</p>
                        <p className="text-red-600">Rechazados: {c.total_rechazados}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
