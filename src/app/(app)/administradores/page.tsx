'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShieldCheck, Plus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import type { AdminPermisos } from '@/types/database';

interface AdminRow {
  id: string;
  nombre: string;
  email: string;
  role: string;
  activo: boolean;
  permisos?: AdminPermisos;
}

const PERMISOS_LABELS: { key: keyof Omit<AdminPermisos, 'user_id'>; label: string }[] = [
  { key: 'perm_aduanas', label: 'Aduanas' },
  { key: 'perm_administradores', label: 'Administradores' },
  { key: 'perm_brokers', label: 'Brokers' },
  { key: 'perm_mercancias', label: 'Mercancias' },
  { key: 'perm_proyectos', label: 'Proyectos' },
];

export default function AdministradoresPage() {
  const supabase = createClient();
  const { user } = useUser();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permisos, setPermisos] = useState<Record<string, boolean>>({
    perm_aduanas: false,
    perm_administradores: false,
    perm_brokers: false,
    perm_mercancias: false,
    perm_proyectos: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id, nombre, email, role, activo')
      .in('role', ['admin', 'superadmin'])
      .order('nombre');

    if (adminUsers) {
      const adminsWithPerms: AdminRow[] = [];
      for (const a of adminUsers) {
        const { data: perms } = await supabase
          .from('admin_permisos')
          .select('*')
          .eq('user_id', a.id)
          .single();
        adminsWithPerms.push({ ...a, permisos: perms || undefined });
      }
      setAdmins(adminsWithPerms);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Only superadmin can manage admins
  const isSuperadmin = user?.role === 'superadmin';

  function openNew() {
    setEditId(null);
    setNombre('');
    setEmail('');
    setPassword('');
    setPermisos({
      perm_aduanas: false,
      perm_administradores: false,
      perm_brokers: false,
      perm_mercancias: false,
      perm_proyectos: false,
    });
    setError('');
    setShowDialog(true);
  }

  function openEdit(a: AdminRow) {
    setEditId(a.id);
    setNombre(a.nombre);
    setEmail(a.email);
    setPassword('');
    setPermisos({
      perm_aduanas: a.permisos?.perm_aduanas || false,
      perm_administradores: a.permisos?.perm_administradores || false,
      perm_brokers: a.permisos?.perm_brokers || false,
      perm_mercancias: a.permisos?.perm_mercancias || false,
      perm_proyectos: a.permisos?.perm_proyectos || false,
    });
    setError('');
    setShowDialog(true);
  }

  async function handleSave() {
    if (!nombre.trim() || !email.trim()) return;
    if (!editId && !password.trim()) return;
    setSaving(true);
    setError('');

    try {
      if (editId) {
        // Update profile
        await supabase
          .from('users')
          .update({ nombre: nombre.trim(), email: email.trim() })
          .eq('id', editId);

        // Update password if provided
        if (password.trim()) {
          const res = await fetch('/api/admin/brokers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: editId, password: password.trim() }),
          });
          if (!res.ok) {
            const err = await res.json();
            setError(err.error || 'Error actualizando contrasena');
            setSaving(false);
            return;
          }
        }

        // Upsert permisos
        await supabase.from('admin_permisos').upsert({
          user_id: editId,
          ...permisos,
        });
      } else {
        // Create new admin via API
        const res = await fetch('/api/admin/brokers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            email: email.trim(),
            password: password.trim(),
            role: 'admin',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.error || 'Error creando administrador');
          setSaving(false);
          return;
        }

        const { user_id } = await res.json();

        // Insert permisos
        if (user_id) {
          await supabase.from('admin_permisos').insert({
            user_id,
            ...permisos,
          });
        }
      }

      setSaving(false);
      setShowDialog(false);
      loadData();
    } catch {
      setError('Error de conexion');
      setSaving(false);
    }
  }

  async function toggleActivo(adminId: string, activo: boolean) {
    await supabase.from('users').update({ activo: !activo }).eq('id', adminId);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este administrador?')) return;
    await supabase.from('admin_permisos').delete().eq('user_id', id);
    await supabase.from('users').delete().eq('id', id);
    loadData();
  }

  if (!isSuperadmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <ShieldCheck className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">Acceso Restringido</p>
        <p className="text-sm">Solo los superadministradores pueden gestionar administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administradores</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona cuentas de administrador y sus permisos.</p>
        </div>
        <Button onClick={openNew} className="bg-rose-500 hover:bg-rose-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Administrador
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
                  <TableHead>Nombre / Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      No hay administradores registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{a.nombre}</p>
                          <p className="text-xs text-slate-500">{a.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            a.role === 'superadmin'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }
                        >
                          {a.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.role === 'superadmin' ? (
                          <span className="text-xs text-purple-500 font-medium">Todos los permisos</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {PERMISOS_LABELS.map(({ key, label }) => (
                              a.permisos?.[key] && (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              )
                            ))}
                            {!a.permisos && (
                              <span className="text-xs text-slate-400">Sin permisos</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            a.activo
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }
                        >
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {a.role !== 'superadmin' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleActivo(a.id, a.activo)}
                                className={a.activo ? 'text-red-500 border-red-200' : 'text-green-500 border-green-200'}
                              >
                                {a.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(a.id)}
                                className="text-red-500 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Administrador' : 'Nuevo Administrador'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Modifica los datos y permisos del administrador.' : 'Crea una nueva cuenta de administrador.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" />
              </div>
            </div>
            <div>
              <Label>
                Contrasena {editId && '(dejar vacio para no cambiar)'}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editId ? 'Nueva contrasena...' : 'Min. 6 caracteres'}
              />
            </div>

            <div>
              <Label className="mb-3 block">Permisos</Label>
              <div className="grid grid-cols-2 gap-3">
                {PERMISOS_LABELS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-rose-200"
                    onClick={() =>
                      setPermisos((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                  >
                    <Checkbox
                      checked={permisos[key]}
                      onCheckedChange={(checked) =>
                        setPermisos((prev) => ({ ...prev, [key]: !!checked }))
                      }
                    />
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !nombre.trim() || !email.trim() || (!editId && !password.trim())}
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
