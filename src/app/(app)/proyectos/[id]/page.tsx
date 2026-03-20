'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Package,
  MapPin,
  ExternalLink,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ContainerEstado,
  ContainerWithRelations,
  Document as DocType,
  ContainerEvent,
} from '@/types/database';

const estadoBadge: Record<ContainerEstado, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  aprobado: { label: 'Aprobado', className: 'bg-green-100 text-green-800 border-green-200' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-800 border-red-200' },
  correccion_solicitada: { label: 'Correccion Solicitada', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

const eventIcon: Record<string, React.ReactNode> = {
  CREATED: <Package className="h-4 w-4 text-blue-500" />,
  APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  CORRECTION_REQUESTED: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  CORRECTION_SUBMITTED: <FileText className="h-4 w-4 text-blue-500" />,
};

export default function ProyectoDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const containerId = params.id as string;
  const { user } = useUser();

  const [container, setContainer] = useState<ContainerWithRelations | null>(null);
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [events, setEvents] = useState<ContainerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [showCorreccionDialog, setShowCorreccionDialog] = useState(false);
  const [showRechazoDialog, setShowRechazoDialog] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Generates a signed URL for private-bucket documents and opens it
  async function openDocument(doc: DocType) {
    // If the url is already an absolute URL (legacy data), try it directly
    if (doc.url.startsWith('http')) {
      window.open(doc.url, '_blank');
      return;
    }
    // Generate a signed URL valid for 5 minutes
    const { data, error } = await supabase.storage
      .from('documentacion')
      .createSignedUrl(doc.url, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      console.error('Error generating signed URL:', error);
      alert('No se pudo abrir el documento. Intenta de nuevo.');
    }
  }

  async function downloadDocument(doc: DocType) {
    if (doc.url.startsWith('http')) {
      window.open(doc.url, '_blank');
      return;
    }
    const { data, error } = await supabase.storage
      .from('documentacion')
      .createSignedUrl(doc.url, 300, { download: true });
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      console.error('Error generating signed URL:', error);
      alert('No se pudo descargar el documento. Intenta de nuevo.');
    }
  }

  async function loadData() {
    setLoading(true);
    const [containerRes, docsRes, eventsRes] = await Promise.all([
      supabase
        .from('containers')
        .select('*, broker:users!broker_id(*), aduana:aduanas!aduana_id(*), mercancia:mercancias!tipo_mercancia_id(*)')
        .eq('id', containerId)
        .single(),
      supabase
        .from('documents')
        .select('*')
        .eq('container_id', containerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('container_events')
        .select('*')
        .eq('container_id', containerId)
        .order('created_at', { ascending: false }),
    ]);

    if (containerRes.data) setContainer(containerRes.data as unknown as ContainerWithRelations);
    if (docsRes.data) setDocuments(docsRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [containerId]);

  async function handleAprobar() {
    if (!user) return;
    setActionLoading(true);

    await supabase
      .from('containers')
      .update({
        estado: 'aprobado',
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    await supabase.from('container_events').insert({
      container_id: containerId,
      tipo_evento: 'APPROVED',
      descripcion: 'Contenedor aprobado y finalizado por administrador.',
      ejecutado_por: user.id,
      rol_ejecutor: user.role,
    });

    // Notify broker
    if (container?.broker_id) {
      await supabase.from('notificaciones').insert({
        user_id: container.broker_id,
        container_id: containerId,
        tipo: 'aprobacion',
        titulo: 'Contenedor Aprobado',
        mensaje: `El contenedor ${container.folio} ha sido aprobado y finalizado.`,
        enviada: false,
        leida: false,
      });
    }

    setActionLoading(false);
    loadData();
  }

  async function handleCorreccion() {
    if (!user || !motivo.trim()) return;
    setActionLoading(true);

    await supabase
      .from('containers')
      .update({
        estado: 'correccion_solicitada',
        motivo_rechazo: motivo,
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    await supabase.from('container_events').insert({
      container_id: containerId,
      tipo_evento: 'CORRECTION_REQUESTED',
      descripcion: 'Se solicitaron correcciones al broker.',
      motivo,
      ejecutado_por: user.id,
      rol_ejecutor: user.role,
    });

    if (container?.broker_id) {
      await supabase.from('notificaciones').insert({
        user_id: container.broker_id,
        container_id: containerId,
        tipo: 'correccion',
        titulo: 'Correcciones Solicitadas',
        mensaje: `Se han solicitado correcciones para el contenedor ${container.folio}: ${motivo}`,
        enviada: false,
        leida: false,
      });
    }

    setMotivo('');
    setShowCorreccionDialog(false);
    setActionLoading(false);
    loadData();
  }

  async function handleRechazar() {
    if (!user || !motivo.trim()) return;
    setActionLoading(true);

    await supabase
      .from('containers')
      .update({
        estado: 'rechazado',
        motivo_rechazo: motivo,
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    await supabase.from('container_events').insert({
      container_id: containerId,
      tipo_evento: 'REJECTED',
      descripcion: 'Contenedor rechazado por administrador.',
      motivo,
      ejecutado_por: user.id,
      rol_ejecutor: user.role,
    });

    if (container?.broker_id) {
      await supabase.from('notificaciones').insert({
        user_id: container.broker_id,
        container_id: containerId,
        tipo: 'rechazo',
        titulo: 'Contenedor Rechazado',
        mensaje: `El contenedor ${container.folio} ha sido rechazado. Motivo: ${motivo}`,
        enviada: false,
        leida: false,
      });
    }

    setMotivo('');
    setShowRechazoDialog(false);
    setActionLoading(false);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Contenedor no encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/proyectos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  // Only allow review actions (approve/reject/request correction) when estado is 'pendiente'.
  // When 'correccion_solicitada', the broker is working on fixes — admin must wait.
  const canReview = container.estado === 'pendiente';
  const isWaitingCorrection = container.estado === 'correccion_solicitada';

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/proyectos')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{container.folio}</h1>
          <p className="text-slate-500 text-sm">Detalle del contenedor</p>
        </div>
        <Badge className={estadoBadge[container.estado].className} variant="outline">
          {estadoBadge[container.estado].label}
        </Badge>
      </div>

      {/* Container details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Datos del Contenedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Folio</label>
                  <p className="text-sm font-semibold text-slate-900">{container.folio}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">No. Contenedor</label>
                  <p className="text-sm font-semibold text-slate-900">{container.numero_contenedor}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">BL</label>
                  <p className="text-sm font-semibold text-slate-900">{container.bl}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Pedimento</label>
                  <p className="text-sm font-semibold text-slate-900">{container.pedimento}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Comercializadora</label>
                  <p className="text-sm font-semibold text-slate-900">{container.comercializadora}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Peso (kg)</label>
                  <p className="text-sm font-semibold text-slate-900">{container.peso.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Aduana
                  </label>
                  <p className="text-sm font-semibold text-slate-900">
                    {container.aduana?.nombre} ({container.aduana?.clave})
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Package className="h-3 w-3" /> Mercancia
                  </label>
                  <p className="text-sm font-semibold text-slate-900">{container.mercancia?.nombre}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <User className="h-3 w-3" /> Broker
                  </label>
                  <p className="text-sm font-semibold text-slate-900">
                    {container.broker?.nombre} ({container.broker?.email})
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Creado
                  </label>
                  <p className="text-sm font-semibold text-slate-900">
                    {format(new Date(container.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>

              {container.motivo_rechazo && (
                <>
                  <Separator className="my-4" />
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-600 mb-1">Motivo de rechazo/correccion:</p>
                    <p className="text-sm text-red-800">{container.motivo_rechazo}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-rose-500" />
                Documentos ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No hay documentos adjuntos.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
                        <p className="text-xs text-slate-400">
                          {doc.tipo_mime} {doc.tamano_bytes ? `- ${(doc.tamano_bytes / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => openDocument(doc)}
                        className="text-rose-500 hover:text-rose-600"
                        title="Ver documento"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="text-slate-400 hover:text-slate-600"
                        title="Descargar documento"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: actions + events */}
        <div className="space-y-6">
          {/* Actions */}
          {canReview && (
            <Card className="border-rose-200">
              <CardHeader>
                <CardTitle className="text-slate-900">Acciones de Revision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleAprobar}
                  disabled={actionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar y Finalizar
                </Button>

                <Button
                  variant="outline"
                  className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                  onClick={() => setShowCorreccionDialog(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Solicitar Correcciones
                </Button>
                <Dialog open={showCorreccionDialog} onOpenChange={setShowCorreccionDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Solicitar Correcciones</DialogTitle>
                      <DialogDescription>
                        Indica al broker que correcciones necesita realizar.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Describe las correcciones necesarias..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={4}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCorreccionDialog(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCorreccion}
                        disabled={!motivo.trim() || actionLoading}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        Enviar Solicitud
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowRechazoDialog(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Dialog open={showRechazoDialog} onOpenChange={setShowRechazoDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rechazar Contenedor</DialogTitle>
                      <DialogDescription>
                        Esta accion rechazara permanentemente este contenedor. Indica el motivo.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Motivo del rechazo..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={4}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowRechazoDialog(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleRechazar}
                        disabled={!motivo.trim() || actionLoading}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        Confirmar Rechazo
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Correction in progress banner */}
          {isWaitingCorrection && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">Correccion en progreso</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Se solicitaron correcciones al broker. Las acciones de revision estan deshabilitadas hasta que el broker reenvie la informacion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-rose-500" />
                Historial de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Sin eventos registrados.</p>
              ) : (
                <div className="space-y-4">
                  {events.map((evt) => (
                    <div key={evt.id} className="flex gap-3">
                      <div className="mt-0.5">
                        {eventIcon[evt.tipo_evento] || <Clock className="h-4 w-4 text-slate-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{evt.descripcion}</p>
                        {evt.motivo && (
                          <p className="text-xs text-slate-500 mt-0.5 italic">&quot;{evt.motivo}&quot;</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {format(new Date(evt.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          {' - '}{evt.rol_ejecutor}
                        </p>
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
