'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserWithPermisos } from '@/types/database';

export function useUser() {
  const [user, setUser] = useState<UserWithPermisos | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      // Fetch profile and permissions in parallel
      const [{ data: profile }, { data: permisos }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('admin_permisos').select('*').eq('user_id', authUser.id).single(),
      ]);

      if (profile) {
        if ((profile.role === 'admin' || profile.role === 'superadmin') && permisos) {
          profile.admin_permisos = permisos;
        }
        setUser(profile as UserWithPermisos);
      }
      setLoading(false);
    }

    getUser();
  }, []);

  return { user, loading };
}
