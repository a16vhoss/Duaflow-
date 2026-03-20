import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getServiceSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
          } catch {
            // ignore
          }
        },
      },
    }
  );
}

// POST: Register a new session (invalidates previous ones)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, sessionId } = body;

  if (!userId || !sessionId) {
    return NextResponse.json({ error: 'userId y sessionId requeridos' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Upsert: replaces the previous session for this user
  const { error } = await supabase
    .from('user_sessions')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET: Verify if current session is still the active one
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('sessionId');

  if (!userId || !sessionId) {
    return NextResponse.json({ error: 'userId y sessionId requeridos' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data } = await supabase
    .from('user_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .single();

  const isActive = data?.session_id === sessionId;

  return NextResponse.json({ isActive });
}

// DELETE: Remove session on logout
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId);

  return NextResponse.json({ success: true });
}
