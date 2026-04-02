import { getStudentTasks } from '../services/tasks';
import { signOut, updateProfile } from '../services/supabase';
import { TaskModal } from '../components/TaskModal';
import { ProfileModal } from '../components/ProfileModal';
import { LoadingSkeleton } from '../components/Loading';
import { toast } from '../components/Toast';
import { getNotifications, markAsRead, subscribeToNotifications, getNotificationContent, clearAllNotifications, cleanupOldNotifications } from '../services/notifications';

const TYPE_TRANSLATIONS = {
    'fill': 'Completare', 'roleplay': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione',
    'dictation': '🎧 Dettato',
    'memory': '🃏 Memoria',
    'speed': '⚡ Velocità'
};

const RANDOM_QUOTES = [
    '"Ogni parola imparata è un passo verso la libertà dell\'anima."',
    '"Chi impara una nuova lingua assume una nuova anima."',
    '"Il limite del mio linguaggio significa il limite del mio mondo."',
    '"Usa la lingua per disegnare il tuo futuro."',
    '"La lingua non è un dono, è uno strumento magico."',
    '"Imparare un\'altra lingua è come possedere una seconda anima."',
    '"Una lingua diversa è una diversa visione della vita."',
    '"Passo dopo passo, parola dopo parola, costruisci il tuo mondo."',
    '"Non aver paura di sbagliare: è lì che nasce l\'apprendimento."',
    '"Il tuo impegno di oggi è la tua voce di domani."',
    '"Ogni piccolo sforzo ti porta più vicino alla meta."',
    '"La curiosità è il motore di ogni scoperta linguistica."',
    '"Parlare una lingua significa immergersi in una nuova cultura."'
];

