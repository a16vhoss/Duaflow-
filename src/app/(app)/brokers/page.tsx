'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { Aduana, Mercancia } from '@/types/database';

interface BrokerRow {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  aduana_base_id: string | null;
  created_at: string;
  aduana_base?: { nombre: string; clave: string } | null;
  user_mercancias?: { mercancia_id: string; mercancias: { nombre: string } }[];
}

export default function BrokersPage() {
  const supabase = createClient();
  useUser();

  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [aduanas, setAduanas] = useState<Aduana[]>([]);
  const [, setMercancias] = useState<Mercancia[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New broker form
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAduanaBase, setNewAduanaBase] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function loadData() {
    setLoading(true);
    const [brokersRes, aduanasRes, mercanciasRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, nombre, email, activo, aduana_base_id, created_at, aduana_base:aduanas!aduana_base_id(nombre, clave)')
        .eq('role', 'broker')
        .order('nombre'),
      supabase.from('aduanas').select('*').eq('activa', true).order('nombre'),
      supabase.from('mercancias').select('*').eq('activa', true).order('nombre'),
    ]);

    if (brokersRes.data) {
      // For each broker, load their mercancias
      const brokersWithMercs: BrokerRow[] = [];
      for (const b of brokersRes.data) {
        const { data: userMercs } = await supabase
          .from('user_mercancias')
          .select('mercancia_id, mercancias(nombre)')
          .eq('user_id', b.id);
        brokersWithMercs.push({
          ...b,
          aduana_base: b.aduana_base as unknown as { nombre: string; clave: string } | null,
          user_mercancias: (userMercs as unknown as BrokerRow['user_mercancias']) || [],
        });
      }
      setBrokers(brokersWithMercs);
    }
    if (aduanasRes.data) setAduanas(aduanasRes.data);
    if (mercanciasRes.data) setMercancias(mercanciasRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateBroker() {
    if (!newNombre.trim() || !newEmail.trim() || !newPassword.trim() || !newAduanaBase) return;
    setCreating(true);
    setCreateError('');

    try {
      // Call API route that uses supabase admin to create user
      const res = await fetch('/api/admin/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newNombre.trim(),
          email: newEmail.trim(),
          password: newPassword,
          aduana_base_id: newAduanaBase,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setCreateError(err.error || 'Error al crear broker');
        setCreating(false);
        return;
      }

      setNewNombre('');
      setNewEmail('');
      setNewPassword('');
      setNewAduanaBase('');
      setShowNewDialog(false);
      loadData();
    } catch {
      setCreateError('Error de conexion.');
    }
    setCreating(false);
  }

  async function toggleActivo(brokerId: string, activo: boolean) {
    await supabase.from('users').update({ activo: !activo }).eq('id', brokerId);
    loadData();
  }

  const filtered = brokers.filter(
    (b) =>
      b.nombre.toLowerCase().includes(search.toLowerCase()) ||
      b.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Brokers</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona los brokers registrados y sus asignaciones.</p>
        </div>

        <Button className="bg-rose-500 hover:bg-rose-600 text-white" onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Broker
        </Button>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Broker</DialogTitle>
              <DialogDescription>
                Se creara una cuenta de broker con acceso al sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre completo</Label>
                <Input
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Juan Perez"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="broker@email.com"
                />
              </div>
              <div>
                <Label>Contrasena</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                />
              </div>
              <div>
                <Label>Aduana Base</Label>
                <Select value={newAduanaBase} onValueChange={(val) => setNewAduanaBase(val || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar aduana" />
                  </SelectTrigger>
                  <SelectContent>
                    {aduanas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre} ({a.clave})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {createError && (
                <p className="text-sm text-red-500">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBroker}
                disabled={creating || !newNombre.trim() || !newEmail.trim() || !newPassword.trim() || !newAduanaBase}
                className="bg-rose-500 hover:bg-rose-600 text-white"
              >
                {creating ? 'Creando...' : 'Crear Broker'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
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
                  <TableHead>Aduana Base</TableHead>
                  <TableHead>Permisos Mercancias</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      No se encontraron brokers.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{b.nombre}</p>
                          <p className="text-xs text-slate-500">{b.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.aduana_base ? (
                          <span className="text-sm text-slate-700">
                            {b.aduana_base.nombre}{' '}
                            <span className="text-slate-400">({b.aduana_base.clave})</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {b.user_mercancias && b.user_mercancias.length > 0 ? (
                            b.user_mercancias.map((um) => (
                              <Badge key={um.mercancia_id} variant="secondary" className="text-xs">
                                {um.mercancias?.nombre}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Sin asignaciones</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            b.activo
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }
                        >
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/brokers/${b.id}/editar`}>
                            <Button variant="outline" size="sm">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleActivo(b.id, b.activo)}
                            className={b.activo ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-green-500 border-green-200 hover:bg-green-50'}
                          >
                            {b.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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
    </div>
  );
}
