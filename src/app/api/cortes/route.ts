import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// POST: Execute a manual corte
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verify user is admin/superadmin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Sin permisos para ejecutar corte' }, { status: 403 });
    }

    // Prevent duplicate cortes — reject if one was created in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentCortes } = await supabase
      .from('cortes')
      .select('id')
      .gte('created_at', oneMinuteAgo)
      .eq('tipo', 'manual');

    if (recentCortes && recentCortes.length > 0) {
      return NextResponse.json(
        { error: 'Ya se ejecuto un corte hace menos de un minuto. Espera antes de ejecutar otro.' },
        { status: 409 }
      );
    }

    // Get all pending containers that are not assigned to any corte
    const { data: pendingContainers, error: fetchError } = await supabase
      .from('containers')
      .select('*')
      .eq('estado', 'pendiente')
      .is('corte_id', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!pendingContainers || pendingContainers.length === 0) {
      return NextResponse.json(
        { error: 'No hay contenedores pendientes para incluir en el corte' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalContenedores = pendingContainers.length;
    const totalPesoKg = pendingContainers.reduce(
      (sum, c) => sum + (c.peso_kg || 0),
      0
    );

    // Create the corte record
    const { data: corte, error: corteError } = await supabase
      .from('cortes')
      .insert({
        tipo: 'manual',
        ejecutado_por: user.id,
        total_contenedores: totalContenedores,
        total_peso_kg: totalPesoKg,
        fecha_corte: new Date().toISOString(),
      })
      .select()
      .single();

    if (corteError) {
      return NextResponse.json({ error: corteError.message }, { status: 400 });
    }

    // Assign all pending containers to this corte
    const containerIds = pendingContainers.map((c) => c.id);
    const { error: updateError } = await supabase
      .from('containers')
      .update({ corte_id: corte.id, estado: 'en_corte' })
      .in('id', containerIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Get distinct broker_ids from the pending containers
    const brokerIds = [...new Set(pendingContainers.map((c) => c.broker_id).filter(Boolean))];

    // Create corte_info notifications for each broker
    if (brokerIds.length > 0) {
      const notifications = brokerIds.map((brokerId) => {
        const brokerContainers = pendingContainers.filter((c) => c.broker_id === brokerId);
        return {
          corte_id: corte.id,
          broker_id: brokerId,
          total_contenedores: brokerContainers.length,
          total_peso_kg: brokerContainers.reduce((sum, c) => sum + (c.peso_kg || 0), 0),
          leido: false,
        };
      });

      const { error: notifError } = await supabase
        .from('corte_info')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating corte_info notifications:', notifError.message);
      }
    }

    return NextResponse.json({
      data: {
        corte,
        total_contenedores: totalContenedores,
        total_peso_kg: totalPesoKg,
        brokers_notificados: brokerIds.length,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
