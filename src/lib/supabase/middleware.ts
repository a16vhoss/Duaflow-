import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname === '/forgot-password'
  ) {
    return supabaseResponse;
  }

  // Not authenticated → login
  if (!user) {
    if (pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ---------- Session uniqueness check (Hallazgo 2.1.4) ----------
  // Validate that this session is the active one for the user.
  // We read the session token from the cookie and compare with the DB.
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSessionId = sessionData?.session?.access_token;

  if (currentSessionId && pathname !== '/login') {
    try {
      const { data: storedSession } = await supabase
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .single();

      if (storedSession && storedSession.session_id !== currentSessionId) {
        // This session has been superseded by a newer login
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'Tu sesion fue cerrada porque se inicio sesion desde otro dispositivo.');
        return NextResponse.redirect(url);
      }
    } catch {
      // If check fails, allow request to continue
    }
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from('users')
    .select('role, activo')
    .eq('id', user.id)
    .single();

  // User inactive
  if (profile && !profile.activo) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Cuenta desactivada');
    await supabase.auth.signOut();
    return NextResponse.redirect(url);
  }

  const role = profile?.role;

  // Redirect from login if already authenticated
  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'broker' ? '/dashboard' : '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect root to dashboard
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Role-based access control
  if (role === 'broker') {
    // Check admin permission for broker module
    // Block admin routes
    const adminRoutes = ['/proyectos', '/brokers', '/aduanas', '/mercancias', '/cortes', '/administradores', '/reportes'];
    const isAdminRoute = adminRoutes.some(r => pathname.startsWith(r));

    if (isAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (role === 'admin' || role === 'superadmin') {
    // Block broker-only routes (registrar)
    if (pathname.startsWith('/registrar')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // For admin (not superadmin), check granular permissions
    if (role === 'admin') {
      const { data: permisos } = await supabase
        .from('admin_permisos')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (permisos) {
        const permMap: Record<string, boolean> = {
          '/proyectos': permisos.perm_proyectos,
          '/brokers': permisos.perm_brokers,
          '/aduanas': permisos.perm_aduanas,
          '/cortes': permisos.perm_aduanas,
          '/mercancias': permisos.perm_mercancias,
          '/administradores': permisos.perm_administradores,
        };

        for (const [route, allowed] of Object.entries(permMap)) {
          if (pathname.startsWith(route) && !allowed) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            url.searchParams.set('error', 'No tiene permisos para esta sección');
            return NextResponse.redirect(url);
          }
        }
      }
    }
  }

  return supabaseResponse;
}
