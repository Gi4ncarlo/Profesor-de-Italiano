import { supabase, handleSupabaseError } from './supabaseClient';
import { createNotification } from './notifications';


/**
 * FEEDBACK SERVICES - IL TOCCO DEL MAESTRO
 * Managing teacher evaluations and student reviews.
 */

/**
 * 1. Creates a new feedback entry for a student submission.
 * @param {Object} - { submissionId, comment }
 */
export const addFeedback = async ({ submissionId, comment }) => {
    try {
        // A. Get Teacher Profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato.");

        // B. Insert Feedback
        const { data, error } = await supabase
            .from('feedback')
            .insert({
                submission_id: submissionId,
                teacher_id: user.id,
                comment: comment
            })
            .select().single();

        if (error) throw error;
        
        // C. Update submission status to 'reviewed'
        await supabase.from('submissions').update({ status: 'reviewed' }).eq('id', submissionId);

        // D. Generate Notification for Luciana (Student)
        // Find recipient from submission record
        const { data: sub, error: subErr } = await supabase
            .from('submissions')
            .select(`
                task_assignments (
                    student_id,
                    task_id
                )
            `)
            .eq('id', submissionId)
            .single();

        if (!subErr && sub && sub.task_assignments) {
            await createNotification({
                recipientId: sub.task_assignments.student_id,
                type: 'new_feedback',
                taskId: sub.task_assignments.task_id
            });
        }

        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'AddFeedback') };
    }
};

/**
 * 2. Retrieves all feedback associated with a specific submission.
 * @param {string} submissionId
 */
export const getFeedbackBySubmission = async (submissionId) => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('submission_id', submissionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetFeedbackBySubmission') };
    }
};
