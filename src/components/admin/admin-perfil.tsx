'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Mail, ShieldCheck, Calendar, Save, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { validatePassword } from '@/lib/password-validation';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';

export default function AdminPerfil() {
  const supabase = createClient();
  const { user, loading: userLoading } = useUser();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  // currentPassword state removed - not currently used
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setNombre(user.nombre);
      setEmail(user.email);
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!user || !nombre.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await supabase
      .from('users')
      .update({ nombre: nombre.trim() })
      .eq('id', user.id);

    if (error) {
      setProfileMsg({ type: 'error', text: 'Error al actualizar perfil: ' + error.message });
    } else {
      setProfileMsg({ type: 'success', text: 'Perfil actualizado correctamente.' });
    }
    setSavingProfile(false);
  }

  async function handleChangePassword() {
    if (!newPassword.trim() || newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Las contrasenas no coinciden.' });
      return;
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordMsg({ type: 'error', text: 'La contrasena no cumple los requisitos: ' + validation.errors[0] });
      return;
    }

    setSavingPassword(true);
    setPasswordMsg(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordMsg({ type: 'error', text: 'Error al cambiar contrasena: ' + error.message });
    } else {
      setPasswordMsg({ type: 'success', text: 'Contrasena actualizada correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-slate-400">
        No se pudo cargar el perfil del usuario.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
        <p className="text-slate-500 text-sm mt-1">Administra tu informacion personal y seguridad.</p>
      </div>

      {/* Profile overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">
                {user.nombre
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{user.nombre}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={
                    user.role === 'superadmin'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }
                >
                  {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Desde {format(new Date(user.created_at), 'MMMM yyyy', { locale: es })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <User className="h-5 w-5 text-rose-500" />
            Informacion Personal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre completo</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Input value={email} disabled className="bg-slate-50" />
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1">El email no se puede cambiar desde aqui.</p>
          </div>

          {profileMsg && (
            <div
              className={`p-3 rounded-lg border text-sm ${
                profileMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !nombre.trim()}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <KeyRound className="h-5 w-5 text-rose-500" />
            Cambiar Contrasena
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nueva contrasena</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 caracteres, mayuscula, numero, especial"
            />
            <PasswordStrengthIndicator password={newPassword} variant="light" />
          </div>
          <div>
            <Label>Confirmar contrasena</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contrasena"
            />
          </div>

          {passwordMsg && (
            <div
              className={`p-3 rounded-lg border text-sm ${
                passwordMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {passwordMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword.trim()}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {savingPassword ? 'Actualizando...' : 'Cambiar Contrasena'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permissions (read-only) */}
      {user.admin_permisos && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-5 w-5 text-rose-500" />
              Mis Permisos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.role === 'superadmin' ? (
              <p className="text-sm text-purple-600 font-medium">
                Como superadministrador, tienes acceso completo a todas las secciones.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['perm_aduanas', 'Aduanas'],
                  ['perm_administradores', 'Administradores'],
                  ['perm_brokers', 'Brokers'],
                  ['perm_mercancias', 'Mercancias'],
                  ['perm_proyectos', 'Proyectos'],
                ] as [string, string][]).map(([key, label]) => {
                  const hasAccess = (user.admin_permisos as unknown as Record<string, boolean>)?.[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${
                        hasAccess
                          ? 'bg-green-50 border-green-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          hasAccess ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          hasAccess ? 'text-green-700' : 'text-slate-400'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
