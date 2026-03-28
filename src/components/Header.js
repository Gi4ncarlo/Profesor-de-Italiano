import { signOut } from '../services/supabase';
import { toast } from '../components/Toast';
import { getNotifications, markAsRead, subscribeToNotifications, getNotificationContent, clearAllNotifications, cleanupOldNotifications } from '../services/notifications';


/**
 * Standard Header Component with Real-Time Notifications
 */
export const Header = (navigate, user, { onProfile } = {}) => {
    const el = document.createElement('header');
    el.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 4rem 0; margin-bottom: 5rem; border-bottom: 1px solid rgba(0,0,0,0.03);
    `;

    // Dynamic Greeting based on role (Teacher = Benvenuto, Student = Benvenuta)
    const greeting = user.role === 'teacher' ? 'Benvenuto' : 'Benvenuta';
    const teacherName = "Giancarlo"; // Forza il nome richiesto por el usuario

    let notifications = [];

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return "adesso";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} h`;
        const days = Math.floor(hours / 24);
        return `${days} d`;
    };

    const renderNotifications = () => {
        const list = el.querySelector('#notifications-list');
        const badge = el.querySelector('#notif-count');
        const unread = notifications.filter(n => !n.read);
        
        if (badge) {
            badge.innerText = unread.length;
            badge.style.display = unread.length > 0 ? 'flex' : 'none';
        }

        if (list) {
            if (notifications.length === 0) {
                list.innerHTML = '<div class="notification-empty">Tutto tranquillo ✨</div>';
            } else {
                list.innerHTML = notifications.map(n => `
                    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-task="${n.task_id}">
                        <div class="notification-icon">${n.type === 'new_submission' ? '🎭' : '✒️'}</div>
                        <div class="notification-info">
                            <div class="notification-text">${getNotificationContent(n)}</div>
                            <div class="notification-time">${timeAgo(n.created_at)}</div>
                        </div>
                    </div>
                `).join('');

                list.querySelectorAll('.notification-item').forEach(item => {
                    item.onclick = async () => {
                        const id = item.dataset.id;
                        const taskId = item.dataset.task;
                        await markAsRead(id);
                        navigate(`/task/${taskId}`);
                        // Chiudi dropdown
                        el.querySelector('#notif-dropdown').classList.remove('active');
                    };
                });
            }
        }
    };

    const loadNotifications = async () => {
        try {
            const { data } = await getNotifications(user.id);
            notifications = data;
            renderNotifications();
        } catch (e) {
            console.error("Error loading notifications:", e);
        }
    };

    el.innerHTML = `
        <div style="font-family: var(--font-titles); font-size: 2.2rem; cursor:pointer;" id="go-home">
           El Rincón de <span style="color: var(--color-dorado-viejo); font-style: italic;">Luci</span>
        </div>
        
        <div style="display: flex; gap: 3.5rem; align-items: center; font-family: var(--font-ui); font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase;">
            <div style="position: relative;">
                <div class="notification-bell-container" id="notif-bell">
                    <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                    <div class="notification-badge" id="notif-count" style="display:none;">0</div>
                </div>
                
                <div class="notification-dropdown" id="notif-dropdown">
                    <div class="notification-header" style="justify-content: space-between;">
                        <span>Notifiche</span>
                        <div>
                            <span id="clear-all" style="cursor:pointer; margin-right: 1.5rem; text-decoration: underline;">Svuota</span>
                            <span id="close-notif" style="cursor:pointer; font-size: 1.2rem;">×</span>
                        </div>
                    </div>

                    <div class="notification-list" id="notifications-list">
                        <!-- Items dynamically injected -->
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 2rem; align-items: center; opacity: 0.6;">
                <span style="opacity: 0.5;">${greeting}, ${user.role === 'teacher' ? teacherName : user.name}</span>
                <button id="profile-btn" style="background:none; border:none; cursor:pointer; color: var(--color-ink); font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.1em;">Profilo</button>
                <button id="logout-btn" style="background:none; border:none; cursor:pointer; color: var(--color-terracota); font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.1em;">Esci</button>
            </div>
        </div>
    `;

    // Event Listeners
    const bell = el.querySelector('#notif-bell');
    const dropdown = el.querySelector('#notif-dropdown');
    
    bell.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    };

    el.querySelector('#close-notif').onclick = () => dropdown.classList.remove('active');
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notif-dropdown') && !e.target.closest('#notif-bell')) {
            dropdown.classList.remove('active');
        }
    });

    el.querySelector('#profile-btn').onclick = () => {
        if (onProfile) onProfile();
        else toast.show("Configurazione profilo in arrivo... 🏗️");
    };

    el.querySelector('#logout-btn').onclick = async () => {
        try {
            await signOut();
            localStorage.removeItem('luci_user');
            toast.show("Arrivederci! 👋");
            navigate('/login');
        } catch (err) { console.error(err); }
    };

    el.querySelector('#go-home').onclick = () => navigate('/dashboard');

    el.querySelector('#clear-all').onclick = async (e) => {
        e.stopPropagation();
        const { success } = await clearAllNotifications(user.id);
        if (success) {
            notifications = [];
            renderNotifications();
        }
    };

    // Real-Time Subscription & Cleanup
    cleanupOldNotifications();
    loadNotifications();
    const sub = subscribeToNotifications(user.id, (payload) => {
        loadNotifications(); 
    });


    return el;
};
