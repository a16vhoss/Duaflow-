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

// GET: List notifications for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leido = searchParams.get('leido');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('corte_info')
      .select('*, corte:cortes(*)', { count: 'exact' })
      .eq('broker_id', user.id);

    if (leido === 'true') {
      query = query.eq('leido', true);
    } else if (leido === 'false') {
      query = query.eq('leido', false);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Also get unread count
    const { count: unreadCount } = await supabase
      .from('corte_info')
      .select('*', { count: 'exact', head: true })
      .eq('broker_id', user.id)
      .eq('leido', false);

    return NextResponse.json({
      data,
      count,
      unread_count: unreadCount || 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { notification_ids, mark_all } = body;

    if (mark_all) {
      // Mark all notifications as read for this user
      const { error } = await supabase
        .from('corte_info')
        .update({ leido: true })
        .eq('broker_id', user.id)
        .eq('leido', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Todas las notificaciones marcadas como leidas' });
    }

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: 'Proporcione notification_ids o mark_all: true' },
        { status: 400 }
      );
    }

    // Mark specific notifications as read (only if they belong to the user)
    const { data, error } = await supabase
      .from('corte_info')
      .update({ leido: true })
      .in('id', notification_ids)
      .eq('broker_id', user.id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
