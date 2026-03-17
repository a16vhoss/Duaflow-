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

// GET: List containers with optional filters
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const aduana_id = searchParams.get('aduana_id');
    const broker_id = searchParams.get('broker_id');
    const corte_id = searchParams.get('corte_id');
    const folio = searchParams.get('folio');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('containers')
      .select('*, aduana:aduanas(*), broker:users!containers_broker_id_fkey(*)', { count: 'exact' });

    if (estado) {
      query = query.eq('estado', estado);
    }
    if (aduana_id) {
      query = query.eq('aduana_id', aduana_id);
    }
    if (broker_id) {
      query = query.eq('broker_id', broker_id);
    }
    if (corte_id) {
      query = query.eq('corte_id', corte_id);
    }
    if (folio) {
      query = query.ilike('folio', `%${folio}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create a new container with auto-generated folio
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      numero_contenedor,
      tipo,
      aduana_id,
      broker_id,
      pedimento,
      peso_kg,
      descripcion_mercancia,
      naviera,
      buque,
      eta,
    } = body;

    if (!numero_contenedor || !aduana_id || !broker_id) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: numero_contenedor, aduana_id, broker_id' },
        { status: 400 }
      );
    }

    // Generate folio: YYYY + sequential 6-digit number
    const year = new Date().getFullYear();
    const folioPrefix = String(year);

    // Get the last folio for this year to determine the next sequence
    const { data: lastContainer } = await supabase
      .from('containers')
      .select('folio')
      .ilike('folio', `${folioPrefix}%`)
      .order('folio', { ascending: false })
      .limit(1)
      .single();

    let nextSeq = 1;
    if (lastContainer?.folio) {
      const lastSeq = parseInt(lastContainer.folio.slice(4), 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const folio = `${folioPrefix}${String(nextSeq).padStart(6, '0')}`;

    // Insert the container
    const { data: container, error: insertError } = await supabase
      .from('containers')
      .insert({
        folio,
        numero_contenedor,
        tipo: tipo || null,
        aduana_id,
        broker_id,
        pedimento: pedimento || null,
        peso_kg: peso_kg || null,
        descripcion_mercancia: descripcion_mercancia || null,
        naviera: naviera || null,
        buque: buque || null,
        eta: eta || null,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Create a CREATED event in container_events
    const { error: eventError } = await supabase
      .from('container_events')
      .insert({
        container_id: container.id,
        tipo_evento: 'CREATED',
        descripcion: `Contenedor ${folio} creado`,
        ejecutado_por: user.id,
      });

    if (eventError) {
      console.error('Error creating container event:', eventError.message);
      // Don't fail the request — the container was already created
    }

    return NextResponse.json({ data: container }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
