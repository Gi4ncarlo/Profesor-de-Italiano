import { supabase, handleSupabaseError } from './supabaseClient';

/**
 * SUBMISSION SERVICES - IL REGISTRO DI LUCI
 * Handling student responses and assignment delivery.
 */

/**
 * 1. Submits a student's answer for a specific assignment.
 * @param {Object} - { assignmentId, answers (JSON), status (default submitted) }
 */
export const submitTask = async ({ assignmentId, answers, status = 'submitted' }) => {
    try {
        const { data, error } = await supabase
            .from('submissions')
            .insert({
                assignment_id: assignmentId,
                answers: answers,
                status: status
            })
            .select().single();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'SubmitTask') };
    }
};

/**
 * 2. Fetches the draft for a specific assignment if it exists.
 * @param {string} assignmentId 
 */
export const getDraft = async (assignmentId) => {
    try {
        const { data, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('assignment_id', assignmentId)
            .eq('status', 'draft')
            .maybeSingle();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetDraft') };
    }
};

/**
 * 3. Saves or updates a draft for an assignment.
 * @param {Object} - { assignmentId, answers } 
 */
export const saveDraft = async ({ assignmentId, answers }) => {
    try {
        // First, check if a draft already exists
        const { data: existing, error: findError } = await getDraft(assignmentId);
        
        if (findError) throw findError;

        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('submissions')
                .update({ answers: answers, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select().single();
            if (error) throw error;
            return { data, error: null };
        } else {
            // Insert
            const { data, error } = await supabase
                .from('submissions')
                .insert({
                    assignment_id: assignmentId,
                    answers: answers,
                    status: 'draft'
                })
                .select().single();
            if (error) throw error;
            return { data, error: null };
        }
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'SaveDraft') };
    }
};

/**
 * 4. Fetches all submissions across assignments for a specific task.
 * Useful for the Teacher's detailed view.
 * @param {string} taskId
 */
export const getSubmissionsByTask = async (taskId) => {
    try {
        const { data, error } = await supabase
            .from('task_assignments')
            .select(`
                id,
                student:student_id (name),
                submissions (
                    id,
                    answers,
                    created_at,
                    feedback (
                        id,
                        comment,
                        created_at
                    )
                )
            `)
            .eq('task_id', taskId);

        if (error) throw error;

        // Flatten assignments to a pure list of submissions
        const res = [];
        data.forEach(assignment => {
            const submissionsArr = assignment.submissions || [];
            submissionsArr.forEach(sub => {
                res.push({
                    ...sub,
                    student: assignment.student, // This should be { name: "..." } or null
                    assignment_id: assignment.id
                });
            });
        });

        // Ensure consistency with teacher dashboard views
        const formatted = res.map(sub => ({
            ...sub,
            profiles: sub.student, // Mapping for TaskDetails.js compatibility
            content: sub.answers 
        }));

        return { data: formatted.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetSubmissionsByTask') };
    }
};

/**
 * 3. Retrieves the submission for a single pinpoint assignment.
 * @param {string} assignmentId
 */
export const getSubmissionByAssignment = async (assignmentId) => {
    try {
        const { data, error } = await supabase
            .from('submissions')
            .select(`
                *,
                feedback (*)
            `)
            .eq('assignment_id', assignmentId)
            .maybeSingle();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetSubmissionByAssignment') };
    }
};

/**
 * 5. Retrieves all reviewed submissions for a student.
 * @param {string} studentId
 */
export const getStudentCorrections = async (studentId) => {
    try {
        const { data, error } = await supabase
            .from('task_assignments')
            .select(`
                id,
                tasks (*),
                submissions!inner (
                    *,
                    feedback (*)
                )
            `)
            .eq('student_id', studentId)
            .eq('submissions.status', 'reviewed');

        if (error) throw error;
        
        // Flatten into a clean list of corrections
        const result = data.map(item => ({
            ...item.submissions[0],
            task: item.tasks,
            assignment_id: item.id
        }));

        // Sort by feedback date descending
        result.sort((a,b) => {
            const dateA = a.feedback?.[0]?.created_at || a.created_at;
            const dateB = b.feedback?.[0]?.created_at || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });

        return { data: result, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetStudentCorrections') };
    }
};
