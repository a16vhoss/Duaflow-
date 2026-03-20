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

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        // Only fetch permissions for admin/superadmin roles
        if (profile.role === 'admin' || profile.role === 'superadmin') {
          const { data: permisos } = await supabase
            .from('admin_permisos')
            .select('*')
            .eq('user_id', profile.id)
            .single();
          if (permisos) profile.admin_permisos = permisos;
        }
        setUser(profile as UserWithPermisos);
      }
      setLoading(false);
    }

    getUser();
  }, []);

  return { user, loading };
}
