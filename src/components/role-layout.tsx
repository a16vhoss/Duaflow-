'use client';

import { useUser } from '@/hooks/use-user';
import { BrokerHeader } from '@/components/broker/header';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null;

  if (user.role === 'broker') {
    return (
      <div className="min-h-screen bg-slate-900 dark">
        <BrokerHeader />
        <main className="max-w-lg mx-auto px-4 py-6 sm:max-w-2xl">
          {children}
        </main>
      </div>
    );
  }

  // admin or superadmin
  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="ml-64 p-6">
        {children}
      </main>
    </div>
  );
}
