'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
// import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, User, MapPin, Package } from 'lucide-react';
import type { Aduana, Mercancia } from '@/types/database';

export default function EditBrokerPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const brokerId = params.id as string;
  useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Broker data
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aduanaBaseId, setAduanaBaseId] = useState('');

  // Assignments
  const [aduanas, setAduanas] = useState<Aduana[]>([]);
  const [mercancias, setMercancias] = useState<Mercancia[]>([]);
  const [assignedMercancias, setAssignedMercancias] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [brokerRes, aduanasRes, mercanciasRes, userMercsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', brokerId).single(),
        supabase.from('aduanas').select('*').eq('activa', true).order('nombre'),
        supabase.from('mercancias').select('*').eq('activa', true).order('nombre'),
        supabase.from('user_mercancias').select('mercancia_id').eq('user_id', brokerId),
      ]);

      if (brokerRes.data) {
        setNombre(brokerRes.data.nombre);
        setEmail(brokerRes.data.email);
        setAduanaBaseId(brokerRes.data.aduana_base_id || '');
      }
      if (aduanasRes.data) setAduanas(aduanasRes.data);
      if (mercanciasRes.data) setMercancias(mercanciasRes.data);
      if (userMercsRes.data) {
        setAssignedMercancias(new Set(userMercsRes.data.map((m) => m.mercancia_id)));
      }
      setLoading(false);
    }
    load();
  }, [brokerId]);

  function toggleMercancia(mercanciaId: string) {
    setAssignedMercancias((prev) => {
      const next = new Set(prev);
      if (next.has(mercanciaId)) {
        next.delete(mercanciaId);
      } else {
        next.add(mercanciaId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');

    // Update user profile
    const updateData: Record<string, unknown> = {
      nombre: nombre.trim(),
      email: email.trim(),
      aduana_base_id: aduanaBaseId || null,
    };

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', brokerId);

    if (updateError) {
      setError('Error al actualizar datos del broker: ' + updateError.message);
      setSaving(false);
      return;
    }

    // Update password if provided (via API route)
    if (password.trim()) {
      const res = await fetch('/api/admin/brokers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: brokerId, password: password.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError('Error al actualizar contrasena: ' + (err.error || 'Error desconocido'));
        setSaving(false);
        return;
      }
    }

    // Update aduanas assignment (aduana base goes to user_aduanas too)
    await supabase.from('user_aduanas').delete().eq('user_id', brokerId);
    if (aduanaBaseId) {
      await supabase.from('user_aduanas').insert({ user_id: brokerId, aduana_id: aduanaBaseId });
    }

    // Update mercancias assignments
    // Delete all existing
    await supabase.from('user_mercancias').delete().eq('user_id', brokerId);

    // Insert new ones
    if (assignedMercancias.size > 0) {
      const inserts = Array.from(assignedMercancias).map((mercancia_id) => ({
        user_id: brokerId,
        mercancia_id,
      }));
      await supabase.from('user_mercancias').insert(inserts);
    }

    setSuccess('Broker actualizado correctamente.');
    setPassword('');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/brokers')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar Broker</h1>
          <p className="text-slate-500 text-sm">{email}</p>
        </div>
      </div>

      {/* Info form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <User className="h-5 w-5 text-rose-500" />
            Datos del Broker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre completo</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nueva contrasena (dejar vacio para no cambiar)</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese nueva contrasena..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Aduana Base */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <MapPin className="h-5 w-5 text-rose-500" />
            Aduana Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={aduanaBaseId} onValueChange={(val) => setAduanaBaseId(val || '')}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Seleccionar aduana base" />
            </SelectTrigger>
            <SelectContent>
              {aduanas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre} ({a.clave})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mercancias checkboxes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Package className="h-5 w-5 text-rose-500" />
            Mercancias Permitidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Seleccione las mercancias que este broker puede gestionar.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {mercancias.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-rose-200 cursor-pointer transition-colors"
                onClick={() => toggleMercancia(m.id)}
              >
                <Checkbox
                  checked={assignedMercancias.has(m.id)}
                  onCheckedChange={() => toggleMercancia(m.id)}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.nombre}</p>
                  {m.descripcion && (
                    <p className="text-xs text-slate-400">{m.descripcion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status messages and save */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !nombre.trim() || !email.trim()}
          className="bg-rose-500 hover:bg-rose-600 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}
