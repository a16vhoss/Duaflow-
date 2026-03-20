'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Package,
} from 'lucide-react';
import { validatePassword } from '@/lib/password-validation';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';

interface MercanciaAssignment {
  mercancias: { nombre: string } | null;
}

interface AduanaAssignment {
  aduanas: { nombre: string; numero: string } | null;
}

export default function BrokerPerfil() {
  const { user, loading: userLoading } = useUser();
  const supabase = createClient();

  const [mercancias, setMercancias] = useState<string[]>([]);
  const [aduanas, setAduanas] = useState<string[]>([]);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchAssignments() {
      const [mercRes, aduanaRes] = await Promise.all([
        supabase
          .from('user_mercancias')
          .select('mercancias(nombre)')
          .eq('user_id', user!.id),
        supabase
          .from('user_aduanas')
          .select('aduanas(nombre, numero)')
          .eq('user_id', user!.id),
      ]);

      if (mercRes.data) {
        setMercancias(
          (mercRes.data as unknown as MercanciaAssignment[])
            .map((m) => m.mercancias?.nombre || '')
            .filter(Boolean)
        );
      }
      if (aduanaRes.data) {
        setAduanas(
          (aduanaRes.data as unknown as AduanaAssignment[])
            .map((a) =>
              a.aduanas ? `${a.aduanas.numero} - ${a.aduanas.nombre}` : ''
            )
            .filter(Boolean)
        );
      }
    }

    fetchAssignments();
  }, [user]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const validation = validatePassword(passwordForm.newPassword);
    if (!validation.isValid) {
      setPasswordError('La contrasena no cumple los requisitos: ' + validation.errors[0]);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contrasenas no coinciden.');
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setPasswordSuccess(false), 4000);
    }

    setChangingPassword(false);
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Mi Perfil</h1>

      {/* Profile Info (Read-only) */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <User className="h-4 w-4 text-cyan-400" />
            Datos de Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {user.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="text-white font-semibold">{user.nombre}</p>
              <Badge
                variant="outline"
                className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] mt-1"
              >
                Broker
              </Badge>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Email
                </p>
                <p className="text-sm text-slate-200">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Rol
                </p>
                <p className="text-sm text-slate-200 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Mercancias */}
      {mercancias.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400" />
              Mercancias Asignadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {mercancias.map((m, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-slate-900 border-slate-600 text-slate-300 text-xs"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Aduanas */}
      {aduanas.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan-400" />
              Aduanas Asignadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aduanas.map((a, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-slate-900 border-slate-600 text-slate-300 text-xs"
                >
                  {a}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Password */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-400" />
            Cambiar Contrasena
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Contrasena Actual</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      currentPassword: e.target.value,
                    }))
                  }
                  className="bg-slate-900 border-slate-600 text-white pr-10 focus:border-cyan-500 focus:ring-cyan-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Nueva Contrasena</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      newPassword: e.target.value,
                    }))
                  }
                  className="bg-slate-900 border-slate-600 text-white pr-10 focus:border-cyan-500 focus:ring-cyan-500/20"
                  placeholder="Min. 8 caracteres, mayuscula, numero, especial"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator password={passwordForm.newPassword} variant="dark" />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">
                Confirmar Nueva Contrasena
              </Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({
                    ...p,
                    confirmPassword: e.target.value,
                  }))
                }
                className="bg-slate-900 border-slate-600 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
              />
            </div>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="h-3 w-3 text-green-400">✓</span>
                <p className="text-xs text-green-400">
                  Contrasena actualizada correctamente.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={changingPassword}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Cambiar Contrasena
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
