import { supabase, handleSupabaseError } from './supabaseClient';

/**
 * NOTIFICATION SERVICES - IL CAMPANELLO DELL'ATELIER
 * Managing real-time alerts for Luciana and Giancarlo.
 */

/**
 * 1. Fetches all notifications for a specific recipient.
 * @param {string} recipientId 
 */
export const getNotifications = async (recipientId) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select(`
                *,
                task:task_id (id, title)
            `)
            .eq('recipient_id', recipientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err) {
        return { data: [], error: handleSupabaseError(err, 'GetNotifications') };
    }
};

/**
 * 2. Marks a notification as read.
 * @param {string} id 
 */
export const markAsRead = async (id) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
        
        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: handleSupabaseError(err, 'MarkAsRead') };
    }
};

/**
 * 3. Deletes a specific notification.
 * @param {string} id 
 */
export const deleteNotification = async (id) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: handleSupabaseError(err, 'DeleteNotification') };
    }
};

/**
 * 4. Deletes all notifications for a recipient.
 * @param {string} recipientId 
 */
export const clearAllNotifications = async (recipientId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('recipient_id', recipientId);
        
        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: handleSupabaseError(err, 'ClearAllNotifications') };
    }
};

/**
 * 5. Deletes notifications older than 15 days.
 */
export const cleanupOldNotifications = async () => {
    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        
        const { error } = await supabase
            .from('notifications')
            .delete()
            .lt('created_at', fifteenDaysAgo.toISOString());
            
        if (error) throw error;
    } catch (err) {
        console.error("[Silent Cleanup Error]:", err);
    }
};

/**
 * 6. Creates a new notification entry.
 * @param {Object} - { recipientId, type, taskId }
 */
export const createNotification = async ({ recipientId, type, taskId }) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                recipient_id: recipientId,
                type,
                task_id: taskId,
                read: false
            })
            .select().single();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        // We log it but usually don't want to block the main action if notification fails
        console.error("[Silent Notification Error]:", err);
        return { data: null, error: err.message };
    }
};

/**
 * 5. Real-time subscription to notifications.
 * @param {string} userId 
 * @param {Function} onNewNotification 
 */
export const subscribeToNotifications = (userId, onNewNotification) => {
    return supabase
        .channel(`notifications:user:${userId}`)
        .on(
            'postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'notifications', 
                filter: `recipient_id=eq.${userId}` 
            }, 
            (payload) => {
                onNewNotification(payload);
            }
        )
        .subscribe();
};

/**
 * Helper to get descriptive text based on type
 */
export const getNotificationContent = (notif) => {
    const taskTitle = notif.task?.title || 'una tarea';
    switch (notif.type) {
        case 'new_submission':
            return `Luciana ha entregado: "${taskTitle}"`;
        case 'new_feedback':
            return `Giancarlo ha corregido: "${taskTitle}"`;
        default:
            return `Nueva actualización en "${taskTitle}"`;
    }
};
