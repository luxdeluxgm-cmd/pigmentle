import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function initAuth(onUserChange: (user: User | null) => void): Promise<void> {
  if (!supabase) {
    onUserChange(null);
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    onUserChange(sessionData.session.user);
  } else {
    const { data: anonData } = await supabase.auth.signInAnonymously();
    onUserChange(anonData.user ?? null);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    onUserChange(session?.user ?? null);
  });
}

export async function linkGoogleAccount(): Promise<string | null> {
  if (!supabase) return 'Database is not connected yet.';
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return error ? error.message : null;
}

export async function signInWithGoogle(): Promise<string | null> {
  if (!supabase) return 'Database is not connected yet.';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return error ? error.message : null;
}

export async function deleteAccountAndData(): Promise<string | null> {
  if (supabase) {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return error.message;
    await supabase.auth.signOut();
  }
  localStorage.removeItem('subtra_state');
  localStorage.removeItem('subtra_stats');
  localStorage.removeItem('subtra_theme');
  return null;
}
