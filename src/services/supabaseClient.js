import { createClient } from '@supabase/supabase-js';

/**
 * EL RINCÓN DE LUCI - Supabase Client Interface
 * Handles connection and global communication with the database.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client Error] Missing environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

/**
 * GLOBAL ERROR HANDLER (Helper)
 * Standardizes error responses into human-readable strings.
 */
export const handleSupabaseError = (error, context = 'Database') => {
    if (!error) return null;
    
    const msg = error.message || error.toString() || 'Errore imprevisto nell\'Atelier.';
    console.error(`[${context} Error]:`, msg);
    
    // Friendly translations for common Supabase errors
    if (msg.includes('Invalid login credentials')) return 'Credenziali non valide. Riprova.';
    if (msg.includes('User already registered')) return 'Questo utente fa già parte dell\'Atelier.';
    
    return msg;
};
