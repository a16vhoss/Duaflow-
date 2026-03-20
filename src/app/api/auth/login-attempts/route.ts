import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

// GET: Check login attempt status for an email
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Check if account is locked
  const { data: lockout } = await supabase
    .from('account_lockouts')
    .select('locked_until')
    .eq('email', email.toLowerCase())
    .single();

  if (lockout) {
    const lockedUntil = new Date(lockout.locked_until);
    if (lockedUntil > new Date()) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return NextResponse.json({
        locked: true,
        remainingMinutes,
        lockedUntil: lockout.locked_until,
        attemptsLeft: 0,
      });
    } else {
      // Lockout expired, remove it
      await supabase
        .from('account_lockouts')
        .delete()
        .eq('email', email.toLowerCase());
    }
  }

  // Count recent failed attempts
  const fifteenMinutesAgo = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .eq('success', false)
    .gte('created_at', fifteenMinutesAgo);

  const failedAttempts = count || 0;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - failedAttempts);

  return NextResponse.json({
    locked: false,
    failedAttempts,
    attemptsLeft,
  });
}

// POST: Record a login attempt
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, success } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // Record the attempt
  await supabase.from('login_attempts').insert({
    email: email.toLowerCase(),
    ip_address: ip,
    success: success || false,
  });

  if (success) {
    // On success, clear failed attempts and lockout for this email
    await supabase
      .from('account_lockouts')
      .delete()
      .eq('email', email.toLowerCase());

    return NextResponse.json({ locked: false, attemptsLeft: MAX_ATTEMPTS });
  }

  // Count recent failed attempts after recording
  const fifteenMinutesAgo = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .eq('success', false)
    .gte('created_at', fifteenMinutesAgo);

  const failedAttempts = count || 0;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - failedAttempts);

  // Lock account if max attempts reached
  if (failedAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();

    await supabase
      .from('account_lockouts')
      .upsert(
        { email: email.toLowerCase(), locked_until: lockedUntil },
        { onConflict: 'email' }
      );

    return NextResponse.json({
      locked: true,
      remainingMinutes: LOCKOUT_MINUTES,
      lockedUntil,
      attemptsLeft: 0,
    });
  }

  return NextResponse.json({
    locked: false,
    failedAttempts,
    attemptsLeft,
  });
}
