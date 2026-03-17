'use client';

import { useUser } from '@/hooks/use-user';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const BrokerPerfil = dynamic(
  () => import('@/components/broker/broker-perfil'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    ),
  }
);

const AdminPerfil = dynamic(
  () => import('@/components/admin/admin-perfil'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    ),
  }
);

export default function PerfilPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null;

  if (user.role === 'broker') {
    return <BrokerPerfil />;
  }

  // admin or superadmin
  return <AdminPerfil />;
}
