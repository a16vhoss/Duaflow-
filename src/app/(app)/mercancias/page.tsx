'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Mercancia } from '@/types/database';

export default function MercanciasPage() {
  const supabase = createClient();
  useUser();

  const [mercancias, setMercancias] = useState<Mercancia[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('mercancias').select('*').order('nombre');
    setMercancias(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openNew() {
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setShowDialog(true);
  }

  function openEdit(m: Mercancia) {
    setEditId(m.id);
    setNombre(m.nombre);
    setDescripcion(m.descripcion || '');
    setShowDialog(true);
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);

    if (editId) {
      await supabase
        .from('mercancias')
        .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null })
        .eq('id', editId);
    } else {
      await supabase
        .from('mercancias')
        .insert({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, activa: true });
    }

    setSaving(false);
    setShowDialog(false);
    loadData();
  }

  async function toggleActiva(m: Mercancia) {
    await supabase.from('mercancias').update({ activa: !m.activa }).eq('id', m.id);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Estas seguro de eliminar esta mercancia?')) return;
    await supabase.from('mercancias').delete().eq('id', id);
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mercancias</h1>
          <p className="text-slate-500 text-sm mt-1">Catalogo de tipos de mercancias del sistema.</p>
        </div>
        <Button onClick={openNew} className="bg-rose-500 hover:bg-rose-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Mercancia
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mercancias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      No hay mercancias registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  mercancias.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-rose-400" />
                          <span className="font-medium text-slate-900">{m.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{m.descripcion || '---'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.activa
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }
                        >
                          {m.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(m.created_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleActiva(m)}>
                            {m.activa ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-slate-400" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(m.id)}
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Mercancia' : 'Nueva Mercancia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Acero Inoxidable"
              />
            </div>
            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripcion opcional de la mercancia..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !nombre.trim()}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
