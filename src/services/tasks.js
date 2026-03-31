import { supabase, handleSupabaseError } from './supabaseClient';
import { createNotification } from './notifications';


/**
 * TASK SERVICES - EL ATELIER DE LUCI
 * Centralized core logic for Educational Tasks and Student Assignments.
 */

/**
 * 1. Creates a new task and assigns it to a specific student.
 * @param {Object} - { title, type, content, studentId }
 */
export const createTaskWithAssignment = async ({ title, type, content, studentId }) => {
    try {
        // A. Get Current User (Teacher)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato.");

        // B. Insert Task
        const { data: task, error: taskErr } = await supabase
            .from('tasks')
            .insert({
                title,
                type,
                content,
                created_by: user.id
            })
            .select().single();

        if (taskErr) throw taskErr;

        // C. Create Assignment
        const { data: assign, error: assignErr } = await supabase
            .from('task_assignments')
            .insert({
                task_id: task.id,
                student_id: studentId
            })
            .select().single();

        if (assignErr) throw assignErr;
        
        // D. Create Notification for Student
        try {
            await createNotification({
                recipientId: studentId,
                type: 'new_assignment',
                taskId: task.id
            });
        } catch (nErr) {
            console.warn("Notification not created:", nErr);
        }

        return { data: { ...task, assignment: assign }, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'CreateTask') };
    }
};

/**
 * 2. Fetches all tasks created by the current teacher.
 */
export const getTeacherTasks = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato.");

        const { data, error } = await supabase
            .from('tasks')
            .select(`
                *,
                task_assignments (
                    id,
                    submissions (
                        id,
                        answers,
                        status,
                        feedback (
                            id,
                            comment
                        )
                    )
                )
            `)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Auto-cleanup per attività orfane (senza assegnazioni dovute all'eliminazione dell'alunno)
        const validTasks = [];
        const orphanIds = [];
        
        (data || []).forEach(task => {
            if (!task.task_assignments || task.task_assignments.length === 0) {
                orphanIds.push(task.id);
            } else {
                validTasks.push(task);
            }
        });

        // Elimina in background i task rimasti senza allievo
        if (orphanIds.length > 0) {
            supabase.from('tasks').delete().in('id', orphanIds).then(() => {
                console.log(`Pulizia: eliminati ${orphanIds.length} task orfani.`);
            }).catch(e => console.error("Errore pulizia:", e));
        }

        return { data: validTasks, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetTeacherTasks') };
    }
};

/**
 * 3. Fetches assignments for the current student (Luci).
 */
export const getStudentTasks = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato.");

        const { data, error } = await supabase
            .from('task_assignments')
            .select(`
                id,
                assigned_at,
                tasks (*),
                submissions (
                    id,
                    answers,
                    status,
                    created_at,
                    feedback (*)
                )
            `)
            .eq('student_id', user.id)
            .order('assigned_at', { ascending: false });

        if (error) throw error;
        
        // Calculate status for each assignment
        const assignments = data.map(item => {
            const subs = item.submissions || [];
            let status = 'pending';
            let feedback = null;
            let answers = null;

            if (subs.length > 0) {
                // Get latest sub
                const latest = subs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
                const hasFeedback = latest.feedback && latest.feedback.length > 0;
                status = (latest.status === 'reviewed' || hasFeedback) ? 'reviewed' : latest.status;
                feedback = latest.feedback;
                answers = latest.answers;
            }

            return { 
                ...item.tasks, 
                assignment_id: item.id, 
                assigned_at: item.assigned_at,
                status, 
                feedback,
                answers,
                submitted_at: subs[0]?.created_at || null 
            };
        });

        return { data: assignments, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetStudentTasks') };
    }
};

/**
 * 4. Retrieves core task info by ID.
 */
export const getTaskById = async (taskId) => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'GetTaskById') };
    }
};

/**
 * 5. Completes a task assignment by inserting or updating a student's submission.
 * @param {string} assignmentId
 * @param {any} answers
 */
export const completeTask = async (assignmentId, answers) => {
    try {
        // A. Check for existing draft
        const { data: existingDraft } = await supabase
            .from('submissions')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('status', 'draft')
            .maybeSingle();

        let data, error;

        if (existingDraft) {
            // Update draft to submitted
            const res = await supabase
                .from('submissions')
                .update({
                    answers: answers,
                    status: 'submitted',
                    created_at: new Date().toISOString()
                })
                .eq('id', existingDraft.id)
                .select().single();
            data = res.data;
            error = res.error;
        } else {
            // Insert new submission
            const res = await supabase
                .from('submissions')
                .insert({
                    assignment_id: assignmentId,
                    answers: answers,
                    status: 'submitted'
                })
                .select().single();
            data = res.data;
            error = res.error;
        }

        if (error) throw error;

        // B. Generate Notification for Giancarlo (Teacher)
        const { data: assignment, error: nodeErr } = await supabase
            .from('task_assignments')
            .select(`
                task_id,
                tasks (created_by)
            `)
            .eq('id', assignmentId)
            .single();

        if (!nodeErr && assignment) {
            await createNotification({
                recipientId: assignment.tasks.created_by,
                type: 'new_submission',
                taskId: assignment.task_id
            });
        }

        return { data, error: null };
    } catch (err) {
        return { data: null, error: handleSupabaseError(err, 'CompleteTask') };
    }
};
/**
 * 6. Deletes a task and all its dependencies.
 * @param {string} taskId
 */
export const deleteTask = async (taskId) => {
    try {
        console.log("Inizio eliminazione profonda per task:", taskId);
        
        // 1. Recupero tutte las assegnazioni
        const { data: assignments } = await supabase.from('task_assignments').select('id').eq('task_id', taskId);
        
        if (assignments && assignments.length > 0) {
            const assignmentIds = assignments.map(a => a.id);
            
            // 2. Recupero todas las entregas (submissions)
            const { data: submissions } = await supabase.from('submissions').select('id').in('assignment_id', assignmentIds);
            
            if (submissions && submissions.length > 0) {
                const subIds = submissions.map(s => s.id);
                // 3. Elimino Feedback (el eslabón más profundo)
                await supabase.from('feedback').delete().in('submission_id', subIds);
                // 4. Elimino Submissions
                await supabase.from('submissions').delete().in('id', subIds);
            }
            
            // 5. Elimino Asignaciones
            await supabase.from('task_assignments').delete().in('id', assignmentIds);
        }

        // 6. Finalmente elimino la tarea original
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        
        console.log("Eliminazione completata con successo.");
        return { data: true, error: null };
    } catch (err) {
        console.error("Errore critico durante deleteTask:", err);
        return { data: null, error: handleSupabaseError(err, 'DeleteTask') };
    }
};
