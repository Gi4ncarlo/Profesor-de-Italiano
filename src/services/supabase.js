import { supabase, handleSupabaseError } from './supabaseClient';
export { supabase, handleSupabaseError };

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
/**
 * Deep delete/reset of student data.
 * Cleans up all dependencies in order to avoid foreign key violations.
 */
export const deleteStudentData = async (studentId) => {
    try {
        console.log("Inizio pulizia profonda per allievo:", studentId);
        
        // 1. Notifications for this student
        await supabase.from('notifications').delete().eq('recipient_id', studentId);
        
        // 2. We need to find all assignments to find associated submissions, feedback, AND the tasks themselves
        const { data: assignments } = await supabase
            .from('task_assignments')
            .select('id, task_id')
            .eq('student_id', studentId);
            
        if (assignments && assignments.length > 0) {
            const assignmentIds = assignments.map(a => a.id);
            const taskIds = assignments.map(a => a.task_id);
            
            // 3. Find submissions for these assignments
            const { data: submissions } = await supabase
                .from('submissions')
                .select('id')
                .in('assignment_id', assignmentIds);
                
            if (submissions && submissions.length > 0) {
                const subIds = submissions.map(s => s.id);
                // 4. Delete feedback (deepest level)
                await supabase.from('feedback').delete().in('submission_id', subIds);
                // 5. Delete submissions
                await supabase.from('submissions').delete().in('id', subIds);
            }
            
            // 6. Delete assignments
            await supabase.from('task_assignments').delete().in('id', assignmentIds);

            // 7. Delete Tasks (since they are 1-to-1 in this app, they become orphans otherwise)
            if (taskIds.length > 0) {
                await supabase.from('tasks').delete().in('id', taskIds);
            }
        }

        // 8. Finally, attempt to delete the profile record
        const { error } = await supabase.from('profiles').delete().eq('id', studentId);
        if (error) {
            console.warn("Potenziale blocco RLS per eliminazione. Modifico il profilo per nasconderlo:", error);
            // Hide the profile so it doesn't show up in the UI queries
            await supabase.from('profiles').update({
                name: 'Allievo Ritirato',
                role: 'deleted_student',
                avatar_url: null
            }).eq('id', studentId);
        }

        return { success: true, error: null };
    } catch (err) {
        console.error("Errore critico durante deep cleaning:", err);
        return { success: false, error: handleSupabaseError(err, 'DeleteStudentData') };
    }
};
