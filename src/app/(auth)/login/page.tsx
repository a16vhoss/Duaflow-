'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const MAX_ATTEMPTS = 5;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemainingMinutes, setLockRemainingMinutes] = useState(0);
  const [lockTimer, setLockTimer] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  // Check account lockout status when email changes (debounced)
  const checkLockoutStatus = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) return;

    try {
      const res = await fetch(`/api/auth/login-attempts?email=${encodeURIComponent(emailToCheck)}`);
      const data = await res.json();

      if (data.locked) {
        setIsLocked(true);
        setLockRemainingMinutes(data.remainingMinutes);
        setAttemptsLeft(0);
        startLockCountdown(data.remainingMinutes);
      } else {
        setIsLocked(false);
        setAttemptsLeft(data.attemptsLeft ?? MAX_ATTEMPTS);
      }
    } catch {
      // Silently fail — don't block login if check fails
    }
  }, []);

  // Countdown timer for locked accounts
  function startLockCountdown(minutes: number) {
    if (lockTimer) clearInterval(lockTimer);

    let remaining = minutes;
    setLockRemainingMinutes(remaining);

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        setIsLocked(false);
        setAttemptsLeft(MAX_ATTEMPTS);
        setLockRemainingMinutes(0);
      } else {
        setLockRemainingMinutes(remaining);
      }
    }, 60000); // Update every minute

    setLockTimer(timer);
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (lockTimer) clearInterval(lockTimer);
    };
  }, [lockTimer]);

  // Check lockout when email field loses focus
  function handleEmailBlur() {
    checkLockoutStatus(email);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (isLocked) {
      setError(`Cuenta bloqueada. Intenta de nuevo en ${lockRemainingMinutes} minuto(s).`);
      return;
    }

    setLoading(true);
    setError('');

    // Re-check lockout before attempting login
    try {
      const checkRes = await fetch(`/api/auth/login-attempts?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();

      if (checkData.locked) {
        setIsLocked(true);
        setLockRemainingMinutes(checkData.remainingMinutes);
        setAttemptsLeft(0);
        startLockCountdown(checkData.remainingMinutes);
        setError(`Cuenta bloqueada. Intenta de nuevo en ${checkData.remainingMinutes} minuto(s).`);
        setLoading(false);
        return;
      }
    } catch {
      // Continue with login if check fails
    }

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Record failed attempt
      try {
        const res = await fetch('/api/auth/login-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, success: false }),
        });
        const data = await res.json();

        if (data.locked) {
          setIsLocked(true);
          setLockRemainingMinutes(data.remainingMinutes);
          setAttemptsLeft(0);
          startLockCountdown(data.remainingMinutes);
          setError(
            `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${data.remainingMinutes} minuto(s).`
          );
        } else {
          setAttemptsLeft(data.attemptsLeft);
          if (data.attemptsLeft <= 2) {
            setError(
              `Credenciales incorrectas. Te quedan ${data.attemptsLeft} intento(s) antes del bloqueo temporal.`
            );
          } else {
            setError('Credenciales incorrectas.');
          }
        }
      } catch {
        setError('Credenciales incorrectas.');
      }

      setLoading(false);
      return;
    }

    // Successful login — record success and clear lockout
    try {
      await fetch('/api/auth/login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, success: true }),
      });
    } catch {
      // Non-critical
    }

    // Get user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Error al obtener usuario');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, activo')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setError('Usuario no encontrado en el sistema');
      setLoading(false);
      return;
    }

    if (!profile.activo) {
      await supabase.auth.signOut();
      setError('Cuenta desactivada');
      setLoading(false);
      return;
    }

    // Register session (invalidates any previous session for this user)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionId = sessionData?.session?.access_token || crypto.randomUUID();

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sessionId,
        }),
      });

      // Store session ID in localStorage for later validation
      if (typeof window !== 'undefined') {
        localStorage.setItem('duaflow_session_id', sessionId);
      }
    } catch {
      // Non-critical — continue with login
    }

    // Reset attempts state
    setAttemptsLeft(MAX_ATTEMPTS);
    setIsLocked(false);

    // Redirect based on role
    router.push('/dashboard');
    router.refresh();
  }

  const showAttemptWarning = !isLocked && attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-2">
            <span className="text-white font-bold text-xl">DC</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Duaflow
          </CardTitle>
          <CardDescription className="text-slate-400">
            AduaRed + CargoFlow — Sistema Unificado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Account locked warning */}
            {isLocked && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-4 rounded-lg text-sm flex items-start gap-3">
                <Lock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Cuenta bloqueada temporalmente</p>
                  <p className="mt-1 text-red-400/80">
                    Demasiados intentos fallidos. Intenta de nuevo en{' '}
                    <strong>{lockRemainingMinutes} minuto(s)</strong>.
                  </p>
                  <p className="mt-2 text-red-400/60 text-xs">
                    Si olvidaste tu contrasena, usa el enlace de recuperacion debajo.
                  </p>
                </div>
              </div>
            )}

            {/* General errors */}
            {(error || errorParam) && !isLocked && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error || errorParam}
              </div>
            )}

            {/* Attempt counter warning */}
            {showAttemptWarning && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>
                  Intentos restantes: <strong>{attemptsLeft}</strong> de {MAX_ATTEMPTS}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
                disabled={isLocked}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Contrasena
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLocked}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 disabled:opacity-50"
              />
            </div>

            {/* Forgot password link */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
              >
                Olvidaste tu contrasena?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading || isLocked}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : isLocked ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Cuenta bloqueada
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
