'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Filter, Package, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Container {
  id: string;
  folio: string;
  numero_contenedor: string;
  bl: string;
  comercializadora: string;
  pedimento: string;
  peso: number;
  status: string;
  created_at: string;
  aduanas: { nombre: string; numero: string } | null;
  mercancias: { nombre: string } | null;
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
  correccion_solicitada: 'Corrección',
};

const ALL_STATUSES = ['pendiente', 'aprobado', 'rechazado', 'correccion_solicitada'];

export default function ContenedoresPage() {
  const { user, loading: userLoading } = useUser();
  const supabase = createClient();

  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;

    async function fetchContainers() {
      const { data } = await supabase
        .from('contenedores')
        .select(
          `id, folio, numero_contenedor, bl, comercializadora, pedimento, peso, status, created_at,
           aduanas(nombre, numero),
           mercancias:tipo_mercancia_id(nombre)`
        )
        .eq('broker_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) setContainers(data as unknown as Container[]);
      setLoading(false);
    }

    fetchContainers();

    const channel = supabase
      .channel('broker-containers-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contenedores',
          filter: `broker_id=eq.${user.id}`,
        },
        () => fetchContainers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = containers.filter((c) => {
    const matchesSearch =
      !search ||
      c.folio?.toLowerCase().includes(search.toLowerCase()) ||
      c.numero_contenedor?.toLowerCase().includes(search.toLowerCase()) ||
      c.bl?.toLowerCase().includes(search.toLowerCase()) ||
      c.comercializadora?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contenedores</h1>
          <p className="text-sm text-slate-400">
            {filtered.length} de {containers.length} operaciones
          </p>
        </div>
        <Link href="/registrar">
          <Button
            size="sm"
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold"
          >
            <Package className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar folio, contenedor, BL..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white focus:ring-cyan-500/20">
            <Filter className="h-3 w-3 mr-1 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem
              value="all"
              className="text-slate-200 focus:bg-slate-700 focus:text-white"
            >
              Todos
            </SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem
                key={s}
                value={s}
                className="text-slate-200 focus:bg-slate-700 focus:text-white"
              >
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 sm:hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No se encontraron contenedores
          </div>
        ) : (
          filtered.map((c) => (
            <Link key={c.id} href={`/contenedores/${c.id}`}>
              <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-cyan-400 font-mono text-sm font-semibold">
                        {c.folio}
                      </p>
                      <p className="text-white text-sm">{c.numero_contenedor}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[c.status] || ''}`}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{c.comercializadora}</span>
                    <span>
                      {format(new Date(c.created_at), 'dd MMM yyyy', {
                        locale: es,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <Card className="bg-slate-800 border-slate-700 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs">Folio</TableHead>
                <TableHead className="text-slate-400 text-xs">Contenedor</TableHead>
                <TableHead className="text-slate-400 text-xs">BL</TableHead>
                <TableHead className="text-slate-400 text-xs">Comercializadora</TableHead>
                <TableHead className="text-slate-400 text-xs">Aduana</TableHead>
                <TableHead className="text-slate-400 text-xs">Fecha</TableHead>
                <TableHead className="text-slate-400 text-xs">Status</TableHead>
                <TableHead className="text-slate-400 text-xs w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-slate-700">
                  <TableCell
                    colSpan={8}
                    className="text-center text-slate-500 py-8"
                  >
                    No se encontraron contenedores
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/contenedores/${c.id}`)
                    }
                  >
                    <TableCell className="text-cyan-400 text-xs font-mono font-semibold">
                      {c.folio}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {c.numero_contenedor}
                    </TableCell>
                    <TableCell className="text-slate-300 text-xs">
                      {c.bl}
                    </TableCell>
                    <TableCell className="text-slate-300 text-xs">
                      {c.comercializadora}
                    </TableCell>
                    <TableCell className="text-slate-300 text-xs">
                      {c.aduanas?.numero} - {c.aduanas?.nombre}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {format(new Date(c.created_at), 'dd/MM/yy', {
                        locale: es,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_COLORS[c.status] || ''}`}
                      >
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
