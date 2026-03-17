'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Aduana } from '@/types/database';

export default function AduanasPage() {
  const supabase = createClient();
  useUser();

  const [aduanas, setAduanas] = useState<Aduana[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('aduanas').select('*').order('nombre');
    setAduanas(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openNew() {
    setEditId(null);
    setNombre('');
    setClave('');
    setShowDialog(true);
  }

  function openEdit(a: Aduana) {
    setEditId(a.id);
    setNombre(a.nombre);
    setClave(a.clave);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!nombre.trim() || !clave.trim()) return;
    setSaving(true);

    if (editId) {
      await supabase
        .from('aduanas')
        .update({ nombre: nombre.trim(), clave: clave.trim() })
        .eq('id', editId);
    } else {
      await supabase
        .from('aduanas')
        .insert({ nombre: nombre.trim(), clave: clave.trim(), activa: true });
    }

    setSaving(false);
    setShowDialog(false);
    loadData();
  }

  async function toggleActiva(aduana: Aduana) {
    await supabase.from('aduanas').update({ activa: !aduana.activa }).eq('id', aduana.id);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Estas seguro de eliminar esta aduana? Esto puede afectar datos relacionados.')) return;
    await supabase.from('aduanas').delete().eq('id', id);
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aduanas</h1>
          <p className="text-slate-500 text-sm mt-1">Administra el catalogo de aduanas disponibles.</p>
        </div>
        <Button onClick={openNew} className="bg-rose-500 hover:bg-rose-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Aduana
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
                  <TableHead>Clave</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aduanas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                      No hay aduanas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  aduanas.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-rose-400" />
                          <span className="font-medium text-slate-900">{a.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-slate-100 px-2 py-0.5 rounded text-sm text-slate-700">{a.clave}</code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            a.activa
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }
                        >
                          {a.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleActiva(a)}>
                            {a.activa ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-slate-400" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(a.id)}
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

      {/* Dialog for create/edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Aduana' : 'Nueva Aduana'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Aduana de Manzanillo"
              />
            </div>
            <div>
              <Label>Clave</Label>
              <Input
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="MZN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !nombre.trim() || !clave.trim()}
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
