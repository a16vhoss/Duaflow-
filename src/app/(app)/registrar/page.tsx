'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  X,
  CheckCircle,
  Loader2,
  FileText,
  Package,
} from 'lucide-react';

interface Mercancia {
  id: string;
  nombre: string;
}

interface Aduana {
  id: string;
  nombre: string;
  numero: string;
}

export default function RegistrarPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [mercancias, setMercancias] = useState<Mercancia[]>([]);
  const [aduanas, setAduanas] = useState<Aduana[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    bl: '',
    numero_contenedor: '',
    comercializadora: '',
    pedimento: '',
    peso: '',
    tipo_mercancia_id: '',
    aduana_id: '',
  });

  const [files, setFiles] = useState<File[]>([]);

  // Fetch broker-assigned mercancias and aduanas
  useEffect(() => {
    if (!user) return;

    async function fetchOptions() {
      // Get mercancias assigned to this broker
      const { data: userMercancias } = await supabase
        .from('user_mercancias')
        .select('mercancia_id, mercancias(id, nombre)')
        .eq('user_id', user!.id);

      if (userMercancias) {
        const mapped = userMercancias
          .map((um: Record<string, unknown>) => um.mercancias as Mercancia)
          .filter(Boolean);
        setMercancias(mapped);
      }

      // Get aduanas assigned to this broker
      const { data: userAduanas } = await supabase
        .from('user_aduanas')
        .select('aduana_id, aduanas(id, nombre, numero)')
        .eq('user_id', user!.id);

      if (userAduanas) {
        const mapped = userAduanas
          .map((ua: Record<string, unknown>) => ua.aduanas as Aduana)
          .filter(Boolean);
        setAduanas(mapped);
      }
    }

    fetchOptions();
  }, [user]);

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (
      !form.bl ||
      !form.numero_contenedor ||
      !form.comercializadora ||
      !form.pedimento ||
      !form.peso ||
      !form.tipo_mercancia_id ||
      !form.aduana_id
    ) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create the container record
      const { data: container, error: insertError } = await supabase
        .from('contenedores')
        .insert({
          bl: form.bl,
          numero_contenedor: form.numero_contenedor,
          comercializadora: form.comercializadora,
          pedimento: form.pedimento,
          peso: parseFloat(form.peso),
          tipo_mercancia_id: form.tipo_mercancia_id,
          aduana_id: form.aduana_id,
          broker_id: user.id,
          status: 'pendiente',
        })
        .select('id, folio')
        .single();

      if (insertError) throw insertError;

      // Upload documents
      if (files.length > 0 && container) {
        for (const file of files) {
          const filePath = `${container.id}/${Date.now()}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('documentacion')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Save document reference
          await supabase.from('documentos').insert({
            contenedor_id: container.id,
            nombre: file.name,
            path: filePath,
            tipo: file.type,
            size: file.size,
          });
        }
      }

      // Log event
      if (container) {
        await supabase.from('eventos').insert({
          contenedor_id: container.id,
          tipo: 'creacion',
          descripcion: 'Contenedor registrado por broker',
          user_id: user.id,
        });
      }

      setSuccess(container?.folio || 'OK');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar contenedor.');
    } finally {
      setSubmitting(false);
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 rounded-full bg-green-500/10">
          <CheckCircle className="h-12 w-12 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Registro Exitoso</h2>
        <p className="text-slate-400 text-sm text-center">
          Tu contenedor ha sido registrado con el folio:
        </p>
        <p className="text-cyan-400 font-mono text-lg font-bold">{success}</p>
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setSuccess(null);
              setForm({
                bl: '',
                numero_contenedor: '',
                comercializadora: '',
                pedimento: '',
                peso: '',
                tipo_mercancia_id: '',
                aduana_id: '',
              });
              setFiles([]);
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Registrar Otro
          </Button>
          <Button
            onClick={() => router.push('/contenedores')}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-900"
          >
            Ver Contenedores
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Registrar Contenedor</h1>
        <p className="text-sm text-slate-400">
          Ingresa los datos de la operación
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400" />
              Datos de la Operación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">BL (Bill of Lading)</Label>
              <Input
                value={form.bl}
                onChange={(e) => handleChange('bl', e.target.value)}
                placeholder="Ej. MAEU123456789"
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Número de Contenedor</Label>
              <Input
                value={form.numero_contenedor}
                onChange={(e) => handleChange('numero_contenedor', e.target.value)}
                placeholder="Ej. MSKU1234567"
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Comercializadora</Label>
              <Input
                value={form.comercializadora}
                onChange={(e) => handleChange('comercializadora', e.target.value)}
                placeholder="Nombre de la comercializadora"
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Pedimento</Label>
                <Input
                  value={form.pedimento}
                  onChange={(e) => handleChange('pedimento', e.target.value)}
                  placeholder="Número de pedimento"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.peso}
                  onChange={(e) => handleChange('peso', e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Tipo de Mercancía</Label>
              <Select
                value={form.tipo_mercancia_id}
                onValueChange={(v) => handleChange('tipo_mercancia_id', v || '')}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white focus:ring-cyan-500/20">
                  <SelectValue placeholder="Selecciona tipo de mercancía" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {mercancias.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      className="text-slate-200 focus:bg-slate-700 focus:text-white"
                    >
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Aduana</Label>
              <Select
                value={form.aduana_id}
                onValueChange={(v) => handleChange('aduana_id', v || '')}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white focus:ring-cyan-500/20">
                  <SelectValue placeholder="Selecciona aduana" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {aduanas.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      className="text-slate-200 focus:bg-slate-700 focus:text-white"
                    >
                      {a.numero} - {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              Documentación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-cyan-500/50 transition-colors">
              <Upload className="h-6 w-6 text-slate-500 mb-2" />
              <span className="text-xs text-slate-400">
                Toca para seleccionar archivos
              </span>
              <span className="text-[10px] text-slate-500 mt-1">
                PDF, JPG, PNG (múltiples archivos)
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
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
                      onClick={() => removeFile(i)}
                      className="text-slate-500 hover:text-red-400 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold h-11"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            'Registrar Contenedor'
          )}
        </Button>
      </form>
    </div>
  );
}
