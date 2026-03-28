import { supabase, handleSupabaseError } from './supabaseClient';

/**
 * AUTH SERVICES - IL CANCELLO DELL'ATELIER
 * Managing user access and identity in a standardized way.
 */

export const signIn = async (email, password) => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'SignIn') };
    }
};

export const signUp = async (email, password, name) => {
    try {
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: { 
                data: { name } 
            }
        });
        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'SignUp') };
    }
};

export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { data: true, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'SignOut') };
    }
};

export const getSession = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return { data: session, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetSession') };
    }
};

export const getProfile = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetProfile') };
    }
};
export const updateProfile = async (userId, updates) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select();
        if (error) throw error;
        // Return the first row updated (or fall back to updates object)
        return { data: (data && data[0]) || updates, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'UpdateProfile') };
    }
};
