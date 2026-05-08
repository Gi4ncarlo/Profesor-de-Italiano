import { supabase, handleSupabaseError } from './supabaseClient';
import { createNotification } from './notifications';

export const createConsultation = async ({ studentId, teacherId, requestedDatetime, topic }) => {
    try {
        const { data, error } = await supabase
            .from('consultations')
            .insert([{
                student_id: studentId,
                teacher_id: teacherId,
                requested_datetime: requestedDatetime,
                topic: topic
            }])
            .select()
            .single();

        if (error) throw error;
        
        // Notify Teacher
        if (teacherId) {
            await createNotification({
                recipientId: teacherId,
                type: 'new_consultation_request'
            });
        }

        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'CreateConsultation') };
    }
};

export const getStudentConsultations = async (studentId) => {
    try {
        const { data, error } = await supabase
            .from('consultations')
            .select('*, profiles!consultations_teacher_id_fkey(name, avatar_url)')
            .eq('student_id', studentId)
            .order('requested_datetime', { ascending: true });

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetStudentConsultations') };
    }
};

export const getTeacherConsultations = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const { data, error } = await supabase
            .from('consultations')
            .select('*, profiles!consultations_student_id_fkey(name, avatar_url)')
            // If the user is the only teacher, we just fetch all, but filtering by teacher_id is safer if assigned
            .order('requested_datetime', { ascending: true });

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetTeacherConsultations') };
    }
};

export const updateConsultationStatus = async (id, status, studentId) => {
    try {
        const { data, error } = await supabase
            .from('consultations')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify student if accepted or rejected
        if (studentId) {
            await createNotification({
                recipientId: studentId,
                type: status === 'accepted' ? 'consultation_accepted' : 'consultation_rejected'
            });
        }

        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'UpdateConsultationStatus') };
    }
};