export const LucianaDashboard = (navigate, user) => {
    const container = document.createElement('div');
    container.className = 'dashboard-container';

    let assignments = [];
    let isLoading = true;
    let currentTab = 'pending'; // 'pending' or 'history'
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
        const list = container.querySelector('#notifications-list');
        const badge = container.querySelector('#notif-count');
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
                        <div class="notification-icon">${n.type === 'new_assignment' ? '🖋️' : '✒️'}</div>
                        <div class="notification-info">
                            <div class="notification-text">${getNotificationContent(n)}</div>
                            <div class="notification-time">${timeAgo(n.created_at)}</div>
                        </div>
                    </div>
                   `).join('');
 
                const dropdown = container.querySelector('#notif-dropdown');
                list.querySelectorAll('.notification-item').forEach(item => {
                    item.onclick = async (e) => {
                        e.stopPropagation();
                        const id = item.dataset.id;
                        const taskId = item.dataset.task;
                        const notif = notifications.find(n => n.id === id);
                        
                        await markAsRead(id);
                        
                        if (notif?.type === 'new_assignment') {
                            const assign = assignments.find(a => a.id === taskId || a.task_id === taskId || a.assignment_id === taskId);
                            if (assign) {
                                taskModal.open(assign);
                                dropdown.classList.remove('active');
                            } else {
                                dropdown.classList.remove('active');
                                toast.show("Apri la lezione dall'Atelier di Oggi ✨");
                            }
                        } else {
                            navigate('/mis-correcciones');
                        }
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

    const taskModal = TaskModal(() => refresh());
    const pModal = ProfileModal(user, async (newName, newAvatar) => {
        try {
            const { data, error } = await updateProfile(user.id, { 
                name: newName, 
                avatar_url: newAvatar || user.avatar_url 
            });
            if (error) throw error;
            
            // Sync local state
            Object.assign(user, data);
            localStorage.setItem('luci_user', JSON.stringify(user));
            render();
            toast.show("Profilo aggiornato! ✨");
        } catch (err) { console.error(err); toast.show("Errore profilo.", "error"); }
    });

    const refresh = async () => {
        isLoading = true; render();
        try {
            const { data, error } = await getStudentTasks(user.id);
            if (error) throw error;
            assignments = data;
        } catch (err) { console.error(err); toast.show("Errore nel caricamento.", "error"); }
        finally { isLoading = false; render(); }
    };

    const render = () => {
        container.innerHTML = '';

        // SIDEBAR
        const sidebar = document.createElement('aside');
        sidebar.className = 'atelier-sidebar';
        sidebar.style.setProperty('--profile-accent', 'var(--color-bordo)');
        sidebar.innerHTML = `
            <div>
                <div class="atelier-sidebar__brand">L'Angolo di <em>Luci</em></div>
                <nav>
                    <button class="sidebar-nav-btn active" id="btn-nav-dashboard">🏠 DASHBOARD</button>
                    <button class="sidebar-nav-btn" id="btn-nav-cuaderno">📓 IL MIO QUADERNO</button>
                </nav>
            </div>
            <div class="sidebar-profile">
                <div class="sidebar-profile__header">
                    <div class="sidebar-profile__avatar">
                        ${user.avatar_url ? '<img src="' + user.avatar_url + '">' : '👤'}
                    </div>
                    <div>
                        <div class="sidebar-profile__name">${user.name}</div>
                        <div class="sidebar-profile__role">STUDENTESSA</div>
                    </div>
                </div>
                <div class="sidebar-profile__divider"></div>
                <div class="sidebar-profile__actions">
                    <button id="btn-settings" class="sidebar-profile__btn">Profilo</button>
                    <button id="btn-logout" class="sidebar-profile__btn sidebar-profile__btn--danger">Esci</button>
                </div>
            </div>
        `;

        // Progress calc
        const getArgDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        const todayStr = getArgDate(new Date());
        const todayAssignments = assignments.filter(a => getArgDate(new Date(a.assigned_at)) === todayStr);
        const completedCount = todayAssignments.filter(s => s.status === 'submitted' || s.status === 'reviewed').length;
        const totalCount = todayAssignments.length;
        const progressVal = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const itDate = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(new Date());
        const shortDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date());
 
        // --- DIRECT OPEN LOGIC ---
        const directId = localStorage.getItem('open_assignment_id');
        if (directId) {
            localStorage.removeItem('open_assignment_id');
            const assign = assignments.find(a => a.id === directId || a.assignment_id === directId);
            if (assign) {
                setTimeout(() => taskModal.open(assign), 300);
            }
        }

        // FILTER LISTS
        const listToShow = currentTab === 'pending' 
            ? assignments.filter(s => s.status !== 'reviewed')
            : assignments.filter(s => s.status === 'reviewed').sort((a,b) => new Date(b.assigned_at) - new Date(a.assigned_at));

        const randomQuote = RANDOM_QUOTES[Math.floor(Math.random() * RANDOM_QUOTES.length)];

        // MAIN
        const main = document.createElement('main');
        main.className = 'luciana-main animate-in';
        main.innerHTML = `
            <div class="luciana-four-deco">4</div>
            <div class="luciana-grid">
                <div>
                    <header class="luciana-header" style="margin-bottom: 5rem; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span class="luciana-date">Oggi è ${itDate}</span>
                            <h1>Benvenuta, ${user.name}. <span class="luciana-lucky-badge">★ 4</span></h1>
                            <p>IL TUO ANGOLO DELL'ITALIANO</p>
                        </div>
                        
                        <div style="position: relative; margin-top: 1rem;">
                            <div class="notification-bell-container" id="notif-bell" style="background: white; border-radius: 50%; width: 4.5rem; height: 4.5rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); cursor: pointer;">
                                <svg style="width: 2.2rem; height: 2.2rem; fill: var(--color-ink); opacity: 0.7;" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                                <div class="notification-badge" id="notif-count" style="display:none; position: absolute; top: -0.2rem; right: -0.2rem; background: var(--color-bordo); color: white; min-width: 1.8rem; height: 1.8rem; padding: 0 0.5rem; border-radius: 50%; font-size: 0.75rem; align-items: center; justify-content: center; border: 2px solid white; font-weight: 900;">0</div>
                            </div>
                            
                            <div class="notification-dropdown" id="notif-dropdown" style="top: 120%; right: 0;">
                                <div class="notification-header">
                                    <span>Notifiche</span>
                                    <span id="clear-all" style="cursor:pointer; text-decoration: underline; font-size: 0.7rem; opacity: 0.6;">Svuota tutto</span>
                                </div>
                                <div class="notification-list" id="notifications-list"></div>
                            </div>
                        </div>
                    </header>
                    
                    <div class="luciana-tabs">
                        <button class="luciana-tab ${currentTab === 'pending' ? 'active' : ''}" id="tab-pending">Lezioni di Oggi</button>
                        <button class="luciana-tab ${currentTab === 'history' ? 'active' : ''}" id="tab-history">Registro Storico</button>
                    </div>

                    <section>
                        <h3 class="luciana-section-title">
                            ${currentTab === 'pending' ? 'Lezioni in sospeso' : 'Fogli Completati'}
                        </h3>
                        <div id="tasks-list" style="display: flex; flex-direction: column; gap: 1.5rem;"></div>
                    </section>
                </div>
                <div class="luciana-progress-wrap">
                    <div class="luciana-ring">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#F4EFE6" stroke-width="6" />
                            <circle class="ring-progress-circle" cx="50" cy="50" r="45" fill="none" stroke="var(--color-bordo)" stroke-width="6"
                                stroke-dasharray="282.7" stroke-dashoffset="282.7"
                                style="transition: stroke-dashoffset 1.2s cubic-bezier(0.165, 0.84, 0.44, 1);" stroke-linecap="round" />
                        </svg>
                        <div class="luciana-ring__label">
                            <span class="luciana-ring__value">${progressVal}%</span>
                            <span class="luciana-ring__unit" style="font-weight: 950; opacity: 0.7; color: var(--color-ink);">ATTIVITÀ DI OGGI</span>
                            <span class="luciana-ring__unit" style="font-size: 0.95rem; margin-top: 0.3rem; opacity: 0.5; color: var(--color-ink);">${shortDate.toUpperCase()}</span>
                        </div>
                    </div>

                        <div class="luciana-quote">
                            <p>${randomQuote}</p>
                        </div>
                </div>
            </div>
        `;

        // Task list
        const tList = main.querySelector('#tasks-list');
        if (isLoading) {
            tList.appendChild(LoadingSkeleton(4));
        } else if (listToShow.length === 0) {
            tList.innerHTML = `<div style="padding: 6rem 2rem; text-align: center; font-family: var(--font-handwritten); font-size: 1.8rem; opacity: 0.2;">${currentTab === 'pending' ? 'Il tavolo è pulito... per ora. 🏛️' : 'Nessuna impronta nel passato.'}</div>`;
        } else {
            listToShow.forEach((a, i) => {
                const card = document.createElement('div');
                card.className = 'luciana-task-card';
                card.style.animationDelay = `${i * 0.08}s`;
                let sClass = 'luciana-badge--pending', sText = 'Pendente';
                if (a.status === 'submitted') { sClass = 'luciana-badge--submitted'; sText = 'Consegnato'; }
                if (a.status === 'reviewed') { sClass = 'luciana-badge--reviewed'; sText = 'Visto'; }
                card.innerHTML = `
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 0.8rem;">
                            <span style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.65; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-ink);">${TYPE_TRANSLATIONS[a.type] || a.type}</span>
                            <span class="luciana-badge ${sClass}" style="font-weight: 950; letter-spacing: 0.1em;">${sText}</span>
                        </div>
                        <h4 style="font-family: var(--font-titles); font-size: 1.85rem; margin: 0; font-weight: 600; color: var(--color-ink);">${a.title}</h4>
                    </div>
                    <div style="font-family: var(--font-ui); font-size: 1.25rem; opacity: 0.65; font-weight: 850; color: var(--color-ink);">${new Date(a.assigned_at).toLocaleDateString('it-IT')}</div>
                `;
                card.onclick = () => taskModal.open(a);
                tList.appendChild(card);
            });
        }

        // TABS Events
        main.querySelector('#tab-pending').onclick = () => { currentTab = 'pending'; render(); };
        main.querySelector('#tab-history').onclick = () => { currentTab = 'history'; render(); };
        
        // General Events
        sidebar.querySelector('#btn-nav-dashboard').onclick = () => render();
        sidebar.querySelector('#btn-nav-cuaderno').onclick = () => navigate('/mis-correcciones');
        sidebar.querySelector('#btn-logout').onclick = async () => { await signOut(); localStorage.removeItem('luci_user'); navigate('/login'); };
        sidebar.querySelector('#btn-settings').onclick = () => pModal.open(user);


        container.appendChild(sidebar);
        container.appendChild(main);

        // Event Listeners for Notifications
        const bell = main.querySelector('#notif-bell');
        const dropdown = main.querySelector('#notif-dropdown');
        if (bell && dropdown) {
            bell.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            };
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#notif-dropdown') && !e.target.closest('#notif-bell')) {
                    dropdown.classList.remove('active');
                }
            });
        }

        const clearBtn = main.querySelector('#clear-all');
        if (clearBtn) {
            clearBtn.onclick = async (e) => {
                e.stopPropagation();
                const { success } = await clearAllNotifications(user.id);
                if (success) {
                    notifications = [];
                    renderNotifications();
                }
            };
        }

        // Subscriptions
        cleanupOldNotifications();
        loadNotifications();
        const sub = subscribeToNotifications(user.id, () => {
            loadNotifications();
        });
        
        // Trigger animation
        setTimeout(() => {
            const circle = main.querySelector('.ring-progress-circle');
            if (circle) circle.style.strokeDashoffset = 282.7 - (282.7 * progressVal) / 100;
        }, 50);

        if (!document.body.contains(taskModal.overlay)) document.body.appendChild(taskModal.overlay);
        if (!document.body.contains(pModal.overlay)) document.body.appendChild(pModal.overlay);
        if (!document.getElementById('cuaderno-styles')) {
            const style = document.createElement('style');
            style.id = 'cuaderno-styles';
            style.innerHTML = `
                .luciana-cuaderno-card {
                    background: var(--glass);
                    border: 1.5px solid rgba(107, 16, 36, 0.15);
                    border-radius: 2.2rem;
                    padding: 2.5rem 2rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    margin-top: 2rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.03);
                    position: relative;
                    overflow: hidden;
                }
                .luciana-cuaderno-card::after {
                    content: ''; position: absolute; bottom: 0; left: 0; 
                    width: 100%; height: 3px; background: var(--color-bordo);
                    transform: scaleX(0); transition: transform 0.4s ease;
                }
                .luciana-cuaderno-card:hover {
                    box-shadow: 0 15px 45px rgba(107, 16, 36, 0.12);
                    transform: translateY(-5px);
                    background: white;
                    border-color: var(--color-bordo);
                }
                .luciana-cuaderno-card:hover::after {
                    transform: scaleX(1);
                }
            `;
            document.head.appendChild(style);
        }
    };

    refresh();
    return container;
};
