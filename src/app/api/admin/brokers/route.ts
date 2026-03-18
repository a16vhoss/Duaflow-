import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase, createServerSupabase } from '@/lib/supabase/server';

// POST: Create a new broker or admin user
export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createServerSupabase();

    // Verify the caller is admin/superadmin
    const { data: { user: authUser } } = await serverSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: callerProfile } = await serverSupabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, email, password, aduana_base_id, role } = body;

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const userRole = role || 'broker';

    // Use service role to create auth user
    const serviceSupabase = createServiceSupabase();
    const { data: newAuthUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !newAuthUser.user) {
      return NextResponse.json(
        { error: authError?.message || 'Error al crear usuario en auth' },
        { status: 400 }
      );
    }

    // Insert into users table
    const { error: insertError } = await serviceSupabase.from('users').insert({
      id: newAuthUser.user.id,
      email,
      nombre,
      role: userRole,
      aduana_base_id: aduana_base_id || null,
      activo: true,
    });

    if (insertError) {
      // Rollback: delete auth user
      await serviceSupabase.auth.admin.deleteUser(newAuthUser.user.id);
      return NextResponse.json(
        { error: 'Error al crear perfil de usuario: ' + insertError.message },
        { status: 400 }
      );
    }

    // Also insert into user_aduanas if aduana_base_id is set
    if (aduana_base_id) {
      await serviceSupabase.from('user_aduanas').insert({
        user_id: newAuthUser.user.id,
        aduana_id: aduana_base_id,
      });
    }

    return NextResponse.json({ user_id: newAuthUser.user.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Update user password (admin action)
export async function PATCH(req: NextRequest) {
  try {
    const serverSupabase = createServerSupabase();

    // Verify caller
    const { data: { user: authUser } } = await serverSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: callerProfile } = await serverSupabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, password } = body;

    if (!user_id || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const serviceSupabase = createServiceSupabase();
    const { error } = await serviceSupabase.auth.admin.updateUserById(user_id, { password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
