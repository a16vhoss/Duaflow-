import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from('users')
    .select('role, activo')
    .eq('id', data.user.id)
    .single();

  if (!profile) throw new Error('Usuario no encontrado');
  if (!profile.activo) {
    await supabase.auth.signOut();
    throw new Error('Cuenta desactivada');
  }

  return { user: data.user, role: profile.role };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
