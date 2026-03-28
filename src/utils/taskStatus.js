/**
 * EL RINCÓN DE LUCI - Task Status Engine
 * Centralized logic to calculate pedagogical progress.
 */

export const getTaskStatus = ({ submission, feedback }) => {
    // 1. PENDING (No work done yet)
    if (!submission) {
        return {
            status: 'pending',
            label: 'Da fare ✏️',
            color: '#E6B905', // Golden Yellow
            theme: 'warning'
        };
    }

    // 2. TO REVIEW (Student sent it, Teacher hasn't corrected yet)
    const hasFeedback = feedback && (Array.isArray(feedback) ? feedback.length > 0 : !!feedback);
    
    if (!hasFeedback) {
        return {
            status: 'to_review',
            label: 'Inviato ✉️',
            color: '#A64D32', // Terracota
            theme: 'accent'
        };
    }

    // 3. COMPLETED (Feedback given)
    return {
        status: 'completed',
        label: 'Fatto ✨',
        color: '#2D5A27', // Dark Forest Green
        theme: 'success'
    };
};

/**
 * Helper to get status directly from a student assignment object
 */
export const getAssignmentStatus = (assignment) => {
    const latestSubmission = assignment.submissions?.[0]; // Assumes sorted by latest
    const latestFeedback = latestSubmission?.feedback?.[0];

    return getTaskStatus({ 
        submission: latestSubmission, 
        feedback: latestFeedback 
    });
};
