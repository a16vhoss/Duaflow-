'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  Package,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Edit3,
  Lock,
  Loader2,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  isFileAllowed,
  isFileSizeAllowed,
  MAX_FILE_SIZE_MB,
  ACCEPTED_INPUT_ATTR,
} from '@/lib/file-validation';

interface ContainerDetail {
  id: string;
  folio: string;
  numero_contenedor: string;
  bl: string;
  comercializadora: string;
  pedimento: string;
  peso: number;
  estado: string;
  created_at: string;
  updated_at: string;
  broker_id: string;
  motivo_rechazo: string | null;
  aduanas: { id: string; nombre: string; clave: string } | null;
  mercancias: { id: string; nombre: string } | null;
}

interface Document {
  id: string;
  nombre_archivo: string;
  url: string;
  tipo_mime: string;
  tamano_bytes: number;
  created_at: string;
}

interface Event {
  id: string;
  tipo_evento: string;
  descripcion: string;
  created_at: string;
  ejecutado_por: string;
  rol_ejecutor: string;
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
  correccion_solicitada: 'Corrección Solicitada',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  creacion: <Package className="h-4 w-4 text-cyan-400" />,
  aprobacion: <CheckCircle className="h-4 w-4 text-green-400" />,
  rechazo: <XCircle className="h-4 w-4 text-red-400" />,
  correccion: <Edit3 className="h-4 w-4 text-orange-400" />,
  correccion_enviada: <Save className="h-4 w-4 text-cyan-400" />,
  documento: <FileText className="h-4 w-4 text-blue-400" />,
};

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode for correction
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bl: '',
    numero_contenedor: '',
    comercializadora: '',
    pedimento: '',
    peso: '',
  });
  const [saving, setSaving] = useState(false);

  // File management for corrections
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deletedDocIds, setDeletedDocIds] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();

    const channel = supabase
      .channel(`container-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'containers', filter: `id=eq.${id}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'container_events', filter: `container_id=eq.${id}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id]);

  async function fetchAll() {
    const [containerRes, docsRes, eventsRes] = await Promise.all([
      supabase
        .from('containers')
        .select(
          `*, aduanas(id, nombre, clave), mercancias:tipo_mercancia_id(id, nombre)`
        )
        .eq('id', id)
        .single(),
      supabase
        .from('documents')
        .select('*')
        .eq('container_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('container_events')
        .select('*')
        .eq('container_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (containerRes.data) {
      const c = containerRes.data as unknown as ContainerDetail;
      setContainer(c);
      setEditForm({
        bl: c.bl,
        numero_contenedor: c.numero_contenedor,
        comercializadora: c.comercializadora,
        pedimento: c.pedimento,
        peso: String(c.peso),
      });
    }

    if (docsRes.data) setDocuments(docsRes.data as Document[]);
    if (eventsRes.data) setEvents(eventsRes.data as unknown as Event[]);
    setLoading(false);
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage
      .from('documentacion')
      .createSignedUrl(doc.url, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handlePreview(doc: Document) {
    const { data } = await supabase.storage
      .from('documentacion')
      .createSignedUrl(doc.url, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }

  function handleCorrectionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const rejected: string[] = [];
    const tooLarge: string[] = [];
    const accepted: File[] = [];

    for (const file of incoming) {
      if (!isFileAllowed(file)) {
        rejected.push(file.name);
      } else if (!isFileSizeAllowed(file.size)) {
        tooLarge.push(file.name);
      } else {
        accepted.push(file);
      }
    }

    if (rejected.length > 0 || tooLarge.length > 0) {
      const messages: string[] = [];
      if (rejected.length > 0) {
        messages.push(
          `Archivos no permitidos: ${rejected.join(', ')}. Solo se aceptan PDF y Excel (.xlsx, .xls).`
        );
      }
      if (tooLarge.length > 0) {
        messages.push(
          `Archivos demasiado grandes (max ${MAX_FILE_SIZE_MB}MB): ${tooLarge.join(', ')}`
        );
      }
      setFileError(messages.join(' '));
    } else {
      setFileError(null);
    }

    if (accepted.length > 0) {
      setNewFiles((prev) => [...prev, ...accepted]);
    }

    e.target.value = '';
  }

  function removeCorrectionFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  function markDocumentForDeletion(docId: string) {
    setDeletedDocIds((prev) => [...prev, docId]);
  }

  function resetFileState() {
    setNewFiles([]);
    setDeletedDocIds([]);
    setFileError(null);
  }

  async function handleSaveCorrection() {
    if (!container || !user) return;
    setSaving(true);

    // 1. Backend validation for new files
    if (newFiles.length > 0) {
      const valRes = await fetch('/api/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: newFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        }),
      });
      if (!valRes.ok) {
        setFileError('Archivos no validos. Solo se aceptan PDF y Excel.');
        setSaving(false);
        return;
      }
    }

    // 2. Update text fields
    const { error } = await supabase
      .from('containers')
      .update({
        bl: editForm.bl,
        numero_contenedor: editForm.numero_contenedor,
        comercializadora: editForm.comercializadora,
        pedimento: editForm.pedimento,
        peso: parseFloat(editForm.peso),
        estado: 'pendiente',
      })
      .eq('id', container.id);

    if (error) {
      setSaving(false);
      return;
    }

    // 3. Delete marked documents
    for (const docId of deletedDocIds) {
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        await supabase.storage.from('documentacion').remove([doc.url]);
        await supabase.from('documents').delete().eq('id', docId);
      }
    }

    // 4. Upload new files
    for (const file of newFiles) {
      const filePath = `${container.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documentacion')
        .upload(filePath, file);

      if (!uploadError) {
        await supabase.from('documents').insert({
          container_id: container.id,
          nombre_archivo: file.name,
          url: filePath,
          tipo_mime: file.type,
          tamano_bytes: file.size,
        });
      }
    }

    // 5. Log event
    await supabase.from('container_events').insert({
      container_id: container.id,
      tipo_evento: 'CORRECTION_SUBMITTED',
      descripcion: 'Corrección enviada por broker',
      ejecutado_por: user.id,
      rol_ejecutor: 'BROKER',
    });

    // 6. Reset and refresh
    setEditing(false);
    resetFileState();
    fetchAll();
    setSaving(false);
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Contenedor no encontrado</p>
        <Button
          variant="ghost"
          onClick={() => router.push('/contenedores')}
          className="mt-4 text-cyan-400"
        >
          Volver a contenedores
        </Button>
      </div>
    );
  }

  const isApproved = container.estado === 'aprobado';
  const needsCorrection = container.estado === 'correccion_solicitada';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/contenedores')}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">{container.folio}</h1>
            <Badge
              variant="outline"
              className={STATUS_COLORS[container.estado] || ''}
            >
              {STATUS_LABELS[container.estado] || container.estado}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            {format(new Date(container.created_at), "dd 'de' MMMM yyyy, HH:mm", {
              locale: es,
            })}
          </p>
        </div>
      </div>

      {/* Approved lock banner */}
      {isApproved && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-400" />
          <p className="text-sm text-green-400">
            Operacion aprobada. Edicion bloqueada.
          </p>
        </div>
      )}

      {/* Correction requested banner */}
      {needsCorrection && !editing && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <p className="text-sm font-medium text-orange-400">
              Correccion solicitada
            </p>
          </div>
          {container.motivo_rechazo && (
            <p className="text-xs text-slate-300 mb-3">
              {container.motivo_rechazo}
            </p>
          )}
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Editar y Reenviar
          </Button>
        </div>
      )}

      {/* Rejection notes */}
      {container.estado === 'rechazado' && container.motivo_rechazo && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm font-medium text-red-400">Motivo de rechazo</p>
          </div>
          <p className="text-xs text-slate-300">{container.motivo_rechazo}</p>
        </div>
      )}

      {/* Edit Form (Correction mode) */}
      {editing && needsCorrection && (
        <Card className="bg-slate-800 border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-400 flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Editar Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">BL</Label>
              <Input
                value={editForm.bl}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, bl: e.target.value }))
                }
                className="bg-slate-900 border-slate-600 text-white text-sm focus:border-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Numero Contenedor</Label>
              <Input
                value={editForm.numero_contenedor}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    numero_contenedor: e.target.value,
                  }))
                }
                className="bg-slate-900 border-slate-600 text-white text-sm focus:border-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Comercializadora</Label>
              <Input
                value={editForm.comercializadora}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    comercializadora: e.target.value,
                  }))
                }
                className="bg-slate-900 border-slate-600 text-white text-sm focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs">Pedimento</Label>
                <Input
                  value={editForm.pedimento}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, pedimento: e.target.value }))
                  }
                  className="bg-slate-900 border-slate-600 text-white text-sm focus:border-cyan-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs">Peso (kg)</Label>
                <Input
                  type="number"
                  value={editForm.peso}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, peso: e.target.value }))
                  }
                  className="bg-slate-900 border-slate-600 text-white text-sm focus:border-cyan-500"
                />
              </div>
            </div>
            {/* Document management during correction */}
            <div className="space-y-2 pt-2">
              <Label className="text-slate-300 text-xs">Documentos Actuales</Label>
              {documents.filter((d) => !deletedDocIds.includes(d.id)).length === 0 && deletedDocIds.length > 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  Todos los documentos seran eliminados al guardar.
                </p>
              ) : null}
              {documents
                .filter((d) => !deletedDocIds.includes(d.id))
                .map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-xs text-slate-200 truncate">
                        {doc.nombre_archivo}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {(doc.tamano_bytes / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => markDocumentForDeletion(doc.id)}
                      className="text-slate-500 hover:text-red-400 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              {deletedDocIds.length > 0 && (
                <p className="text-xs text-red-400">
                  {deletedDocIds.length} documento(s) seran eliminados al guardar.{' '}
                  <button
                    type="button"
                    onClick={() => setDeletedDocIds([])}
                    className="underline text-slate-400 hover:text-slate-300"
                  >
                    Deshacer
                  </button>
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-slate-300 text-xs">Agregar Documentos</Label>
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-cyan-500/50 transition-colors">
                <Upload className="h-5 w-5 text-slate-500 mb-1" />
                <span className="text-[10px] text-slate-500">
                  Solo PDF y Excel (max {MAX_FILE_SIZE_MB}MB)
                </span>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_INPUT_ATTR}
                  className="hidden"
                  onChange={handleCorrectionFileChange}
                />
              </label>

              {fileError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{fileError}</p>
                </div>
              )}

              {newFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300 truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCorrectionFile(i)}
                    className="text-slate-500 hover:text-red-400 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  resetFileState();
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCorrection}
                disabled={saving}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-900"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Guardar y Reenviar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operation Details */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Package className="h-4 w-4 text-cyan-400" />
            Detalles de Operacion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Folio</p>
              <p className="text-cyan-400 font-mono">{container.folio}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">BL</p>
              <p className="text-slate-200">{container.bl}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Contenedor</p>
              <p className="text-slate-200">{container.numero_contenedor}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Pedimento</p>
              <p className="text-slate-200">{container.pedimento}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Comercializadora</p>
              <p className="text-slate-200">{container.comercializadora}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Aduana</p>
              <p className="text-slate-200">
                {container.aduanas
                  ? `${container.aduanas.clave} - ${container.aduanas.nombre}`
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cargo Info */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Truck className="h-4 w-4 text-cyan-400" />
            Carga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Tipo de Mercancia</p>
              <p className="text-slate-200">
                {container.mercancias?.nombre || '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Peso</p>
              <p className="text-slate-200">
                {container.peso?.toLocaleString('es-MX')} kg
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-400" />
            Documentacion
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              Sin documentos adjuntos
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-200 truncate">
                        {doc.nombre_archivo}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(doc.tamano_bytes / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isApproved && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(doc)}
                        className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isApproved && (
                      <Lock className="h-3 w-3 text-slate-600 ml-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            Linea de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              Sin eventos registrados
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700" />
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3 relative">
                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full bg-slate-800 flex items-center justify-center z-10">
                      {EVENT_ICONS[event.tipo_evento] || (
                        <Clock className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-200">
                        {event.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">
                          {format(
                            new Date(event.created_at),
                            "dd MMM yyyy, HH:mm",
                            { locale: es }
                          )}
                        </span>
                        {event.rol_ejecutor && (
                          <span className="text-[10px] text-slate-500">
                            por {event.rol_ejecutor}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
