'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FolderOpen,
  Search,
  Eye,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ContainerEstado } from '@/types/database';

interface ContainerRow {
  id: string;
  folio: string;
  numero_contenedor: string;
  bl: string;
  comercializadora: string;
  estado: ContainerEstado;
  created_at: string;
  broker: { id: string; nombre: string } | null;
  aduana: { id: string; nombre: string; clave: string } | null;
  mercancia: { id: string; nombre: string } | null;
}

const estadoBadge: Record<ContainerEstado, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  aprobado: { label: 'Aprobado', className: 'bg-green-100 text-green-800 border-green-200' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-800 border-red-200' },
  correccion_solicitada: { label: 'Correccion Solicitada', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

export default function ProyectosPage() {
  const supabase = createClient();
  const { loading: userLoading } = useUser();

  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from('containers')
        .select('id, folio, numero_contenedor, bl, comercializadora, estado, created_at, broker:users!broker_id(id, nombre), aduana:aduanas!aduana_id(id, nombre, clave), mercancia:mercancias!tipo_mercancia_id(id, nombre)')
        .order('created_at', { ascending: false });

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado);
      }

      if (search.trim()) {
        query = query.or(`folio.ilike.%${search}%,numero_contenedor.ilike.%${search}%,bl.ilike.%${search}%,comercializadora.ilike.%${search}%`);
      }

      const { data } = await query;
      setContainers((data as unknown as ContainerRow[]) || []);
      setLoading(false);
    }
    load();
  }, [filtroEstado, search]);

  // Group by aduana
  const grouped = containers.reduce<Record<string, { aduana: { id: string; nombre: string; clave: string }; items: ContainerRow[] }>>((acc, c) => {
    const key = c.aduana?.id || 'sin-aduana';
    if (!acc[key]) {
      acc[key] = {
        aduana: c.aduana || { id: 'sin-aduana', nombre: 'Sin Aduana', clave: '---' },
        items: [],
      };
    }
    acc[key].items.push(c);
    return acc;
  }, {});

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proyectos (Revision)</h1>
        <p className="text-slate-500 text-sm mt-1">Contenedores agrupados por aduana para revision administrativa.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={filtroEstado} onValueChange={(val) => setFiltroEstado(val || 'todos')}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
            <TabsTrigger value="aprobado">Aprobados</TabsTrigger>
            <TabsTrigger value="rechazado">Rechazados</TabsTrigger>
            <TabsTrigger value="correccion_solicitada">Correccion</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por folio, contenedor, BL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Grouped containers */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron contenedores.</p>
          </CardContent>
        </Card>
      ) : (
        Object.values(grouped).map(({ aduana, items }) => (
          <Card key={aduana.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <MapPin className="h-5 w-5 text-rose-500" />
                {aduana.nombre}
                <span className="text-sm font-normal text-slate-400">({aduana.clave})</span>
                <Badge variant="secondary" className="ml-auto">{items.length} contenedores</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{c.folio}</span>
                        <Badge className={estadoBadge[c.estado].className} variant="outline">
                          {estadoBadge[c.estado].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>Contenedor: {c.numero_contenedor}</span>
                        <span>BL: {c.bl}</span>
                        <span>Broker: {c.broker?.nombre || '---'}</span>
                        <span>Mercancia: {c.mercancia?.nombre || '---'}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Creado: {format(new Date(c.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <Link href={`/proyectos/${c.id}`}>
                      <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50">
                        <Eye className="h-4 w-4 mr-1" />
                        Revisar
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
